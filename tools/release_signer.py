"""DPoS release-only signer. No password or private key enters argv/env/results.

This process is invoked with a fixed executable path by trusted project code, not
with paths supplied by a model. Its stdin is a private pipe carrying one JSON
request. This is not a sandbox against a malicious same-UID process.
"""
import base64
import json
import os
import sys
import re
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
                      allow_nan=False).encode('utf-8')


def restricted_private_file(path):
    st = path.lstat()
    if not path.is_file() or st.st_uid != os.getuid() or st.st_nlink != 1 or st.st_mode & 0o077:
        raise ValueError('unsafe key file')
    if path.is_symlink():
        raise ValueError('unsafe key file')


def operate(request, key_path):
    if type(request) is not dict or set(request) != {'mode', 'password', 'manifest'}:
        raise ValueError('invalid request')
    mode, password, manifest = request['mode'], request['password'], request['manifest']
    if mode not in ('init', 'sign') or type(password) is not str or len(password) < 16:
        raise ValueError('invalid request')
    if mode == 'init':
        if manifest is not None or key_path.exists() or key_path.is_symlink():
            raise ValueError('key already exists or request invalid')
        private = ed25519.Ed25519PrivateKey.generate()
        encrypted = private.private_bytes(serialization.Encoding.PEM,
                                          serialization.PrivateFormat.PKCS8,
                                          serialization.BestAvailableEncryption(password.encode()))
        fd = os.open(key_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(fd, 'wb') as out:
                out.write(encrypted)
                out.flush()
                os.fsync(out.fileno())
        except BaseException:
            key_path.unlink(missing_ok=True)
            raise
    else:
        if type(manifest) is not dict or set(manifest) != {'apk', 'sha256', 'package', 'certificateSha256', 'versionCode', 'versionName', 'sourceCommit', 'publishedAt', 'notBefore'}:
            raise ValueError('invalid release manifest')
        if (manifest['apk'] != '/downloads/dpos-space-3.1.2.apk'
                or manifest['package'] != 'space.dpos.android.debug'
                or type(manifest['versionCode']) is not int or manifest['versionCode'] != 80
                or manifest['versionName'] != '3.1.2'
                or any(type(manifest[k]) is not str or not re.fullmatch('[0-9a-f]{64}', manifest[k])
                       for k in ('sha256', 'certificateSha256'))
                or type(manifest['sourceCommit']) is not str
                or not re.fullmatch('[0-9a-f]{40}', manifest['sourceCommit'])):
            raise ValueError('invalid release identity')
        try:
            published = datetime.strptime(manifest['publishedAt'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
            available = datetime.strptime(manifest['notBefore'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            raise ValueError('invalid release timing') from None
        if (available - published).total_seconds() < 86400:
            raise ValueError('release delay too short')
        restricted_private_file(key_path)
        private = serialization.load_pem_private_key(key_path.read_bytes(), password.encode())
        if not isinstance(private, ed25519.Ed25519PrivateKey):
            raise ValueError('invalid key type')
    public = base64.b64encode(private.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw)).decode()
    if mode == 'init':
        return {'status': 'initialized', 'publicKey': public}
    signature = base64.b64encode(private.sign(b'dpos.space/release/v1\n' + canonical(manifest))).decode()
    return {'status': 'signed', 'publicKey': public, 'signature': signature}


def main():
    # Fixed key location configured by operator; not taken from stdin or model parameters.
    if len(sys.argv) != 2:
        raise ValueError('expected trusted key location')
    key_path = Path(sys.argv[1])
    request = json.loads(sys.stdin.buffer.read(8193))
    if key_path.parent.is_symlink() or not key_path.parent.is_dir():
        raise ValueError('unsafe key directory')
    parent = key_path.parent.stat()
    if parent.st_uid != os.getuid() or parent.st_mode & 0o077:
        raise ValueError('unsafe key directory')
    print(json.dumps(operate(request, key_path), sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"status":"failed"}')
        sys.exit(1)
