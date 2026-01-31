import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetPath, mockAppendFileSync: hoistedAppendFileSync } = vi.hoisted(() => ({
  mockGetPath: vi.fn().mockReturnValue('/mock/userData'),
  mockAppendFileSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (name: string) => mockGetPath(name),
  },
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  appendFileSync: hoistedAppendFileSync,
}));

vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

import { logger } from '../../../main/utils/logger';

const mockAppendFileSync = hoistedAppendFileSync;

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should be exported as a singleton', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  describe('debug', () => {
    it('should log a debug message to console in dev mode', () => {
      logger.debug('test debug message');

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] test debug message')
      );
    });

    it('should write debug message to file', () => {
      logger.debug('file debug message');

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[DEBUG] file debug message\n')
      );
    });

    it('should include meta in debug message when provided', () => {
      logger.debug('with meta', { key: 'value' });

      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('with meta {"key":"value"}')
      );
    });
  });

  describe('info', () => {
    it('should log an info message to console in dev mode', () => {
      logger.info('test info message');

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] test info message')
      );
    });

    it('should write info message to file', () => {
      logger.info('file info message');

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[INFO] file info message\n')
      );
    });

    it('should include meta in info message when provided', () => {
      logger.info('connection established', { connectionId: '123' });

      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining('connection established {"connectionId":"123"}')
      );
    });
  });

  describe('warn', () => {
    it('should log a warn message to console in dev mode', () => {
      logger.warn('test warning');

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] test warning')
      );
    });

    it('should write warn message to file', () => {
      logger.warn('file warning');

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[WARN] file warning\n')
      );
    });
  });

  describe('error', () => {
    it('should log an error message to console in dev mode', () => {
      logger.error('test error');

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] test error')
      );
    });

    it('should write error message to file', () => {
      logger.error('file error');

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('[ERROR] file error\n')
      );
    });

    it('should include meta in error message when provided', () => {
      logger.error('query failed', { sql: 'SELECT *', error: 'timeout' });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('query failed {"sql":"SELECT *","error":"timeout"}')
      );
    });
  });

  describe('message formatting', () => {
    it('should include ISO timestamp in log messages', () => {
      logger.info('timestamp check');

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      // Timestamp pattern: [2025-01-15T10:30:00.000Z]
      expect(call).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
    });

    it('should not include meta string when meta is not provided', () => {
      logger.info('no meta');

      const call = (console.info as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(call).toMatch(/\[INFO\] no meta$/);
    });
  });

  describe('file write errors', () => {
    it('should not throw when file write fails', () => {
      mockAppendFileSync.mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      expect(() => logger.info('should not throw')).not.toThrow();
    });
  });
});
