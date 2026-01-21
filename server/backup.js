import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'database.json');

function performBackup() {
    console.log("Checking for backup configuration...");

    if (!fs.existsSync(DB_PATH)) {
        console.error("No database file found at " + DB_PATH + ". Ensure the app has been run and synchronized.");
        return;
    }

    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        if (!data) {
            console.error("Database file is empty.");
            return;
        }

        const json = JSON.parse(data);
        // The backupPath is stored in the root state based on our DataContext change
        const backupDir = json.backupPath;

        if (!backupDir) {
            console.log("\x1b[33mWarning: No backup folder configured in Settings.\x1b[0m");
            console.log("Go to Settings > Automated Backup Location and enter a valid path.");
            return;
        }

        if (!fs.existsSync(backupDir)) {
            console.log(`Backup directory '${backupDir}' does not exist. Attempting to create...`);
            try {
                fs.mkdirSync(backupDir, { recursive: true });
            } catch (e) {
                console.error(`\x1b[31mError: Could not create backup directory '${backupDir}'. Check permissions.\x1b[0m`);
                return;
            }
        }

        const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
        const filename = `backup_${timestamp}.json`;
        const destPath = path.join(backupDir, filename);

        fs.copyFileSync(DB_PATH, destPath);
        console.log(`\x1b[32mSUCCESS: Backup created at: ${destPath}\x1b[0m`);

    } catch (e) {
        console.error("Backup process failed:", e.message);
    }
}

performBackup();
