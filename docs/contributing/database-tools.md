# Bundled database clients

Development and CI use Node 26. Electron 33 has its own embedded Node runtime; updating the development runtime does not replace it.

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

The build matrix covers macOS and Linux x64/ARM64, Windows x64, and the same Windows x64 application on Windows 11 ARM using its built-in emulation. DuckDB's pinned Node binding has no Windows ARM64 build, so the complete Windows application and its native modules remain x64. The ARM download uses the x64 installer; CI executes that installer payload on a Windows ARM runner. Do not mix DLL architectures. The macOS package declares macOS 14 as its minimum system version because the included MySQL Apple Silicon client requires it; the older Electron runtime minimum does not describe the complete application.

`smoke-tools.py` executes every included client with a restricted PATH. `test-installer.py` installs the NSIS artifact or extracts the macOS ZIP/Linux AppImage into a disposable path containing spaces and Unicode. It calls `smoke-packaged.py` against that installed application, which probes all clients and exercises SQLite/DuckDB backup/restore, window lifecycle, native cancellation and repeated 10k/100k/1m row transfers. The Linux x64 job additionally runs the nine-engine server matrix. CI retains screenshots, timing/memory measurements and installer sizes as artifacts. Release jobs run the same gate before uploading installers; macOS additionally requires valid code signing and stapled notarization, and Windows verifies Authenticode when a signing certificate is configured. CI runs native target jobs; successful cross-compilation or hash verification alone does not establish execution compatibility.

The release workflow uploads `zequel-database-client-sources.tar` with pinned MySQL, MariaDB and PostgreSQL source archives and the build recipes. Linux jobs also collect the exact distro source packages for bundled GPL/LGPL runtime libraries. Payloads include upstream license notices. Changes to versions, dependency closure or supported targets require rerunning these checks and reviewing the corresponding distribution material.

## Validation scope

The local transfer matrix uses isolated PostgreSQL 18, MySQL 8.4, MariaDB 11, MongoDB 8, Redis 7, SQL Server 2022 and ClickHouse 24 instances, plus SQLite/DuckDB files. These tested versions are evidence, not a claim that every older or newer server version is interchangeable. PostgreSQL rejects a dump client older than its server; restore compatibility also depends on dump and destination versions. Native client failures must remain visible and must never trigger an automatic downgrade of TLS verification.

SSH creates a separate tunnel per operation. Certificate verification retains the original server name where the driver/client supports it. Native client combinations that cannot verify the requested hostname through a forwarded address can fail closed; do not resolve that by silently disabling certificate verification.

Release signing and notarization require the repository's release secrets. Local unsigned packaging validates execution, not a signed/notarized release.

### Compatibility and destination preflight

The shipped manifest selects one complete, pinned toolchain for each engine and application architecture; there is no runtime download or speculative fallback to an older version. Windows builds use x64 Node and x64 Electron, including when built/tested on Windows 11 ARM. An explicit native Windows ARM package is rejected before packaging because the pinned DuckDB Node binding is unavailable for that target.

PostgreSQL probes the actual chosen `pg_dump` and the connected server before creating a backup artifact. A dump tool older than the server is rejected. Before restoring, archive TOCs are read with `pg_restore --list` without connecting to the destination. An unreadable/newer archive format fails before mutation. Source server versions recorded by PostgreSQL SQL/archive headers are compared with the destination; downgrade restores are rejected. Arbitrary SQL without version metadata is executable input, not proof of version compatibility. Source extensions, privileges and SQL features can still cause a native restore error.

| Engine | Compatibility boundary |
| --- | --- |
| PostgreSQL | Included 18.6 tools; upstream supports dumping servers from 9.2 through 18. Real transfer fixtures cover 17 and 18. Restore also depends on source metadata, extensions and destination features. |
| MySQL / MariaDB | Separate vendor clients, never substituted across engines; tested with MySQL 8.4 and MariaDB 11. Exact native errors remain visible for unsupported authentication or SQL features. |
| MongoDB | Paired 100.19.1 dump/restore tools; tested with MongoDB 8. Source namespace is explicit and remapped to the reviewed destination. |
| SQLite / DuckDB | Included CLI versions in the manifest; SQL dump round trips tested against the application's embedded drivers. Restore creates a new file. |
| Redis / ClickHouse | Driver-backed versioned archives/SQL; tested with Redis 7 and ClickHouse 24. Unknown archive versions are rejected; no claim of arbitrary cross-version downgrade compatibility. |
| SQL Server | Server-owned backup format; tested with SQL Server 2022. FILELISTONLY validates server access and derives destination file moves before RESTORE. Server format/version errors remain authoritative. |

Transfer IPC accepts a typed allowlist, not arbitrary CLI flags. Destination-changing flags (`--create`, alternate connection/database, MongoDB namespace patterns) and error-suppressing flags are rejected. PostgreSQL parallel restore conflicts with a single transaction; plain SQL cannot use parallel restore. SQL scripts explicitly retain their own execution scope, displayed during review: Zequel does not claim to sandbox `USE`, `\\connect`, qualified names or file attachments. MongoDB namespaces and SQL Server physical files have explicit engine-specific remapping; neither silently inherits the source database destination.

References: [PostgreSQL pg_dump compatibility](https://www.postgresql.org/docs/18/app-pgdump.html), [MongoDB Database Tools](https://www.mongodb.com/docs/database-tools/), [Windows ARM emulation](https://learn.microsoft.com/windows/arm/apps-on-arm-x86-emulation).

DuckDB editor and transfer connections use the native instance cache to share a file handle while retaining separate transactions. A full backup copies the database through its own connection into a private native snapshot, detaches it, and runs the included dump client against that snapshot. This supports backup while an editor has the source open, including Windows file-locking rules. SQLite/DuckDB restores are staged in a private file and published exclusively after successful process completion; existing destinations are rejected and failure/cancellation removes only staging files.
