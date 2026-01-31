import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { SSHConfig } from '@main/types';

// ── Mock: ssh2 Client ──────────────────────────────────────────────────────
class MockSSHClient extends EventEmitter {
  connect = vi.fn();
  forwardOut = vi.fn();
  end = vi.fn();
}

let mockClientInstance: MockSSHClient;

vi.mock('ssh2', () => {
  class Client extends EventEmitter {
    connect = vi.fn();
    forwardOut = vi.fn();
    end = vi.fn();

    constructor() {
      super();
      // Copy vi.fn() spies so tests can assert on them
      mockClientInstance = this as unknown as MockSSHClient;
    }
  }
  return { Client };
});

// ── Mock: net ──────────────────────────────────────────────────────────────
const mockSocketPipe = vi.fn().mockReturnThis();
const mockSocketEnd = vi.fn();

const mockSocket = {
  localPort: 12345,
  pipe: mockSocketPipe,
  end: mockSocketEnd,
};

const mockServerClose = vi.fn();
const mockServerAddress = vi.fn().mockReturnValue({ port: 54321 });
const mockServerListen = vi.fn();
const mockServerOn = vi.fn();

let serverConnectionCallback: ((socket: typeof mockSocket) => void) | null = null;
let serverErrorCallback: ((err: Error) => void) | null = null;

vi.mock('net', () => ({
  createServer: vi.fn((cb: (socket: typeof mockSocket) => void) => {
    serverConnectionCallback = cb;
    const server = {
      close: mockServerClose,
      address: mockServerAddress,
      listen: mockServerListen,
      on: mockServerOn,
    };

    // Capture event callbacks
    mockServerOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'error') {
        serverErrorCallback = handler as (err: Error) => void;
      }
      return server;
    });

    // Simulate listen callback on next tick
    mockServerListen.mockImplementation(
      (_port: number, _host: string, cb: () => void) => {
        process.nextTick(cb);
        return server;
      }
    );

    return server;
  }),
}));

// ── Mock: logger ───────────────────────────────────────────────────────────
vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────
const makeSSHConfig = (overrides?: Partial<SSHConfig>): SSHConfig => ({
  enabled: true,
  host: 'ssh.example.com',
  port: 22,
  username: 'testuser',
  authMethod: 'password',
  password: 'secret',
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────────────
describe('SSHTunnelManager', () => {
  let sshTunnelManager: typeof import('@main/services/ssh-tunnel')['sshTunnelManager'];

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    serverConnectionCallback = null;
    serverErrorCallback = null;
    mockServerClose.mockReset();
    mockServerAddress.mockReturnValue({ port: 54321 });
    mockServerListen.mockReset();
    mockServerOn.mockReset();
    mockSocketPipe.mockReset().mockReturnThis();
    mockSocketEnd.mockReset();

    // Re-setup listen mock after reset
    mockServerListen.mockImplementation(
      (_port: number, _host: string, cb: () => void) => {
        process.nextTick(cb);
        return {
          close: mockServerClose,
          address: mockServerAddress,
          listen: mockServerListen,
          on: mockServerOn,
        };
      }
    );

    mockServerOn.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'error') {
        serverErrorCallback = handler as (err: Error) => void;
      }
      return {
        close: mockServerClose,
        address: mockServerAddress,
        listen: mockServerListen,
        on: mockServerOn,
      };
    });

    const mod = await import('@main/services/ssh-tunnel');
    sshTunnelManager = mod.sshTunnelManager;
  });

  afterEach(() => {
    sshTunnelManager.closeAllTunnels();
  });

  // ── createTunnel ───────────────────────────────────────────────────────
  describe('createTunnel', () => {
    it('should create a tunnel and resolve with the local port', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-1',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => {
        expect(mockClientInstance).toBeDefined();
      });
      mockClientInstance.emit('ready');

      const localPort = await promise;
      expect(localPort).toBe(54321);
      expect(sshTunnelManager.hasTunnel('conn-1')).toBe(true);
      expect(sshTunnelManager.getLocalPort('conn-1')).toBe(54321);
    });

    it('should return existing tunnel port if tunnel already exists', async () => {
      // First tunnel
      const p1 = sshTunnelManager.createTunnel(
        'conn-dup',
        makeSSHConfig(),
        'db.example.com',
        5432
      );
      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      const port1 = await p1;

      // Second call with same id should return the same port without creating a new tunnel
      const port2 = await sshTunnelManager.createTunnel(
        'conn-dup',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      expect(port2).toBe(port1);
    });

    it('should reject when SSH client emits an error', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-err',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('error', new Error('Auth failed'));

      await expect(promise).rejects.toThrow('Auth failed');
      expect(sshTunnelManager.hasTunnel('conn-err')).toBe(false);
    });

    it('should reject when the TCP server emits an error before the tunnel is ready', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-srv-err',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(serverErrorCallback).not.toBeNull());
      serverErrorCallback!(new Error('EADDRINUSE'));

      await expect(promise).rejects.toThrow('EADDRINUSE');
    });

    it('should use password authentication when authMethod is password', async () => {
      const config = makeSSHConfig({ authMethod: 'password', password: 'mypass' });

      const promise = sshTunnelManager.createTunnel(
        'conn-pw',
        config,
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      expect(mockClientInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'ssh.example.com',
          port: 22,
          username: 'testuser',
          password: 'mypass',
        })
      );
    });

    it('should use private key authentication when authMethod is privateKey', async () => {
      const config = makeSSHConfig({
        authMethod: 'privateKey',
        password: undefined,
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nfakekey\n-----END RSA PRIVATE KEY-----',
      });

      const promise = sshTunnelManager.createTunnel(
        'conn-pk',
        config,
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      expect(mockClientInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey: config.privateKey,
        })
      );
      // password should NOT be set
      const callArg = mockClientInstance.connect.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.password).toBeUndefined();
    });

    it('should include passphrase when privateKeyPassphrase is provided', async () => {
      const config = makeSSHConfig({
        authMethod: 'privateKey',
        password: undefined,
        privateKey: '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
        privateKeyPassphrase: 'mypassphrase',
      });

      const promise = sshTunnelManager.createTunnel(
        'conn-pk-pp',
        config,
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      expect(mockClientInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          passphrase: 'mypassphrase',
        })
      );
    });

    it('should set readyTimeout to 30000', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-to',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      expect(mockClientInstance.connect).toHaveBeenCalledWith(
        expect.objectContaining({ readyTimeout: 30000 })
      );
    });
  });

  // ── Port forwarding (server connection callback) ───────────────────────
  describe('port forwarding', () => {
    it('should pipe data between socket and SSH stream on successful forwardOut', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-fwd',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      expect(serverConnectionCallback).not.toBeNull();

      const mockStream = { pipe: vi.fn().mockReturnThis() };
      mockClientInstance.forwardOut.mockImplementation(
        (_srcHost: string, _srcPort: number, _dstHost: string, _dstPort: number, cb: (err: Error | null, stream: unknown) => void) => {
          cb(null, mockStream);
        }
      );

      serverConnectionCallback!(mockSocket);

      expect(mockClientInstance.forwardOut).toHaveBeenCalledWith(
        '127.0.0.1',
        12345,
        'db.example.com',
        5432,
        expect.any(Function)
      );
      expect(mockSocket.pipe).toHaveBeenCalledWith(mockStream);
      expect(mockStream.pipe).toHaveBeenCalledWith(mockSocket);
    });

    it('should end socket on forwardOut error', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-fwd-err',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      mockClientInstance.forwardOut.mockImplementation(
        (_srcHost: string, _srcPort: number, _dstHost: string, _dstPort: number, cb: (err: Error | null, stream: unknown) => void) => {
          cb(new Error('forward failed'), undefined);
        }
      );

      serverConnectionCallback!(mockSocket);

      expect(mockSocket.end).toHaveBeenCalled();
    });
  });

  // ── closeTunnel ────────────────────────────────────────────────────────
  describe('closeTunnel', () => {
    it('should close the server and client, and remove the tunnel from the map', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-close',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      const capturedClient = mockClientInstance;
      capturedClient.emit('ready');
      await promise;

      expect(sshTunnelManager.hasTunnel('conn-close')).toBe(true);

      sshTunnelManager.closeTunnel('conn-close');

      expect(mockServerClose).toHaveBeenCalled();
      expect(capturedClient.end).toHaveBeenCalled();
      expect(sshTunnelManager.hasTunnel('conn-close')).toBe(false);
    });

    it('should be a no-op when connection id does not exist', () => {
      sshTunnelManager.closeTunnel('nonexistent');
      expect(sshTunnelManager.hasTunnel('nonexistent')).toBe(false);
    });
  });

  // ── hasTunnel ──────────────────────────────────────────────────────────
  describe('hasTunnel', () => {
    it('should return false when no tunnel exists', () => {
      expect(sshTunnelManager.hasTunnel('no-such-id')).toBe(false);
    });

    it('should return true after tunnel is created', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-has',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      expect(sshTunnelManager.hasTunnel('conn-has')).toBe(true);
    });
  });

  // ── getLocalPort ───────────────────────────────────────────────────────
  describe('getLocalPort', () => {
    it('should return null for non-existent tunnel', () => {
      expect(sshTunnelManager.getLocalPort('none')).toBeNull();
    });

    it('should return the local port for an existing tunnel', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-port',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      mockClientInstance.emit('ready');
      await promise;

      expect(sshTunnelManager.getLocalPort('conn-port')).toBe(54321);
    });
  });

  // ── closeAllTunnels ────────────────────────────────────────────────────
  describe('closeAllTunnels', () => {
    it('should close all existing tunnels', async () => {
      // Create first tunnel
      const p1 = sshTunnelManager.createTunnel(
        'conn-a',
        makeSSHConfig(),
        'db.example.com',
        5432
      );
      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      const clientA = mockClientInstance;
      clientA.emit('ready');
      await p1;

      // Create second tunnel
      const p2 = sshTunnelManager.createTunnel(
        'conn-b',
        makeSSHConfig(),
        'db2.example.com',
        3306
      );
      await vi.waitFor(() => expect(mockClientInstance !== clientA).toBe(true));
      const clientB = mockClientInstance;
      clientB.emit('ready');
      await p2;

      expect(sshTunnelManager.hasTunnel('conn-a')).toBe(true);
      expect(sshTunnelManager.hasTunnel('conn-b')).toBe(true);

      sshTunnelManager.closeAllTunnels();

      expect(sshTunnelManager.hasTunnel('conn-a')).toBe(false);
      expect(sshTunnelManager.hasTunnel('conn-b')).toBe(false);
    });

    it('should be safe to call when no tunnels exist', () => {
      expect(() => sshTunnelManager.closeAllTunnels()).not.toThrow();
    });
  });

  // ── SSH client close event ─────────────────────────────────────────────
  describe('SSH client close event', () => {
    it('should clean up tunnel when SSH client emits close', async () => {
      const promise = sshTunnelManager.createTunnel(
        'conn-ssh-close',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      const capturedClient = mockClientInstance;
      capturedClient.emit('ready');
      await promise;

      expect(sshTunnelManager.hasTunnel('conn-ssh-close')).toBe(true);

      capturedClient.emit('close');

      expect(sshTunnelManager.hasTunnel('conn-ssh-close')).toBe(false);
    });
  });

  // ── SSH client handshake event (line 122-124) ─────────────────────────
  describe('SSH client handshake event', () => {
    it('should log handshake information when handshake event fires', async () => {
      const { logger } = await import('@main/utils/logger');

      const promise = sshTunnelManager.createTunnel(
        'conn-handshake',
        makeSSHConfig(),
        'db.example.com',
        5432
      );

      await vi.waitFor(() => expect(mockClientInstance).toBeDefined());
      const capturedClient = mockClientInstance;

      // Emit handshake before ready
      const negotiated = { kex: 'ecdh-sha2-nistp256', srvHostKey: 'ssh-ed25519' };
      capturedClient.emit('handshake', negotiated);

      // Then emit ready so the promise resolves
      capturedClient.emit('ready');
      await promise;

      expect(logger.info).toHaveBeenCalledWith('SSH handshake completed', negotiated);
    });
  });
});
