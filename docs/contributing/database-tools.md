# Bundled database clients

Development and CI use Node 26.10.0 from `.nvmrc`. Electron 33 has its own embedded Node runtime; updating the development runtime does not replace it.

Run `npm run tools:prepare` on the target OS/architecture before packaging. This downloads checksum-pinned upstream archives or compiles the pinned client sources. Downloads happen during the build, never on first use in the installed application. Python 3.12 or newer is required. macOS additionally needs Xcode command-line tools and CMake; Linux build dependencies are listed in `scripts/database-tools/Dockerfile`.

Generated files live in ignored `resources/database-tools/<platform>-<arch>`. Each manifest records executable paths, versions, provenance and SHA-256 hashes for the payload. `npm run tools:verify` and electron-builder's `beforePack` hook reject incomplete or modified bundles. The installed application resolves tools from its own resources before any advanced custom path.

| Client | Version |
| --- | --- |
| PostgreSQL | 18.6 |
| MySQL | 8.4.13; macOS Intel uses the upstream 8.0.46 distribution |
| MariaDB | 11.4.13 |
| MongoDB Database Tools | 100.19.1 |
| SQLite | 3.54.1 |
| DuckDB | 1.4.4 |
| sqlcmd | 1.10.0 |

Redis and ClickHouse use the application's drivers and streaming archive readers. They do not require a separate CLI.

The build matrix covers macOS, Windows and Linux, each with x64 and ARM64 targets. Windows ARM64 includes x64 CLI processes and matching x64 DLLs, using Windows 11's built-in emulation; the manifest records this explicitly. Do not mix DLL architectures. The macOS package declares macOS 14 as its minimum system version because the included MySQL Apple Silicon client requires it; the older Electron runtime minimum does not describe the complete application.

`smoke-tools.py` executes every included client with a restricted PATH. `smoke-packaged.py` repeats those checks against the packaged payload and performs SQLite/DuckDB backup/restore round trips in the packaged application. CI runs native target jobs; successful cross-compilation or hash verification alone does not establish execution compatibility.

The release workflow uploads `zequel-database-client-sources.tar` with pinned MySQL, MariaDB and PostgreSQL source archives and the build recipes. Linux jobs also collect the exact distro source packages for bundled GPL/LGPL runtime libraries. Payloads include upstream license notices. Changes to versions, dependency closure or supported targets require rerunning these checks and reviewing the corresponding distribution material.

## Validation scope

The local transfer matrix uses isolated PostgreSQL 18, MySQL 8.4, MariaDB 11, MongoDB 8, Redis 7, SQL Server 2022 and ClickHouse 24 instances, plus SQLite/DuckDB files. These tested versions are evidence, not a claim that every older or newer server version is interchangeable. PostgreSQL rejects a dump client older than its server; restore compatibility also depends on dump and destination versions. Native client failures must remain visible and must never trigger an automatic downgrade of TLS verification.

SSH creates a separate tunnel per operation. Certificate verification retains the original server name where the driver/client supports it. Native client combinations that cannot verify the requested hostname through a forwarded address can fail closed; do not resolve that by silently disabling certificate verification.

Release signing and notarization require the repository's release secrets. Local unsigned packaging validates execution, not a signed/notarized release.
