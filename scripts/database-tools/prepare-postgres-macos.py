"""Prepare the relocatable PostgreSQL client toolchain from a pinned upstream image."""
import argparse
import hashlib
import json
import os
import pathlib
import platform
import shutil
import subprocess
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
SOURCE = json.loads((HERE / "sources.json").read_text())["postgresql-macos"]


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest()


def prepare(archive, mounted, arch):
    if digest(archive) != SOURCE["sha256"]:
        raise RuntimeError("PostgreSQL download checksum mismatch")
    source = mounted / "Postgres.app/Contents/Versions/18"
    destination = ROOT / "resources/database-tools" / ("darwin-" + ("x64" if arch == "x86_64" else arch))
    relative_tool = pathlib.Path("postgresql") / SOURCE["version"]
    tool = destination / relative_tool
    if tool.exists():
        raise RuntimeError(f"Toolchain already exists: {tool}. Remove this generated toolchain explicitly before rebuilding.")
    tool.mkdir(parents=True)
    copied = set()

    def copy_binary(original):
        original = pathlib.Path(os.path.abspath(original))
        original.resolve().relative_to(source.resolve())
        local = original.relative_to(pathlib.Path(os.path.abspath(source)))
        if local in copied:
            return
        copied.add(local)
        target = tool / local
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original, target)
        dependencies = []
        for line in run("otool", "-L", str(original)).splitlines():
            if not line.startswith("\t"):
                continue
            dependency = line.strip().split(" (", 1)[0]
            # A dylib's install ID is not a dependency.
            if pathlib.Path(dependency).name == original.name:
                continue
            if dependency.startswith(("/usr/lib/", "/System/Library/")):
                continue
            if not dependency.startswith("@loader_path/"):
                raise RuntimeError(f"Non-relocatable dependency in {original}: {dependency}")
            dependency_file = original.parent / dependency.removeprefix("@loader_path/")
            dependencies.append(dependency_file)
        for dependency in dependencies:
            copy_binary(dependency)
        # Ship only the architecture of the application being built.
        temporary = target.with_name(target.name + ".thin")
        run("lipo", str(target), "-thin", arch, "-output", str(temporary))
        temporary.replace(target)
        target.chmod(0o755)
        run("codesign", "--force", "--sign", "-", str(target))

    try:
        for binary in SOURCE["binaries"]:
            copy_binary(source / "bin" / binary)
        shutil.copytree(HERE / "licenses", tool / "licenses")
        # No PATH, Homebrew, loader environment or installed Postgres.app is required.
        for binary in SOURCE["binaries"] if platform.machine() == arch else []:
            result = subprocess.check_output(
                [str(tool / "bin" / binary), "--version"],
                env={"PATH": "/usr/bin:/bin", "HOME": "/nonexistent", "LANG": "C"},
                cwd="/private/tmp",
                text=True,
            ).strip()
            if SOURCE["version"] not in result:
                raise RuntimeError(f"Unexpected version: {result}")
        files = {str(path.relative_to(destination)): digest(path)
                 for path in tool.rglob("*") if path.is_file()}
        manifest_path = destination / "manifest.json"
        manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {
            "platform": "darwin", "arch": "x64" if arch == "x86_64" else arch, "tools": []
        }
        manifest["tools"] = [entry for entry in manifest["tools"] if entry["engine"] != "postgresql"]
        manifest["tools"].append({
            "engine": "postgresql",
            "version": SOURCE["version"],
            "upstream": SOURCE["upstream"],
            "sourceSha256": SOURCE["sha256"],
            "binaries": {name: str(relative_tool / "bin" / name) for name in SOURCE["binaries"]},
            "files": files,
        })
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
        print(f"Prepared PostgreSQL {SOURCE['version']} for macOS {arch}: {len(files)} files")
    except BaseException:
        shutil.rmtree(tool)
        raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--arch", choices=["arm64", "x86_64"], required=True)
    parser.add_argument("--archive", type=pathlib.Path)
    parser.add_argument("--mounted", type=pathlib.Path)
    options = parser.parse_args()
    # Electron names x86_64 as x64.
    with tempfile.TemporaryDirectory(prefix="zequel-tools-") as temporary:
        archive = options.archive or pathlib.Path(temporary) / "postgres.dmg"
        if not options.archive:
            urllib.request.urlretrieve(SOURCE["url"], archive)
        if digest(archive) != SOURCE["sha256"]:
            raise RuntimeError("PostgreSQL download checksum mismatch")
        if options.mounted:
            prepare(archive, options.mounted, options.arch)
        else:
            mount = pathlib.Path(temporary) / "source"
            run("hdiutil", "attach", str(archive), "-readonly", "-nobrowse", "-mountpoint", str(mount))
            try:
                prepare(archive, mount, options.arch)
            finally:
                run("hdiutil", "detach", str(mount))



if __name__ == "__main__":
    main()
