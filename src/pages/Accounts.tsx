import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, X, Save, Wallet, Pencil, TrendingUp } from 'lucide-react';
import { useData } from '../context/DataContext';
import type { Account, AccountType } from '../types';
import '../styles/shared.css';

const ACCOUNT_TYPES: AccountType[] = ['TFSA', 'RRSP', 'Margin', 'Cash', 'Crypto', 'Other'];

const Accounts = () => {
    const { accounts, members, institutions, assets, addAccount, updateAccount, deleteAccount } = useData();
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form State
    const [memberId, setMemberId] = useState('');
    const [institutionId, setInstitutionId] = useState('');
    const [type, setType] = useState<AccountType>('TFSA');
    const [name, setName] = useState('');
    const [initialCash, setInitialCash] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (memberId && institutionId && name && initialCash) {
            if (isEditing && editingId) {
                updateAccount(editingId, {
                    memberId,
                    institutionId,
                    type,
                    name,
                    cashBalance: parseFloat(initialCash)
                });
            } else {
                addAccount({
                    memberId,
                    institutionId,
                    type,
                    name,
                    cashBalance: parseFloat(initialCash)
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
        setType('TFSA');
        setName('');
        setInitialCash('');
    };

    // Helper to get Names
    const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';
    const getInstName = (id: string) => institutions.find(i => i.id === id)?.name || 'Unknown';

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Accounts</h1>
                {!isEditing && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setIsEditing(true)}
                    >
                        <Plus size={18} />
                        Add Account
                    </button>
                )}
            </div>

            {isEditing && (
                <div className="card mb-6 border-blue-500/30">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Account' : 'New Account'}</h3>
                        <button onClick={resetForm} className="text-slate-400 hover:text-white"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Account Name</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="e.g. John's TFSA"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Select Member</label>
                            <select
                                className="input"
                                value={memberId}
                                onChange={e => setMemberId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Member --</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Select Institution</label>
                            <select
                                className="input"
                                value={institutionId}
                                onChange={e => setInstitutionId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Institution --</option>
                                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Account Type</label>
                            <select
                                className="input"
                                value={type}
                                onChange={e => setType(e.target.value as AccountType)}
                                required
                            >
                                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Initial Cash Balance ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                placeholder="0.00"
                                value={initialCash}
                                onChange={e => setInitialCash(e.target.value)}
                                required
                            />
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                            <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
                            <button type="submit" className="btn btn-primary">
                                <Save size={18} />
                                {editingId ? 'Update Account' : 'Save Account'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {accounts.length === 0 ? (
                    <div className="text-center py-10 text-slate-500">
                        No accounts found. Create one above!
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Account Name</th>
                                    <th>Member</th>
                                    <th>Institution</th>
                                    <th>Type</th>
                                    <th className="text-right">Assets</th>
                                    <th className="text-right">Cash Balance</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map(acc => (
                                    <tr key={acc.id}>
                                        <td className="font-medium text-white flex items-center gap-2">
                                            <Wallet size={16} className="text-blue-400" />
                                            {acc.name}
                                        </td>
                                        <td>{getMemberName(acc.memberId)}</td>
                                        <td>{getInstName(acc.institutionId)}</td>
                                        <td>
                                            <span className="bg-slate-700 text-xs px-2 py-1 rounded-full text-slate-300">
                                                {acc.type}
                                            </span>
                                        </td>
                                        <td className="text-right text-slate-300">
                                            {assets.filter(a => a.accountId === acc.id).length}
                                        </td>
                                        <td className="text-right font-mono text-green-400">
                                            ${acc.cashBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="text-right flex justify-end gap-2">
                                            <Link
                                                to={`/accounts/${acc.id}`}
                                                className="btn btn-primary bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/50"
                                                title="Manage Assets"
                                            >
                                                <TrendingUp size={16} /> Assets
                                            </Link>
                                            <button
                                                className="btn btn-secondary"
                                                onClick={() => startEdit(acc)}
                                                title="Edit Account"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => deleteAccount(acc.id)}
                                                title="Delete Account"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Accounts;
