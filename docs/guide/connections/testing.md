# Testing Connections

Before saving a connection, you can verify that Zequel can reach the database server and authenticate successfully using the **Test Connection** feature.

## Using Test Connection

1. Open the connection form and fill in the connection details (see [Creating a Connection](./index.md)).
2. Click the **"Test Connection"** button at the bottom of the form.
3. Zequel attempts to connect to the database using the provided settings, including any SSH tunnel or SSL/TLS configuration.
4. The result is displayed:
   - **Success** -- The connection was established and authenticated. You can proceed to save.
   - **Failure** -- An error message describes what went wrong.

The test does not save the connection. It only verifies connectivity.

## What the Test Verifies

- **Network reachability** -- Can Zequel reach the host and port.
- **SSH tunnel** -- If configured, can the SSH connection be established and the tunnel opened.
- **SSL/TLS handshake** -- If enabled, can the TLS session be negotiated.
- **Authentication** -- Are the username and password (or other credentials) accepted by the database server.
- **Database access** -- Can the specified database be accessed with the given credentials.

## Common Errors and Troubleshooting

### Connection Refused

```
connect ECONNREFUSED 127.0.0.1:5432
```

The database server is not listening on the specified host and port. Verify:

- The **host** and **port** are correct.
- The database service is running.
- Firewall rules allow inbound connections on the port.

### Connection Timed Out

```
connect ETIMEDOUT
```

The server did not respond. This typically means:

- The host is unreachable (wrong IP, DNS resolution failure, or network issue).
- A firewall is silently dropping packets.
- If using an SSH tunnel, check that the SSH host is reachable first.

### Authentication Failed

```
password authentication failed for user "admin"
```

The credentials were rejected. Verify:

- The **username** and **password** are correct.
- The user exists on the database server.
- The user is allowed to connect from your IP (check `pg_hba.conf` for PostgreSQL, or the user's host grants for MySQL/MariaDB).

### Database Does Not Exist

```
database "myapp" does not exist
```

The specified database name was not found on the server. Verify:

- The **database** field contains the correct name.
- The database has been created on the server.

### SSL Required

```
SSL connection is required
```

The server requires SSL but it was not enabled in the connection form. Go to the SSL/TLS section and enable SSL. See [SSL/TLS](./ssl-tls.md).

### SSH Tunnel Errors

If the connection fails when an SSH tunnel is configured, the error may originate from the SSH layer. See [SSH Tunnels -- Troubleshooting](./ssh-tunnels.md#troubleshooting) for details.

## Tips

- Always test after making changes to a connection's settings.
- If a test fails, address one issue at a time -- start with the network layer (host and port), then authentication, then database access.
- For SSH-tunneled connections, verify that you can connect to the SSH host independently before troubleshooting the database connection.
