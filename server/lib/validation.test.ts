import path from 'path';
import { describe, expect, it } from 'vitest';
import { APP_ROOT } from '../config.js';
import { SymbolSchema, sanitizeBackupDir } from './validation.js';

describe('sanitizeBackupDir', () => {
    it('returns null for blank paths', () => {
        expect(sanitizeBackupDir('')).toBeNull();
        expect(sanitizeBackupDir('   ')).toBeNull();
    });

    it('rejects relative, UNC, device, NUL, system, and app-internal paths', () => {
        expect(() => sanitizeBackupDir('..\\..\\Windows')).toThrow();
        expect(() => sanitizeBackupDir('backups\\local')).toThrow();
        expect(() => sanitizeBackupDir('\\\\attacker\\share')).toThrow();
        expect(() => sanitizeBackupDir('\\\\?\\C:\\Backups')).toThrow();
        expect(() => sanitizeBackupDir('D:\\Backups\0evil')).toThrow();
        expect(() => sanitizeBackupDir('C:\\Windows\\Temp')).toThrow();
        expect(() => sanitizeBackupDir(path.join(APP_ROOT, 'server'))).toThrow();
    });

    it('accepts valid absolute paths and app-root backups subfolder', () => {
        const externalBackupDir =
            process.platform === 'win32' ? 'D:\\Backups' : '/tmp/hit-backups';
        expect(sanitizeBackupDir(externalBackupDir)).toBe(path.resolve(externalBackupDir));
        expect(sanitizeBackupDir(path.join(APP_ROOT, 'backups'))).toBe(
            path.resolve(path.join(APP_ROOT, 'backups'))
        );
    });
});

describe('SymbolSchema', () => {
    it('normalizes valid symbols and rejects path traversal characters', () => {
        expect(SymbolSchema.parse('xeqt.to')).toBe('XEQT.TO');
        expect(SymbolSchema.parse('cad=x')).toBe('CAD=X');
        expect(() => SymbolSchema.parse('../etc/passwd')).toThrow();
        expect(() => SymbolSchema.parse('AAPL?foo=bar')).toThrow();
    });
});
