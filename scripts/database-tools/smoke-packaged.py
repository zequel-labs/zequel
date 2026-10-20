"""Run client and embedded-database round trips from the unpacked installer payload."""
import os
import pathlib
import platform
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

ROOT = pathlib.Path(__file__).resolve().parents[2]
arch = os.environ.get('ZEQUEL_PACKAGE_ARCH') or ('arm64' if platform.system() != 'Windows' and platform.machine().lower() in ['arm64', 'aarch64'] else 'x64')
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
if os.environ.get('ZEQUEL_PACKAGED_EXECUTABLE'):
    executable = pathlib.Path(os.environ['ZEQUEL_PACKAGED_EXECUTABLE'])
    resources = executable.parents[1] / 'Resources' if target == 'darwin' else executable.parent / 'resources'
subprocess.run([sys.executable, str(ROOT / 'scripts/database-tools/smoke-tools.py'),
                str(resources / 'resources/database-tools' / f'{target}-{arch}')], check=True)
base = ['node', str(ROOT / 'node_modules/@playwright/test/cli.js'), 'test']
command = [*base, 'src/tests/e2e/tests/transfer-matrix.test.ts',
           'src/tests/e2e/tests/transfer-portable.test.ts', '--retries=0', '--output=test-results/installed']
all_engines = os.environ.get('ZEQUEL_TRANSFER_ALL_ENGINES') == '1'
if not all_engines:
    command += ['--grep', 'sqlite:|duckdb:|portable:']
runs = [(command, {})]
if all_engines:
    runs.append(([*base, 'src/tests/e2e/tests/transfer-matrix.test.ts', '--retries=0',
                  '--grep', 'mysql:|mariadb:|mongodb:|redis:|clickhouse:|sqlserver:|postgresql:',
                  '--output=test-results/ssh'], {'ZEQUEL_TRANSFER_SSH_MATRIX': '1'}))
    runs.append(([*base, 'src/tests/e2e/tests/transfer-matrix.test.ts', '--retries=0',
                  '--grep', 'mongodb:|redis:|clickhouse:', '--output=test-results/tls'],
                 {'ZEQUEL_TRANSFER_SSH_MATRIX': '1', 'ZEQUEL_TRANSFER_TLS_MATRIX': '1'}))
for command, extra_env in runs:
    if target == 'linux':
        command = ['xvfb-run', '-a', *command]
    process = subprocess.Popen(command, cwd=ROOT, env={**os.environ, 'ZEQUEL_TRANSFER_MATRIX': '1',
                                                    'ZEQUEL_TRANSFER_PORTABLE': '1',
                                                    'ZEQUEL_PACKAGED_EXECUTABLE': str(executable), **extra_env,
                                                    **({'DEBUG': 'pw:browser'} if os.environ.get('CI') else {})},
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                               encoding='utf-8', errors='replace')
    tail = ''
    for line in process.stdout:
        print(line, end='', flush=True)
        tail = (tail + line)[-12000:]
    code = process.wait()
    if code:
        if os.environ.get('CI'):
            annotation = tail[-3000:].replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
            print(f'::error title=Packaged transfer test failed::{annotation}', flush=True)
        sys.exit(code)
