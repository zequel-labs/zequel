"""Build MariaDB and SQLite clients on Linux ARM64 from checksum-pinned sources."""
import hashlib
import importlib.util
import json
import pathlib
import platform
import shutil
import subprocess
import tarfile
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = ROOT / '.cache/database-tools'


def prepare(engine, version, url, expected, algorithm, binaries):
    destination = ROOT / 'resources/database-tools/linux-arm64'
    if (destination / engine / version).exists():
        return
    CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / url.rsplit('/', 1)[-1]
    if not archive.exists():
        urllib.request.urlretrieve(url, archive)
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream, algorithm).hexdigest() != expected:
            raise RuntimeError(f'{engine} source checksum mismatch')
    work = CACHE / f'{engine}-linux-arm64-build'
    work.mkdir(exist_ok=True)
    if not any(path.is_dir() and path.name.startswith(f'{engine}-') for path in work.iterdir()):
        with tarfile.open(archive) as packed:
            packed.extractall(work, filter='data')
    source = next(path for path in work.iterdir() if path.is_dir() and path.name.startswith(f'{engine}-'))
    prefix = work / 'install'
    (prefix / 'bin').mkdir(parents=True, exist_ok=True)
    if engine == 'mariadb':
        build = work / 'build'
        subprocess.run(['cmake', '-S', str(source), '-B', str(build), '-DWITHOUT_SERVER=ON',
                        '-DWITH_UNIT_TESTS=OFF', '-DWITH_PCRE=bundled', '-DWITH_ZLIB=bundled',
                        '-DWITH_WSREP=OFF', '-DWITH_SSL=system', '-DCMAKE_BUILD_TYPE=Release'], check=True)
        subprocess.run(['cmake', '--build', str(build), '--target', *binaries, '--parallel', '4'], check=True)
        for name in binaries:
            shutil.copy2(build / 'client' / name, prefix / 'bin' / name)
        shutil.copy2(source / 'COPYING', prefix / 'LICENSE')
    else:
        subprocess.run(['./configure', f'--prefix={prefix}', '--disable-readline', '--disable-shared'], cwd=source, check=True)
        subprocess.run(['make', '-j4', 'sqlite3'], cwd=source, check=True)
        shutil.copy2(source / 'sqlite3', prefix / 'bin/sqlite3')
        shutil.copy2(HERE / 'licenses/SQLite.txt', prefix / 'LICENSE')
    built = CACHE / f'{engine}-{version}-linux-arm64-clients.tar.gz'
    with tarfile.open(built, 'w:gz') as packed:
        packed.add(prefix, arcname=engine)
    spec = importlib.util.spec_from_file_location('portable', HERE / 'prepare-portable.py')
    portable = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(portable)
    portable.prepare({'engine': engine, 'version': version, 'platform': 'linux', 'arch': 'arm64',
                      'url': built.as_uri(), 'sha256': portable.checksum(built), 'sourceUrl': url, 'upstream': url,
                      'binaries': binaries}, destination, CACHE)
    manifest_path = destination / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    for tool in manifest['tools']:
        if tool['engine'] == engine:
            tool['sourceChecksum'] = expected
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    if platform.system() != 'Linux' or platform.machine() not in ['aarch64', 'arm64']:
        raise RuntimeError('These clients must be built on Linux ARM64')
    prepare('mariadb', '11.4.13',
            'https://archive.mariadb.org/mariadb-11.4.13/source/mariadb-11.4.13.tar.gz',
            '1bb254b106d0a7ca871cfa18fa6e18d4b80a7430f9ec9d1571ec4271a13def96',
            'sha256', ['mariadb', 'mariadb-dump'])
    prepare('sqlite', '3.54.1', 'https://www.sqlite.org/2026/sqlite-autoconf-3540100.tar.gz',
            'b6ced585c750916b1052667239a12c25a7ff34e7f06e1e6e01ecb0427657d9c4',
            'sha3_256', ['sqlite3'])
