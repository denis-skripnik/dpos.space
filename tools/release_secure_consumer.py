"""Project-owned secure-env consumer registration; never import a model-supplied path.

Operator imports register(home, repo, key_dir, sdk_build_tools) from a trusted
startup hook after installing the reviewed secure-env operations-capable build.
No registration, gateway mutation or key creation occurs on import.
"""
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import threading
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# The config loader executes this file without adding its directory to sys.path.
# Keep the canonical format identical to release_signer without an import-time
# dependency on the project tools directory.
def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
                      allow_nan=False).encode('utf-8')

_REPO = Path('/home/assistent/ai-projects/dpos.space')
_KEY_DIR = Path('/home/assistent/.hermes/keys/dpos-release-312')
_SDK = Path('/home/assistent/android-sdk/build-tools/35.0.0')

_PACKAGE = 'space.dpos.android.debug'
_NAME = '3.1.2'
_CODE = 80
_ORIGIN = 'https://github.com/denis-skripnik/dpos.space.git'
_SEMVER = re.compile(r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\Z')
_HEX = re.compile(r'[0-9a-f]{64}\Z')
_COMMIT = re.compile(r'[0-9a-f]{40}\Z')
_LOCK = threading.Lock()
_HISTORIC_CERT = '86b51e10c666cf9c2c4ecdea8407ec068380fb242adb2fae5d237351768f3b27'
# Independently reviewed dependency pin, covered by this consumer's config digest.
# Never derive trust from the adjacent file at registration or binding time.
_SIGNER_SHA256 = '3233b585df748f4a93284d074c5b1ea746be034a97c7b821dc443cc9aaac5681'


def run_fixed(argv, cwd):
    result = subprocess.run(argv, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            timeout=30, check=True, text=True)
    return result.stdout.strip()


def assert_private_dir(path):
    st = path.lstat()
    if path.is_symlink() or not path.is_dir() or st.st_uid != os.getuid() or st.st_mode & 0o077:
        raise ValueError('unsafe private directory')


def artifact_snapshot(apk):
    """Copy from a no-follow descriptor; keep immutable bytes rather than a path."""
    fd = os.open(apk, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_mode & 0o022:
            raise ValueError('unsafe mutable APK')
        if before.st_size < 1 or before.st_size > 80 * 1024 * 1024:
            raise ValueError('APK size invalid')
        with os.fdopen(fd, 'rb', closefd=False) as source:
            data = source.read(before.st_size + 1)
        after = os.fstat(fd)
        identity = lambda st: (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns, st.st_ctime_ns)
        # Reading can update atime; only identity/content-relevant fields are stable.
        if len(data) != before.st_size or identity(after) != identity(before):
            raise ValueError('APK changed during snapshot')
        return data, identity(before)
    finally:
        os.close(fd)


def release_filename(version, code):
    if (type(version) is not str or len(version) > 64 or not _SEMVER.fullmatch(version)
            or type(code) is not int or not 1 <= code <= 2100000000):
        raise ValueError('invalid explicit release version/code')
    return 'dpos-space-' + version + '.apk'


def public_commit(commit):
    if type(commit) is not str or not _COMMIT.fullmatch(commit):
        raise ValueError('invalid public commit')
    # No tokens, cookies, git credentials or model-selected host/repository.
    url = 'https://api.github.com/repos/denis-skripnik/dpos.space/commits/' + commit
    request = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.geturl() != url:
            raise ValueError('unexpected GitHub redirect')
        data = json.loads(response.read(2 * 1024 * 1024))
    if data.get('sha') != commit:
        raise ValueError('commit unavailable on public GitHub')


def collect(repo, sdk, *, version=_NAME, code=_CODE, remote=True, expected_cert=_HISTORIC_CERT):
    """Recompute exact immutable release fields; refuse dirty or unpushed source."""
    repo = Path(repo).resolve(strict=True)
    sdk = Path(sdk).resolve(strict=True)
    filename = release_filename(version, code)
    apk = repo / 'downloads' / filename
    if (repo / 'downloads').is_symlink():
        raise ValueError('linked downloads directory')
    if expected_cert != _HISTORIC_CERT:
        raise ValueError('invalid operator certificate pin')
    snapshot, identity = artifact_snapshot(apk)
    if run_fixed(['git', 'status', '--porcelain', '--untracked-files=all'], repo):
        raise ValueError('dirty source tree: exact commit provenance unavailable')
    commit = run_fixed(['git', 'rev-parse', 'HEAD'], repo)
    if not _COMMIT.fullmatch(commit):
        raise ValueError('invalid commit')
    origin = run_fixed(['git', 'remote', 'get-url', 'origin'], repo)
    if origin not in (_ORIGIN, _ORIGIN.removesuffix('.git')):
        raise ValueError('unverified GitHub origin')
    if remote:
        public_commit(commit)
    badging = run_fixed([str(sdk / 'aapt'), 'dump', 'badging', str(apk)], repo)
    match = re.search(r"^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging, re.M)
    if not match or match.groups() != (_PACKAGE, str(code), version):
        raise ValueError('unexpected package or version')
    if re.search(r'^application-debuggable(?:\s|$)', badging, re.M):
        raise ValueError('debug APK is not a release')
    certs = run_fixed([str(sdk / 'apksigner'), 'verify', '--print-certs', str(apk)], repo)
    match = re.search(r'^Signer #1 certificate SHA-256 digest: ([0-9a-fA-F]{64})$', certs, re.M)
    if not match or 'Signer #2 ' in certs:
        raise ValueError('unexpected signing certificates')
    # Operator-pinned historical APK certificate. Do not derive trust from new APK.
    expected = expected_cert
    if match.group(1).lower() != expected:
        raise ValueError('historical APK signer changed')
    digest = hashlib.sha256(snapshot).hexdigest()
    # The APK itself must be committed in the claimed tree; a clean ignored
    # download or a locally untracked binary is not GitHub source provenance.
    tracked_apk = run_fixed(['git', 'ls-files', '--error-unmatch', '--', 'downloads/' + filename], repo)
    if tracked_apk != 'downloads/' + filename:
        raise ValueError('APK is not tracked')
    committed_blob = run_fixed(['git', 'rev-parse', 'HEAD:downloads/' + filename], repo)
    actual_blob = run_fixed(['git', 'hash-object', str(apk)], repo)
    if committed_blob != actual_blob:
        raise ValueError('APK differs from source commit')
    if (artifact_snapshot(apk) != (snapshot, identity)
            or run_fixed(['git', 'rev-parse', 'HEAD'], repo) != commit
            or run_fixed(['git', 'status', '--porcelain', '--untracked-files=all'], repo)):
        raise ValueError('source or APK changed during verification')
    return {'apk': '/downloads/' + filename,
            'sha256': digest,
            'package': _PACKAGE, 'certificateSha256': expected, 'versionCode': code,
            'versionName': version, 'sourceCommit': commit}


def _factories(repo, key_dir, sdk_build_tools, *, expected_cert=_HISTORIC_CERT):
    """Build two purpose-bound factories from operator-locked paths.

    Caller must supply fixed paths out of band. No path or command is accepted
    from the LLM/tool request. An operation runs at most once per process.
    """
    from secure_env_ingress.operations import BoundOperation
    repo, key_dir, sdk = Path(repo).resolve(strict=True), Path(key_dir).resolve(strict=True), Path(sdk_build_tools).resolve(strict=True)
    assert_private_dir(key_dir)
    if expected_cert != _HISTORIC_CERT:
        raise ValueError('historical certificate differs from independently verified installed 3.1.1')
    key = key_dir / 'dpos-release-ed25519.pem'
    signer = Path(__file__).resolve().with_name('release_signer.py')
    def check_signer():
        if hashlib.sha256(signer.read_bytes()).hexdigest() != _SIGNER_SHA256:
            raise ValueError('trusted signer changed')

    check_signer()

    def spawn(mode, password, manifest):
        # Recheck before serializing or delivering the password to a subprocess.
        check_signer()
        payload = canonical({'mode': mode, 'password': password, 'manifest': manifest})
        proc = subprocess.run([sys.executable, str(signer), str(key)], input=payload,
                              stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                              env={'PATH': '/usr/bin:/bin', 'PYTHONNOUSERSITE': '1'},
                              timeout=20, check=True)
        result = json.loads(proc.stdout)
        if (set(result) != ({'status', 'publicKey'} if mode == 'init' else {'status', 'publicKey', 'signature'})
                or result['status'] != ('initialized' if mode == 'init' else 'signed')):
            raise ValueError('signer result invalid')
        return result

    def init_factory(raw):
        check_signer()
        if json.loads(raw) != {'release': _NAME}:
            raise ValueError('invalid init parameters')
        if key.exists() or key.is_symlink():
            raise ValueError('release key already exists')
        consumed = False
        def execute(password):
            nonlocal consumed
            with _LOCK:
                if consumed:
                    raise ValueError('operation already consumed')
                consumed = True
            assert_private_dir(key_dir)
            result = spawn('init', password, None)
            # Public pin may be read by operator; not model/secret return value.
            public_path = key_dir / 'dpos-release-ed25519.public'
            fd = os.open(public_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'w') as target:
                target.write(result['publicKey'] + '\n')
        return BoundOperation('Create a NEW encrypted DPoS 3.1.2 manifest key in the operator-private directory; no APK signing key is changed.', execute)

    def sign_factory(raw):
        check_signer()
        params = json.loads(raw)
        if type(params) is not dict or set(params) != {'versionName', 'versionCode'}:
            raise ValueError('invalid sign parameters')
        version, code = params['versionName'], params['versionCode']
        filename = release_filename(version, code)
        # Immutable per-version output; latest alias is separately reviewed/published.
        output = repo / 'downloads' / ('dpos-space-' + version + '.manifest.json')
        fields = collect(repo, sdk, version=version, code=code, expected_cert=expected_cert)
        if output.exists() or output.is_symlink():
            raise ValueError('release manifest already exists')
        # Freeze canonical manifest and immutable artifact identity at issuance.
        apk = repo / 'downloads' / filename
        frozen, identity = artifact_snapshot(apk)
        directory = (repo / 'downloads').stat()
        directory_identity = (directory.st_dev, directory.st_ino)
        if hashlib.sha256(frozen).hexdigest() != fields['sha256']:
            raise ValueError('artifact changed after binding')
        instant = datetime.now(timezone.utc).replace(microsecond=0)
        manifest = {**fields, 'publishedAt': instant.isoformat().replace('+00:00', 'Z'),
                    'notBefore': (instant + timedelta(hours=24)).isoformat().replace('+00:00', 'Z')}
        consumed = False
        def execute(password):
            nonlocal consumed
            with _LOCK:
                if consumed:
                    raise ValueError('operation already consumed')
                consumed = True
            assert_private_dir(key_dir)
            def recheck():
                if output.exists() or output.is_symlink():
                    raise ValueError('release manifest already exists')
                directory = (repo / 'downloads').lstat()
                if (not stat.S_ISDIR(directory.st_mode)
                        or (directory.st_dev, directory.st_ino) != directory_identity):
                    raise ValueError('downloads directory changed')
                current, current_identity = artifact_snapshot(apk)
                if current_identity != identity or current != frozen or collect(repo, sdk, version=version, code=code, expected_cert=expected_cert) != fields:
                    raise ValueError('source or artifact changed')
            recheck()
            result = spawn('sign', password, manifest)
            recheck()
            envelope = {'manifest': manifest, 'publicKey': result['publicKey'],
                        'signature': result['signature']}
            # First write wins. Secret and private key never go to the repo.
            directory_fd = os.open(repo / 'downloads', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            created = None
            try:
                directory = os.fstat(directory_fd)
                if (directory.st_dev, directory.st_ino) != directory_identity:
                    raise ValueError('downloads directory changed')
                fd = os.open(output.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                             0o600, dir_fd=directory_fd)
                created = os.fstat(fd)
                with os.fdopen(fd, 'wb') as target:
                    target.write(canonical(envelope) + b'\n')
                    target.flush()
                    os.fsync(target.fileno())
                current, current_identity = artifact_snapshot(apk)
                directory = (repo / 'downloads').lstat()
                if (current_identity != identity or current != frozen
                        or (directory.st_dev, directory.st_ino) != directory_identity
                        or run_fixed(['git', 'rev-parse', 'HEAD'], repo) != fields['sourceCommit']
                        or run_fixed(['git', 'status', '--porcelain', '--untracked-files=all',
                                      '--', '.', ':(exclude)downloads/' + output.name], repo)):
                    raise ValueError('source or APK changed during manifest write')
                os.fsync(directory_fd)
            except BaseException:
                # Never delete an output won/replaced by a concurrent operation.
                if created is not None:
                    try:
                        current = os.stat(output.name, dir_fd=directory_fd, follow_symlinks=False)
                        if (current.st_dev, current.st_ino) == (created.st_dev, created.st_ino):
                            os.unlink(output.name, dir_fd=directory_fd)
                    except FileNotFoundError:
                        pass
                raise
            finally:
                os.close(directory_fd)
        return BoundOperation('Sign DPoS ' + version + ': package ' + _PACKAGE + ', code ' + str(code) + ', immutable output ' + output.name + ', APK SHA-256 '
                              + fields['sha256'] + ', certificate ' + fields['certificateSha256']
                              + ', GitHub commit ' + fields['sourceCommit'] + '. Earliest install: '
                              + manifest['notBefore'] + '.', execute)

    return init_factory, sign_factory


def dpos_release_key_init(raw):
    return _factories(_REPO, _KEY_DIR, _SDK)[0](raw)


def dpos_release_sign(raw):
    # Registration pins this handler's path and digest in the clean release worktree.
    return _factories(Path(__file__).resolve().parent.parent, _KEY_DIR, _SDK)[1](raw)


def dpos_release_sign_312(raw):
    if json.loads(raw) != {'release': _NAME}:
        raise ValueError('invalid legacy sign parameters')
    return _factories(_REPO, _KEY_DIR, _SDK)[1](canonical({'versionName': _NAME, 'versionCode': _CODE}))


def register(home, repo, key_dir, sdk_build_tools, *, expected_cert=_HISTORIC_CERT):
    """Legacy trusted embedding API; config allowlist uses top-level factories."""
    from secure_env_ingress.operations import register_consumer
    init, sign = _factories(repo, key_dir, sdk_build_tools, expected_cert=expected_cert)
    register_consumer(home, 'dpos_release_key_init', init)
    register_consumer(home, 'dpos_release_sign', sign)
    def legacy(raw):
        if json.loads(raw) != {'release': _NAME}:
            raise ValueError('invalid legacy sign parameters')
        return sign(canonical({'versionName': _NAME, 'versionCode': _CODE}))
    register_consumer(home, 'dpos_release_sign_312', legacy)
