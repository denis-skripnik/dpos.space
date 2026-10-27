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
                        with self.assertRaisesRegex(ValueError, '^dependency_mismatch$'):
                            operation.execute('synthetic-test-only-passphrase')
                spawn.assert_not_called()
            self.assertFalse((self.key_dir / 'dpos-release-ed25519.pem').exists())
            self.assertFalse((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').exists())
            self.assertEqual(self.receipt()['code'], 'dependency_mismatch')

    def diagnostic_operation(self, *, initialize=True):
        init, sign = consumer._factories(self.repo, self.key_dir, self.sdk)
        if initialize:
            init(json.dumps({'release': '3.1.2'})).execute('synthetic-test-only-passphrase')
        return sign(json.dumps({'versionName': '3.1.2', 'versionCode': 80}))

    def receipt(self):
        path = self.key_dir / consumer.RECEIPT_NAME
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        data = json.loads(path.read_bytes())
        self.assertEqual(set(data), {'attempt', 'boundAtNs', 'startedAtNs', 'finishedAtNs',
                                    'versionName', 'versionCode', 'sourceCommit', 'code'})
        self.assertEqual(data['sourceCommit'], 'b' * 40)
        self.assertEqual((data['versionName'], data['versionCode']), ('3.1.2', 80))
        self.assertLessEqual(data['boundAtNs'], data['startedAtNs'])
        self.assertLessEqual(data['startedAtNs'], data['finishedAtNs'])
        self.assertRegex(data['attempt'], '^[0-9a-f]{32}$')
        self.assertNotIn('CANARY', path.read_text())
        self.assertNotIn('synthetic-test-only-passphrase', path.read_text())
        return data

    def test_diagnostic_positive_and_immutable_attempt_retry(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            operation = self.diagnostic_operation()
            operation.execute('synthetic-test-only-passphrase')
            receipt = self.receipt()
            self.assertEqual(receipt['code'], 'signed')
            self.assertRaisesRegex(consumer.SigningFailure, '^already_consumed$',
                                   operation.execute, 'synthetic-test-only-passphrase')
            self.assertEqual(self.receipt(), receipt)

    def test_wrong_fixture_secret_and_malformed_key_share_decrypt_code(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            operation = self.diagnostic_operation()
            self.assertRaisesRegex(consumer.SigningFailure, '^key_decrypt$',
                                   operation.execute, 'wrong-fixture-CANARY-password')
            first = self.receipt()
            key = self.key_dir / 'dpos-release-ed25519.pem'
            key.write_bytes(b'MALFORMED-KEY-CANARY')
            operation = self.diagnostic_operation(initialize=False)
            self.assertRaisesRegex(consumer.SigningFailure, '^key_decrypt$',
                                   operation.execute, 'synthetic-test-only-passphrase')
            second = self.receipt()
            self.assertEqual(first['code'], second['code'])
            self.assertNotEqual(first['attempt'], second['attempt'])
            self.assertFalse((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').exists())

    def test_signer_cli_only_fixed_failure_codes(self):
        key = self.key_dir / 'key.pem'
        manifest = {'apk':'/downloads/dpos-space-3.1.2.apk', 'sha256':'a'*64,
                    'package':consumer._PACKAGE, 'certificateSha256':consumer._HISTORIC_CERT,
                    'versionName':'3.1.2', 'versionCode':80, 'sourceCommit':'b'*40,
                    'publishedAt':'2026-10-01T00:00:00Z', 'notBefore':'2026-10-02T00:00:00Z'}
        release_signer.operate({'mode':'init', 'password':'synthetic-test-only-passphrase', 'manifest':None}, key)
        request = {'mode':'sign', 'password':'wrong-fixture-CANARY-password', 'manifest':manifest}
        for expected, mutate in [('key_decrypt', lambda: None),
                                 ('key_decrypt', lambda: key.write_bytes(b'BROKEN-CANARY')),
                                 ('key_permissions', lambda: key.chmod(0o644)),
                                 ('request_policy', lambda: request.update(mode='CANARY'))]:
            mutate()
            result = subprocess.run([sys.executable, str(TOOLS / 'release_signer.py'), str(key)],
                                    input=json.dumps(request).encode(), capture_output=True)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(json.loads(result.stdout), {'status':'failed', 'code':expected})
            self.assertEqual(result.stderr, b'')
            self.assertNotIn(b'CANARY', result.stdout)

    def test_unsafe_receipt_targets_prevent_signing(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            operation = self.diagnostic_operation()
            target = self.key_dir / consumer.RECEIPT_NAME
            outside = self.root / 'outside'
            outside.write_bytes(b'UNTOUCHED')
            target.symlink_to(outside)
            with patch.object(consumer.subprocess, 'run') as spawn:
                self.assertRaisesRegex(consumer.SigningFailure, '^receipt_io$',
                                       operation.execute, 'synthetic-test-only-passphrase')
                spawn.assert_not_called()
            self.assertEqual(outside.read_bytes(), b'UNTOUCHED')
            target.unlink()
            for kind in ('hardlink', 'permissions', 'directory'):
                with self.subTest(kind=kind):
                    operation = self.diagnostic_operation(initialize=False)
                    if kind == 'hardlink':
                        os.link(outside, target)
                    elif kind == 'permissions':
                        target.write_bytes(b'OLD')
                        target.chmod(0o644)
                    else:
                        target.mkdir()
                    with patch.object(consumer.subprocess, 'run') as spawn:
                        self.assertRaisesRegex(consumer.SigningFailure, '^receipt_io$',
                                               operation.execute, 'synthetic-test-only-passphrase')
                        spawn.assert_not_called()
                    target.rmdir() if kind == 'directory' else target.unlink()

    def test_receipt_io_failure_prevents_signing_and_hides_exception(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            operation = self.diagnostic_operation()
            with patch.object(consumer.os, 'replace', side_effect=OSError('IO-CANARY')), \
                    patch.object(consumer.subprocess, 'run') as spawn:
                self.assertRaisesRegex(consumer.SigningFailure, '^receipt_io$',
                                       operation.execute, 'synthetic-test-only-passphrase')
                spawn.assert_not_called()
            self.assertEqual(list(self.key_dir.glob('.' + consumer.RECEIPT_NAME + '.*')), [])

    def test_protocol_and_subprocess_failures_never_persist_untrusted_output(self):
        cases = [({'status':'failed', 'code':'CANARY'}, 1, 'signer_protocol'),
                 ({'status':'failed', 'code':'key_decrypt', 'extra':'CANARY'}, 1, 'signer_protocol'),
                 (['CANARY'], 1, 'signer_runtime'),
                 ({'status':'signed', 'publicKey':'CANARY', 'signature':'CANARY'}, 0, 'verification'),
                 ({'status':'failed', 'code':'request_policy'}, 1, 'request_policy')]
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            self.diagnostic_operation()
            for payload, returncode, expected in cases:
                with self.subTest(expected=expected, payload=payload):
                    operation = self.diagnostic_operation(initialize=False)
                    fake = subprocess.CompletedProcess([], returncode, json.dumps(payload).encode())
                    with patch.object(consumer.subprocess, 'run', return_value=fake):
                        self.assertRaisesRegex(consumer.SigningFailure, '^' + expected + '$',
                                               operation.execute, 'synthetic-test-only-passphrase')
                    self.assertEqual(self.receipt()['code'], expected)
            for exception in (OSError('CANARY'), subprocess.TimeoutExpired('CANARY', 20)):
                operation = self.diagnostic_operation(initialize=False)
                with patch.object(consumer.subprocess, 'run', side_effect=exception):
                    self.assertRaisesRegex(consumer.SigningFailure, '^signer_subprocess$',
                                           operation.execute, 'synthetic-test-only-passphrase')
                self.assertEqual(self.receipt()['code'], 'signer_subprocess')

    def test_source_and_manifest_write_canary_exceptions_are_fixed(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            operation = self.diagnostic_operation()
            with patch.object(consumer, 'collect', side_effect=ValueError('SOURCE-CANARY')):
                self.assertRaisesRegex(consumer.SigningFailure, '^source_recheck$',
                                       operation.execute, 'synthetic-test-only-passphrase')
            self.assertEqual(self.receipt()['code'], 'source_recheck')
            operation = self.diagnostic_operation(initialize=False)
            original_open = consumer.os.open
            def fail_manifest(path, *args, **kwargs):
                if str(path).endswith('.manifest.json'):
                    raise OSError('WRITE-CANARY')
                return original_open(path, *args, **kwargs)
            with patch.object(consumer.os, 'open', side_effect=fail_manifest):
                self.assertRaisesRegex(consumer.SigningFailure, '^manifest_write$',
                                       operation.execute, 'synthetic-test-only-passphrase')
            self.assertEqual(self.receipt()['code'], 'manifest_write')

    def test_signer_stage_callback_is_fixed_and_legacy_result_unchanged(self):
        key = self.key_dir / 'key.pem'
        stages = []
        result = release_signer.operate({'mode':'init', 'password':'synthetic-test-only-passphrase',
                                         'manifest':None}, key, stage=stages.append)
        self.assertEqual(set(result), {'status', 'publicKey'})
        self.assertEqual(stages, ['request_policy', 'sign'])
        self.assertTrue(set(stages) <= release_signer.FAILURE_CODES)
        stages.clear()
        self.assertRaises(ValueError, release_signer.operate,
                          {'mode':'CANARY', 'password':'CANARY', 'manifest':None}, key,
                          stage=stages.append)
        self.assertEqual(stages, ['request_policy'])

    def test_replaced_private_directory_is_not_written_or_signed(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            operation = self.diagnostic_operation()
            self.key_dir.rename(self.root / 'old-keys')
            self.key_dir.mkdir(mode=0o700)
            with patch.object(consumer.subprocess, 'run') as spawn:
                self.assertRaisesRegex(consumer.SigningFailure, '^receipt_io$',
                                       operation.execute, 'synthetic-test-only-passphrase')
                spawn.assert_not_called()
            self.assertEqual(list(self.key_dir.iterdir()), [])

    def test_post_write_verification_error_removes_only_own_manifest(self):
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            operation = self.diagnostic_operation()
            def fail_final(args, cwd):
                if args[:2] == ['git', 'status'] and any(str(a).startswith(':(exclude)') for a in args):
                    raise OSError('VERIFY-CANARY')
                return self.fake_run(args, cwd)
            with patch.object(consumer, 'run_fixed', side_effect=fail_final):
                self.assertRaisesRegex(consumer.SigningFailure, '^verification$',
                                       operation.execute, 'synthetic-test-only-passphrase')
            self.assertEqual(self.receipt()['code'], 'verification')
            self.assertFalse((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').exists())

    def test_generic_factory_anchors_repo_to_pinned_handler(self):
        with patch.object(consumer, '_factories') as factories:
            consumer.dpos_release_sign('{"versionName":"3.2.0","versionCode":81}')
            self.assertEqual(factories.call_args.args,
                             (Path(consumer.__file__).resolve().parent.parent, consumer._KEY_DIR, consumer._SDK))


if __name__ == '__main__':
    unittest.main()
