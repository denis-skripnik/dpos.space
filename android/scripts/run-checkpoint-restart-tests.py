#!/usr/bin/env python3
"""Run checkpoint acceptance only on the dedicated disposable Android emulator.

No pm clear, uninstall, mainnet RPC, key import, or physical-device operations.
Unique run IDs retain prior evidence and permit repeat tests without clearing data.
"""
import argparse
import re
import subprocess
import sys
import uuid
from pathlib import Path

PACKAGE = "space.dpos.android.debug"
RUNNER = PACKAGE + ".test/androidx.test.runner.AndroidJUnitRunner"
CERT = "86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", type=Path, required=True)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--test-apk", type=Path, required=True)
    parser.add_argument("--logs", type=Path, required=True)
    parser.add_argument("--serial", default="emulator-5554")
    parser.add_argument("--run-id", default=uuid.uuid4().hex)
    parser.add_argument("--include-golos-recovery", action="store_true",
                        help="also run synthetic-RPC future-generation A/B/C distinct-PID boundary tests")
    args = parser.parse_args()
    if not re.fullmatch(r"emulator-[0-9]+", args.serial):
        parser.error("physical devices are prohibited")
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", args.run_id):
        parser.error("invalid run ID; identifiers are not normalized")
    args.logs.mkdir(parents=True, exist_ok=True)
    adb = args.sdk / "platform-tools/adb"
    transcript = args.logs / (args.run_id + "-driver.log")

    def run(label, command, timeout=120):
        # Stream directly to a file so parent/child interruption cannot erase real output.
        raw_log = args.logs / f"{args.run_id}-{label}.log"
        with raw_log.open("w") as sink:
            try:
                result = subprocess.run([str(x) for x in command], stdout=sink,
                                        stderr=subprocess.STDOUT, text=True, timeout=timeout)
            except subprocess.TimeoutExpired:
                sink.flush()
                with transcript.open("a") as output:
                    output.write(f"\n[{label}] timeout; partial output retained at {raw_log}\n")
                raise
        text = raw_log.read_text()
        with transcript.open("a") as output:
            output.write(f"\n[{label}] exit={result.returncode}\n{text}\n")
        if result.returncode:
            raise RuntimeError(f"{label} failed; see {transcript}")
        return text

    device = [adb, "-s", args.serial]
    try:
        state = run("device-state", device + ["get-state"]).strip()
        if state != "device":
            raise RuntimeError(f"emulator not ready: {state!r}")
        qemu = run("qemu-identity", device + ["shell", "getprop", "ro.kernel.qemu"]).strip()
        avd = run("avd-identity", device + ["emu", "avd", "name"]).splitlines()[0].strip()
        if qemu != "1" or avd != "dpos-checkpoint":
            raise RuntimeError("refusing an emulator not identified as dpos-checkpoint")
        build_tools = args.sdk / "build-tools/35.0.0"
        cert = run("apk-certificate", [build_tools / "apksigner", "verify", "--print-certs", args.apk])
        if f"certificate SHA-256 digest: {CERT}" not in cert:
            raise RuntimeError("installed-package certificate compatibility is unverified")
        badging = run("apk-package", [build_tools / "aapt", "dump", "badging", args.apk])
        if f"package: name='{PACKAGE}'" not in badging:
            raise RuntimeError("unexpected APK package")
        run("install-app", device + ["install", "-r", args.apk])
        run("install-instrumentation", device + ["install", "-r", args.test_apk])
        targets = run("instrumentation-target", device + ["shell", "pm", "list", "instrumentation"])
        if RUNNER not in targets or f"target={PACKAGE}" not in targets:
            raise RuntimeError("instrumentation target readback failed")
        sequences = [("CheckpointAndroidRestartTest", "A"), ("CheckpointAndroidRestartTest", "B"),
                     ("CheckpointRuntimeRestartTest", "A"), ("CheckpointRuntimeRestartTest", "B"),
                     ("CheckpointRuntimeRestartTest", "C")]
        if args.include_golos_recovery:
            sequences += [("GolosRecoveryAndroidTest", phase) for phase in ("A", "B", "C")]
        for name, phase in sequences:
            # Process restart only, retaining every fixture preference, journal, key and setting.
            run("process-stop", device + ["shell", "am", "force-stop", PACKAGE])
            text = run(f"{name}-{phase}", device + ["shell", "am", "instrument", "-w",
                       "-e", "class", "space.dpos.android." + name, "-e", "phase", phase,
                       "-e", "runId", args.run_id, RUNNER], timeout=1200)
            (args.logs / f"{args.run_id}-{name}-{phase}.log").write_text(text)
            if "FAILURES!!!" in text or "INSTRUMENTATION_FAILED" in text or not re.search(r"OK \([0-9]+ tests?\)", text):
                raise RuntimeError(f"{name}-{phase} did not pass; see {transcript}")
        print(f"Android checkpoint acceptance passed; runId={args.run_id}; transcript={transcript}")
        return 0
    except (RuntimeError, subprocess.TimeoutExpired, OSError) as error:
        with transcript.open("a") as output:
            output.write(f"\nBLOCKED: {error}\n")
        print(f"Android checkpoint acceptance NOT COMPLETE: {error}; transcript={transcript}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
