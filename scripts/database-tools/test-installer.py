"""Install/extract the release-format artifact into a disposable directory and test it."""
import json
import os
import pathlib
import platform
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
arch = os.environ.get('ZEQUEL_PACKAGE_ARCH') or ('arm64' if platform.machine().lower() in ['arm64', 'aarch64'] else 'x64')
system = platform.system()
pattern = {'Darwin': f'zequel-apple-{arch}.zip', 'Windows': 'zequel-window-x64.exe', 'Linux': f'zequel-linux-{arch}.AppImage'}[system]
artifact = ROOT / 'dist' / pattern
if not artifact.is_file():
    raise RuntimeError(f'Missing installer: {artifact}')

with tempfile.TemporaryDirectory(prefix='Zequel installed á ') as temporary:
    destination = pathlib.Path(temporary)
    if system == 'Darwin':
        subprocess.run(['ditto', '-x', '-k', str(artifact), str(destination)], check=True)
        executable = destination / 'Zequel.app/Contents/MacOS/Zequel'
    elif system == 'Windows':
        # NSIS requires /D last, with an unquoted path even when it contains spaces.
        subprocess.run([str(artifact), '/S', '/D=' + str(destination)], check=True, timeout=180)
        executable = destination / 'Zequel.exe'
    else:
        artifact.chmod(artifact.stat().st_mode | 0o111)
        subprocess.run([str(artifact), '--appimage-extract'], cwd=destination,
                       stdout=subprocess.DEVNULL, check=True, timeout=180)
        executable = destination / 'squashfs-root/zequel'
    if not executable.is_file():
        raise RuntimeError(f'Installer did not produce {executable}')
    signed = False
    if os.environ.get('ZEQUEL_REQUIRE_SIGNATURE') == '1':
        if system == 'Darwin':
            app = executable.parents[2]
            subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
            subprocess.run(['spctl', '--assess', '--type', 'execute', str(app)], check=True)
            subprocess.run(['xcrun', 'stapler', 'validate', str(app)], check=True)
        elif system == 'Windows':
            subprocess.run(['powershell', '-NoProfile', '-Command',
                            "if ((Get-AuthenticodeSignature -LiteralPath $env:ZEQUEL_SIGNED_ARTIFACT).Status -ne 'Valid') { exit 1 }"],
                           env={**os.environ, 'ZEQUEL_SIGNED_ARTIFACT': str(artifact)}, check=True)
        else:
            raise RuntimeError('Signature validation is not configured for this platform')
        signed = True
    report = ROOT / 'installer-evidence'
    report.mkdir(exist_ok=True)
    (report / f'{system}-{arch}.json').write_text(json.dumps({
        'platform': system, 'architecture': arch, 'artifact': artifact.name,
        'installerBytes': artifact.stat().st_size,
        'installedBytes': sum(path.stat().st_size for path in destination.rglob('*') if path.is_file()),
        'signed': signed,
    }, indent=2))
    try:
        subprocess.run([sys.executable, str(ROOT / 'scripts/database-tools/smoke-packaged.py')],
                       cwd=ROOT, env={**os.environ, 'ZEQUEL_PACKAGED_EXECUTABLE': str(executable)}, check=True)
    finally:
        if system == 'Windows':
            uninstall = destination / 'Uninstall Zequel.exe'
            if uninstall.is_file():
                subprocess.run([str(uninstall), '/S', '_?=' + str(destination)], check=True, timeout=120)
