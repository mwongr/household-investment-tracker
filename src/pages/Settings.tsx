import { useState, useRef, type ChangeEvent } from 'react';
import { Download, Upload, Trash2, AlertTriangle, Check, Settings as SettingsIcon, Folder } from 'lucide-react';
import { useData } from '../context/DataContext';
import '../styles/shared.css';

const Settings = () => {
    const { backupPath, setBackupPath } = useData();
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const STORAGE_KEY = 'wealth-tracker-storage';

    const handleExport = () => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) {
                setImportStatus({ type: 'error', message: 'No data found to export.' });
                return;
            }

            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            a.href = url;
            a.download = `investment-tracker-backup-${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setImportStatus({ type: 'success', message: 'Backup exported successfully.' });
        } catch (error) {
            setImportStatus({ type: 'error', message: 'Failed to export data.' });
        }
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                if (!content) throw new Error('Empty file');

                const parsed = JSON.parse(content);

                // Basic validation
                if (!parsed.members || !parsed.accounts || !parsed.transactions) {
                    throw new Error('Invalid backup file format. Missing core data.');
                }

                // Confirm Import
                if (window.confirm('Are you sure you want to restore this backup? Current data will be REPLACED.')) {
                    localStorage.setItem(STORAGE_KEY, content);
                    setImportStatus({ type: 'success', message: 'Data restored successfully. Reloading...' });
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    // Reset input
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }

            } catch (error) {
                setImportStatus({ type: 'error', message: 'Invalid JSON file or corrupted backup.' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        if (window.confirm('DANGER: This will delete ALL your data permanently. This action cannot be undone. Are you sure?')) {
            if (window.confirm('Are you REALLY sure?')) {
                localStorage.removeItem(STORAGE_KEY);
                // Also plain clear to be safe if key changed
                localStorage.clear();
                window.location.reload();
            }
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <SettingsIcon size={32} className="text-slate-400" /> Settings & Data Management
                </h1>
            </div>

            <div className="max-w-3xl space-y-8">

                {/* Status Message */}
                {importStatus && (
                    <div className={`p-4 rounded-lg flex items-center gap-3 ${importStatus.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                        {importStatus.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
                        <p>{importStatus.message}</p>
                    </div>
                )}

                {/* Backup */}
                <div className="card border-l-4 border-blue-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Download size={20} className="text-blue-400" /> Backup Data
                            </h3>
                            <p className="text-slate-400 mt-2 text-sm">Download a complete copy of your financial data as a JSON file. Keep this file safe.</p>
                        </div>
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                            <Download size={18} /> Export Backup
                        </button>
                    </div>
                </div>

                {/* Restore */}
                <div className="card border-l-4 border-yellow-500">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Upload size={20} className="text-yellow-400" /> Restore Data
                            </h3>
                            <p className="text-slate-400 mt-2 text-sm">Upload a previously exported backup file. <strong className="text-yellow-500">Warning: This will replace your current data.</strong></p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".json"
                                className="hidden"
                            />
                            <button
                                onClick={handleImportClick}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors whitespace-nowrap"
                            >
                                <Upload size={18} /> Import Backup
                            </button>
                        </div>
                    </div>
                </div>

                {/* Automated Backups */}
                <div className="card border-l-4 border-purple-500">
                    <div className="flex flex-col gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Folder size={20} className="text-purple-400" /> Automated Backup Location
                            </h3>
                            <p className="text-slate-400 mt-2 text-sm">
                                Specify a folder path on your computer. When you close the application,
                                the startup script will ask if you want to save a backup to this folder.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={backupPath}
                                onChange={(e) => setBackupPath(e.target.value)}
                                placeholder="e.g. D:\Backups"
                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="card border-l-4 border-red-600 bg-red-900/10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <AlertTriangle size={20} className="text-red-500" /> Danger Zone
                            </h3>
                            <p className="text-slate-400 mt-2 text-sm">Permanently delete all data and reset the application to its initial state.</p>
                        </div>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap"
                        >
                            <Trash2 size={18} /> Reset All Data
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Settings;
