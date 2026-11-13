import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, X, Save, Wallet, Pencil, TrendingUp, Upload, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Account, AccountType } from '../types';
import CsvImportModal from '../components/CsvImportModal';
import { COMMON_INSTITUTIONS } from '../components/OnboardingModal';
import '../styles/shared.css';

type AccountSortField = 'name' | 'member' | 'institution' | 'type' | 'assets' | 'cashBalance';
type SortDirection = 'asc' | 'desc';

const Accounts = () => {
    const {
        accounts,
        members,
        institutions,
        accountTypes,
        assets,
        addAccount,
        updateAccount,
        deleteAccount,
        addMember,
        addInstitution,
    } = useData();
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importTargetAccountId, setImportTargetAccountId] = useState<string | undefined>(undefined);
    const [importTargetType, setImportTargetType] = useState<'existing' | 'new'>('new');

    // Form State
    const [memberId, setMemberId] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [type, setType] = useState<AccountType>(() => accountTypes[0] || 'TFSA');
    const [name, setName] = useState('');
    const [initialCash, setInitialCash] = useState('');

    // Inline Member & Institution Creation State
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberName, setNewMemberName] = useState('');
    const [showAddInstitution, setShowAddInstitution] = useState(false);
    const [newInstitutionName, setNewInstitutionName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (memberId && institutionId && name && initialCash !== '') {
            if (isEditing && editingId) {
                updateAccount(editingId, {
                    memberId,
                    institutionId,
                    type,
                    name,
                    cashBalance: parseFloat(initialCash),
                });
            } else {
                addAccount({
                    memberId,
                    institutionId,
                    type,
                    name,
                    cashBalance: parseFloat(initialCash),
                });
            }
            resetForm();
        }
    };

    const startEdit = (acc: Account) => {
        setIsEditing(true);
        setEditingId(acc.id);
        setMemberId(acc.memberId);
        setInstitutionId(acc.institutionId);
        setType(acc.type);
        setName(acc.name);
        setInitialCash(acc.cashBalance.toString());
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingId(null);
        setMemberId('');
        setInstitutionId('');
        setType(accountTypes[0] || 'TFSA');
        setName('');
        setInitialCash('');
        setShowAddMember(false);
        setNewMemberName('');
        setShowAddInstitution(false);
        setNewInstitutionName('');
    };

    const handleQuickAddMember = () => {
        const trimmed = newMemberName.trim();
        if (!trimmed) return;
        const existing = members.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            setMemberId(existing.id);
        } else {
            const created = addMember(trimmed);
            setMemberId(created.id);
        }
        setNewMemberName('');
        setShowAddMember(false);
    };

    const handleQuickAddInstitution = (instName: string) => {
        const trimmed = instName.trim();
        if (!trimmed) return;
        const existing = institutions.find(i => i.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            setInstitutionId(existing.id);
        } else {
            const created = addInstitution(trimmed);
            setInstitutionId(created.id);
        }
        setNewInstitutionName('');
        setShowAddInstitution(false);
    };

    const availableAccountTypes = type && !accountTypes.includes(type) ? [type, ...accountTypes] : accountTypes;

    // Sorting State: default to alphabetical by account name
    const [sortField, setSortField] = useState<AccountSortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';
    const getInstName = (id: string) => institutions.find(i => i.id === id)?.name || 'Unknown';

    const assetCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const a of assets) {
            counts[a.accountId] = (counts[a.accountId] || 0) + 1;
        }
        return counts;
    }, [assets]);

    const handleColumnSort = (field: AccountSortField) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'assets' || field === 'cashBalance' ? 'desc' : 'asc');
        }
    };

    const renderSortIcon = (field: AccountSortField) => {
        if (sortField !== field) return <ArrowUpDown size={12} className="opacity-40" />;
        return sortDirection === 'asc' ? (
            <ArrowUp size={12} className="text-blue-400" />
        ) : (
            <ArrowDown size={12} className="text-blue-400" />
        );
    };

    const sortedAccounts = useMemo(() => {
        const list = [...accounts];
        return list.sort((a, b) => {
            let comparison = 0;
            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                    break;
                case 'member': {
                    const memA = getMemberName(a.memberId);
                    const memB = getMemberName(b.memberId);
                    comparison = memA.localeCompare(memB, undefined, { sensitivity: 'base' });
                    break;
                }
                case 'institution': {
                    const instA = getInstName(a.institutionId);
                    const instB = getInstName(b.institutionId);
                    comparison = instA.localeCompare(instB, undefined, { sensitivity: 'base' });
                    break;
                }
                case 'type':
                    comparison = a.type.localeCompare(b.type, undefined, { sensitivity: 'base' });
                    break;
                case 'assets': {
                    const countA = assetCounts[a.id] || 0;
                    const countB = assetCounts[b.id] || 0;
                    comparison = countA - countB;
                    break;
                }
                case 'cashBalance':
                    comparison = a.cashBalance - b.cashBalance;
                    break;
                default:
                    comparison = 0;
            }

            // Secondary tie-breaker: alphabetical by account name
            if (comparison === 0 && sortField !== 'name') {
                comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [accounts, sortField, sortDirection, members, institutions, assetCounts]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-blue-500/15 rounded-2xl border border-blue-500/35 text-blue-400 shadow-sm">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Accounts</h1>
                        <p className="text-sm text-slate-300 mt-0.5">
                            Manage household investment accounts, cash balances &amp; holdings
                        </p>
                    </div>
                </div>
                {!isEditing && (
                    <div className="flex items-center gap-2.5 self-start sm:self-auto">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                            onClick={() => {
                                setImportTargetAccountId(undefined);
                                setImportTargetType(accounts.length === 0 ? 'new' : 'existing');
                                setIsImportModalOpen(true);
                            }}
                        >
                            <Upload size={18} className="text-blue-400" /> Import CSV
                        </button>
                        <button
                            style={{ color: '#ffffff' }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                            onClick={() => setIsEditing(true)}
                        >
                            <Plus size={18} /> Add Account
                        </button>
                    </div>
                )}
            </div>

            {isEditing && (
                <div className="bg-slate-800/95 border border-blue-500/40 rounded-2xl p-6 shadow-xl">
                    <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-700/80">
                        <h3 className="text-lg font-bold text-white">
                            {editingId ? 'Edit Account' : 'New Account'}
                        </h3>
                        <button
                            onClick={resetForm}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                            aria-label="Close form"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                Account Name
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                placeholder="e.g. John's TFSA"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                                    Select Member
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowAddMember(prev => !prev)}
                                    className="text-xs font-semibold text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                    {showAddMember ? (
                                        <>Cancel</>
                                    ) : (
                                        <>
                                            <Plus size={12} /> Add Member
                                        </>
                                    )}
                                </button>
                            </div>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                value={memberId}
                                onChange={e => setMemberId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Member --</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.name}
                                    </option>
                                ))}
                            </select>
                            {showAddMember && (
                                <div className="mt-2 p-2.5 bg-slate-900/75 border border-slate-700/80 rounded-xl flex items-center gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
                                        placeholder="Enter member name..."
                                        value={newMemberName}
                                        onChange={e => setNewMemberName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleQuickAddMember();
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={handleQuickAddMember}
                                        disabled={!newMemberName.trim()}
                                        style={{ color: '#ffffff' }}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
                                    >
                                        Add
                                    </button>
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                                    Select Institution
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowAddInstitution(prev => !prev)}
                                    className="text-xs font-semibold text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                    {showAddInstitution ? (
                                        <>Cancel</>
                                    ) : (
                                        <>
                                            <Plus size={12} /> Add Institution
                                        </>
                                    )}
                                </button>
                            </div>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                value={institutionId}
                                onChange={e => setInstitutionId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Institution --</option>
                                {institutions.map(i => (
                                    <option key={i.id} value={i.id}>
                                        {i.name}
                                    </option>
                                ))}
                            </select>
                            {showAddInstitution && (
                                <div className="mt-2 p-3 bg-slate-900/75 border border-slate-700/80 rounded-xl space-y-2.5">
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                            Quick Presets
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {COMMON_INSTITUTIONS.map(preset => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => handleQuickAddInstitution(preset)}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-blue-600/25 border border-slate-700 hover:border-blue-500/40 text-slate-200 hover:text-white transition-colors"
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-700/70">
                                        <input
                                            type="text"
                                            className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-blue-500"
                                            placeholder="Or enter custom institution..."
                                            value={newInstitutionName}
                                            onChange={e => setNewInstitutionName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleQuickAddInstitution(newInstitutionName);
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleQuickAddInstitution(newInstitutionName)}
                                            disabled={!newInstitutionName.trim()}
                                            style={{ color: '#ffffff' }}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                                    Account Type
                                </label>
                                <Link
                                    to="/settings"
                                    className="text-xs font-semibold text-blue-400 hover:underline"
                                >
                                    Manage types in Settings
                                </Link>
                            </div>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                value={type}
                                onChange={e => setType(e.target.value as AccountType)}
                                required
                            >
                                {availableAccountTypes.map(t => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                                Cash Balance ($)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                className="input-no-spinner w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-400 rounded-xl px-3.5 py-2.5 text-sm font-mono tabular-nums font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                placeholder="0.00"
                                value={initialCash}
                                onChange={e => setInitialCash(e.target.value)}
                                required
                            />
                        </div>
                        {!editingId && (
                            <div className="md:col-span-2 p-3.5 bg-slate-900/60 border border-slate-700/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="p-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
                                        <Upload size={16} />
                                    </span>
                                    <div>
                                        <p className="text-xs font-bold text-white">Have a CSV of holdings or trade history?</p>
                                        <p className="text-[11px] text-slate-400">Create this account directly via CSV import with holdings automatically populated.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setImportTargetAccountId(undefined);
                                        setImportTargetType('new');
                                        setIsImportModalOpen(true);
                                    }}
                                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 transition-colors"
                                >
                                    Create via CSV Import
                                </button>
                            </div>
                        )}
                        <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-4 border-t border-slate-700/70">
                            <button
                                type="button"
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-sm font-semibold transition-colors"
                                onClick={resetForm}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                style={{ color: '#ffffff' }}
                                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors"
                            >
                                <Save size={16} /> {editingId ? 'Update Account' : 'Save Account'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl shadow-xl overflow-hidden">
                {accounts.length === 0 ? (
                    <div className="text-center py-14 px-6 space-y-3">
                        <p className="text-slate-300 text-sm font-medium">No accounts found yet.</p>
                        <p className="text-slate-400 text-xs">Create your first account manually or import holdings from a CSV.</p>
                        <div className="flex justify-center gap-3 pt-2">
                            <button
                                style={{ color: '#ffffff' }}
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-colors"
                            >
                                <Plus size={15} /> Add Account
                            </button>
                            <button
                                onClick={() => {
                                    setImportTargetAccountId(undefined);
                                    setIsImportModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors"
                            >
                                <Upload size={15} className="text-blue-400" /> Import CSV
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-900/90 border-b border-slate-700/80">
                                <tr className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                    <th className="px-5 py-3.5" aria-sort={sortField === 'name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => handleColumnSort('name')}
                                            className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer select-none"
                                        >
                                            <span>Account Name</span>
                                            {renderSortIcon('name')}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3.5" aria-sort={sortField === 'member' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => handleColumnSort('member')}
                                            className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer select-none"
                                        >
                                            <span>Member</span>
                                            {renderSortIcon('member')}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3.5" aria-sort={sortField === 'institution' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => handleColumnSort('institution')}
                                            className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer select-none"
                                        >
                                            <span>Institution</span>
                                            {renderSortIcon('institution')}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3.5" aria-sort={sortField === 'type' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => handleColumnSort('type')}
                                            className="inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer select-none"
                                        >
                                            <span>Type</span>
                                            {renderSortIcon('type')}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3.5 text-right" aria-sort={sortField === 'assets' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => handleColumnSort('assets')}
                                            className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto cursor-pointer select-none"
                                        >
                                            <span>Assets</span>
                                            {renderSortIcon('assets')}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3.5 text-right" aria-sort={sortField === 'cashBalance' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => handleColumnSort('cashBalance')}
                                            className="inline-flex items-center justify-end gap-1.5 hover:text-white transition-colors ml-auto cursor-pointer select-none"
                                        >
                                            <span>Cash Balance</span>
                                            {renderSortIcon('cashBalance')}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/60 text-sm">
                                {sortedAccounts.map(acc => {
                                    const assetCount = assetCounts[acc.id] || 0;
                                    return (
                                        <tr key={acc.id} className="hover:bg-slate-750/60 transition-colors">
                                            <td className="px-5 py-4">
                                                <Link
                                                    to={`/accounts/${acc.id}`}
                                                    className="font-bold text-white hover:text-blue-400 transition-colors inline-flex items-center gap-2.5"
                                                >
                                                    <span className="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400">
                                                        <Wallet size={15} />
                                                    </span>
                                                    <span>{acc.name}</span>
                                                </Link>
                                            </td>
                                            <td className="px-5 py-4 text-slate-200 font-medium">
                                                {getMemberName(acc.memberId)}
                                            </td>
                                            <td className="px-5 py-4 text-slate-300">{getInstName(acc.institutionId)}</td>
                                            <td className="px-5 py-4">
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-900 border border-slate-700 text-slate-200">
                                                    {acc.type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right font-mono tabular-nums text-slate-200 font-semibold">
                                                {assetCount}
                                            </td>
                                            <td className="px-5 py-4 text-right font-mono tabular-nums font-bold text-green-400">
                                                ${acc.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end items-center gap-2">
                                                    <Link
                                                        to={`/accounts/${acc.id}`}
                                                        style={{ color: '#ffffff' }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 shadow-sm transition-colors"
                                                        title="Manage Assets"
                                                    >
                                                        <TrendingUp size={14} /> Assets
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setImportTargetAccountId(acc.id);
                                                            setImportTargetType('existing');
                                                            setIsImportModalOpen(true);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                                                        title="Import CSV into this account"
                                                        aria-label={`Import CSV into ${acc.name}`}
                                                    >
                                                        <Upload size={13} className="text-blue-400" /> Import
                                                    </button>
                                                    <button
                                                        className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
                                                        onClick={() => startEdit(acc)}
                                                        title="Edit Account"
                                                        aria-label={`Edit ${acc.name}`}
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        className="p-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors"
                                                        onClick={() => deleteAccount(acc.id)}
                                                        title="Delete Account"
                                                        aria-label={`Delete ${acc.name}`}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <CsvImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                defaultAccountId={importTargetAccountId}
                initialTargetType={importTargetType}
                initialAccountName={name}
                initialAccountType={type}
                initialMemberId={memberId}
                initialInstitutionId={institutionId}
                onSuccess={() => {
                    resetForm();
                }}
            />
        </div>
    );
};

export default Accounts;
