"""Prepare the complete native tool bundle before packaging; never run on app startup."""
import argparse
import importlib.util
import json
import pathlib
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--platform', choices=['darwin', 'linux', 'win32'], default={'Darwin': 'darwin', 'Linux': 'linux', 'Windows': 'win32'}[platform.system()])
    parser.add_argument('--arch', choices=['arm64', 'x64'], default='arm64' if platform.machine().lower() in ['arm64', 'aarch64'] else 'x64')
    args = parser.parse_args()
    destination = ROOT / 'resources/database-tools' / f'{args.platform}-{args.arch}'
    cache = ROOT / '.cache/database-tools'
    cache.mkdir(parents=True, exist_ok=True)
    if args.platform == 'win32' and args.arch == 'arm64':
        # Windows 11 supplies x64 process emulation. Keep each CLI and all of its
        # DLLs x64; never mix ARM64 and x64 libraries in a single process.
        subprocess.run([sys.executable, str(__file__), '--platform', 'win32', '--arch', 'x64'], check=True)
        if destination.exists():
            raise RuntimeError(f'Remove the generated ARM64 bundle before rebuilding: {destination}')
        shutil.copytree(destination.parent / 'win32-x64', destination)
        manifest_path = destination / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['arch'] = 'arm64'
        manifest['minimumWindowsVersion'] = '11'
        for tool in manifest['tools']:
            tool['binaryArch'] = 'x64'
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
        subprocess.run(['node', str(HERE / 'verify-bundle.cjs'), args.platform, args.arch], check=True)
        if platform.system() == 'Windows':
            subprocess.run([sys.executable, str(HERE / 'smoke-tools.py'), str(destination)], check=True)
        return
    if args.platform == 'darwin':
        if platform.system() != 'Darwin':
            raise RuntimeError('macOS tools must be prepared on macOS')
        spec = importlib.util.spec_from_file_location('postgres_tools', HERE / 'prepare-postgres-macos.py')
        postgres = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(postgres)
        archive = cache / 'postgres-18.6.dmg'
        if not archive.exists():
            urllib.request.urlretrieve(postgres.SOURCE['url'], archive)
        if postgres.digest(archive) != postgres.SOURCE['sha256']:
            raise RuntimeError('PostgreSQL checksum mismatch')
        with tempfile.TemporaryDirectory(prefix='zequel-build-tools-') as directory:
            mount = pathlib.Path(directory) / 'postgres'
            subprocess.run(['hdiutil', 'attach', str(archive), '-readonly', '-nobrowse', '-mountpoint', str(mount)], check=True)
            try:
                if not (destination / 'postgresql/18.6').exists():
                    postgres.prepare(archive, mount, 'x86_64' if args.arch == 'x64' else 'arm64')
                if not (destination / 'mariadb/11.4.13').exists():
                    subprocess.run([sys.executable, str(HERE / 'prepare-mariadb-macos.py'), '--arch', args.arch, '--openssl-prefix', str(mount / 'Postgres.app/Contents/Versions/18')], check=True)
            finally:
                subprocess.run(['hdiutil', 'detach', str(mount)], check=True)
    if args.platform == 'linux':
        subprocess.run([sys.executable, str(HERE / 'prepare-postgres-linux.py'), '--arch', args.arch], check=True)
        if args.arch == 'arm64':
            subprocess.run([sys.executable, str(HERE / 'prepare-linux-arm-clients.py')], check=True)
    subprocess.run([sys.executable, str(HERE / 'prepare-portable.py'), '--platform', args.platform, '--arch', args.arch], check=True)
    if args.platform == 'win32':
        subprocess.run([sys.executable, str(HERE / 'windows-runtime.py'), str(destination)], check=True)
    subprocess.run(['node', str(HERE / 'verify-bundle.cjs'), args.platform, args.arch], check=True)
    native_platform = {'Darwin': 'darwin', 'Linux': 'linux', 'Windows': 'win32'}[platform.system()]
    native_arch = 'arm64' if platform.machine().lower() in ['arm64', 'aarch64'] else 'x64'
    if native_platform == args.platform and native_arch == args.arch:
        subprocess.run([sys.executable, str(HERE / 'smoke-tools.py'), str(destination)], check=True)


if __name__ == '__main__':
    main()
