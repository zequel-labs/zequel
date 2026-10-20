"""Run client and embedded-database round trips from the unpacked installer payload."""
import os
import pathlib
import platform
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
arch = 'arm64' if platform.machine().lower() in ['arm64', 'aarch64'] else 'x64'
target = {'Darwin': 'darwin', 'Windows': 'win32', 'Linux': 'linux'}[platform.system()]
if target == 'linux' and os.environ.get('CI'):
    if os.environ.get('ZEQUEL_SMOKE_DBUS') != '1':
        # A headless runner has no desktop session/keyring; use a private session.
        subprocess.run(['dbus-run-session', '--', sys.executable, __file__],
                       env={**os.environ, 'ZEQUEL_SMOKE_DBUS': '1'}, check=True)
        sys.exit(0)
    subprocess.run(['gnome-keyring-daemon', '--unlock', '--components=secrets'],
                   input=b'zequel-isolated-ci-keyring\n', check=True)

if target == 'darwin':
    executable = ROOT / 'dist' / ('mac-arm64' if arch == 'arm64' else 'mac') / 'Zequel.app/Contents/MacOS/Zequel'
    resources = executable.parents[1] / 'Resources'
else:
    folder = ('win' if target == 'win32' else 'linux') + ('-arm64' if arch == 'arm64' else '') + '-unpacked'
    executable = ROOT / 'dist' / folder / ('Zequel.exe' if target == 'win32' else 'zequel')
    resources = executable.parent / 'resources'
subprocess.run([sys.executable, str(ROOT / 'scripts/database-tools/smoke-tools.py'),
                str(resources / 'resources/database-tools' / f'{target}-{arch}')], check=True)
command = ['node', str(ROOT / 'node_modules/@playwright/test/cli.js'), 'test',
           'src/tests/e2e/tests/transfer-matrix.test.ts', '--grep', 'sqlite:|duckdb:', '--retries=0']
if target == 'linux':
    command = ['xvfb-run', '-a', *command]
subprocess.run(command, cwd=ROOT, env={**os.environ, 'ZEQUEL_TRANSFER_MATRIX': '1',
                                    'ZEQUEL_PACKAGED_EXECUTABLE': str(executable),
                                    **({'DEBUG': 'pw:browser'} if os.environ.get('CI') else {})}, check=True)
