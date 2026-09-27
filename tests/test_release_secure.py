"""Synthetic-only signer/consumer tests. No live key, gateway or APK publication."""
import base64
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[1] / 'tools'
SOURCE = Path('/home/assistent/ai-projects/public/hermes-secure-env-plugin-release')
sys.path.insert(0, str(TOOLS))
sys.path.insert(0, str(SOURCE))
import release_signer
import release_secure_consumer as consumer
from secure_env_ingress.operations import bind, clear_consumers
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.key_dir = self.root / 'keys'
        self.key_dir.mkdir(mode=0o700)
        self.repo = self.root / 'repo'
        (self.repo / 'downloads').mkdir(parents=True)
        (self.repo / 'tools').mkdir()
        (self.repo / 'downloads/dpos-space-3.1.2.apk').write_bytes(b'SYNTHETIC APK NOT FOR RELEASE')
        (self.repo / 'downloads/dpos-space-3.1.2.apk').chmod(0o644)
        (self.repo / 'tools/release-apk-certificate.sha256').write_text('a' * 64)
        self.sdk = self.root / 'sdk'
        self.sdk.mkdir()
        self.home = self.root / 'home'
        self.home.mkdir()

    def fake_run(self, args, cwd):
        if args[:2] == ['git', 'status']:
            return ''
        if args[:3] == ['git', 'rev-parse', 'HEAD']:
            return 'b' * 40
        if args[:4] == ['git', 'remote', 'get-url', 'origin']:
            return 'https://github.com/example/test.git'
        if args[:2] == ['git', 'ls-remote']:
            return 'b' * 40 + '\trefs/heads/main'
        if args[:3] == ['git', 'ls-files', '--error-unmatch']:
            return 'downloads/dpos-space-3.1.2.apk'
        if args[:2] == ['git', 'rev-parse'] and args[2].startswith('HEAD:downloads/'):
            return 'c' * 40
        if args[:2] == ['git', 'hash-object']:
            return 'c' * 40
        if args[0].endswith('/aapt'):
            return "package: name='space.dpos.android.debug' versionCode='80' versionName='3.1.2'"
        if args[0].endswith('/apksigner'):
            return 'Signer #1 certificate SHA-256 digest: ' + consumer._HISTORIC_CERT
        raise AssertionError(args)

    def test_encrypted_key_one_shot_signed_snapshot_and_tamper(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            consumer.register(self.home, self.repo, self.key_dir, self.sdk)
            self.addCleanup(clear_consumers, self.home)
            init, _ = bind(self.home, 'dpos_release_key_init', {'release': '3.1.2'})
            self.assertRaises(ValueError, bind, self.home, 'dpos_release_key_init', {'release': '../x'})
            init.execute('synthetic-test-only-passphrase')
            self.assertRaises(ValueError, init.execute, 'synthetic-test-only-passphrase')
            key = self.key_dir / 'dpos-release-ed25519.pem'
            self.assertIn(b'ENCRYPTED PRIVATE KEY', key.read_bytes())
            self.assertNotIn(b'synthetic-test-only-passphrase', key.read_bytes())
            self.assertEqual(key.stat().st_mode & 0o777, 0o600)
            sign, _ = bind(self.home, 'dpos_release_sign_312', {'release': '3.1.2'})
            self.assertIn('GitHub commit ' + 'b' * 40, sign.summary)
            sign.execute('synthetic-test-only-passphrase')
            self.assertRaises(ValueError, sign.execute, 'synthetic-test-only-passphrase')
            envelope = json.loads((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').read_text())
            message = b'dpos.space/release/v1\n' + release_signer.canonical(envelope['manifest'])
            Ed25519PublicKey.from_public_bytes(base64.b64decode(envelope['publicKey'])).verify(
                base64.b64decode(envelope['signature']), message)
            self.assertEqual(envelope['manifest']['versionCode'], 80)
            self.assertNotIn('synthetic-test-only-passphrase', json.dumps(envelope))
            tampered = dict(envelope['manifest'], versionCode=81)
            with self.assertRaises(Exception):
                Ed25519PublicKey.from_public_bytes(base64.b64decode(envelope['publicKey'])).verify(
                    base64.b64decode(envelope['signature']), b'dpos.space/release/v1\n' + release_signer.canonical(tampered))

    def test_recheck_artifact_and_fail_closed(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            consumer.register(self.home, self.repo, self.key_dir, self.sdk)
            self.addCleanup(clear_consumers, self.home)
            init, _ = bind(self.home, 'dpos_release_key_init', {'release': '3.1.2'})
            init.execute('synthetic-test-only-passphrase')
            bound, _ = bind(self.home, 'dpos_release_sign_312', {'release': '3.1.2'})
            (self.repo / 'downloads/dpos-space-3.1.2.apk').write_bytes(b'CHANGED')
            with self.assertRaises(ValueError):
                bound.execute('synthetic-test-only-passphrase')
            self.assertFalse((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').exists())

    def test_replaced_after_signer_validation_is_rejected(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            consumer.register(self.home, self.repo, self.key_dir, self.sdk)
            self.addCleanup(clear_consumers, self.home)
            init, _ = bind(self.home, 'dpos_release_key_init', {'release':'3.1.2'})
            init.execute('synthetic-test-only-passphrase')
            bound, _ = bind(self.home, 'dpos_release_sign_312', {'release':'3.1.2'})
            original = consumer.subprocess.run
            apk = self.repo / 'downloads/dpos-space-3.1.2.apk'
            def replace_during_sign(*args, **kwargs):
                result = original(*args, **kwargs)
                if kwargs.get('input') and b'"mode":"sign"' in kwargs['input']:
                    alternate = apk.with_suffix('.alternate')
                    alternate.write_bytes(b'CHANGED AFTER VALIDATION')
                    alternate.replace(apk)
                return result
            with patch.object(consumer.subprocess, 'run', side_effect=replace_during_sign):
                with self.assertRaises(ValueError):
                    bound.execute('synthetic-test-only-passphrase')
            self.assertFalse((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').exists())

    def test_symlink_and_repo_supplied_pin_fail_closed(self):
        apk = self.repo / 'downloads/dpos-space-3.1.2.apk'
        self.assertRaises(ValueError, consumer.register, self.home, self.repo, self.key_dir, self.sdk,
                          expected_cert='e' * 64)
        (self.repo / 'tools/release-apk-certificate.sha256').write_text('e' * 64)
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            self.assertEqual(consumer.collect(self.repo, self.sdk)['certificateSha256'], consumer._HISTORIC_CERT)
        other = self.root / 'elsewhere.apk'
        apk.replace(other)
        apk.symlink_to(other)
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            with self.assertRaises(OSError):
                consumer.collect(self.repo, self.sdk)

    def test_wrong_certificate_package_and_dirty_tree_rejected(self):
        from unittest.mock import patch as mock_patch
        cases = [
            lambda argv, normal: 'Signer #1 certificate SHA-256 digest: ' + 'e' * 64
                if argv[0].endswith('/apksigner') else normal,
            lambda argv, normal: "package: name='other.app' versionCode='80' versionName='3.1.2'"
                if argv[0].endswith('/aapt') else normal,
            lambda argv, normal: ' M android/app/build.gradle.kts'
                if argv[:2] == ['git', 'status'] else normal,
            lambda argv, normal: 'd' * 40
                if argv[:2] == ['git', 'hash-object'] else normal,
        ]
        for change in cases:
            with self.subTest(change=cases.index(change)):
                def altered(argv, cwd):
                    return change(argv, self.fake_run(argv, cwd))
                with mock_patch.object(consumer, 'run_fixed', side_effect=altered):
                    with self.assertRaises(ValueError):
                        consumer.collect(self.repo, self.sdk)

    def test_wrong_password_and_permissions(self):
        key = self.key_dir / 'key.pem'
        release_signer.operate({'mode':'init', 'password':'synthetic-test-only-passphrase', 'manifest':None}, key)
        manifest = {'apk':'/downloads/dpos-space-3.1.2.apk','sha256':'a'*64,'package':'space.dpos.android.debug',
                    'certificateSha256':'a'*64,'versionCode':80,'versionName':'3.1.2','sourceCommit':'b'*40,
                    'publishedAt':'2026-09-27T00:00:00Z','notBefore':'2026-09-28T00:00:00Z'}
        with self.assertRaises(Exception):
            release_signer.operate({'mode':'sign','password':'wrong-synthetic-password','manifest':manifest},key)
        key.chmod(0o644)
        with self.assertRaises(ValueError):
            release_signer.operate({'mode':'sign','password':'synthetic-test-only-passphrase','manifest':manifest},key)


if __name__ == '__main__':
    unittest.main()
