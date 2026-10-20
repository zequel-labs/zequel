"""Execute every bundled client without user-installed database tools on PATH."""
import json
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((root / 'manifest.json').read_text())
environment = {**os.environ, 'PATH': os.path.join(os.environ.get('SystemRoot', r'C:\Windows'), 'System32') if sys.platform == 'win32' else '/usr/bin:/bin'}
for tool in manifest['tools']:
    for name, relative in tool['binaries'].items():
        output = subprocess.check_output([str(root / relative), '--version'], env=environment,
                                         stderr=subprocess.STDOUT, text=True, timeout=30)
        if tool['version'] not in output:
            raise RuntimeError(f'Unexpected version for {name}: {output}')
        print(f"Executed {name} {tool['version']}", flush=True)
