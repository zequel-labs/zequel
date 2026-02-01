# SSL/TLS

Zequel supports SSL/TLS-encrypted connections to your database server. This ensures that data transmitted between Zequel and the database is encrypted in transit.

## Enabling SSL

1. Open the connection form (see [Creating a Connection](./index.md)).
2. Expand the **"SSL/TLS"** section.
3. Enable the SSL toggle.

For many cloud-hosted databases (e.g. AWS RDS, Google Cloud SQL, Azure Database), enabling SSL with default settings is sufficient. The connection will use TLS encryption with the system's trusted certificate authorities.

## SSL Options

| Field | Description | Required |
|-------|-------------|----------|
| **SSL** | Enable or disable SSL/TLS for this connection. | Yes |
| **CA Certificate** | Path to the Certificate Authority (CA) certificate file. Used to verify the server's identity. | No |
| **Client Certificate** | Path to the client certificate file. Required for mutual TLS (mTLS) authentication. | No |
| **Client Key** | Path to the client private key file. Required alongside the client certificate for mTLS. | No |
| **Reject Unauthorized** | When enabled, the connection will fail if the server's certificate cannot be verified against the CA. Disable only for self-signed certificates in development environments. | No (default: enabled) |

## Certificate Files

Certificate and key files are typically PEM-encoded. Common file extensions include `.pem`, `.crt`, `.key`, and `.ca`.

### CA Certificate

The CA certificate verifies that the database server's certificate was issued by a trusted authority. Cloud providers typically supply a downloadable CA certificate bundle:

- **AWS RDS** -- [Amazon RDS CA certificates](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
- **Google Cloud SQL** -- available via the Cloud SQL console
- **Azure Database** -- available via the Azure portal

### Client Certificate and Key (mTLS)

Some database configurations require the client to present its own certificate. This is known as mutual TLS. You will need both:

- A **client certificate** (`.crt` or `.pem`) issued by the server's CA.
- A **client private key** (`.key` or `.pem`) corresponding to the client certificate.

## Reject Unauthorized

The **Reject Unauthorized** option controls whether Zequel validates the server's SSL certificate against the provided CA or the system's trusted CAs.

- **Enabled (default)** -- The connection fails if the server's certificate is not trusted. This is the recommended setting for production environments.
- **Disabled** -- The connection proceeds even if the certificate cannot be verified. Use this only for development or testing with self-signed certificates.

::: warning
Disabling "Reject Unauthorized" in production environments exposes the connection to potential man-in-the-middle attacks. Always use a valid CA certificate and keep this option enabled for production databases.
:::

## Combining SSL with SSH Tunnels

SSL/TLS and SSH tunnels can be used together. The SSH tunnel provides a secure channel to reach the database server, and SSL encrypts the database protocol within that channel. This is useful when organizational policy requires encryption at both the network and application layers.
