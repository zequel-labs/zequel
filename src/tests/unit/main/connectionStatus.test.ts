import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();
const mockGetAllWindows = vi.fn();

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows(),
  },
}));

import {
  emitConnectionStatus,
  ConnectionStatusType,
} from '../../../main/services/connectionStatus';
import type { ConnectionStatusEvent } from '../../../main/services/connectionStatus';

describe('connectionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ConnectionStatusType enum', () => {
    it('should have a Reconnecting value', () => {
      expect(ConnectionStatusType.Reconnecting).toBe('reconnecting');
    });

    it('should have a Connected value', () => {
      expect(ConnectionStatusType.Connected).toBe('connected');
    });

    it('should have an Error value', () => {
      expect(ConnectionStatusType.Error).toBe('error');
    });
  });

  describe('emitConnectionStatus', () => {
    it('should send event to a single window', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const event: ConnectionStatusEvent = {
        connectionId: 'conn-1',
        status: ConnectionStatusType.Connected,
      };

      emitConnectionStatus(event);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith('connection:status', event);
    });

    it('should send event to multiple windows', () => {
      const mockSend1 = vi.fn();
      const mockSend2 = vi.fn();
      const mockSend3 = vi.fn();

      mockGetAllWindows.mockReturnValue([
        { webContents: { send: mockSend1 } },
        { webContents: { send: mockSend2 } },
        { webContents: { send: mockSend3 } },
      ]);

      const event: ConnectionStatusEvent = {
        connectionId: 'conn-2',
        status: ConnectionStatusType.Reconnecting,
        attempt: 3,
      };

      emitConnectionStatus(event);

      expect(mockSend1).toHaveBeenCalledWith('connection:status', event);
      expect(mockSend2).toHaveBeenCalledWith('connection:status', event);
      expect(mockSend3).toHaveBeenCalledWith('connection:status', event);
    });

    it('should handle no open windows', () => {
      mockGetAllWindows.mockReturnValue([]);

      const event: ConnectionStatusEvent = {
        connectionId: 'conn-1',
        status: ConnectionStatusType.Connected,
      };

      expect(() => emitConnectionStatus(event)).not.toThrow();
    });

    it('should send reconnecting status with attempt number', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const event: ConnectionStatusEvent = {
        connectionId: 'conn-1',
        status: ConnectionStatusType.Reconnecting,
        attempt: 5,
      };

      emitConnectionStatus(event);

      expect(mockSend).toHaveBeenCalledWith('connection:status', {
        connectionId: 'conn-1',
        status: 'reconnecting',
        attempt: 5,
      });
    });

    it('should send error status with error message', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const event: ConnectionStatusEvent = {
        connectionId: 'conn-1',
        status: ConnectionStatusType.Error,
        error: 'Connection refused',
      };

      emitConnectionStatus(event);

      expect(mockSend).toHaveBeenCalledWith('connection:status', {
        connectionId: 'conn-1',
        status: 'error',
        error: 'Connection refused',
      });
    });

    it('should send connected status without optional fields', () => {
      const mockWindow = { webContents: { send: mockSend } };
      mockGetAllWindows.mockReturnValue([mockWindow]);

      const event: ConnectionStatusEvent = {
        connectionId: 'conn-abc',
        status: ConnectionStatusType.Connected,
      };

      emitConnectionStatus(event);

      expect(mockSend).toHaveBeenCalledWith('connection:status', {
        connectionId: 'conn-abc',
        status: 'connected',
      });
    });
  });
});
