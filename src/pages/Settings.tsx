import { useState, useRef, type ChangeEvent } from 'react';
import {
    Download,
    Upload,
    Trash2,
    AlertTriangle,
    Check,
    Settings as SettingsIcon,
    Folder,
    Users,
    Building2,
    Plus,
    Save,
    X,
    Pencil,
    Sun,
    Moon,
    Monitor,
    ToggleRight,
    TrendingUp,
    Calculator,
    Percent,
    ShieldAlert,
    Database,
    Tag,
    Sparkles,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/shared.css';

// ─── Reusable Entity Manager Card (Members / Institutions) ────────────────────

interface EntityItem {
    id: string;
    name: string;
}

interface EntityManagerCardProps {
    icon: React.ReactNode;
    iconTone: string;
    title: string;
    description: string;
    itemLabel: string;
    placeholder: string;
    items: EntityItem[];
    getUsageCount: (id: string) => number;
    onAdd: (name: string) => void;
    onUpdate: (id: string, name: string) => void;
    onDelete: (id: string) => void;
}

const EntityManagerCard: React.FC<EntityManagerCardProps> = ({
    icon,
    iconTone,
    title,
    description,
    itemLabel,
    placeholder,
    items,
    getUsageCount,
    onAdd,
    onUpdate,
    onDelete,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = newName.trim();
        if (!trimmed) return;
        onAdd(trimmed);
        setNewName('');
        setIsAdding(false);
    };

    const startEdit = (item: EntityItem) => {
        setIsAdding(false);
        setEditingId(item.id);
        setEditName(item.name);
    };

    const saveEdit = (id: string) => {
        const trimmed = editName.trim();
        if (!trimmed) return;
        onUpdate(id, trimmed);
        setEditingId(null);
        setEditName('');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const handleDelete = (item: EntityItem) => {
        const count = getUsageCount(item.id);
        const msg =
            count > 0
                ? `Delete "${item.name}"? It is currently linked to ${count} account${count === 1 ? '' : 's'}.`
                : `Delete "${item.name}"?`;
        if (window.confirm(msg)) {
            if (editingId === item.id) cancelEdit();
            onDelete(item.id);
        }
    };

    return (
        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${iconTone}`}>{icon}</div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white tracking-tight truncate">{title}</h2>
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-slate-300">
                                {items.length}
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 truncate">{description}</p>
                    </div>
                </div>
                {!isAdding && (
                    <button
                        type="button"
                        onClick={() => {
                            cancelEdit();
                            setNewName('');
                            setIsAdding(true);
                        }}
                        style={{ color: '#ffffff' }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold shadow-sm transition-colors shrink-0"
                    >
                        <Plus size={14} /> Add {itemLabel}
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="p-5 flex-1 flex flex-col gap-4">
                {isAdding && (
                    <form
                        onSubmit={handleAddSubmit}
                        className="bg-slate-900/75 p-3.5 rounded-xl border border-blue-500/40 flex flex-wrap sm:flex-nowrap gap-2.5 items-center"
                    >
                        <input
                            type="text"
                            placeholder={placeholder}
                            className="flex-1 min-w-[160px] bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="submit"
                                style={{ color: '#ffffff' }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-colors"
                            >
                                <Save size={14} /> Save
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAdding(false);
                                    setNewName('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors"
                            >
                                <X size={14} /> Cancel
                            </button>
                        </div>
                    </form>
                )}

                {items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl text-center">
                        <p className="text-slate-300 text-sm font-medium">No {title.toLowerCase()} added yet.</p>
                        <p className="text-slate-400 text-xs mt-1">
                            Click &ldquo;Add {itemLabel}&rdquo; above to create one.
                        </p>
                    </div>
                ) : (
                    <div className="bg-slate-900/50 border border-slate-700/80 rounded-xl divide-y divide-slate-700/60 overflow-hidden">
                        {items.map(item => {
                            const accountCount = getUsageCount(item.id);
                            const isRowEditing = editingId === item.id;

                            return (
                                <div
                                    key={item.id}
                                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-800/60 transition-colors"
                                >
                                    {isRowEditing ? (
                                        <>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        saveEdit(item.id);
                                                    } else if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        cancelEdit();
                                                    }
                                                }}
                                                placeholder={placeholder}
                                                className="flex-1 min-w-0 bg-slate-800 border border-blue-500 text-white placeholder-slate-400 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                                autoFocus
                                            />
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => saveEdit(item.id)}
                                                    className="p-1.5 bg-green-500/15 border border-green-500/35 hover:bg-green-500/25 text-green-400 rounded-lg transition-colors"
                                                    title="Save changes"
                                                    aria-label={`Save ${item.name}`}
                                                >
                                                    <Check size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelEdit}
                                                    className="p-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                    title="Cancel editing"
                                                    aria-label="Cancel editing"
                                                >
                                                    <X size={15} />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="font-semibold text-sm text-white truncate">
                                                    {item.name}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                                                    {accountCount} {accountCount === 1 ? 'account' : 'accounts'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(item)}
                                                    className="p-1.5 bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white rounded-lg transition-colors"
                                                    title={`Edit ${item.name}`}
                                                    aria-label={`Edit ${item.name}`}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item)}
                                                    className="p-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors"
                                                    title={`Delete ${item.name}`}
                                                    aria-label={`Delete ${item.name}`}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

// ─── Features Card ────────────────────────────────────────────────────────────

const FeaturesCard = () => {
    const { preferences, updatePreferences } = useData();

    const modules = [
        {
            key: 'enableNetWorth' as const,
            title: 'Net Worth Tracker',
            description: 'Track external bank cash, liabilities, and living expenses',
            icon: <TrendingUp size={18} />,
            tone: 'bg-blue-500/15 border-blue-500/35 text-blue-400',
            enabled: preferences.enableNetWorth,
        },
        {
            key: 'enableTaxOptimizer' as const,
            title: 'Tax Optimizer',
            description: 'Model RRSP contributions and marginal tax bracket refunds',
            icon: <Percent size={18} />,
            tone: 'bg-green-500/15 border-green-500/35 text-green-400',
            enabled: preferences.enableTaxOptimizer,
        },
        {
            key: 'enableAcbTracker' as const,
            title: 'ACB Tracker',
            description: 'Track Adjusted Cost Base and capital gains for non-registered accounts',
            icon: <Calculator size={18} />,
            tone: 'bg-amber-500/15 border-amber-500/35 text-amber-400',
            enabled: preferences.enableAcbTracker,
        },
    ];

    return (
        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/35 text-purple-400 shrink-0">
                    <ToggleRight size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Features &amp; Modules</h2>
                    <p className="text-xs text-slate-300">Show or hide optional pages in the navigation bar</p>
                </div>
            </div>

            <div className="p-5 space-y-3 flex-1">
                {modules.map(mod => (
                    <div
                        key={mod.key}
                        onClick={() => updatePreferences({ [mod.key]: !mod.enabled })}
                        className="flex items-center justify-between gap-4 p-4 bg-slate-900/65 hover:bg-slate-900/90 rounded-xl border border-slate-700/80 cursor-pointer transition-colors"
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className={`p-2 rounded-xl border shrink-0 ${mod.tone}`}>{mod.icon}</div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-sm text-white">{mod.title}</h3>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                            mod.enabled
                                                ? 'bg-green-500/15 border-green-500/35 text-green-400'
                                                : 'bg-slate-800 border-slate-700 text-slate-400'
                                        }`}
                                    >
                                        {mod.enabled ? 'Active' : 'Hidden'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 mt-0.5">{mod.description}</p>
                            </div>
                        </div>

                        <button
                            type="button"
                            role="switch"
                            aria-checked={mod.enabled}
                            aria-label={`Toggle ${mod.title}`}
                            onClick={e => {
                                e.stopPropagation();
                                updatePreferences({ [mod.key]: !mod.enabled });
                            }}
                            className={`w-12 h-6 rounded-full flex items-center transition-colors p-1 shrink-0 border ${
                                mod.enabled
                                    ? 'bg-blue-600 border-blue-500'
                                    : 'bg-slate-700 border-slate-600'
                            }`}
                        >
                            <span
                                className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                    mod.enabled ? 'translate-x-6' : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
};

// ─── Appearance Card ──────────────────────────────────────────────────────────

const AppearanceCard = () => {
    const { theme, setTheme } = useTheme();

    const options = [
        {
            value: 'dark' as const,
            title: 'Dark Mode',
            description: 'Deep slate background optimized for low-light viewing',
            icon: <Moon size={18} />,
        },
        {
            value: 'light' as const,
            title: 'Light Mode',
            description: 'Crisp high-contrast daylight palette',
            icon: <Sun size={18} />,
        },
    ];

    return (
        <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400 shrink-0">
                    <Monitor size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Appearance</h2>
                    <p className="text-xs text-slate-300">Select your preferred interface colour theme</p>
                </div>
            </div>

            <div className="p-5 space-y-3 flex-1" role="radiogroup" aria-label="Color theme">
                {options.map(opt => {
                    const isSelected = theme === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setTheme(opt.value)}
                            className={`w-full text-left flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                                isSelected
                                    ? 'bg-blue-500/15 border-blue-500/60'
                                    : 'bg-slate-900/65 hover:bg-slate-900/90 border-slate-700/80'
                            }`}
                        >
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div
                                    className={`p-2 rounded-xl border shrink-0 ${
                                        isSelected
                                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-300'
                                    }`}
                                >
                                    {opt.icon}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm text-white">{opt.title}</h3>
                                    <p className="text-xs text-slate-300 mt-0.5">{opt.description}</p>
                                </div>
                            </div>

                            {/* Radio indicator */}
                            <span
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                    isSelected ? 'border-blue-500' : 'border-slate-500'
                                }`}
                            >
                                {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

// ─── Main Settings Page ───────────────────────────────────────────────────────

const Settings = () => {
    const {
        members,
        institutions,
        accountTypes,
        accounts,
        addMember,
        updateMember,
        deleteMember,
        addInstitution,
        updateInstitution,
        deleteInstitution,
        addAccountType,
        updateAccountType,
        deleteAccountType,
        backupPath,
        setBackupPath,
        isDemoData,
        loadDemoData,
        clearAllData,
    } = useData();
    const { theme } = useTheme();
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
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
            a.href = url;
            const now = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            a.download = `investment-tracker-backup-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setImportStatus({ type: 'success', message: 'Backup exported successfully.' });
        } catch {
            setImportStatus({ type: 'error', message: 'Failed to export data.' });
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const content = ev.target?.result as string;
                if (!content) throw new Error('Empty file');
                const parsed = JSON.parse(content);
                if (!parsed.members || !parsed.accounts || !parsed.transactions) {
                    throw new Error('Invalid backup format.');
                }
                if (window.confirm('Restore this backup? Current data will be REPLACED.')) {
                    localStorage.setItem(STORAGE_KEY, content);
                    setImportStatus({ type: 'success', message: 'Data restored. Reloading...' });
                    setTimeout(() => window.location.reload(), 1500);
                } else if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch {
                setImportStatus({ type: 'error', message: 'Invalid JSON or corrupted backup.' });
            }
        };
        reader.readAsText(file);
    };

    const handleReset = () => {
        if (window.confirm('DANGER: Delete ALL data permanently? This will reset the app to a clean, blank slate.')) {
            if (window.confirm('Are you REALLY sure? This cannot be undone.')) {
                clearAllData();
                setImportStatus({ type: 'success', message: 'All data deleted. App reset to clean slate.' });
            }
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-500/35 text-blue-400 shadow-sm">
                        <SettingsIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings</h1>
                        <p className="text-sm text-slate-300 mt-0.5">
                            Configure household members, financial institutions, enabled modules, theme &amp; backups
                        </p>
                    </div>
                </div>

                {/* Quick Summary Pills */}
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="px-3 py-1.5 rounded-xl bg-slate-800/95 border border-slate-700/90 text-slate-200 font-mono">
                        {members.length} {members.length === 1 ? 'Member' : 'Members'}
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-800/95 border border-slate-700/90 text-slate-200 font-mono">
                        {institutions.length} {institutions.length === 1 ? 'Institution' : 'Institutions'}
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-800/95 border border-slate-700/90 text-slate-200 font-mono">
                        {accountTypes.length} {accountTypes.length === 1 ? 'Type' : 'Types'}
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-800/95 border border-slate-700/90 text-slate-200 font-mono">
                        {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-slate-800/95 border border-slate-700/90 text-blue-400 capitalize">
                        {theme} Theme
                    </span>
                </div>
            </div>

            {/* Status Banner */}
            {importStatus && (
                <div
                    className={`p-4 rounded-xl flex items-center justify-between gap-3 border ${
                        importStatus.type === 'success'
                            ? 'bg-green-500/15 text-green-400 border-green-500/35'
                            : 'bg-red-500/15 text-red-400 border-red-500/35'
                    }`}
                >
                    <div className="flex items-center gap-2.5 text-sm font-semibold">
                        {importStatus.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
                        <span>{importStatus.message}</span>
                    </div>
                    <button
                        onClick={() => setImportStatus(null)}
                        className="p-1 rounded-lg hover:bg-slate-800/60 transition-colors"
                        aria-label="Dismiss message"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Row 1: Household Members, Financial Institutions & Account Types */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <EntityManagerCard
                    icon={<Users size={20} />}
                    iconTone="bg-blue-500/15 border-blue-500/35 text-blue-400"
                    title="Household Members"
                    description="Individuals linked to accounts & tax views"
                    itemLabel="Member"
                    placeholder="Enter member name..."
                    items={members}
                    getUsageCount={id => accounts.filter(a => a.memberId === id).length}
                    onAdd={addMember}
                    onUpdate={updateMember}
                    onDelete={deleteMember}
                />

                <EntityManagerCard
                    icon={<Building2 size={20} />}
                    iconTone="bg-green-500/15 border-green-500/35 text-green-400"
                    title="Financial Institutions"
                    description="Brokerages and banks holding your accounts"
                    itemLabel="Institution"
                    placeholder="e.g. Questrade, Wealthsimple, TD..."
                    items={institutions}
                    getUsageCount={id => accounts.filter(a => a.institutionId === id).length}
                    onAdd={addInstitution}
                    onUpdate={updateInstitution}
                    onDelete={deleteInstitution}
                />

                <EntityManagerCard
                    icon={<Tag size={20} />}
                    iconTone="bg-purple-500/15 border-purple-500/35 text-purple-400"
                    title="Account Types"
                    description="Account classifications (TFSA, RRSP, FHSA, etc.)"
                    itemLabel="Type"
                    placeholder="e.g. FHSA, RESP, Non-Registered..."
                    items={accountTypes.map(t => ({ id: t, name: t }))}
                    getUsageCount={name => accounts.filter(a => a.type === name).length}
                    onAdd={addAccountType}
                    onUpdate={updateAccountType}
                    onDelete={deleteAccountType}
                />
            </div>

            {/* Row 2: Features & Appearance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FeaturesCard />
                <AppearanceCard />
            </div>

            {/* Row 3: Data Management & Danger Zone */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Data Management */}
                <section className="lg:col-span-2 bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-5 py-4 bg-slate-900/80 border-b border-slate-700/80 flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-400 shrink-0">
                            <Database size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Data Management &amp; Backups</h2>
                            <p className="text-xs text-slate-300">
                                Export JSON snapshots, restore from a file, or configure the script backup path
                            </p>
                        </div>
                    </div>

                    <div className="p-5 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-slate-900/65 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-sm text-white">Backup Data</h3>
                                    <p className="text-xs text-slate-300 mt-1">
                                        Download a complete JSON copy of all members, accounts, transactions, and settings.
                                    </p>
                                </div>
                                <button
                                    onClick={handleExport}
                                    style={{ color: '#ffffff' }}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold shadow-sm transition-colors"
                                >
                                    <Download size={15} /> Export Backup (.json)
                                </button>
                            </div>

                            <div className="bg-slate-900/65 border border-slate-700/80 rounded-xl p-4 flex flex-col justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-sm text-white">Restore Data</h3>
                                    <p className="text-xs text-slate-300 mt-1">
                                        Upload a previously exported backup.{' '}
                                        <span className="text-amber-400 font-semibold">Replaces all current data.</span>
                                    </p>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".json"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors"
                                >
                                    <Upload size={15} /> Import Backup (.json)
                                </button>
                            </div>

                            <div className={`bg-slate-900/65 border rounded-xl p-4 flex flex-col justify-between gap-4 ${isDemoData ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-700/80'}`}>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles size={16} className={isDemoData ? 'text-amber-400' : 'text-blue-400'} />
                                        <h3 className="font-bold text-sm text-white">
                                            {isDemoData ? 'Demo Mode Active' : 'Sample / Demo Data'}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-1">
                                        {isDemoData
                                            ? 'Currently viewing sample household data. Clear it when ready for your real data.'
                                            : 'Explore with a pre-populated sample household portfolio (stocks, ETFs, dividends).'}
                                    </p>
                                </div>
                                {isDemoData ? (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Clear sample demo data? Your app will be reset to a clean blank slate.')) {
                                                clearAllData();
                                                setImportStatus({ type: 'success', message: 'Demo data cleared. Clean slate restored.' });
                                            }
                                        }}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        <Trash2 size={15} /> Clear Demo Data
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('Load sample demo data? This will load a complete sample household portfolio.')) {
                                                loadDemoData();
                                                setImportStatus({ type: 'success', message: 'Demo portfolio loaded!' });
                                            }
                                        }}
                                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        <Sparkles size={15} /> Load Demo Data
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-900/65 border border-slate-700/80 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <Folder size={15} className="text-blue-400" />
                                <h3 className="font-bold text-sm text-white">Automated Backup Location</h3>
                            </div>
                            <p className="text-xs text-slate-300">
                                Folder path used by <code className="font-mono text-blue-400">Start App.bat</code> when saving automatic backups.
                            </p>
                            <input
                                type="text"
                                value={backupPath}
                                onChange={e => setBackupPath(e.target.value)}
                                placeholder="e.g. D:\Backups"
                                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                        </div>
                    </div>
                </section>

                {/* Danger Zone */}
                <section className="bg-slate-800/95 border border-red-500/35 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                    <div className="px-5 py-4 bg-red-500/10 border-b border-red-500/30 flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/35 text-red-400 shrink-0">
                            <ShieldAlert size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-red-400 tracking-tight">Danger Zone</h2>
                            <p className="text-xs text-slate-300">Irreversible destructive actions</p>
                        </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between gap-5">
                        <div className="space-y-2">
                            <h3 className="font-bold text-sm text-white">Reset All Data</h3>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Permanently deletes all members, accounts, transactions, watchlists, and preferences from local storage and restores factory defaults.
                            </p>
                        </div>

                        <button
                            onClick={handleReset}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-400 rounded-xl text-xs font-bold transition-colors"
                        >
                            <Trash2 size={15} /> Reset All Data
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Settings;
