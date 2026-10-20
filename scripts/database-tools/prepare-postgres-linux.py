"""Build PostgreSQL clients from the pinned release source on the target Linux architecture."""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import subprocess
import sys
import tarfile
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VERSION = '18.6'
URL = f'https://ftp.postgresql.org/pub/source/v{VERSION}/postgresql-{VERSION}.tar.bz2'
SHA256 = '555610c24d53e4316da5b7d3fc25c279d96856d5e0e23ee308c328c5fa881d9f'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--arch', required=True, choices=['arm64', 'x64'])
    args = parser.parse_args()
    destination = ROOT / 'resources/database-tools' / f'linux-{args.arch}'
    if (destination / 'postgresql' / VERSION).exists():
        return  # The complete bundle is hash-verified by the caller.
    cache = ROOT / '.cache/database-tools'
    cache.mkdir(parents=True, exist_ok=True)
    archive = cache / f'postgresql-{VERSION}.tar.bz2'
    if not archive.exists():
        urllib.request.urlretrieve(URL, archive)
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != SHA256:
            raise RuntimeError('PostgreSQL source checksum mismatch')
    build = cache / f'postgres-build-{args.arch}'
    build.mkdir(exist_ok=True)
    source = build / f'postgresql-{VERSION}'
    if not source.exists():
        with tarfile.open(archive) as packed:
            packed.extractall(build, filter='data')
    prefix = build / 'install'
    subprocess.run(['./configure', f'--prefix={prefix}', '--without-icu', '--without-readline', '--with-openssl', '--with-lz4', '--with-zstd'], cwd=source, check=True)
    for directory, targets in [
        ('src/backend', ['generated-headers']), ('src/port', ['all']), ('src/common', ['all']),
        ('src/interfaces/libpq', ['all', 'install']), ('src/fe_utils', ['all']),
        ('src/bin/pg_dump', ['all', 'install']), ('src/bin/psql', ['all', 'install']),
    ]:
        subprocess.run(['make', '-C', str(source / directory), '-j4', *targets], check=True)
    built = cache / f'postgresql-{VERSION}-linux-{args.arch}-clients.tar.gz'
    with tarfile.open(built, 'w:gz') as packed:
        packed.add(prefix, arcname='postgresql')
        packed.add(source / 'COPYRIGHT', arcname='postgresql/LICENSE')
    spec = importlib.util.spec_from_file_location('portable', HERE / 'prepare-portable.py')
    portable = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(portable)
    portable.prepare({'engine': 'postgresql', 'version': VERSION, 'platform': 'linux', 'arch': args.arch,
                      'url': built.as_uri(), 'sha256': portable.checksum(built), 'upstream': URL,
                      'sourceUrl': URL, 'binaries': ['pg_dump', 'pg_restore', 'psql']}, destination, cache)
    manifest_path = destination / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    for tool in manifest['tools']:
        if tool['engine'] == 'postgresql':
            tool['sourceChecksum'] = SHA256
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
