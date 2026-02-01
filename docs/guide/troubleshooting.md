# Troubleshooting

This page covers common issues you may encounter when using Zequel and how to resolve them.

## Connection Refused

**Symptom**: You see an error like "Connection refused" or "ECONNREFUSED" when trying to connect.

**Possible causes and solutions**:

- **Database server is not running** -- Verify that the database server is started and accepting connections. For local databases, check the service status (e.g., `systemctl status postgresql` or `brew services list`).
- **Wrong host or port** -- Double-check the hostname and port number in the connection settings. The default ports are: PostgreSQL (5432), MySQL (3306), MariaDB (3306), ClickHouse (9000/8123), MongoDB (27017), Redis (6379).
- **Firewall blocking the connection** -- Ensure that your firewall allows outbound connections to the database host and port. On remote servers, check that the database port is open in the server's firewall rules.
- **Database not listening on the expected interface** -- Some databases are configured to listen only on `localhost` by default. If you are connecting to a remote server, verify that the database is configured to accept connections on the network interface you are using (check `listen_addresses` in PostgreSQL or `bind-address` in MySQL).

## SSL / TLS Errors

**Symptom**: Errors mentioning SSL, TLS, certificates, or "self-signed certificate" appear during connection.

**Possible causes and solutions**:

- **SSL required but not configured** -- If the server requires SSL, enable the SSL toggle in the connection settings and provide the necessary certificate files (CA certificate, client certificate, and client key).
- **Self-signed certificate** -- If the server uses a self-signed certificate, you may need to provide the CA certificate file so Zequel can verify the server's identity. Alternatively, some connection dialogs offer an option to allow self-signed certificates.
- **Certificate mismatch** -- Ensure the certificate's common name (CN) or subject alternative name (SAN) matches the hostname you are connecting to.

## SSH Tunnel Failures

**Symptom**: The connection fails with SSH-related errors when using an SSH tunnel.

**Possible causes and solutions**:

- **Incorrect SSH credentials** -- Verify the SSH host, port (default 22), username, and authentication method (password or private key).
- **Private key format** -- Zequel supports OpenSSH-format private keys. If your key is in a different format (e.g., PuTTY `.ppk`), convert it using `ssh-keygen -i -f key.ppk > key_openssh`.
- **SSH server not reachable** -- Confirm that the SSH server is running and accessible from your machine. Test with `ssh user@host` from a terminal.
- **Port forwarding blocked** -- Some SSH servers disable TCP port forwarding. Check the server's `sshd_config` for `AllowTcpForwarding yes`.
- **Passphrase-protected key** -- If your private key is encrypted with a passphrase, make sure you enter the passphrase in the connection dialog.

## Application Not Starting

**Symptom**: Zequel does not open, crashes on launch, or shows a blank white window.

**Possible causes and solutions**:

- **Corrupted application data** -- Reset Zequel's local data by deleting its configuration directory. The location depends on your platform:
  - macOS: `~/Library/Application Support/zequel`
  - Windows: `%APPDATA%/zequel`
  - Linux: `~/.config/zequel`
- **Outdated version** -- Download the latest release from the [releases page](https://github.com/zequel-labs/zequel/releases/latest) and reinstall.
- **GPU acceleration issues** -- On some systems, hardware acceleration can cause rendering problems. Try launching Zequel with the `--disable-gpu` flag to see if this resolves the issue.
- **Missing system libraries (Linux)** -- AppImage builds require FUSE. Install it with `sudo apt install libfuse2` on Debian/Ubuntu-based distributions.

## Checking Logs

Zequel writes diagnostic logs that can help identify issues:

1. Open the application menu.
2. Select **Help** and then **Open Logs** (or navigate to the log file directory manually).

Log file locations by platform:

| Platform | Log directory                              |
| -------- | ------------------------------------------ |
| macOS    | `~/Library/Logs/zequel/`                   |
| Windows  | `%APPDATA%/zequel/logs/`                   |
| Linux    | `~/.config/zequel/logs/`                   |

When reporting a bug, include the relevant log output along with the steps to reproduce the issue. This helps diagnose the problem significantly faster.

## Getting Help

If the troubleshooting steps above do not resolve your issue:

- Search existing [GitHub Issues](https://github.com/zequel-labs/zequel/issues) to see if the problem has been reported.
- Open a new issue with a description of the problem, the steps to reproduce it, your operating system and version, and any relevant log output.
