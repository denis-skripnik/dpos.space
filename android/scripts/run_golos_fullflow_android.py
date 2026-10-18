#!/usr/bin/env python3
"""Run only on an explicitly authorized, disposable emulator. No provider/host access."""
import argparse, hashlib, io, json, os, pathlib, re, subprocess, sys, tarfile, time

from golos_fullflow_containment import verify_containment

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def admit_lifecycle_pid(seen, pid):
    if type(pid) is not int or pid <= 0 or pid in seen:
        return False
    seen.add(pid)
    return True
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--serial', required=True); p.add_argument('--artifacts', type=pathlib.Path, required=True)
    p.add_argument('--output', type=pathlib.Path, required=True); p.add_argument('--run-id', required=True)
    p.add_argument('--disposable-emulator-approved', action='store_true', required=True)
    p.add_argument('--adb', default='adb'); p.add_argument('--timeout', type=int, default=120)
    p.add_argument('--emulator-pid', type=int, required=True, help='exact QEMU PID in the private loopback-only network namespace')
    a=p.parse_args()
    if not 1 <= a.timeout <= 120: p.error('instrumentation timeout must be 1..120 seconds')
    if not re.fullmatch(r'emulator-[0-9]+', a.serial): p.error('only explicit emulator serials; no personal device')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,60}',a.run_id): p.error('invalid run ID')
    if a.emulator_pid <= 0: p.error('emulator PID must be positive')
    if a.output.exists(): p.error('output must not exist; never overwrite prior evidence')
    manifest=json.loads((a.artifacts/'harness-manifest.json').read_text())
    apks=[]
    for row in manifest['apks']:
        file=a.artifacts/row['file']; assert sha(file)==row['sha256'], file
        apks.append(file)
    a.output.mkdir(parents=True)
    deadline=time.monotonic()+70*60
    def adb(*args, timeout=30):
        remaining=deadline-time.monotonic()
        if remaining <= 0: raise SystemExit('70-minute driver deadline; no PASS, preserve evidence and stop emulator')
        return subprocess.run([a.adb,'-H','127.0.0.1','-P','5037','-s',a.serial,*args],env={**os.environ,'ADB_SERVER_SOCKET':'tcp:127.0.0.1:5037'},stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=min(timeout,remaining))
    def checked(*args):
        r=adb(*args); assert r.returncode==0, r.stdout.decode(errors='replace'); return r.stdout.decode().strip()
    assert checked('shell','getprop','ro.kernel.qemu')=='1', 'not emulator'
    assert checked('shell','getprop','sys.boot_completed')=='1', 'not booted'
    def containment(label):
        try:
            proof=verify_containment(a.emulator_pid, a.serial, adb)
        except Exception as e:
            (a.output/f'containment-{label}.json').write_text(json.dumps({'verified':False,'error_type':type(e).__name__}))
            raise SystemExit('containment NOT verified; no instrumentation permitted') from e
        (a.output/f'containment-{label}.json').write_text(json.dumps(proof,indent=2))
    containment('preinstall')
    pkg='space.dpos.android.debug'
    installed=checked('shell','pm','list','packages',pkg)
    assert not installed, 'Requires clean disposable emulator; refuses installed app/storage'
    for apk in apks: checked('install','-t',str(apk.resolve()))
    (a.output/'environment.json').write_text(json.dumps({'serial':a.serial,'sdk':checked('shell','getprop','ro.build.version.sdk'),'fingerprint':checked('shell','getprop','ro.build.fingerprint'),'manifest':manifest},indent=2))
    component=pkg+'.test/androidx.test.runner.AndroidJUnitRunner'
    invocations=[(row['class']+'#'+row['method'],'matrix') for row in manifest['methods'] if 'Lifecycle' not in row['class']]
    invocations += [('space.dpos.android.GolosFullFlowLifecycleAndroidTest#distinctProcessPhases',phase) for phase in ['seed','migrated','adopted','confirmed','unknown','final']]
    rows=[]; lifecycle_pids=set()
    for n,(method,phase) in enumerate(invocations):
        checked('shell','am','force-stop',pkg); checked('shell','am','force-stop',pkg+'.test')
        containment(f'{n:02d}')  # Fresh proof before EVERY invocation, never an operator attestation/cache.
        started=time.monotonic(); command=['shell','am','instrument','-w','-r','-e','class',method,'-e','runId',a.run_id,'-e','phase',phase,'-e','listener','space.dpos.android.GolosFullFlowListener',component]
        try:
            r=adb(*command,timeout=a.timeout); text=r.stdout.decode(errors='replace')
            ok=r.returncode==0 and re.search(r'OK \(1 test\)',text) is not None and 'FAILURES' not in text and 'INSTRUMENTATION_FAILED' not in text
        except subprocess.TimeoutExpired as e:
            text=(e.stdout or b'').decode(errors='replace')+'\nDRIVER_TIMEOUT'; ok=False
        logfile=f'{n:02d}-{phase}-{method.split("#")[-1]}.log'; (a.output/logfile).write_text(text)
        # Pull only exact synthetic evidence directory, never application prefs/keys or unrelated files.
        remote='golos-fullflow-evidence-'+a.run_id
        pulled=None
        if time.monotonic() < deadline:
            try: pulled=adb('exec-out','run-as',pkg,'tar','-cf','-','-C','files',remote)
            except subprocess.TimeoutExpired: pass
        pid=None; evidence_error=None
        try:
            if pulled is None or pulled.returncode != 0: raise ValueError('evidence pull failed or timed out')
            with tarfile.open(fileobj=io.BytesIO(pulled.stdout),mode='r:') as tar:
                for member in tar.getmembers():
                    if not member.isfile(): continue
                    rel=pathlib.PurePosixPath(member.name)
                    assert '..' not in rel.parts and not rel.is_absolute() and rel.parts[0]==remote
                    stream=tar.extractfile(member); assert stream is not None
                    data=stream.read(); dest=a.output/'device'/pathlib.Path(*rel.parts[1:]); dest.parent.mkdir(parents=True,exist_ok=True); dest.write_bytes(data)
            events=(a.output/'device/events.jsonl').read_text().splitlines()
            event=json.loads(events[-1]); pid=event['pid']
            ok=ok and event['kind']=='finished' and not event['failed'] and event['class']+'#'+event['method']==method and event['phase']==phase
        except (ValueError, OSError, tarfile.TarError, AssertionError, KeyError, IndexError) as e:
            ok=False; evidence_error=type(e).__name__+': '+str(e)[:300]
        if phase!='matrix':
            pid_ok=admit_lifecycle_pid(lifecycle_pids,pid)
            ok=ok and pid_ok
        row={'method':method,'phase':phase,'pid':pid,'passed':bool(ok),'elapsed_s':round(time.monotonic()-started,3),'log':logfile,'evidence_error':evidence_error}
        with (a.output/'results.jsonl').open('a') as f: f.write(json.dumps(row)+'\n'); f.flush()
        rows.append(row); print(json.dumps(row),flush=True)
        if not ok: checked('shell','am','force-stop',pkg); raise SystemExit('FAILED; preserved exact logs/evidence, no replay')
    checked('shell','am','force-stop',pkg)
    assert len(rows)==len(invocations)
    if len(lifecycle_pids)!=6: raise SystemExit('requires six globally distinct positive lifecycle PIDs; no PASS')
    (a.output/'summary.json').write_text(json.dumps({'executed':len(rows),'passed':sum(r['passed'] for r in rows),'android_acceptance':'PASS','scope':'synthetic fullflow only; not TalkBack/mainnet/update acceptance'},indent=2))
if __name__=='__main__': main()
