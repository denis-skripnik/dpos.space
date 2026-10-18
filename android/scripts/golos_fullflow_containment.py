#!/usr/bin/env python3
"""Read-only admission of an ALREADY isolated disposable emulator; never sets networking.

Only supported topology: driver, private ADB server and emulator in a dedicated
Linux network namespace with loopback as its sole interface (no veth/uplink).
The temporary ADB reverse is a loopback canary, not an external route.
"""
import json
import os
from pathlib import Path
import re
import socket
import threading
import uuid


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate_topology(state):
    require(any(name != 'lo' for name in state['initial_interfaces']), 'cannot prove separation from host PID 1 network namespace')
    require(state['namespace'] == state['emulator_namespace'], 'emulator not in driver namespace')
    require(state['driver_caps'] == state['emulator_caps'] == 0, 'driver/emulator must have no effective capabilities')
    require(state['emulator_exe'].startswith('qemu-system-'), 'expected actual emulator QEMU PID')
    links = state['links']
    require(len(links) == 1 and links[0]['ifname'] == 'lo' and 'UP' in links[0]['flags'], 'only UP loopback permitted; no uplink/veth')
    require(all(r.get('dev') == 'lo' and r.get('type') in ('local', 'broadcast', 'unicast')
                for r in state['routes']), 'non-loopback route forbidden')
    require(state['console_owned'], 'serial console listener not owned by exact emulator PID')
    return state


def topology(emulator_pid, serial):
    import subprocess
    proc = Path('/proc')
    def namespace(pid): return os.readlink(proc / str(pid) / 'ns/net')
    current_namespace = namespace('self')
    def interfaces(pid):
        return [line.split(':')[0].strip() for line in (proc / str(pid) / 'net/dev').read_text().splitlines()[2:]]
    # /proc/1/ns/net readlink needs ptrace privilege on many kernels. Live
    # interface inventories prove namespace inequality without that privilege:
    # ours has ONLY lo, while PID 1's namespace must have a non-loopback link.
    require(interfaces('self') == ['lo'], 'initial/host or uplink network namespace forbidden')
    initial_interfaces = interfaces(1)
    require(any(name != 'lo' for name in initial_interfaces), 'cannot prove separation from host namespace')
    require(current_namespace == namespace(emulator_pid), 'emulator not in driver namespace')
    def caps(pid):
        text = (proc / str(pid) / 'status').read_text()
        uid = re.search(r'^Uid:\s*(.*)$', text, re.M)
        require(uid is not None and all(int(n) > 0 for n in uid[1].split()), 'unprivileged user required')
        effective = re.search(r'^CapEff:\s*([0-9a-f]+)$', text, re.M)
        permitted = re.search(r'^CapPrm:\s*([0-9a-f]+)$', text, re.M)
        require(effective is not None and permitted is not None, 'missing process capability state')
        return int(effective[1], 16) | int(permitted[1], 16)
    def ip(*args):
        return json.loads(subprocess.check_output(['ip', '-j', *args], text=True, timeout=5))
    # /proc/net/tcp is namespace-local. Correlate the exact serial's listening
    # console socket to an FD of the explicitly supplied QEMU process.
    port = int(serial.split('-')[1])
    inodes = set()
    for table, loopback in [('tcp', '0100007F'), ('tcp6', '00000000000000000000000001000000')]:
        for line in (proc / f'net/{table}').read_text().splitlines()[1:]:
            cols = line.split()
            if cols[1] == f'{loopback}:{port:04X}' and cols[3] == '0A':
                inodes.add(cols[9])
    fds = {os.readlink(p) for p in (proc / str(emulator_pid) / 'fd').iterdir()}
    state = dict(namespace=current_namespace, initial_interfaces=initial_interfaces,
                 emulator_namespace=namespace(emulator_pid), driver_caps=caps('self'),
                 emulator_caps=caps(emulator_pid), emulator_exe=Path(os.readlink(proc / str(emulator_pid) / 'exe')).name,
                 links=ip('link', 'show'), routes=ip('-4', 'route', 'show', 'table', 'all') + ip('-6', 'route', 'show', 'table', 'all'),
                 console_owned=any(f'socket:[{i}]' in fds for i in inodes))
    return validate_topology(state)


def verify_canaries(adb):
    """Prove usable emulator nc over private ADB/loopback; then TCP-only external denial.

    No HTTP, TLS, DNS or blockchain requests. Outbound probes happen ONLY AFTER
    no-uplink topology admission. Their success is a fatal containment failure.
    """
    nonce = 'golos_' + uuid.uuid4().hex
    with socket.socket() as server:
        server.bind(('127.0.0.1', 0)); server.listen(1); server.settimeout(8)
        port = server.getsockname()[1]
        received = []
        def serve():
            try:
                with server.accept()[0] as conn:
                    conn.settimeout(5)
                    received.append(conn.recv(256).decode().strip())
                    conn.sendall((nonce + '\n').encode())
            except OSError:
                pass
        thread = threading.Thread(target=serve, daemon=True); thread.start()
        mapped = False
        try:
            r = adb('reverse', '--no-rebind', f'tcp:{port}', f'tcp:{port}')
            require(r.returncode == 0, 'private loopback reverse unavailable')
            mapped = True
            r = adb('shell', f'{{ printf "{nonce}\\n"; sleep 1; }} | toybox nc -q 2 -w 2 127.0.0.1 {port}')
            thread.join(6)
            require(received == [nonce] and nonce in r.stdout.decode(), 'emulator loopback/nc positive canary failed')
        finally:
            if mapped:
                r = adb('reverse', '--remove', f'tcp:{port}')
                require(r.returncode == 0, 'cannot remove exact canary reverse')
    denied = []
    # Android 15 toybox: -z exits on connect success; xconnbind reports
    # "nc: connect: <strerror>" through perror_exit_raw with status 1.
    # Status 1 ALONE also covers tool/argument/socket errors, not just connect.
    # Fail closed on timeouts, signals, unknown/localized errors and ADB errors.
    failures = {'Network is unreachable': 'network_unreachable',
                'No route to host': 'host_unreachable',
                'Connection refused': 'connection_refused'}
    for family, address in ((4, '1.1.1.1'), (6, '2606:4700:4700::1111')):
        r = adb('shell', f'out=$(LC_ALL=C /system/bin/toybox nc -{family} -n -z -w 2 {address} 443 </dev/null 2>&1); '
                'status=$?; printf \'%s\\nGOLOS_CANARY:%s\\n\' "$out" "$status"')
        require(r.returncode == 0 and not getattr(r, 'stderr', None)
                and isinstance(r.stdout, bytes) and len(r.stdout) <= 256,
                'external TCP/443 canary transport/tool failure')
        match = re.fullmatch(r'nc: connect: (Network is unreachable|No route to host|Connection refused)\nGOLOS_CANARY:1\n',
                            r.stdout.decode('ascii'))
        if match is None:
            raise ValueError('external TCP/443 canary not demonstrably denied')
        denied.append({'address': address, 'port': 443, 'connected': False,
                       'failure_class': failures[match[1]]})
    return {'emulator_loopback_and_private_adb': True, 'external_tcp_canaries': denied,
            'application_requests_sent': False}


def verify_containment(emulator_pid, serial, adb):
    before = topology(emulator_pid, serial)  # Never probe externally before this succeeds.
    canaries = verify_canaries(adb)
    after = topology(emulator_pid, serial)
    require(before == after, 'containment topology changed during verification')
    # Export only fixed/non-sensitive facts, not process argv, environment or raw ADB output.
    return {'verified': True, 'mode': 'private-loopback-only-network-namespace',
            'namespace': after['namespace'], 'emulator_pid': emulator_pid, 'serial': serial,
            'only_interface': 'lo', 'no_uplink': True, 'no_effective_capabilities': True,
            'serial_console_owned_by_emulator': True, **canaries}
