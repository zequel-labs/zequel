"""Collect exact distro source packages for bundled GPL/LGPL runtime libraries."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import tarfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--arch', required=True, choices=['x64', 'arm64'])
args = parser.parse_args()
root = ROOT / 'resources/database-tools' / f'linux-{args.arch}'
cache = ROOT / '.cache/database-tools' / f'linux-runtime-sources-{args.arch}'
cache.mkdir(parents=True, exist_ok=True)
libraries = subprocess.check_output(['ldconfig', '-p'], text=True)
sources = {}
build_id = lambda path: re.search(r'Build ID: (\w+)', subprocess.check_output(['readelf', '-n', str(path)], text=True)).group(1)
for library in root.rglob('lib/*.so.*'):
    if not library.name.startswith(('libgcc_s.', 'libstdc++.', 'libkeyutils.', 'libcom_err.')):
        continue
    matches = re.findall(r'^\s*' + re.escape(library.name) + r'\s.*=> (.+)$', libraries, re.M)
    system = next((pathlib.Path(path).resolve() for path in matches if build_id(path) == build_id(library)), None)
    if not system:
        raise RuntimeError(f'Cannot identify the corresponding distro source for {library}')
    package = subprocess.check_output(['dpkg-query', '-S', str(system)], text=True).split(': ')[0]
    source = subprocess.check_output(['dpkg-query', '-W', '-f=${source:Package}=${source:Version}', package], text=True)
    sources[source] = package
for source in sorted(sources):
    subprocess.run(['apt-get', 'source', '--download-only', '--only-source', source], cwd=cache, check=True)
metadata = {'packages': sources, 'files': {}}
for path in cache.iterdir():
    if path.is_file() and path.name != 'source-packages.json':
        with path.open('rb') as stream:
            metadata['files'][path.name] = hashlib.file_digest(stream, 'sha256').hexdigest()
destination = ROOT / 'dist' / f'zequel-linux-tool-dependency-sources-{args.arch}.tar'
destination.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(destination, 'w') as packed:
    for path in cache.iterdir():
        if path.is_file() and path.name != 'source-packages.json':
            packed.add(path, arcname=path.name)
    manifest = cache / 'source-packages.json'
    manifest.write_text(json.dumps(metadata, indent=2) + '\n')
    packed.add(manifest, arcname=manifest.name)
with destination.open('rb') as stream:
    checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
destination.with_suffix('.tar.sha256').write_text(f'{checksum}  {destination.name}\n')
print(f'Prepared {destination.name}')
