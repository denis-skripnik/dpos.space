"""Runtime selection regressions; synthetic keys only, no live configuration."""
import base64
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import test_release_secure as fixtures
import pm.environments as environments
from hermes_cli.update_owning_install import owning_install_root

consumer = fixtures.consumer
ROOT = Path(__file__).resolve().parents[1]
ENV = {'PATH': '/usr/bin:/bin', 'PYTHONNOUSERSITE': '1'}


def selected_python():
    return str(environments.project_python(Path(environments.__file__).resolve().parent.parent))


class RuntimeTest(unittest.TestCase):
    root: Path
    repo: Path
    key_dir: Path
    sdk: Path
    setUp = fixtures.ReleaseTest.setUp
    fake_run = fixtures.ReleaseTest.fake_run

    def test_gateway_base_process_with_activated_modules_signs_using_selected_venv(self):
        selected = selected_python()
        base = str(Path(selected).resolve())
        module_root = Path(environments.__file__).resolve().parent.parent
        # A terminal can import a PM generation snapshot; the gateway launcher
        # imports PM from its owning install before activating dependency paths.
        gateway_root = owning_install_root(module_root) or module_root
        probe = subprocess.run([base, '-c', 'import cryptography'], env=ENV, capture_output=True)
        self.assertNotEqual(probe.returncode, 0, 'regression requires the dependency-free gateway base')
        self.assertIn(b"No module named 'cryptography'", probe.stderr)
        # Gateway starts the base interpreter and activates dependency module paths.
        # Reproduce that split, rather than merely mocking sys.executable.
        script = '''
import sys, unittest
from unittest.mock import patch
sys.path[:0] = MODULE_PATHS
import test_release_secure as fixtures
import pm.environments as environments
from pathlib import Path
consumer = fixtures.consumer
expected = str(environments.project_python(Path(environments.__file__).resolve().parent.parent))
assert sys.executable != expected
import cryptography
real_run = consumer.subprocess.run
calls = []
def observe(argv, **kwargs):
    if len(argv) > 1 and argv[1].endswith('release_signer.py'):
        calls.append(argv[0])
        assert argv[0] == expected, argv[0]
    return real_run(argv, **kwargs)
suite = unittest.TestSuite([fixtures.ReleaseTest('test_encrypted_key_one_shot_signed_snapshot_and_tamper')])
with patch.object(consumer.subprocess, 'run', side_effect=observe):
    result = unittest.TextTestRunner().run(suite)
assert result.wasSuccessful()
assert calls == [expected, expected], calls
print('gateway-base activated imports PASS; selected-venv init/sign verified PASS')
'''.replace('MODULE_PATHS', repr([str(ROOT / 'tests'), str(gateway_root), *sys.path]))
        result = subprocess.run([base, '-c', script], env=ENV, capture_output=True, timeout=40)
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertIn(b'selected-venv init/sign verified PASS', result.stdout)

    def test_runtime_is_frozen_at_each_binding_not_registration_or_callback(self):
        selected = selected_python()
        calls = []
        real_run = consumer.subprocess.run
        def observe(argv, **kwargs):
            if len(argv) > 1 and argv[1].endswith('release_signer.py'):
                calls.append(argv[0])
            return real_run(argv, **kwargs)
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run):
            init, sign = consumer._factories(self.repo, self.key_dir, self.sdk)
            with patch.object(environments, 'project_python', return_value=Path(selected)):
                bound_init = init('{"release":"3.1.2"}')
            with patch.object(environments, 'project_python', side_effect=AssertionError('must not reselect')), \
                    patch.object(consumer.subprocess, 'run', side_effect=observe):
                bound_init.execute('synthetic-test-only-passphrase')
            with patch.object(environments, 'project_python', return_value=Path(selected)):
                bound_sign = sign('{"versionName":"3.1.2","versionCode":80}')
            with patch.object(environments, 'project_python', side_effect=AssertionError('must not reselect')), \
                    patch.object(sys, 'executable', str(self.root / 'missing-python')), \
                    patch.object(consumer.subprocess, 'run', side_effect=observe):
                bound_sign.execute('synthetic-test-only-passphrase')
        self.assertEqual(calls, [selected, selected])
        envelope = json.loads((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').read_bytes())
        fixtures.Ed25519PublicKey.from_public_bytes(base64.b64decode(envelope['publicKey'])).verify(
            base64.b64decode(envelope['signature']),
            b'dpos.space/release/v1\n' + consumer.canonical(envelope['manifest']))

    def test_missing_nonpython_and_dependency_free_runtime_refuse_before_binding(self):
        candidates = [self.root / 'missing-python', Path('/bin/true'), Path(selected_python()).resolve()]
        with patch.object(consumer, 'collect') as collect:
            init, sign = consumer._factories(self.repo, self.key_dir, self.sdk)
            for candidate in candidates:
                for factory, raw in ((init, '{"release":"3.1.2"}'),
                                     (sign, '{"versionName":"3.1.2","versionCode":80}')):
                    with self.subTest(runtime=str(candidate), raw=raw), \
                            patch.object(environments, 'project_python', return_value=candidate):
                        self.assertRaisesRegex(consumer.SigningFailure, '^signer_runtime$', factory, raw)
            collect.assert_not_called()
        self.assertEqual(list(self.key_dir.iterdir()), [])
        self.assertFalse((self.repo / 'downloads/dpos-space-3.1.2.manifest.json').exists())

    def test_selection_and_preflight_errors_have_only_fixed_diagnostic(self):
        with patch.object(consumer, 'collect') as collect:
            init, sign = consumer._factories(self.repo, self.key_dir, self.sdk)
            for factory, raw in ((init, '{"release":"3.1.2"}'),
                                 (sign, '{"versionName":"3.1.2","versionCode":80}')):
                with patch.object(environments, 'project_python', side_effect=RuntimeError('RUNTIME-CANARY')):
                    self.assertRaisesRegex(consumer.SigningFailure, '^signer_runtime$', factory, raw)
                with patch.object(consumer.subprocess, 'run', side_effect=subprocess.TimeoutExpired('CANARY', 20)):
                    self.assertRaisesRegex(consumer.SigningFailure, '^signer_runtime$', factory, raw)
            collect.assert_not_called()
        self.assertEqual(list(self.key_dir.iterdir()), [])

    def test_preflight_has_no_secret_key_path_or_inherited_environment(self):
        real_run = consumer.subprocess.run
        calls = []
        def observe(argv, **kwargs):
            calls.append((argv, kwargs))
            return real_run(argv, **kwargs)
        with patch.object(consumer, 'run_fixed', side_effect=self.fake_run), \
                patch.object(consumer.subprocess, 'run', side_effect=observe):
            _, sign = consumer._factories(self.repo, self.key_dir, self.sdk)
            sign('{"versionName":"3.1.2","versionCode":80}')
        self.assertEqual(len(calls), 1)
        argv, kwargs = calls[0]
        self.assertEqual(argv[:2], [selected_python(), '-c'])
        self.assertNotIn(str(self.key_dir), ' '.join(argv))
        self.assertNotIn('input', kwargs)
        self.assertEqual(kwargs['env'], ENV)
        self.assertEqual(kwargs['stdin'], subprocess.DEVNULL)
        self.assertEqual(kwargs['stderr'], subprocess.DEVNULL)
        self.assertEqual(list(self.key_dir.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
