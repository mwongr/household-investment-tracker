import { describe, expect, it } from 'vitest';
import { detectColumnMapping, detectImportMode, parseCsvContent } from './csvImport';

// Header layout of a brokerage "account details" holdings export (values are dummy data).
const HEADER =
    'Security name,Symbol,Asset class,Currency,Quantity,Average cost ($),Market price ($),Book value ($),All time value change (%),All time value change ($),Market value ($)';
const HOLDINGS_EXPORT = `﻿${HEADER}\nEXAMPLE ETF UNIT ,ABC,Equity,CAD,10,20.5,25,205,21.95,45,250\n`;

describe('holdings export with "All time value change" columns', () => {
    it('does not map a value-change column as the date', () => {
        const mapping = detectColumnMapping(HEADER.split(','));
        expect(mapping.date).toBeUndefined();
        expect(detectImportMode(mapping)).toBe('holdings');
    });

    it('parses every row as a valid holding', () => {
        const result = parseCsvContent(HOLDINGS_EXPORT, 'acct', undefined, undefined, 'CAD');
        expect(result.detectedMode).toBe('holdings');
        expect(result.validatedRows).toHaveLength(1);
        expect(result.validatedRows[0]!.isValid).toBe(true);
        expect(result.validatedRows[0]!.transaction?.ticker).toBe('ABC');
        expect(result.validatedRows[0]!.transaction?.shares).toBe(10);
    });
});
