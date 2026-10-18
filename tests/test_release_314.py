"""3.1.4 packaging and purpose-bound signer checks; no key access or signing."""
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch, Mock
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import release_secure_consumer as consumer

class Release314Test(unittest.TestCase):
    def test_version_and_monotonic_code(self):
        source = (ROOT / 'android/app/build.gradle.kts').read_text()
        self.assertIn('versionCode = 82', source)
        self.assertIn('versionName = "3.1.4"', source)
        for name in ('3.1.2', '3.1.3'):
            manifest = json.loads((ROOT / ('downloads/dpos-space-' + name + '.manifest.json')).read_text())['manifest']
            self.assertGreater(82, manifest['versionCode'])
        self.assertIn('applicationIdSuffix = ".debug"', source)
        self.assertIn('https://dpos.blinddev.xyz/', source)
        self.assertIn('dposReleasePublicKey', source)

    def test_exact_purpose_bound_parameters_and_paths(self):
        sign = Mock(return_value='bound-only-no-signing')
        with patch.object(consumer, '_factories', return_value=(None, sign)) as factories:
            self.assertEqual(consumer.dpos_release_sign_314('{"release":"3.1.4"}'), 'bound-only-no-signing')
            factories.assert_called_once_with(ROOT, consumer._KEY_DIR, consumer._SDK)
            self.assertEqual(json.loads(sign.call_args.args[0]), {'versionName':'3.1.4','versionCode':82})

    def test_rejects_other_versions_overrides_and_extra_fields(self):
        for value in ({'release':'3.1.2'}, {'release':'3.1.3'}, {'release':'3.1.4','path':'/evil'},
                      {'versionName':'3.1.4','versionCode':82}, {}, [], None):
            with self.subTest(value=value), patch.object(consumer, '_factories') as factories:
                with self.assertRaises(ValueError):
                    consumer.dpos_release_sign_314(json.dumps(value))
                factories.assert_not_called()

if __name__ == '__main__':
    unittest.main()
