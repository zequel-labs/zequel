"""Build only MariaDB clients from pinned GPL source; bundle their TLS dependency closure."""
import argparse
import hashlib
import json
import os
import pathlib
import platform
import shutil
import subprocess
import tarfile
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
VERSION = '11.4.13'
SOURCE_URL = f'https://archive.mariadb.org/mariadb-{VERSION}/source/mariadb-{VERSION}.tar.gz'
SOURCE_SHA256 = '1bb254b106d0a7ca871cfa18fa6e18d4b80a7430f9ec9d1571ec4271a13def96'


def digest(path):
    hasher = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            hasher.update(chunk)
    return hasher.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--arch', choices=['arm64', 'x64'], required=True)
    parser.add_argument('--openssl-prefix', type=pathlib.Path, required=True)
    parser.add_argument('--cmake', default='cmake')
    parser.add_argument('--archive', type=pathlib.Path)
    parser.add_argument('--build-directory', type=pathlib.Path)
    parser.add_argument('--source-directory', type=pathlib.Path)
    parser.add_argument('--native-generators', type=pathlib.Path)
    args = parser.parse_args()
    cache = ROOT / '.cache/database-tools'
    cache.mkdir(parents=True, exist_ok=True)
    archive = args.archive or cache / f'mariadb-{VERSION}.tar.gz'
    if not archive.exists():
        urllib.request.urlretrieve(SOURCE_URL, archive)
    if digest(archive) != SOURCE_SHA256:
        raise RuntimeError('MariaDB source checksum mismatch')
    source = args.source_directory or cache / f'mariadb-{VERSION}'
    if not source.exists():
        with tarfile.open(archive) as packed:
            packed.extractall(cache, filter='data')
    build = args.build_directory or cache / f'mariadb-build-{args.arch}'
    ssl = args.openssl_prefix.resolve()
    cross = ['-DCMAKE_SYSTEM_NAME=Darwin', f'-DIMPORT_EXECUTABLES={args.native_generators.resolve()}'] if args.native_generators else []
    subprocess.run([args.cmake, '-S', str(source), '-B', str(build), *cross, '-DWITHOUT_SERVER=ON', '-DWITH_UNIT_TESTS=OFF', '-DWITH_PCRE=bundled', '-DWITH_ZLIB=bundled', '-DWITH_WSREP=OFF', '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_OSX_DEPLOYMENT_TARGET=11.0', '-DCMAKE_OSX_ARCHITECTURES=' + ('x86_64' if args.arch == 'x64' else 'arm64'), f'-DWITH_SSL={ssl}', f'-DOPENSSL_INCLUDE_DIR={ssl}/include', f'-DOPENSSL_SSL_LIBRARY={ssl}/lib/libssl.3.dylib', f'-DOPENSSL_CRYPTO_LIBRARY={ssl}/lib/libcrypto.3.dylib'], check=True)
    subprocess.run([args.cmake, '--build', str(build), '--target', 'mariadb', 'mariadb-dump', '--parallel', '4'], check=True)
    destination = ROOT / 'resources/database-tools' / f'darwin-{args.arch}'
    relative = pathlib.Path('mariadb') / VERSION
    target = destination / relative
    if target.exists():
        raise RuntimeError(f'Toolchain already exists: {target}')
    try:
        (target / 'bin').mkdir(parents=True)
        (target / 'lib').mkdir()
        binaries = {}
        for name in ['mariadb', 'mariadb-dump']:
            output = target / 'bin' / name
            shutil.copy2(build / 'client' / name, output)
            for line in subprocess.check_output(['otool', '-L', str(output)], text=True).splitlines():
                if not line.startswith('\t'):
                    continue
                dependency = line.strip().split(' (', 1)[0]
                if dependency.startswith(('/usr/lib/', '/System/Library/')):
                    continue
                library = pathlib.Path(dependency).name
                if library not in ['libssl.3.dylib', 'libcrypto.3.dylib']:
                    raise RuntimeError(f'Unexpected client dependency: {dependency}')
                subprocess.run(['install_name_tool', '-change', dependency, f'@loader_path/../lib/{library}', str(output)], check=True)
            subprocess.run(['codesign', '--force', '--sign', '-', str(output)], check=True)
            binaries[name] = str(relative / 'bin' / name)
        for name in ['libssl.3.dylib', 'libcrypto.3.dylib']:
            # This earlier build step already verified and made the upstream TLS libraries relocatable.
            shutil.copy2(destination / 'postgresql/18.6/lib' / name, target / 'lib' / name)
        (target / 'licenses').mkdir()
        shutil.copy2(source / 'COPYING', target / 'licenses/MariaDB-GPLv2.txt')
        shutil.copy2(HERE / 'licenses/OpenSSL.txt', target / 'licenses/OpenSSL.txt')
        (target / 'SOURCE.json').write_text(json.dumps({'url': SOURCE_URL, 'sha256': SOURCE_SHA256}, indent=2) + '\n')
        for name in binaries:
            architecture = 'x86_64' if args.arch == 'x64' else 'arm64'
            subprocess.run(['lipo', '-verify_arch', architecture, str(target / 'bin' / name)], check=True)
            if platform.machine() == architecture:
                result = subprocess.check_output([str(target / 'bin' / name), '--version'], text=True, env={'PATH': '/usr/bin:/bin', 'HOME': '/nonexistent'})
                if VERSION not in result:
                    raise RuntimeError(f'Unexpected version: {result}')
        manifest_path = destination / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['tools'] = [tool for tool in manifest['tools'] if tool['engine'] != 'mariadb']
        manifest['tools'].append({'engine': 'mariadb', 'version': VERSION, 'sourceUrl': SOURCE_URL, 'sourceChecksum': SOURCE_SHA256, 'binaries': binaries, 'files': {str(path.relative_to(destination)): digest(path) for path in target.rglob('*') if path.is_file()}})
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        print(f'Prepared MariaDB {VERSION} for macOS {args.arch}')
    except BaseException:
        shutil.rmtree(target, ignore_errors=True)
        raise

if __name__ == '__main__':
    main()
