import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve, normalize, sep } from 'path';

const { mockGetPath, mockExistsSync, mockRealpathSync } = vi.hoisted(() => ({
  mockGetPath: vi.fn(),
  mockExistsSync: vi.fn(),
  mockRealpathSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => mockGetPath(name),
  },
}));

vi.mock('fs', () => ({
  existsSync: (p: string) => mockExistsSync(p),
  realpathSync: (p: string) => mockRealpathSync(p),
}));

import { isPathAllowed } from '@main/utils/pathValidation';

describe('isPathAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetPath.mockImplementation((name: string) => {
      const paths: Record<string, string> = {
        documents: '/Users/testuser/Documents',
        downloads: '/Users/testuser/Downloads',
        desktop: '/Users/testuser/Desktop',
        temp: '/tmp',
      };
      return paths[name] ?? '/Users/testuser';
    });

    // By default, realpathSync returns the input unchanged (no symlinks)
    mockRealpathSync.mockImplementation((p: string) => p);
    // By default, files do not exist on disk
    mockExistsSync.mockReturnValue(false);
  });

  describe('paths within allowed directories', () => {
    it('should return true for a file in Documents', () => {
      expect(isPathAllowed('/Users/testuser/Documents/report.pdf')).toBe(true);
    });

    it('should return true for a file in Downloads', () => {
      expect(isPathAllowed('/Users/testuser/Downloads/archive.zip')).toBe(true);
    });

    it('should return true for a file in Desktop', () => {
      expect(isPathAllowed('/Users/testuser/Desktop/notes.txt')).toBe(true);
    });

    it('should return true for a file in temp', () => {
      expect(isPathAllowed('/tmp/session-data.json')).toBe(true);
    });
  });

  describe('paths outside allowed directories', () => {
    it('should return false for /etc/passwd', () => {
      expect(isPathAllowed('/etc/passwd')).toBe(false);
    });

    it('should return false for ~/.ssh/id_rsa', () => {
      expect(isPathAllowed('/Users/testuser/.ssh/id_rsa')).toBe(false);
    });

    it('should return false for a system binary', () => {
      expect(isPathAllowed('/usr/bin/env')).toBe(false);
    });

    it('should return false for root path', () => {
      expect(isPathAllowed('/')).toBe(false);
    });

    it('should return false for the home directory itself', () => {
      expect(isPathAllowed('/Users/testuser')).toBe(false);
    });

    it('should return false for a path in another users home', () => {
      expect(isPathAllowed('/Users/otheruser/Documents/secret.txt')).toBe(false);
    });
  });

  describe('empty string input', () => {
    it('should return false for an empty string', () => {
      expect(isPathAllowed('')).toBe(false);
    });
  });

  describe('non-string input', () => {
    it('should return false for null', () => {
      expect(isPathAllowed(null as any)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isPathAllowed(undefined as any)).toBe(false);
    });

    it('should return false for a number', () => {
      expect(isPathAllowed(12345 as any)).toBe(false);
    });

    it('should return false for a boolean', () => {
      expect(isPathAllowed(true as any)).toBe(false);
    });

    it('should return false for an object', () => {
      expect(isPathAllowed({} as any)).toBe(false);
    });

    it('should return false for an array', () => {
      expect(isPathAllowed([] as any)).toBe(false);
    });
  });

  describe('paths that exactly equal the allowed directory', () => {
    it('should return false for Documents directory itself', () => {
      expect(isPathAllowed('/Users/testuser/Documents')).toBe(false);
    });

    it('should return false for Downloads directory itself', () => {
      expect(isPathAllowed('/Users/testuser/Downloads')).toBe(false);
    });

    it('should return false for Desktop directory itself', () => {
      expect(isPathAllowed('/Users/testuser/Desktop')).toBe(false);
    });

    it('should return false for temp directory itself', () => {
      expect(isPathAllowed('/tmp')).toBe(false);
    });
  });

  describe('nested subdirectory paths', () => {
    it('should return true for a deeply nested file in Documents', () => {
      expect(isPathAllowed('/Users/testuser/Documents/projects/work/report.docx')).toBe(true);
    });

    it('should return true for a nested directory in Downloads', () => {
      expect(isPathAllowed('/Users/testuser/Downloads/2026/january/data.csv')).toBe(true);
    });

    it('should return true for a deeply nested file in temp', () => {
      expect(isPathAllowed('/tmp/app/cache/session/abc123.tmp')).toBe(true);
    });

    it('should return true for a subdirectory path in Desktop', () => {
      expect(isPathAllowed('/Users/testuser/Desktop/folder/subfolder/file.txt')).toBe(true);
    });
  });

  describe('path traversal attempts with ..', () => {
    it('should return false for traversal from Documents to parent', () => {
      expect(isPathAllowed('/Users/testuser/Documents/../.ssh/id_rsa')).toBe(false);
    });

    it('should return false for traversal from Downloads to etc', () => {
      expect(isPathAllowed('/Users/testuser/Downloads/../../etc/passwd')).toBe(false);
    });

    it('should return false for traversal from temp to root', () => {
      expect(isPathAllowed('/tmp/../etc/shadow')).toBe(false);
    });

    it('should return false for multiple traversal sequences', () => {
      expect(isPathAllowed('/Users/testuser/Documents/../../../etc/passwd')).toBe(false);
    });

    it('should return true for traversal that stays within allowed directory', () => {
      expect(isPathAllowed('/Users/testuser/Documents/subdir/../file.txt')).toBe(true);
    });

    it('should return true for redundant traversal within allowed directory', () => {
      expect(isPathAllowed('/Users/testuser/Documents/a/b/../../c/file.txt')).toBe(true);
    });
  });

  describe('symlink resolution via realpathSync', () => {
    it('should return true when realpath resolves to an allowed directory', () => {
      const docsDir = resolve(normalize('/Users/testuser/Documents'));
      const docsFile = resolve(normalize('/Users/testuser/Documents/file.txt'));
      const symlinkDir = resolve(normalize('/Volumes/Data/Documents'));
      const symlinkFile = resolve(normalize('/Volumes/Data/Documents/file.txt'));

      mockExistsSync.mockReturnValue(true);
      mockRealpathSync.mockImplementation((p: string) => {
        if (p === docsDir) return symlinkDir;
        if (p === docsFile) return symlinkFile;
        return p;
      });

      expect(isPathAllowed('/Users/testuser/Documents/file.txt')).toBe(true);
    });

    it('should return false when symlink resolves outside allowed directories', () => {
      const docsDir = resolve(normalize('/Users/testuser/Documents'));
      const evilLink = resolve(normalize('/Users/testuser/Documents/evil-link'));
      const etcShadow = resolve(normalize('/etc/shadow'));

      mockExistsSync.mockReturnValue(true);
      mockRealpathSync.mockImplementation((p: string) => {
        if (p === docsDir) return docsDir;
        if (p === evilLink) return etcShadow;
        return p;
      });

      expect(isPathAllowed('/Users/testuser/Documents/evil-link')).toBe(false);
    });

    it('should fall back to unresolved path comparison when realpathSync throws', () => {
      mockRealpathSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      // Falls back to: resolved.startsWith(dir + '/')
      expect(isPathAllowed('/Users/testuser/Documents/file.txt')).toBe(true);
      expect(isPathAllowed('/etc/passwd')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should return false for a path that is a prefix of an allowed directory name', () => {
      // e.g., /Users/testuser/DocumentsExfil/data.txt should NOT match /Users/testuser/Documents
      expect(isPathAllowed('/Users/testuser/DocumentsExfil/data.txt')).toBe(false);
    });

    it('should return false for a path with trailing slash equal to allowed directory', () => {
      expect(isPathAllowed('/Users/testuser/Documents/')).toBe(false);
    });

    it('should return true for a path with double slashes that normalizes to allowed', () => {
      expect(isPathAllowed('/Users/testuser/Documents//file.txt')).toBe(true);
    });
  });
});
