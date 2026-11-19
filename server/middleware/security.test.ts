import { describe, expect, it } from 'vitest';
import { isOriginAllowed, isPrivateNetworkOrigin } from './security.js';

describe('isPrivateNetworkOrigin', () => {
    it.each([
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://myhost.local:3001',
        'http://myhost:3001',
        'http://192.168.1.20:3001',
        'http://10.0.0.5',
        'http://172.20.1.1',
        'http://[::1]:3001',
        'http://[fd12:3456::1]:3001',
    ])('accepts %s', (origin) => {
        expect(isPrivateNetworkOrigin(origin)).toBe(true);
    });

    it.each([
        'https://evil.example',
        'http://8.8.8.8',
        'http://172.32.0.1',
        'http://192.169.1.1',
        'http://localhost.evil.example',
        'http://[2001:db8::1]',
        'not a url',
    ])('rejects %s', (origin) => {
        expect(isPrivateNetworkOrigin(origin)).toBe(false);
    });
});

describe('isOriginAllowed', () => {
    it('matches exact origins only by default', () => {
        expect(isOriginAllowed('http://localhost:3001', ['http://localhost:3001'])).toBe(true);
        expect(isOriginAllowed('http://192.168.1.20:3001', ['http://localhost:3001'])).toBe(false);
    });

    it('supports "private" and "*" keywords', () => {
        expect(isOriginAllowed('http://192.168.1.20:3001', ['private'])).toBe(true);
        expect(isOriginAllowed('https://evil.example', ['private'])).toBe(false);
        expect(isOriginAllowed('https://evil.example', ['*'])).toBe(true);
    });
});
