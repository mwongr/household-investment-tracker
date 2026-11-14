import { describe, expect, it } from 'vitest';
import { cleanGithubUrl, compareSemver } from './version.js';

describe('compareSemver', () => {
    it('returns 0 for equal versions', () => {
        expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
        expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
        expect(compareSemver('1.0', '1.0.0')).toBe(0);
        expect(compareSemver('1.0.0-beta.1', '1.0.0')).toBe(0);
    });

    it('returns positive when v1 > v2', () => {
        expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
        expect(compareSemver('1.1.0', '1.0.9')).toBe(1);
        expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
        expect(compareSemver('v1.10.0', '1.2.0')).toBe(1);
        expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
    });

    it('returns negative when v1 < v2', () => {
        expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
        expect(compareSemver('1.0.9', '1.1.0')).toBe(-1);
        expect(compareSemver('1.9.9', '2.0.0')).toBe(-1);
        expect(compareSemver('1.2.0', '1.10.0')).toBe(-1);
        expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
    });

    it('handles unexpected inputs gracefully', () => {
        expect(compareSemver('', '1.0.0')).toBe(-1);
        expect(compareSemver('invalid', '0.0.0')).toBe(0);
    });
});

describe('cleanGithubUrl', () => {
    it('preserves clean https URLs', () => {
        expect(cleanGithubUrl('https://github.com/mwongr/household-investment-tracker')).toBe(
            'https://github.com/mwongr/household-investment-tracker'
        );
    });

    it('extracts URL from markdown link syntax', () => {
        const mdLink = '[https://github.com/mwongr/deck-tv](https://github.com/mwongr/household-investment-tracker)';
        expect(cleanGithubUrl(mdLink)).toBe('https://github.com/mwongr/household-investment-tracker');
    });

    it('falls back to default repo URL for invalid or missing inputs', () => {
        expect(cleanGithubUrl('')).toBe('https://github.com/mwongr/household-investment-tracker');
        expect(cleanGithubUrl(null)).toBe('https://github.com/mwongr/household-investment-tracker');
        expect(cleanGithubUrl(123)).toBe('https://github.com/mwongr/household-investment-tracker');
    });
});
