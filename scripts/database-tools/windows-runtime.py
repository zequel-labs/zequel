"""Include the vendor-redistributed MSVC runtime and verify PE import dependencies."""
import hashlib
import json
import pathlib
import shutil
import struct
import sys

SYSTEM_DLLS = set('kernel32.dll kernelbase.dll ntdll.dll user32.dll gdi32.dll advapi32.dll shell32.dll shlwapi.dll ws2_32.dll mswsock.dll crypt32.dll secur32.dll bcrypt.dll bcryptprimitives.dll ole32.dll oleaut32.dll combase.dll comdlg32.dll comctl32.dll rpcrt4.dll version.dll winmm.dll psapi.dll iphlpapi.dll dnsapi.dll wldap32.dll normaliz.dll netapi32.dll userenv.dll ucrtbase.dll msvcrt.dll dbghelp.dll powrprof.dll winspool.drv setupapi.dll cfgmgr32.dll wintrust.dll imm32.dll dwmapi.dll authz.dll ncrypt.dll cryptbase.dll imagehlp.dll winhttp.dll wininet.dll pdh.dll wtsapi32.dll shcore.dll dbgcore.dll ntasn1.dll rstrtmgr.dll hid.dll'.split())


def imports(path):
    data = path.read_bytes()
    if data[:2] != b'MZ':
        return []
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    if data[pe:pe + 4] != b'PE\0\0':
        raise RuntimeError(f'Invalid PE file: {path}')
    sections = struct.unpack_from('<H', data, pe + 6)[0]
    optional_size = struct.unpack_from('<H', data, pe + 20)[0]
    optional = pe + 24
    magic = struct.unpack_from('<H', data, optional)[0]
    directories = optional + (112 if magic == 0x20b else 96)
    table = optional + optional_size
    def offset(rva):
        for index in range(sections):
            at = table + index * 40
            size, virtual, raw_size, raw = struct.unpack_from('<IIII', data, at + 8)
            if virtual <= rva < virtual + max(size, raw_size):
                return raw + rva - virtual
        raise RuntimeError(f'Invalid PE import RVA: {path}')
    rva, size = struct.unpack_from('<II', data, directories + 8)
    if not rva:
        return []
    at = offset(rva)
    result = []
    while any(data[at:at + 20]):
        name_rva = struct.unpack_from('<I', data, at + 12)[0]
        name_at = offset(name_rva)
        result.append(data[name_at:data.index(0, name_at)].decode('ascii').lower())
        at += 20
    return result


def main():
    root = pathlib.Path(sys.argv[1]).resolve()
    manifest_path = root / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    maria = next(tool for tool in manifest['tools'] if tool['engine'] == 'mariadb')
    runtime_dir = (root / maria['binaries']['mariadb']).parent
    runtime = [path for path in runtime_dir.glob('*.dll') if path.name.lower().startswith(('vcruntime', 'msvcp', 'concrt'))]
    if not runtime:
        raise RuntimeError('The verified MariaDB distribution is missing its redistributable C++ runtime')
    for tool in manifest['tools']:
        directory = root / tool['engine'] / tool['version']
        for library in runtime:
            target = directory / 'bin' / library.name
            if library != target:
                shutil.copy2(library, target)
            tool['files'][str(target.relative_to(root)).replace('\\', '/')] = hashlib.sha256(target.read_bytes()).hexdigest()
        notice = directory / 'licenses' / 'MSVC-runtime-provenance.json'
        notice.write_text(json.dumps({'redistributedFrom': maria.get('upstream'), 'version': maria['version'], 'archiveChecksum': maria['sourceChecksum'], 'files': [path.name for path in runtime]}, indent=2) + '\n')
        tool['files'][str(notice.relative_to(root)).replace('\\', '/')] = hashlib.sha256(notice.read_bytes()).hexdigest()
    for tool in manifest['tools']:
        directory = root / tool['engine'] / tool['version']
        available = {path.name.lower(): path for path in directory.rglob('*.dll')}
        pending = [root / binary for binary in tool['binaries'].values()]
        # Authentication plugins are loaded dynamically by vendor clients.
        pending.extend(path for path in directory.rglob('*.dll') if 'plugin' in path.parts and 'debug' not in path.parts and ('client' in path.name.lower() or path.name.lower() in ['dialog.dll', 'mysql_clear_password.dll', 'ed25519.dll', 'caching_sha2_password.dll', 'sha256_password.dll']))
        required = set()
        while pending:
            path = pending.pop()
            if path in required:
                continue
            required.add(path)
            for name in imports(path):
                if name in SYSTEM_DLLS or name.startswith(('api-ms-win-', 'ext-ms-win-')):
                    continue
                if name not in available:
                    raise RuntimeError(f'Missing DLL for {path}: {name}')
                pending.append(available[name])
        for path in directory.rglob('*.dll'):
            if path not in required:
                path.unlink()
                tool['files'].pop(str(path.relative_to(root)).replace('\\', '/'), None)
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print('Verified Windows executable imports and included vendor MSVC runtimes')


if __name__ == '__main__':
    main()
