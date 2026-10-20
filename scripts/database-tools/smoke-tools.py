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
        if name in ['mongodump', 'mongorestore']:
            help_text = subprocess.check_output([str(root / relative), '--help'], env=environment,
                                                stderr=subprocess.STDOUT, text=True, timeout=30)
            for flag in ['--ssl', '--sslCAFile', '--sslPEMKeyFile', '--tlsInsecure']:
                if flag not in help_text:
                    raise RuntimeError(f'{name} does not support the TLS option {flag}')
            # CA-only verification must not silently become --tlsInsecure.
            subprocess.check_output([str(root / relative), '--sslAllowInvalidHostnames', '--version'],
                                    env=environment, stderr=subprocess.STDOUT, timeout=30)
        print(f"Executed {name} {tool['version']}", flush=True)
