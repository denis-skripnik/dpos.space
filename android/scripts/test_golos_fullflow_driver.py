#!/usr/bin/env python3
"""Offline harness regressions. Fake ADB is explicitly NOT Android execution.

Uses only temporary files and a host loopback echo socket; no namespace, firewall,
emulator, DNS, external network, user settings or real app data changes.
"""
import contextlib

import io
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import golos_fullflow_containment as containment
import run_golos_fullflow_android as driver


def completed(data=b'', code=0):
    return subprocess.CompletedProcess([], code, data)


def valid_state():
    return dict(namespace='net:[200]', initial_interfaces=['lo','eth0'], emulator_namespace='net:[200]',
                driver_caps=0, emulator_caps=0, emulator_exe='qemu-system-x86_64',
                links=[{'ifname':'lo','flags':['UP','LOOPBACK']}],
                routes=[{'type':'local','dev':'lo'}], console_owned=True)


class ContainmentTests(unittest.TestCase):
    def test_live_read_only_host_namespace_rejected_without_adb(self):
        if len(Path('/proc/self/net/dev').read_text().splitlines()) == 3:
            self.skipTest('already running with loopback only')
        with self.assertRaisesRegex(ValueError,'initial/host'):
            containment.topology(os.getpid(),'emulator-5554')

    def test_only_loopback_topology_admitted(self):
        self.assertEqual(valid_state(), containment.validate_topology(valid_state()))

    def test_host_wrong_namespace_uplink_routes_caps_and_wrong_pid_fail_closed(self):
        cases = [dict(initial_interfaces=['lo']), dict(emulator_namespace='net:[300]'),
                 dict(links=[{'ifname':'lo','flags':['UP']},{'ifname':'eth0','flags':['UP']}]),
                 dict(routes=[{'dev':'eth0','type':'unicast'}]), dict(console_owned=False),
                 dict(emulator_caps=1), dict(driver_caps=1), dict(emulator_exe='python3'),
                 dict(links=[{'ifname':'lo','flags':[]}])]
        for delta in cases:
            with self.subTest(delta=delta), self.assertRaises(ValueError):
                containment.validate_topology({**valid_state(), **delta})

    def test_no_external_probe_before_topology_admission(self):
        with patch.object(containment,'topology',side_effect=ValueError('uplink')), patch.object(containment,'verify_canaries') as probe:
            with self.assertRaises(ValueError): containment.verify_containment(42,'emulator-5554',None)
            probe.assert_not_called()

    def fake_canary_adb(self, external_connected=False, broken_loopback=False, malformed=False, early_eof=False):
        calls=[]
        def adb(*args):
            calls.append(args)
            if args[0]=='reverse': return completed()
            command=args[1]
            if 'printf "golos_' in command:
                if early_eof and '; sleep 1; }' not in command:
                    with socket.create_connection(('127.0.0.1',int(command.split()[-1])),timeout=3):
                        pass
                    return completed()
                if broken_loopback:
                    # Wake the local server but supply wrong nonce (no timeout delay).
                    nonce='wrong'
                else: nonce=re.search(r'printf "(golos_[a-f0-9]+)',command)[1]
                port=int(command.split()[-1])
                with socket.create_connection(('127.0.0.1',port),timeout=3) as conn:
                    conn.sendall((nonce+'\n').encode()); data=conn.recv(256)
                return completed(data)
            return completed(b'not-a-receipt' if malformed else b'\nGOLOS_CANARY:0\n' if external_connected
                             else b'nc: connect: Network is unreachable\nGOLOS_CANARY:1\n')
        return adb,calls

    def test_positive_nonce_survives_observed_android_early_stdin_eof(self):
        adb,calls=self.fake_canary_adb(early_eof=True)
        proof=containment.verify_canaries(adb)
        self.assertTrue(proof['emulator_loopback_and_private_adb'])
        self.assertEqual(2,len(proof['external_tcp_canaries']))

    def test_canary_success_is_denial_not_connectivity(self):
        adb,calls=self.fake_canary_adb()
        proof=containment.verify_canaries(adb)
        self.assertEqual(2,len(proof['external_tcp_canaries']))
        self.assertFalse(proof['application_requests_sent'])
        self.assertEqual('reverse',calls[-3][0])  # exact mapping removed before TCP negatives
        self.assertEqual('--remove',calls[-3][1])

    def test_external_connectivity_and_malformed_receipt_rejected(self):
        for options in ({'external_connected':True},{'malformed':True}):
            with self.subTest(options=options), self.assertRaises(ValueError):
                containment.verify_canaries(self.fake_canary_adb(**options)[0])

    def test_good_positive_then_shell_failure_rejected_for_either_family(self):
        for address in ('1.1.1.1', '2606:4700:4700::1111'):
            for status in (126, 127, 137):
                with self.subTest(address=address, status=status):
                    adb, calls = self.fake_canary_adb()
                    def broken(*args):
                        if args[0] == 'shell' and address in args[1]:
                            calls.append(args)
                            return completed(f'GOLOS_CANARY:{status}'.encode())
                        return adb(*args)
                    with self.assertRaises(ValueError):
                        containment.verify_canaries(broken)
                    self.assertTrue(any(c[0] == 'reverse' and c[1] == '--remove' for c in calls))

    def test_only_explicit_connect_failures_accepted_after_good_positive(self):
        for reason, classification in [('Network is unreachable', 'network_unreachable'),
                                       ('No route to host', 'host_unreachable'),
                                       ('Connection refused', 'connection_refused')]:
            adb, calls = self.fake_canary_adb()
            def denied(*args):
                if args[0] == 'shell' and ' 443 ' in args[1]:
                    return completed(f'nc: connect: {reason}\nGOLOS_CANARY:1\n'.encode())
                return adb(*args)
            proof = containment.verify_canaries(denied)
            self.assertTrue(proof['emulator_loopback_and_private_adb'])
            self.assertEqual([classification] * 2,
                             [r['failure_class'] for r in proof['external_tcp_canaries']])

    def test_tool_signal_timeout_adb_and_malformed_fail_closed_after_good_positive(self):
        valid = b'nc: connect: Connection refused\nGOLOS_CANARY:1\n'
        outcomes = [completed(b'nc: connect: Connection refused\nGOLOS_CANARY:%d\n' % n)
                    for n in (0, 2, 124, 126, 127, 128, 137, 255, 256, -9)]
        outcomes += [completed(b'GOLOS_CANARY:1\n'), completed(b'nc: Timeout\nGOLOS_CANARY:1\n'),
                     completed(b'nc: socket: Permission denied\nGOLOS_CANARY:1\n'),
                     completed(valid + valid), completed(valid + b'junk'), completed(b'\xff'),
                     completed(valid, 1), completed(valid, -9), completed(valid, 137),
                     subprocess.CompletedProcess([], 0, valid, b'error: device offline'),
                     subprocess.TimeoutExpired('adb', 2), FileNotFoundError('adb')]
        for address in ('1.1.1.1', '2606:4700:4700::1111'):
            for outcome in outcomes:
                with self.subTest(address=address, outcome=outcome):
                    adb, calls = self.fake_canary_adb()
                    def failed(*args):
                        if args[0] == 'shell' and address in args[1]:
                            if isinstance(outcome, Exception): raise outcome
                            return outcome
                        return adb(*args)
                    with self.assertRaises((ValueError, subprocess.TimeoutExpired, FileNotFoundError)):
                        containment.verify_canaries(failed)
                    self.assertTrue(any(c[0] == 'reverse' and c[1] == '--remove' for c in calls))

    def test_broken_positive_never_runs_negative_canary(self):
        adb,calls=self.fake_canary_adb(broken_loopback=True)
        with self.assertRaises(ValueError): containment.verify_canaries(adb)
        self.assertFalse(any(c[0] == 'shell' and ' 443 ' in c[1] for c in calls))
        self.assertEqual('--remove',calls[-1][1])

    def test_topology_changed_mid_probe_rejected_and_proof_sanitized(self):
        with patch.object(containment,'topology',side_effect=[valid_state(),{**valid_state(),'namespace':'net:[201]'}]), patch.object(containment,'verify_canaries',return_value={}):
            with self.assertRaises(ValueError): containment.verify_containment(42,'emulator-5554',None)
        with patch.object(containment,'topology',return_value=valid_state()), patch.object(containment,'verify_canaries',return_value={}):
            proof=containment.verify_containment(42,'emulator-5554',None)
        self.assertTrue(proof['verified']); self.assertNotIn('emulator_exe',proof)


class DriverTests(unittest.TestCase):
    def test_positive_globally_distinct_pids_only(self):
        seen=set()
        self.assertTrue(all(driver.admit_lifecycle_pid(seen,pid) for pid in [101,102,103,104,105,106]))
        self.assertEqual(6,len(seen))
        for pid in [101,0,-1,None,'107',True,1.5]:
            self.assertFalse(driver.admit_lifecycle_pid(seen,pid))

    def test_nonadjacent_reuse(self):
        seen=set()
        self.assertEqual([True,True,False], [driver.admit_lifecycle_pid(seen,p) for p in [101,102,101]])

    def run_driver(self, root, pids, gate_failure=None):
        artifacts=root/'artifacts'; artifacts.mkdir()
        apks=[]
        for name in ('fake-app.apk','fake-test.apk'):
            apk=artifacts/name; apk.write_bytes(b'OFFLINE TEST FIXTURE NOT AN APK')
            apks.append({'file':name,'sha256':driver.sha(apk)})
        (artifacts/'harness-manifest.json').write_text(json.dumps({'apks':apks,'methods':[]}))
        output=root/'output'; calls=[]; phase=None; counter=0
        def adb(command,**kwargs):
            nonlocal phase,counter
            self.assertEqual(['-H','127.0.0.1','-P','5037'],command[1:5])
            self.assertEqual('tcp:127.0.0.1:5037',kwargs['env']['ADB_SERVER_SOCKET'])
            args=command[7:]; calls.append(args)
            if args[:2]==['shell','getprop']:
                return completed(b'1' if args[2] in ('ro.kernel.qemu','sys.boot_completed') else b'35')
            if args[:3]==['shell','am','instrument']:
                phase=args[args.index('phase')+1]; counter+=1
                return completed(b'OK (1 test)')
            if args[0]=='exec-out':
                event={'pid':pids[counter-1],'kind':'finished','failed':False,
                       'class':'space.dpos.android.GolosFullFlowLifecycleAndroidTest','method':'distinctProcessPhases','phase':phase}
                data=(json.dumps(event)+'\n').encode(); stream=io.BytesIO()
                with tarfile.open(fileobj=stream,mode='w') as tar:
                    item=tarfile.TarInfo('golos-fullflow-evidence-offline/events.jsonl'); item.size=len(data); tar.addfile(item,io.BytesIO(data))
                return completed(stream.getvalue())
            return completed()
        gate_calls=[]
        def gate(*args):
            gate_calls.append(args)
            if len(gate_calls)==gate_failure: raise ValueError('synthetic containment failure')
            return {'verified':True,'scope':'OFFLINE_MOCK_NOT_ANDROID'}
        argv=['driver','--serial','emulator-5554','--emulator-pid','42','--artifacts',str(artifacts),'--output',str(output),'--run-id','offline','--disposable-emulator-approved']
        error=None
        with patch.object(sys,'argv',argv), patch.object(driver.subprocess,'run',side_effect=adb), patch.object(driver,'verify_containment',side_effect=gate), contextlib.redirect_stdout(io.StringIO()):
            try: driver.main()
            except SystemExit as e: error=str(e)
        return output,calls,gate_calls,error

    def test_driver_six_unique_summary_and_fresh_gate_each_call(self):
        with tempfile.TemporaryDirectory() as tmp:
            output,calls,gates,error=self.run_driver(Path(tmp),[101,102,103,104,105,106])
            self.assertIsNone(error); self.assertEqual(7,len(gates))
            self.assertEqual(6,json.loads((output/'summary.json').read_text())['passed'])
            self.assertEqual(7,len(list(output.glob('containment-*.json'))))

    def test_driver_nonadjacent_reuse_and_nonpositive_pid_no_summary(self):
        for pids in ([101,102,101,104,105,106],[101,102,0,104,105,106]):
            with self.subTest(pids=pids), tempfile.TemporaryDirectory() as tmp:
                output,calls,gates,error=self.run_driver(Path(tmp),pids)
                self.assertIn('FAILED',error); self.assertFalse((output/'summary.json').exists())
                rows=[json.loads(r) for r in (output/'results.jsonl').read_text().splitlines()]
                self.assertEqual(3,len(rows)); self.assertFalse(rows[-1]['passed'])

    def test_driver_unverified_containment_stops_before_install_or_instrument(self):
        for failure in (1,2,4):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                output,calls,gates,error=self.run_driver(Path(tmp),[101,102,103,104,105,106],failure)
                self.assertIn('containment NOT verified',error)
                self.assertFalse((output/'summary.json').exists())
                self.assertEqual(0 if failure==1 else 2,sum(c[0]=='install' for c in calls))
                self.assertEqual(max(0,failure-2),sum(c[:3]==['shell','am','instrument'] for c in calls))
                label='preinstall' if failure==1 else f'{failure-2:02d}'
                self.assertFalse(json.loads((output/f'containment-{label}.json').read_text())['verified'])


if __name__=='__main__': unittest.main(verbosity=2)
