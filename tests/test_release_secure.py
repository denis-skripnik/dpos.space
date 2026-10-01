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
PUBLIC_COMMIT = consumer.public_commit
from secure_env_ingress.operations import bind, clear_consumers
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        public = patch.object(consumer, 'public_commit')
        public.start()
        self.addCleanup(public.stop)
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
            return consumer._ORIGIN
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
                    'certificateSha256':consumer._HISTORIC_CERT,'versionCode':80,'versionName':'3.1.2','sourceCommit':'b'*40,
                    'publishedAt':'2026-09-27T00:00:00Z','notBefore':'2026-09-28T00:00:00Z'}
        with self.assertRaises(Exception):
            release_signer.operate({'mode':'sign','password':'wrong-synthetic-password','manifest':manifest},key)
        key.chmod(0o644)
        with self.assertRaises(ValueError):
            release_signer.operate({'mode':'sign','password':'synthetic-test-only-passphrase','manifest':manifest},key)


    def test_explicit_release_validation_and_path_injection(self):
        invalid = [('03.2.0', 81), ('3.2', 81), ('3.2.0-beta', 81),
                   ('3.2.0+build', 81), ('../3.2.0', 81), ('3.2.0\n', 81),
                   ('3.2.0', True), ('3.2.0', '81'), ('3.2.0', 0),
                   ('3.2.0', 2100000001)]
        for version, code in invalid:
            with self.subTest(version=version, code=code):
                self.assertRaises(ValueError, consumer.release_filename, version, code)
                self.assertRaises(ValueError, release_signer.validate_release, version, code)
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            _, factory = consumer._factories(self.repo, self.key_dir, self.sdk)
            for field in ('repo', 'key', 'signer', 'sdk', 'password', 'output', 'release'):
                params = {'versionName': '3.1.2', 'versionCode': 80, field: '/other'}
                self.assertRaises(ValueError, factory, json.dumps(params))

    def test_future_version_reuses_key_and_preserves_latest_alias(self):
        future = self.repo / 'downloads/dpos-space-3.2.0.apk'
        future.write_bytes(b'SYNTHETIC FUTURE APK')
        future.chmod(0o644)
        latest = self.repo / 'downloads/dpos-space-latest.manifest.json'
        latest.write_bytes(b'PREVIOUS PUBLIC ALIAS')
        def future_run(args, cwd):
            if args[:3] == ['git', 'ls-files', '--error-unmatch']:
                return args[-1]
            if args[0].endswith('/aapt'):
                return "package: name='space.dpos.android.debug' versionCode='81' versionName='3.2.0'"
            return self.fake_run(args, cwd)
        with patch.object(consumer, 'run_fixed', side_effect=future_run):
            init, factory = consumer._factories(self.repo, self.key_dir, self.sdk)
            init(json.dumps({'release':'3.1.2'})).execute('synthetic-test-only-passphrase')
            key = self.key_dir / 'dpos-release-ed25519.pem'
            original_key = key.read_bytes()
            bound = factory(json.dumps({'versionName':'3.2.0', 'versionCode':81}))
            self.assertIn('3.2.0', bound.summary)
            bound.execute('synthetic-test-only-passphrase')
            self.assertEqual(key.read_bytes(), original_key)
            self.assertEqual(latest.read_bytes(), b'PREVIOUS PUBLIC ALIAS')
            output = self.repo / 'downloads/dpos-space-3.2.0.manifest.json'
            envelope = json.loads(output.read_bytes())
            self.assertEqual(envelope['manifest']['versionName'], '3.2.0')
            self.assertEqual(envelope['manifest']['versionCode'], 81)
            self.assertEqual(envelope['manifest']['apk'], '/downloads/dpos-space-3.2.0.apk')
            from datetime import datetime
            manifest = envelope['manifest']
            self.assertEqual((datetime.fromisoformat(manifest['notBefore']) -
                              datetime.fromisoformat(manifest['publishedAt'])).total_seconds(), 86400)
            Ed25519PublicKey.from_public_bytes(base64.b64decode(envelope['publicKey'])).verify(
                base64.b64decode(envelope['signature']),
                b'dpos.space/release/v1\n' + release_signer.canonical(manifest))
            self.assertRaises(ValueError, factory, json.dumps({'versionName':'3.2.0', 'versionCode':81}))

    def test_cross_version_and_provenance_negatives(self):
        future = self.repo / 'downloads/dpos-space-3.2.0.apk'
        future.write_bytes(b'SYNTHETIC FUTURE APK')
        future.chmod(0o644)
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            # Filename alone cannot attest the requested APK package version/code.
            self.assertRaises(ValueError, consumer.collect, self.repo, self.sdk, version='3.2.0', code=81)
            self.assertRaises(ValueError, consumer.collect, self.repo, self.sdk, code=81)
        changes = [
            lambda args, normal: 'https://github.com/other/repo.git'
                if args[:4] == ['git', 'remote', 'get-url', 'origin'] else normal,
            lambda args, normal: normal + '\napplication-debuggable'
                if args[0].endswith('/aapt') else normal,
            lambda args, normal: normal + '\nSigner #2 certificate SHA-256 digest: ' + 'a'*64
                if args[0].endswith('/apksigner') else normal,
            lambda args, normal: 'downloads/other.apk'
                if args[:3] == ['git', 'ls-files', '--error-unmatch'] else normal,
        ]
        for change in changes:
            with patch.object(consumer, 'run_fixed', side_effect=lambda args, cwd: change(args, self.fake_run(args, cwd))):
                self.assertRaises(ValueError, consumer.collect, self.repo, self.sdk)
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run), \
                patch.object(consumer, 'public_commit', side_effect=ValueError('not public')):
            self.assertRaises(ValueError, consumer.collect, self.repo, self.sdk)

    def test_invalid_manifest_rejected_before_key_access(self):
        manifest = {'apk':'/downloads/dpos-space-3.2.0.apk', 'sha256':'a'*64,
                    'package':consumer._PACKAGE, 'certificateSha256':consumer._HISTORIC_CERT,
                    'versionName':'3.2.0', 'versionCode':81, 'sourceCommit':'b'*40,
                    'publishedAt':'2026-10-01T00:00:00Z', 'notBefore':'2026-10-02T00:00:00Z'}
        variants = [dict(manifest, apk='/downloads/dpos-space-3.1.2.apk'),
                    dict(manifest, versionName='03.2.0'), dict(manifest, versionCode=True),
                    dict(manifest, certificateSha256='c'*64), dict(manifest, package='other'),
                    dict(manifest, notBefore='2026-10-01T23:59:59Z')]
        with patch.object(release_signer, 'restricted_private_file') as access:
            for candidate in variants:
                self.assertRaises(ValueError, release_signer.operate,
                                  {'mode':'sign', 'password':'synthetic-test-only-passphrase',
                                   'manifest':candidate}, self.root / 'nonexistent-key')
            access.assert_not_called()

    def test_pending_manifest_collision_and_directory_swap(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            _, factory = consumer._factories(self.repo, self.key_dir, self.sdk)
            raw = json.dumps({'versionName':'3.1.2', 'versionCode':80})
            bound = factory(raw)
            output = self.repo / 'downloads/dpos-space-3.1.2.manifest.json'
            output.write_bytes(b'CONCURRENT WINNER')
            # Collision is rejected before the password reaches any signer.
            with patch.object(consumer.subprocess, 'run') as spawn:
                self.assertRaises(ValueError, bound.execute, 'synthetic-test-only-passphrase')
                spawn.assert_not_called()
            self.assertEqual(output.read_bytes(), b'CONCURRENT WINNER')
            output.unlink()
            bound = factory(raw)
            (self.repo / 'downloads').rename(self.repo / 'old-downloads')
            (self.repo / 'downloads').mkdir()
            with patch.object(consumer.subprocess, 'run') as spawn:
                self.assertRaises(ValueError, bound.execute, 'synthetic-test-only-passphrase')
                spawn.assert_not_called()

    def test_commit_change_during_collection(self):
        calls = 0
        def changed(args, cwd):
            nonlocal calls
            if args == ['git', 'rev-parse', 'HEAD']:
                calls += 1
                return ('b' if calls == 1 else 'd') * 40
            return self.fake_run(args, cwd)
        with patch.object(consumer, 'run_fixed', side_effect=changed):
            self.assertRaises(ValueError, consumer.collect, self.repo, self.sdk)

    def test_public_provenance_uses_fixed_unauthenticated_endpoint(self):
        # Execute the real helper; only its HTTP transport is synthetic.
        module = consumer
        url = 'https://api.github.com/repos/denis-skripnik/dpos.space/commits/' + 'b'*40
        with patch.object(module.urllib.request, 'urlopen') as get:
            response = get.return_value.__enter__.return_value
            response.geturl.return_value = url
            response.read.return_value = json.dumps({'sha':'b'*40}).encode()
            PUBLIC_COMMIT('b'*40)
            request = get.call_args.args[0]
            self.assertEqual(request.full_url, url)
            self.assertNotIn('Authorization', dict(request.header_items()))
            response.read.return_value = json.dumps({'sha':'d'*40}).encode()
            self.assertRaises(ValueError, PUBLIC_COMMIT, 'b'*40)
            response.geturl.return_value = 'https://other.invalid/'
            self.assertRaises(ValueError, PUBLIC_COMMIT, 'b'*40)

    def test_replaced_signer_before_factory_creation_is_rejected(self):
        signer = self.repo / 'tools/release_signer.py'
        signer.write_bytes(b'UNREVIEWED REPLACEMENT')
        with patch.object(consumer, '__file__', str(self.repo / 'tools/release_secure_consumer.py')), \
                patch.object(consumer, 'collect') as collect, \
                patch.object(consumer.subprocess, 'run') as spawn:
            with self.assertRaisesRegex(ValueError, 'trusted signer changed'):
                consumer._factories(self.repo, self.key_dir, self.sdk)
            collect.assert_not_called()
            spawn.assert_not_called()

    def test_replaced_signer_before_binding_is_rejected(self):
        signer = self.repo / 'tools/release_signer.py'
        signer.write_bytes((TOOLS / 'release_signer.py').read_bytes())
        with patch.object(consumer, '__file__', str(self.repo / 'tools/release_secure_consumer.py')), \
                patch.object(consumer, 'collect') as collect, \
                patch.object(consumer.subprocess, 'run') as spawn:
            init, sign = consumer._factories(self.repo, self.key_dir, self.sdk)
            signer.write_bytes(b'UNREVIEWED REPLACEMENT')
            for factory, params in ((init, {'release': '3.1.2'}),
                                    (sign, {'versionName': '3.1.2', 'versionCode': 80})):
                with self.subTest(params=params):
                    with self.assertRaisesRegex(ValueError, 'trusted signer changed'):
                        factory(json.dumps(params))
            collect.assert_not_called()
            spawn.assert_not_called()

    def test_replaced_signer_after_binding_never_receives_password(self):
        signer = self.repo / 'tools/release_signer.py'
        signer.write_bytes((TOOLS / 'release_signer.py').read_bytes())
        with patch.object(consumer, '__file__', str(self.repo / 'tools/release_secure_consumer.py')), \
                patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            init, sign = consumer._factories(self.repo, self.key_dir, self.sdk)
            operations = (init(json.dumps({'release': '3.1.2'})),
                          sign(json.dumps({'versionName': '3.1.2', 'versionCode': 80})))
            signer.write_bytes(b'UNREVIEWED REPLACEMENT')
            with patch.object(consumer.subprocess, 'run') as spawn:
                for operation in operations:
                    with self.subTest(summary=operation.summary):
                        with self.assertRaisesRegex(ValueError, 'trusted signer changed'):
                            operation.execute('synthetic-test-only-passphrase')
                spawn.assert_not_called()
            self.assertFalse((self.key_dir / 'dpos-release-ed25519.pem').exists())
            self.assertFalse((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').exists())

    def test_generic_factory_anchors_repo_to_pinned_handler(self):
        with patch.object(consumer, '_factories') as factories:
            consumer.dpos_release_sign('{"versionName":"3.2.0","versionCode":81}')
            self.assertEqual(factories.call_args.args,
                             (Path(consumer.__file__).resolve().parent.parent, consumer._KEY_DIR, consumer._SDK))


if __name__ == '__main__':
    unittest.main()
