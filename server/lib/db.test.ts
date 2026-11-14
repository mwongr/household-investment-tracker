import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDbStore } from './db.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-db-test-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    while (tempDirs.length > 0) {
        const dir = tempDirs.pop()!;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('createDbStore', () => {
    it('serializes 50 concurrent mutations without losing updates', async () => {
        const dir = makeTempDir();
        const store = createDbStore({
            dbPath: path.join(dir, 'database.json'),
            backupsDir: path.join(dir, 'backups'),
            maxSnapshots: 5,
        });
        store.init();

        await Promise.all(
            Array.from({ length: 50 }, (_, idx) =>
                store.mutate((draft) => {
                    const list = (draft.items as number[] | undefined) ?? [];
                    list.push(idx);
                    draft.items = list;
                })
            )
        );

        const items = store.read().items as number[];
        expect(items).toHaveLength(50);
        expect(new Set(items).size).toBe(50);
    });

    it('keeps previous state intact if a mutation throws', async () => {
        const dir = makeTempDir();
        const store = createDbStore({
            dbPath: path.join(dir, 'database.json'),
            backupsDir: path.join(dir, 'backups'),
        });
        store.init();

        await store.mutate((draft) => {
            draft.exchangeRate = 1.38;
        });

        await expect(
            store.mutate((draft) => {
                draft.exchangeRate = 9.99;
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');

        expect(store.read().exchangeRate).toBe(1.38);
    });

    it('quarantines a corrupt database.json and restores from newest snapshot', async () => {
        const dir = makeTempDir();
        const dbPath = path.join(dir, 'database.json');
        const backupsDir = path.join(dir, 'backups');

        const store1 = createDbStore({ dbPath, backupsDir });
        store1.init();
        await store1.mutate((draft) => {
            draft.members = [{ id: 'm1', name: 'Alice' }];
        });
        await store1.mutate((draft) => {
            draft.members = [{ id: 'm1', name: 'Alice' }, { id: 'm2', name: 'Bob' }];
        });

        fs.writeFileSync(dbPath, '{corrupt json', 'utf-8');

        const store2 = createDbStore({ dbPath, backupsDir });
        store2.init();
        expect(Array.isArray(store2.read().members)).toBe(true);
        expect((store2.read().members as Array<{ name: string }>).length).toBeGreaterThan(0);

        const corruptFiles = fs.readdirSync(dir).filter((f) => f.includes('.corrupt-'));
        expect(corruptFiles).toHaveLength(1);
    });
});
