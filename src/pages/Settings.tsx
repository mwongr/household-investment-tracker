import { useState, useRef, type ChangeEvent } from 'react';
import { Download, Upload, Trash2, AlertTriangle, Check, Settings as SettingsIcon, Folder, Users, Building, Plus, Save, X, Pencil } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Member, Institution } from '../types';
import '../styles/shared.css';

// ─── Section Shell ─────────────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
    <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-700/50">
        <div className="p-3 bg-slate-700/60 rounded-xl">{icon}</div>
        <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{description}</p>
        </div>
    </div>
);

// ─── Members Sub-Section ──────────────────────────────────────────────────────

const MembersSection = () => {
    const { members, addMember, updateMember, deleteMember } = useData();
    const [isAdding, setIsAdding]   = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName]     = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        if (editingId) {
            updateMember(editingId, newName.trim());
        } else {
            addMember(newName.trim());
        }
        reset();
    };

    const startEdit = (m: Member) => {
        setEditingId(m.id);
        setIsAdding(true);
        setNewName(m.name);
    };

    const reset = () => {
        setIsAdding(false);
        setEditingId(null);
        setNewName('');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Users size={16} className="text-blue-400" /> Members
                </h3>
                {!isAdding && (
                    <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                        <Plus size={15} /> Add Member
                    </button>
                )}
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4 flex gap-3 items-center">
                    <input
                        type="text"
                        placeholder="Member name..."
                        className="input flex-1 max-w-xs"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="btn btn-primary"><Save size={15} /> {editingId ? 'Update' : 'Save'}</button>
                    <button type="button" className="btn btn-secondary" onClick={reset}><X size={15} /> Cancel</button>
                </form>
            )}

            {members.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No members yet.</p>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead><tr><th>Name</th><th className="text-right">Actions</th></tr></thead>
                        <tbody>
                            {members.map(m => (
                                <tr key={m.id}>
                                    <td className="font-medium text-white">{m.name}</td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="btn btn-secondary" onClick={() => startEdit(m)} title="Edit"><Pencil size={14} /></button>
                                            <button className="btn btn-danger" onClick={() => deleteMember(m.id)} title="Delete"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── Institutions Sub-Section ─────────────────────────────────────────────────

const InstitutionsSection = () => {
    const { institutions, addInstitution, updateInstitution, deleteInstitution } = useData();
    const [isAdding, setIsAdding]   = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName]     = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        if (editingId) {
            updateInstitution(editingId, newName.trim());
        } else {
            addInstitution(newName.trim());
        }
        reset();
    };

    const startEdit = (inst: Institution) => {
        setEditingId(inst.id);
        setIsAdding(true);
        setNewName(inst.name);
    };

    const reset = () => {
        setIsAdding(false);
        setEditingId(null);
        setNewName('');
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Building size={16} className="text-blue-400" /> Institutions
                </h3>
                {!isAdding && (
                    <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
                        <Plus size={15} /> Add Institution
                    </button>
                )}
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-4 flex gap-3 items-center">
                    <input
                        type="text"
                        placeholder="e.g. Questrade, TD..."
                        className="input flex-1 max-w-xs"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        autoFocus
                    />
                    <button type="submit" className="btn btn-primary"><Save size={15} /> {editingId ? 'Update' : 'Save'}</button>
                    <button type="button" className="btn btn-secondary" onClick={reset}><X size={15} /> Cancel</button>
                </form>
            )}

            {institutions.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No institutions yet.</p>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead><tr><th>Name</th><th className="text-right">Actions</th></tr></thead>
                        <tbody>
                            {institutions.map(inst => (
                                <tr key={inst.id}>
                                    <td className="font-medium text-white flex items-center gap-2">
                                        <Building size={14} className="text-slate-400" /> {inst.name}
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <button className="btn btn-secondary" onClick={() => startEdit(inst)} title="Edit"><Pencil size={14} /></button>
                                            <button className="btn btn-danger" onClick={() => deleteInstitution(inst.id)} title="Delete"><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── Main Settings Page ───────────────────────────────────────────────────────

const Settings = () => {
    const { backupPath, setBackupPath } = useData();
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const STORAGE_KEY = 'wealth-tracker-storage';

    const handleExport = () => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) { setImportStatus({ type: 'error', message: 'No data found to export.' }); return; }
            const blob = new Blob([data], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `investment-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setImportStatus({ type: 'success', message: 'Backup exported successfully.' });
        } catch { setImportStatus({ type: 'error', message: 'Failed to export data.' }); }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const content = ev.target?.result as string;
                if (!content) throw new Error('Empty file');
                const parsed = JSON.parse(content);
                if (!parsed.members || !parsed.accounts || !parsed.transactions) throw new Error('Invalid backup format.');
                if (window.confirm('Restore this backup? Current data will be REPLACED.')) {
                    localStorage.setItem(STORAGE_KEY, content);
                    setImportStatus({ type: 'success', message: 'Data restored. Reloading...' });
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            } catch { setImportStatus({ type: 'error', message: 'Invalid JSON or corrupted backup.' }); }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        if (window.confirm('DANGER: Delete ALL data permanently? This cannot be undone.')) {
            if (window.confirm('Are you REALLY sure?')) {
                localStorage.removeItem(STORAGE_KEY);
                localStorage.clear();
                window.location.reload();
            }
        }
    };

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <SettingsIcon size={30} className="text-slate-400" />
                <h1 className="text-3xl font-bold text-white">Settings</h1>
            </div>

            <div className="space-y-6">

                {/* ── Status Banner ── */}
                {importStatus && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${importStatus.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {importStatus.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                        {importStatus.message}
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

                    {/* ── Section 1: People & Organizations ── */}
                    <div className="card">
                        <SectionHeader
                            icon={<Users size={22} className="text-blue-400" />}
                            title="People & Organizations"
                            description="Manage household members and financial institutions."
                        />
                        <div className="space-y-6">
                            <MembersSection />
                            <div className="border-t border-slate-700/50 pt-6">
                                <InstitutionsSection />
                            </div>
                        </div>
                    </div>

                    {/* ── Section 2: Data Management ── */}
                    <div className="card">
                        <SectionHeader
                            icon={<Folder size={22} className="text-slate-400" />}
                            title="Data Management"
                            description="Export, restore, and manage your application data."
                        />
                        <div className="divide-y divide-slate-700/50">
                            {/* Backup */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4 first:pt-0">
                                <div>
                                    <h3 className="font-semibold text-white">Backup Data</h3>
                                    <p className="text-slate-400 text-sm mt-0.5">Download a complete JSON copy of all your financial data.</p>
                                </div>
                                <button onClick={handleExport} className="btn btn-primary whitespace-nowrap">
                                    <Download size={16} /> Export Backup
                                </button>
                            </div>

                            {/* Restore */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4">
                                <div>
                                    <h3 className="font-semibold text-white">Restore Data</h3>
                                    <p className="text-slate-400 text-sm mt-0.5">Upload a previously exported backup. <span className="text-amber-400 font-medium">Replaces all current data.</span></p>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary whitespace-nowrap">
                                    <Upload size={16} /> Import Backup
                                </button>
                            </div>

                            {/* Auto Backup Path */}
                            <div className="py-4">
                                <h3 className="font-semibold text-white">Automated Backup Location</h3>
                                <p className="text-slate-400 text-sm mt-0.5 mb-3">Folder path the startup script uses to save automatic backups.</p>
                                <input
                                    type="text"
                                    value={backupPath}
                                    onChange={e => setBackupPath(e.target.value)}
                                    placeholder="e.g. D:\Backups"
                                    className="input w-full"
                                />
                            </div>

                            {/* Danger Zone */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4">
                                <div>
                                    <h3 className="font-semibold text-white">Reset All Data</h3>
                                    <p className="text-slate-400 text-sm mt-0.5">Permanently delete all data and reset to factory defaults.</p>
                                </div>
                                <button onClick={handleReset} className="btn btn-danger whitespace-nowrap">
                                    <Trash2 size={16} /> Reset All Data
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default Settings;
