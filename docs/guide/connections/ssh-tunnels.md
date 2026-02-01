# SSH Tunnels

When a database server is not directly accessible from your machine -- for example, it sits inside a private network or behind a firewall -- you can connect through an SSH tunnel. Zequel supports local port forwarding over SSH to reach remote databases securely.

## How SSH Tunneling Works

Zequel establishes an SSH connection to a bastion or jump host, then forwards a local port through that connection to the database server. Your database client traffic is routed through the encrypted SSH channel:

```
Zequel --> SSH tunnel --> SSH host --> Database server
```

The database connection itself is made to `localhost` on a dynamically assigned local port, which is forwarded through the tunnel to the target database host and port.

## Configuring an SSH Tunnel

1. Open the connection form (see [Creating a Connection](./index.md)).
2. Expand the **"SSH Tunnel"** section.
3. Enable the SSH tunnel toggle.
4. Fill in the SSH fields:

| Field | Description | Required |
|-------|-------------|----------|
| **SSH Host** | The hostname or IP of the SSH server (bastion/jump host). | Yes |
| **SSH Port** | The SSH port, typically `22`. | Yes |
| **SSH Username** | The user to authenticate as on the SSH server. | Yes |
| **Authentication** | Choose between **Password** or **Private Key**. | Yes |
| **Password** | The SSH user password (if password authentication is selected). | Conditional |
| **Private Key** | Path to the private key file, e.g. `~/.ssh/id_rsa` (if key authentication is selected). | Conditional |
| **Passphrase** | The passphrase for the private key, if it is encrypted. | No |

5. In the main connection fields, set the **Host** and **Port** to the values the database listens on from the perspective of the SSH server. For example, if the database runs on the same machine as the SSH server, set Host to `127.0.0.1`.

## Authentication Methods

### Password

Provide the SSH user's password directly. The password is stored securely in the OS keychain alongside your database credentials.

### Private Key

Point to a private key file on disk. Supported key formats include OpenSSH and PEM. If the key is protected by a passphrase, enter it in the **Passphrase** field.

Common key paths:

- `~/.ssh/id_rsa`
- `~/.ssh/id_ed25519`
- `~/.ssh/id_ecdsa`

## Example Configuration

To connect to a PostgreSQL database at `10.0.1.50:5432` through a bastion host at `bastion.example.com`:

| Setting | Value |
|---------|-------|
| SSH Host | `bastion.example.com` |
| SSH Port | `22` |
| SSH Username | `deploy` |
| Authentication | Private Key |
| Private Key | `~/.ssh/id_ed25519` |
| DB Host | `10.0.1.50` |
| DB Port | `5432` |

## Troubleshooting

- **Connection refused on SSH host** -- Verify the SSH host and port are correct and that the SSH service is running.
- **Authentication failed** -- Check the SSH username, password, or private key. Ensure the key is authorized on the server (`~/.ssh/authorized_keys`).
- **Passphrase required** -- If your private key is encrypted, make sure to enter the passphrase.
- **Database unreachable through tunnel** -- Confirm that the database host and port are correct relative to the SSH server, not your local machine. The SSH server must be able to reach the database.
