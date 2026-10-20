"""Publish the corresponding client sources and build recipes alongside installers."""
import hashlib
import json
import pathlib
import tarfile
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]
CACHE = ROOT / '.cache/database-tools'
CACHE.mkdir(parents=True, exist_ok=True)
sources = json.loads((HERE / 'client-sources.json').read_text())
archives = []
for source in sources:
    archive = CACHE / source['url'].rsplit('/', 1)[-1]
    if not archive.exists():
        temporary = archive.with_suffix(archive.suffix + '.download')
        urllib.request.urlretrieve(source['url'], temporary)
        with temporary.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != source['sha256']:
                temporary.unlink()
                raise RuntimeError(f"Source checksum mismatch: {source['url']}")
        temporary.replace(archive)
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != source['sha256']:
            raise RuntimeError(f'Source checksum mismatch: {archive}')
    archives.append(archive)
destination = ROOT / 'dist/zequel-database-client-sources.tar'
destination.parent.mkdir(parents=True, exist_ok=True)
with tarfile.open(destination, 'w') as packed:
    for archive in archives:
        packed.add(archive, arcname=f'sources/{archive.name}')
    for path in HERE.rglob('*'):
        if path.is_file() and '__pycache__' not in path.parts:
            packed.add(path, arcname=str(path.relative_to(ROOT)))
with destination.open('rb') as stream:
    checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
destination.with_suffix('.tar.sha256').write_text(f'{checksum}  {destination.name}\n')
print(f'Prepared {destination.name} ({destination.stat().st_size} bytes)')
