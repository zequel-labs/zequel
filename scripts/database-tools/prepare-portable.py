"""Fetch pinned official client archives. Downloads happen at build time, never in the app."""
import argparse
import hashlib
import json
import os
import pathlib
import platform
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCES = json.loads((HERE / 'portable-sources.json').read_text())


def checksum(path, algorithm='sha256'):
    digest = hashlib.new(algorithm)
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def prepare(source, destination, cache):
    archive = cache / source['url'].rsplit('/', 1)[-1]
    algorithm = 'sha256' if 'sha256' in source else 'sha3_256'
    expected = source[algorithm]
    if not archive.exists() or checksum(archive, algorithm) != expected:
        temporary = archive.with_suffix(archive.suffix + '.download')
        urllib.request.urlretrieve(source['url'], temporary)
        if checksum(temporary, algorithm) != expected:
            temporary.unlink()
            raise RuntimeError(f"Checksum mismatch: {source['url']}")
        temporary.replace(archive)
    relative = pathlib.Path(source['engine']) / source['version']
    target = destination / relative
    if target.exists():
        manifest_path = destination / 'manifest.json'
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'tools': []}
        previous = next((tool for tool in manifest['tools'] if tool['engine'] == source['engine'] and tool['version'] == source['version']), None)
        if previous and previous.get('sourceChecksum') == expected and previous.get('files') and all((destination / name).is_file() and checksum(destination / name) == digest for name, digest in previous['files'].items()):
            print(f"Already verified: {source['engine']} {source['version']}", flush=True)
            return
        raise RuntimeError(f'Existing toolchain is incomplete or modified: {target}. Remove it explicitly before rebuilding.')
    with tempfile.TemporaryDirectory(prefix='zequel-tool-extract-') as directory:
        extracted = pathlib.Path(directory)
        if archive.name.endswith('.zip'):
            with zipfile.ZipFile(archive) as zipped:
                for item in zipped.infolist():
                    (extracted / item.filename).resolve().relative_to(extracted.resolve())
                    if (item.external_attr >> 16) & 0o170000 == 0o120000:
                        raise RuntimeError('Unexpected archive symlink')
                zipped.extractall(extracted)
        else:
            with tarfile.open(archive) as packed:
                packed.extractall(extracted, filter='data')
        try:
            target.mkdir(parents=True)
            binaries = {}
            for name in source['binaries']:
                executable = name + ('.exe' if source['platform'] == 'win32' else '')
                matches = [path for path in extracted.rglob(executable) if path.is_file()]
                preferred = [path for path in matches if path.parent.name.lower() == 'bin']
                if len(preferred) == 1:
                    matches = preferred
                if len(matches) != 1:
                    raise RuntimeError(f'Expected one {executable}, found {len(matches)}')
                original_root = matches[0].parent.parent if matches[0].parent.name == 'bin' else matches[0].parent
                copied = set()
                def copy_executable(original):
                    original = pathlib.Path(os.path.abspath(original))
                    local = original.relative_to(original_root)
                    if local in copied:
                        return
                    copied.add(local)
                    output = target / (local if len(local.parts) > 1 else pathlib.Path('bin') / local)
                    output.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(original, output)
                    output.chmod(0o755)
                    if source['platform'] == 'darwin' and platform.system() == 'Darwin':
                        for line in subprocess.check_output(['otool', '-L', str(original)], text=True).splitlines():
                            if not line.startswith('\t'):
                                continue
                            dependency = line.strip().split(' (', 1)[0]
                            if dependency.startswith(('/usr/lib/', '/System/Library/')) or pathlib.Path(dependency).name == original.name:
                                continue
                            if dependency.startswith('@loader_path/'):
                                resolved = pathlib.Path(os.path.abspath(original.parent / dependency.removeprefix('@loader_path/')))
                            elif dependency.startswith('@rpath/'):
                                resolved = original_root / 'lib' / dependency.removeprefix('@rpath/')
                            else:
                                raise RuntimeError(f'Non-relocatable dependency: {dependency}')
                            resolved.resolve().relative_to(original_root.resolve())
                            copy_executable(resolved)
                    if source['platform'] == 'linux':
                        if platform.system() != 'Linux':
                            raise RuntimeError('Linux toolchains must be prepared and tested on Linux')
                        search = ':'.join(str(original_root / path) for path in ['lib', 'lib/private', 'lib64'])
                        environment = {**os.environ, 'LD_LIBRARY_PATH': search}
                        listed = subprocess.run(['ldd', str(original)], env=environment, text=True, capture_output=True)
                        if 'not found' in listed.stdout:
                            raise RuntimeError(f'Missing dependency for {original}: {listed.stdout}')
                        system_runtime = re.compile(r'^(?:ld-linux.*|lib(?:c|m|pthread|dl|rt|resolv|util)\.so(?:\..*)?)$')
                        for line in listed.stdout.splitlines():
                            match = re.search(r'=> (/\S+)', line)
                            if not match or system_runtime.match(pathlib.Path(match[1]).name):
                                continue
                            dependency = pathlib.Path(match[1])
                            library_output = target / 'lib' / dependency.name
                            if not library_output.exists():
                                library_output.parent.mkdir(parents=True, exist_ok=True)
                                shutil.copy2(dependency, library_output)
                                subprocess.run(['patchelf', '--set-rpath', '$ORIGIN', str(library_output)], check=True)
                                # ldd resolves the transitive closure as well.
                                try:
                                    package = subprocess.check_output(['dpkg-query', '-S', str(dependency.resolve())], text=True).split(': ')[0].split(':')[0]
                                    notice = pathlib.Path('/usr/share/doc') / package / 'copyright'
                                    if notice.is_file():
                                        notices = target / 'system-licenses'
                                        notices.mkdir(exist_ok=True)
                                        shutil.copy2(notice, notices / (package + '.txt'))
                                except subprocess.CalledProcessError:
                                    pass
                        if listed.returncode == 0:
                            subprocess.run(['patchelf', '--set-rpath', '$ORIGIN/../lib:$ORIGIN', str(output)], check=True)
                    return output
                output = copy_executable(matches[0])
                binaries[name] = str(output.relative_to(destination)).replace(os.sep, '/')
            if source['platform'] == 'win32':
                # Vendor DLLs are loaded adjacent to the executable. Include the
                # complete vendor DLL set so optional authentication/TLS works too.
                for dependency in original_root.rglob('*.dll'):
                    local = dependency.relative_to(original_root)
                    if local.parts[0].lower() not in ['bin', 'lib']:
                        continue
                    relative_dll = dependency.relative_to(original_root) if dependency.is_relative_to(original_root) else pathlib.Path('bin') / dependency.name
                    output = target / relative_dll
                    output.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(dependency, output)
            licenses = target / 'licenses'
            licenses.mkdir()
            for path in extracted.rglob('*'):
                if path.is_file() and any(word in path.name.lower() for word in ['license', 'notice', 'copying']):
                    shutil.copy2(path, licenses / path.name)
            own_license = {'duckdb': 'DuckDB.txt', 'sqlserver': 'sqlcmd.txt', 'sqlite': 'SQLite.txt'}.get(source['engine'])
            if own_license:
                shutil.copy2(HERE / 'licenses' / own_license, licenses / own_license)
            if not list(licenses.iterdir()):
                raise RuntimeError(f"No redistribution notices found for {source['engine']}")
            native_platform = {'Darwin': 'darwin', 'Linux': 'linux', 'Windows': 'win32'}[platform.system()]
            native_arch = 'arm64' if platform.machine().lower() in ['arm64', 'aarch64'] else 'x64'
            # Windows runtime DLLs are installed after all vendor archives are prepared.
            if native_platform != 'win32' and source['platform'] == native_platform and source['arch'] == native_arch:
                for executable in binaries.values():
                    result = subprocess.check_output([str(destination / executable), '--version'], text=True, stderr=subprocess.STDOUT, timeout=15, env={**os.environ, 'PATH': '/usr/bin:/bin' if native_platform != 'win32' else os.environ.get('SystemRoot', 'C:\\Windows') + '\\System32'})
                    if source['version'] not in result:
                        raise RuntimeError(f'Unexpected tool version: {result}')
            manifest_path = destination / 'manifest.json'
            manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'platform': source['platform'], 'arch': source['arch'], 'tools': []}
            manifest['tools'] = [item for item in manifest['tools'] if item['engine'] != source['engine']]
            manifest['tools'].append({'engine': source['engine'], 'version': source['version'], 'upstream': source['upstream'], 'sourceChecksum': expected, 'sourceUrl': source.get('sourceUrl'), 'binaries': binaries, 'files': {str(path.relative_to(destination)).replace(os.sep, '/'): checksum(path) for path in target.rglob('*') if path.is_file()}})
            manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
            print(f"Prepared {source['engine']} {source['version']} ({source['platform']}-{source['arch']})", flush=True)
        except BaseException:
            shutil.rmtree(target, ignore_errors=True)
            raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', choices=['darwin', 'linux', 'win32'], required=True)
    parser.add_argument('--arch', choices=['arm64', 'x64'], required=True)
    parser.add_argument('--engine', choices=['duckdb', 'mongodb', 'sqlite', 'sqlserver', 'mysql', 'mariadb', 'postgresql'])
    args = parser.parse_args()
    cache = ROOT / '.cache/database-tools'
    cache.mkdir(parents=True, exist_ok=True)
    destination = ROOT / 'resources/database-tools' / f'{args.platform}-{args.arch}'
    sources = [s for s in SOURCES if s['platform'] == args.platform and s['arch'] == args.arch and (not args.engine or s['engine'] == args.engine)]
    if not sources:
        raise RuntimeError('No pinned source for the requested target')
    for source in sources:
        prepare(source, destination, cache)

if __name__ == '__main__':
    main()
