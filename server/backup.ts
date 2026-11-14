import fs from 'fs';
import path from 'path';
import { DB_PATH } from './config.js';
import { isInsideDir, sanitizeBackupDir } from './lib/validation.js';

function performBackup(): void {
    if (!fs.existsSync(DB_PATH)) {
        console.error(`No database file found at ${DB_PATH}. Ensure the app has been run and synchronized.`);
        return;
    }

    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        if (!raw.trim()) {
            console.error('Database file is empty.');
            return;
        }

        const json = JSON.parse(raw) as { backupPath?: string };
        const rawBackupDir = json.backupPath;
        if (!rawBackupDir || !rawBackupDir.trim()) {
            console.warn('Warning: No backup folder configured in Settings.');
            return;
        }

        const backupDir = sanitizeBackupDir(rawBackupDir);
        if (!backupDir) {
            console.warn('Warning: No backup folder configured in Settings.');
            return;
        }

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const stat = fs.lstatSync(backupDir);
        if (stat.isSymbolicLink() || !stat.isDirectory()) {
            console.error('Error: Backup destination must be a real directory (symlinks are not allowed).');
            return;
        }

        const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
        const filename = `investment-tracker-backup-${timestamp}.json`;
        const destPath = path.resolve(backupDir, filename);

        if (!isInsideDir(destPath, backupDir)) {
            console.error('Error: Resolved backup path escaped target directory.');
            return;
        }

        fs.copyFileSync(DB_PATH, destPath, fs.constants.COPYFILE_EXCL);
        console.log(`SUCCESS: Backup created at: ${destPath}`);
    } catch (err) {
        console.error('Backup process failed:', err instanceof Error ? err.message : err);
    }
}

performBackup();
