import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetPassword = vi.fn();
const mockGetPassword = vi.fn();
const mockDeletePassword = vi.fn();
const mockFindCredentials = vi.fn();

vi.mock('keytar', () => ({
  default: {
    setPassword: (...args: unknown[]) => mockSetPassword(...args),
    getPassword: (...args: unknown[]) => mockGetPassword(...args),
    deletePassword: (...args: unknown[]) => mockDeletePassword(...args),
    findCredentials: (...args: unknown[]) => mockFindCredentials(...args),
  },
}));

vi.mock('../../../main/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { KeychainService, keychainService } from '../../../main/services/keychain';

describe('KeychainService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export a singleton keychainService instance', () => {
    expect(keychainService).toBeDefined();
    expect(keychainService).toBeInstanceOf(KeychainService);
  });

  describe('setPassword', () => {
    it('should call keytar.setPassword with service name and credentials', async () => {
      mockSetPassword.mockResolvedValue(undefined);

      await keychainService.setPassword('conn-1', 'my-secret-password');

      expect(mockSetPassword).toHaveBeenCalledWith('zequel', 'conn-1', 'my-secret-password');
    });

    it('should catch and log errors from keytar', async () => {
      mockSetPassword.mockRejectedValue(new Error('Keychain access denied'));

      // Should not throw — errors are caught and logged
      await keychainService.setPassword('conn-1', 'password');
    });

    it('should handle empty password', async () => {
      mockSetPassword.mockResolvedValue(undefined);

      await keychainService.setPassword('conn-1', '');

      expect(mockSetPassword).toHaveBeenCalledWith('zequel', 'conn-1', '');
    });
  });

  describe('getPassword', () => {
    it('should return the password when it exists', async () => {
      mockGetPassword.mockResolvedValue('stored-password');

      const result = await keychainService.getPassword('conn-1');

      expect(result).toBe('stored-password');
      expect(mockGetPassword).toHaveBeenCalledWith('zequel', 'conn-1');
    });

    it('should return null when password does not exist', async () => {
      mockGetPassword.mockResolvedValue(null);

      const result = await keychainService.getPassword('non-existent');

      expect(result).toBeNull();
    });

    it('should return null on keytar error', async () => {
      mockGetPassword.mockRejectedValue(new Error('Keychain locked'));

      const result = await keychainService.getPassword('conn-1');
      expect(result).toBeNull();
    });
  });

  describe('deletePassword', () => {
    it('should return true when password was deleted', async () => {
      mockDeletePassword.mockResolvedValue(true);

      const result = await keychainService.deletePassword('conn-1');

      expect(result).toBe(true);
      expect(mockDeletePassword).toHaveBeenCalledWith('zequel', 'conn-1');
    });

    it('should return false when password was not found', async () => {
      mockDeletePassword.mockResolvedValue(false);

      const result = await keychainService.deletePassword('non-existent');

      expect(result).toBe(false);
    });

    it('should return false on keytar error', async () => {
      mockDeletePassword.mockRejectedValue(new Error('Keychain access denied'));

      const result = await keychainService.deletePassword('conn-1');
      expect(result).toBe(false);
    });
  });

  describe('findCredentials', () => {
    it('should return all credentials for the service', async () => {
      const credentials = [
        { account: 'conn-1', password: 'pass1' },
        { account: 'conn-2', password: 'pass2' },
      ];
      mockFindCredentials.mockResolvedValue(credentials);

      const result = await keychainService.findCredentials();

      expect(result).toEqual(credentials);
      expect(mockFindCredentials).toHaveBeenCalledWith('zequel');
    });

    it('should return an empty array when no credentials exist', async () => {
      mockFindCredentials.mockResolvedValue([]);

      const result = await keychainService.findCredentials();

      expect(result).toEqual([]);
    });

    it('should return empty array on keytar error', async () => {
      mockFindCredentials.mockRejectedValue(new Error('Keychain unavailable'));

      const result = await keychainService.findCredentials();
      expect(result).toEqual([]);
    });
  });

  describe('service name', () => {
    it('should always use "zequel" as the service name', async () => {
      mockSetPassword.mockResolvedValue(undefined);
      mockGetPassword.mockResolvedValue(null);
      mockDeletePassword.mockResolvedValue(true);
      mockFindCredentials.mockResolvedValue([]);

      await keychainService.setPassword('a', 'b');
      await keychainService.getPassword('a');
      await keychainService.deletePassword('a');
      await keychainService.findCredentials();

      expect(mockSetPassword.mock.calls[0][0]).toBe('zequel');
      expect(mockGetPassword.mock.calls[0][0]).toBe('zequel');
      expect(mockDeletePassword.mock.calls[0][0]).toBe('zequel');
      expect(mockFindCredentials.mock.calls[0][0]).toBe('zequel');
    });
  });

  describe('multiple instances', () => {
    it('should work with a new instance the same as the singleton', async () => {
      mockGetPassword.mockResolvedValue('found-it');

      const custom = new KeychainService();
      const result = await custom.getPassword('conn-x');

      expect(result).toBe('found-it');
      expect(mockGetPassword).toHaveBeenCalledWith('zequel', 'conn-x');
    });
  });
});
