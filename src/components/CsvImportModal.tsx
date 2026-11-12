import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    X,
    Upload,
    FileText,
    Download,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Wallet,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
    parseCsvContent,
    downloadSampleCsv,
    type ImportMode,
    type ColumnMapping,
    type CsvParseResult,
} from '../utils/csvImport';
import type { AccountType } from '../types';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultAccountId?: string;
    onSuccess?: (accountId: string) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
    isOpen,
    onClose,
    defaultAccountId,
    onSuccess,
}) => {
    const {
        accounts,
        members,
        institutions,
        accountTypes,
        addAccount,
        addTransactions,
        refreshPrices,
    } = useData();

    // Account Selection / Creation State
    const [targetType, setTargetType] = useState<'existing' | 'new'>(() =>
        accounts.length === 0 ? 'new' : defaultAccountId ? 'existing' : 'existing'
    );
    const [selectedAccountId, setSelectedAccountId] = useState<string>(() =>
        defaultAccountId || (accounts[0] ? accounts[0].id : '')
    );

    // New Account Form state
    const [newAccountName, setNewAccountName] = useState('');
    const [newMemberId, setNewMemberId] = useState(() => (members[0] ? members[0].id : ''));
    const [newInstitutionId, setNewInstitutionId] = useState(() => (institutions[0] ? institutions[0].id : ''));
    const [newAccType, setNewAccType] = useState<AccountType>(() => accountTypes[0] || 'TFSA');
    const [newCashBalance, setNewCashBalance] = useState('0.00');

    // CSV Input State
    const [file, setFile] = useState<File | null>(null);
    const [csvText, setCsvText] = useState('');
    const [inputMethod, setInputMethod] = useState<'file' | 'paste'>('file');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Parsing & Mapping State
    const [mode, setMode] = useState<ImportMode | null>(null);
    const [customMapping, setCustomMapping] = useState<ColumnMapping>({});
    const [showMappingConfig, setShowMappingConfig] = useState(false);
    const [updateCashBalance, setUpdateCashBalance] = useState<boolean>(true);
    const [autoFetchPrices, setAutoFetchPrices] = useState<boolean>(true);
    const [skipInvalidRows, setSkipInvalidRows] = useState<boolean>(true);

    // Status State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

    // Update selectedAccountId when defaultAccountId changes or accounts load
    useEffect(() => {
        if (defaultAccountId) {
            setSelectedAccountId(defaultAccountId);
            setTargetType('existing');
        } else if (accounts.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accounts[0].id);
        } else if (accounts.length === 0) {
            setTargetType('new');
        }
    }, [defaultAccountId, accounts, selectedAccountId]);

    // Read file text when file changes
    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const text = (e.target?.result as string) || '';
            setCsvText(text);
        };
        reader.readAsText(file);
    }, [file]);

    // Parse CSV dynamically whenever content, mode override, or mapping changes
    const parseResult: CsvParseResult | null = useMemo(() => {
        if (!csvText.trim()) return null;
        try {
            const activeAccountId = targetType === 'existing' ? selectedAccountId : 'temp-account-id';
            const res = parseCsvContent(
                csvText,
                activeAccountId,
                mode || undefined,
                customMapping
            );
            return res;
        } catch (err: any) {
            console.error('CSV parse error:', err);
            return null;
        }
    }, [csvText, mode, customMapping, targetType, selectedAccountId]);

    // Sync detected mode if mode is not manually overridden yet
    useEffect(() => {
        if (parseResult && mode === null) {
            setMode(parseResult.detectedMode);
            // Default updateCashBalance based on mode
            if (parseResult.detectedMode === 'holdings') {
                setUpdateCashBalance(false);
            } else {
                setUpdateCashBalance(true);
            }
        }
    }, [parseResult, mode]);

    if (!isOpen) return null;

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.name.endsWith('.csv') || droppedFile.type.includes('csv') || droppedFile.type.includes('text')) {
                setFile(droppedFile);
                setMode(null);
                setCustomMapping({});
                setImportError(null);
            } else {
                setImportError('Please upload a valid .csv file.');
            }
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setMode(null);
            setCustomMapping({});
            setImportError(null);
        }
    };

    const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
        setCustomMapping(prev => ({
            ...prev,
            [field]: value === '__NONE__' ? undefined : value,
        }));
    };

    const resetImporter = () => {
        setFile(null);
        setCsvText('');
        setMode(null);
        setCustomMapping({});
        setImportError(null);
        setImportSuccessMessage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleExecuteImport = async () => {
        setImportError(null);
        if (!parseResult) {
            setImportError('No CSV data loaded.');
            return;
        }

        const validRows = parseResult.validatedRows.filter(r => r.isValid);
        if (validRows.length === 0) {
            setImportError('No valid rows found to import. Please check column mappings and data errors.');
            return;
        }

        if (!skipInvalidRows && parseResult.stats.invalidRows > 0) {
            setImportError(`There are ${parseResult.stats.invalidRows} invalid rows. Please resolve them or enable "Skip invalid rows".`);
            return;
        }

        setIsSubmitting(true);

        try {
            let finalAccountId = selectedAccountId;

            // 1. Create Account if target is 'new'
            if (targetType === 'new') {
                if (!newAccountName.trim()) {
                    setImportError('Please enter a name for the new account.');
                    setIsSubmitting(false);
                    return;
                }
                if (!newMemberId || !newInstitutionId) {
                    setImportError('Please select a member and institution.');
                    setIsSubmitting(false);
                    return;
                }

                const cashParsed = parseFloat(newCashBalance) || 0;
                const createdAcc = addAccount({
                    name: newAccountName.trim(),
                    memberId: newMemberId,
                    institutionId: newInstitutionId,
                    type: newAccType,
                    cashBalance: cashParsed,
                });
                finalAccountId = createdAcc.id;
            }

            if (!finalAccountId) {
                setImportError('No valid account selected.');
                setIsSubmitting(false);
                return;
            }

            // 2. Prepare transactions with target accountId
            const transactionsToImport = validRows.map(r => {
                const tx = r.transaction!;
                return {
                    ...tx,
                    accountId: finalAccountId,
                    ignoreCashImpact: !updateCashBalance,
                };
            });

            // 3. Batch insert transactions into DataContext
            addTransactions(transactionsToImport, { updateCashBalance });

            // 4. Optionally refresh market data for new assets
            if (autoFetchPrices) {
                // Non-blocking refresh
                refreshPrices().catch(err => console.warn('Post-import price refresh error:', err));
            }

            const count = transactionsToImport.length;
            const modeLabel = mode === 'holdings' ? 'holding(s)' : 'transaction(s)';
            setImportSuccessMessage(`Successfully imported ${count} ${modeLabel}!`);

            setTimeout(() => {
                onSuccess?.(finalAccountId);
                onClose();
            }, 1200);
        } catch (err: any) {
            console.error('Import execution failed:', err);
            setImportError(err.message || 'Failed to complete import.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/15 rounded-xl border border-blue-500/30 text-blue-400">
                            <Upload size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                Import Investments
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    CSV
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Import current portfolio holdings or historical transactions into an account
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        aria-label="Close dialog"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Success Notice */}
                    {importSuccessMessage && (
                        <div className="bg-green-500/15 border border-green-500/35 rounded-xl p-4 flex items-center gap-3 text-green-300 animate-in fade-in">
                            <CheckCircle2 size={20} className="shrink-0 text-green-400" />
                            <span className="text-sm font-semibold">{importSuccessMessage}</span>
                        </div>
                    )}

                    {/* Error Notice */}
                    {importError && (
                        <div className="bg-red-500/15 border border-red-500/35 rounded-xl p-4 flex items-center gap-3 text-red-300 animate-in fade-in">
                            <AlertCircle size={20} className="shrink-0 text-red-400" />
                            <span className="text-sm font-medium">{importError}</span>
                        </div>
                    )}

                    {/* Step 1: Destination Account */}
                    <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <Wallet size={15} className="text-blue-400" /> Destination Account
                            </label>
                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setTargetType('existing')}
                                    disabled={accounts.length === 0}
                                    className={`px-3 py-1 rounded-md transition-colors ${
                                        targetType === 'existing'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white disabled:opacity-50'
                                    }`}
                                >
                                    Existing Account
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTargetType('new')}
                                    className={`px-3 py-1 rounded-md transition-colors ${
                                        targetType === 'new'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    + Create New Account
                                </button>
                            </div>
                        </div>

                        {targetType === 'existing' ? (
                            <div>
                                <select
                                    value={selectedAccountId}
                                    onChange={e => setSelectedAccountId(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    {accounts.map(acc => {
                                        const member = members.find(m => m.id === acc.memberId)?.name || 'Unknown';
                                        const inst = institutions.find(i => i.id === acc.institutionId)?.name || 'Unknown';
                                        return (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} ({acc.type} • {member} • {inst})
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Account Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Questrade TFSA"
                                        value={newAccountName}
                                        onChange={e => setNewAccountName(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Member
                                    </label>
                                    <select
                                        value={newMemberId}
                                        onChange={e => setNewMemberId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    >
                                        {members.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Institution
                                    </label>
                                    <select
                                        value={newInstitutionId}
                                        onChange={e => setNewInstitutionId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    >
                                        {institutions.map(i => (
                                            <option key={i.id} value={i.id}>{i.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Account Type
                                    </label>
                                    <select
                                        value={newAccType}
                                        onChange={e => setNewAccType(e.target.value as AccountType)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                                    >
                                        {accountTypes.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Initial Cash Balance ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={newCashBalance}
                                        onChange={e => setNewCashBalance(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Upload CSV / Paste Content */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                    <FileText size={15} className="text-blue-400" /> Select CSV File
                                </span>
                                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setInputMethod('file')}
                                        className={`px-2 py-0.5 rounded ${inputMethod === 'file' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
                                    >
                                        File Upload
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInputMethod('paste')}
                                        className={`px-2 py-0.5 rounded ${inputMethod === 'paste' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
                                    >
                                        Paste Text
                                    </button>
                                </div>
                            </div>

                            {/* Download Templates Button Group */}
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                                <span className="text-xs text-slate-400">Templates:</span>
                                <button
                                    type="button"
                                    onClick={() => downloadSampleCsv('holdings')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-blue-400 border border-slate-700 hover:border-blue-500/40 transition-colors"
                                    title="Download CSV template for current portfolio holdings"
                                >
                                    <Download size={12} /> Holdings CSV
                                </button>
                                <button
                                    type="button"
                                    onClick={() => downloadSampleCsv('transactions')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-blue-400 border border-slate-700 hover:border-blue-500/40 transition-colors"
                                    title="Download CSV template for trade transaction history"
                                >
                                    <Download size={12} /> Transactions CSV
                                </button>
                            </div>
                        </div>

                        {inputMethod === 'file' ? (
                            <div
                                onDragOver={e => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleFileDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                                    isDragging
                                        ? 'border-blue-500 bg-blue-500/10'
                                        : file
                                        ? 'border-green-500/50 bg-green-500/5'
                                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/70'
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,text/csv,text/plain"
                                    onChange={handleFileInput}
                                    className="hidden"
                                />

                                {file ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="p-2.5 bg-green-500/20 text-green-400 rounded-xl">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-white">{file.name}</p>
                                            <p className="text-xs text-slate-400">
                                                {(file.size / 1024).toFixed(1)} KB • Click or drop another to replace
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={e => {
                                                e.stopPropagation();
                                                resetImporter();
                                            }}
                                            className="ml-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                                            title="Clear file"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm font-semibold text-white">
                                            Drop your CSV file here, or <span className="text-blue-400 underline">browse</span>
                                        </p>
                                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                                            Supports Questrade, Wealthsimple, Interactive Brokers, Yahoo Finance, or our template CSV.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                <textarea
                                    value={csvText}
                                    onChange={e => {
                                        setCsvText(e.target.value);
                                        setMode(null);
                                        setImportError(null);
                                    }}
                                    placeholder={`Paste CSV text here...\nExample:\nTicker,Shares,Average Cost,Currency\nXEQT.TO,100,28.50,CAD\nVFV.TO,50,118.25,CAD`}
                                    rows={5}
                                    className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        )}
                    </div>

                    {/* Step 3: Mode & Column Configuration (Visible once CSV is parsed) */}
                    {parseResult && (
                        <div className="space-y-4 pt-2">
                            {/* Mode Toggle Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-800/90 border border-slate-700/80 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                        Import As:
                                    </span>
                                    <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700">
                                        <button
                                            type="button"
                                            onClick={() => setMode('holdings')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                mode === 'holdings'
                                                    ? 'bg-blue-600 text-white shadow'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Holdings / Current Portfolio
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMode('transactions')}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                mode === 'transactions'
                                                    ? 'bg-blue-600 text-white shadow'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Transaction History
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowMappingConfig(!showMappingConfig)}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    {showMappingConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    {showMappingConfig ? 'Hide Column Mapping' : 'Adjust Column Mapping'}
                                </button>
                            </div>

                            {/* Column Mapping Selectors */}
                            {showMappingConfig && (
                                <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 animate-in fade-in space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Column Header Mapping ({parseResult.headers.length} headers detected)
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            Auto-detected from CSV headers
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                                        {/* Ticker */}
                                        <div>
                                            <label className="block text-slate-400 mb-1 font-semibold">
                                                Ticker / Symbol <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                                value={parseResult.mapping.ticker || '__NONE__'}
                                                onChange={e => handleMappingChange('ticker', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="__NONE__">-- Not Mapped --</option>
                                                {parseResult.headers.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Shares */}
                                        <div>
                                            <label className="block text-slate-400 mb-1 font-semibold">
                                                Shares / Qty <span className="text-red-400">*</span>
                                            </label>
                                            <select
                                                value={parseResult.mapping.shares || '__NONE__'}
                                                onChange={e => handleMappingChange('shares', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="__NONE__">-- Not Mapped --</option>
                                                {parseResult.headers.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Price / Avg Cost */}
                                        <div>
                                            <label className="block text-slate-400 mb-1 font-semibold">
                                                {mode === 'holdings' ? 'Avg Cost / Book Cost' : 'Price per Share'} {mode === 'holdings' && <span className="text-red-400">*</span>}
                                            </label>
                                            <select
                                                value={parseResult.mapping.price || '__NONE__'}
                                                onChange={e => handleMappingChange('price', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="__NONE__">-- Not Mapped --</option>
                                                {parseResult.headers.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Amount / Total ($) (for transactions) */}
                                        {mode === 'transactions' && (
                                            <div>
                                                <label className="block text-slate-400 mb-1 font-semibold">
                                                    Amount / Total ($)
                                                </label>
                                                <select
                                                    value={parseResult.mapping.amount || '__NONE__'}
                                                    onChange={e => handleMappingChange('amount', e.target.value)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="__NONE__">-- Auto (Shares × Price) --</option>
                                                    {parseResult.headers.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Type (if transactions) */}
                                        {mode === 'transactions' && (
                                            <div>
                                                <label className="block text-slate-400 mb-1 font-semibold">
                                                    Action / Type
                                                </label>
                                                <select
                                                    value={parseResult.mapping.type || '__NONE__'}
                                                    onChange={e => handleMappingChange('type', e.target.value)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="__NONE__">-- Auto-detect (Buy) --</option>
                                                    {parseResult.headers.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Date (if transactions) */}
                                        {mode === 'transactions' && (
                                            <div>
                                                <label className="block text-slate-400 mb-1 font-semibold">
                                                    Date
                                                </label>
                                                <select
                                                    value={parseResult.mapping.date || '__NONE__'}
                                                    onChange={e => handleMappingChange('date', e.target.value)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="__NONE__">-- Today's Date --</option>
                                                    {parseResult.headers.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Currency */}
                                        <div>
                                            <label className="block text-slate-400 mb-1 font-semibold">
                                                Currency
                                            </label>
                                            <select
                                                value={parseResult.mapping.currency || '__NONE__'}
                                                onChange={e => handleMappingChange('currency', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="__NONE__">-- Default (CAD) --</option>
                                                {parseResult.headers.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Commission */}
                                        {mode === 'transactions' && (
                                            <div>
                                                <label className="block text-slate-400 mb-1 font-semibold">
                                                    Commission / Fee
                                                </label>
                                                <select
                                                    value={parseResult.mapping.commission || '__NONE__'}
                                                    onChange={e => handleMappingChange('commission', e.target.value)}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="__NONE__">-- $0.00 --</option>
                                                    {parseResult.headers.map(h => (
                                                        <option key={h} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Summary Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Valid Records
                                    </span>
                                    <span className="text-xl font-bold font-mono text-green-400">
                                        {parseResult.stats.validRows}
                                    </span>
                                    <span className="text-xs text-slate-400 ml-1">
                                        / {parseResult.stats.totalRows}
                                    </span>
                                </div>

                                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Unique Tickers
                                    </span>
                                    <span className="text-xl font-bold font-mono text-blue-400">
                                        {parseResult.stats.tickersCount}
                                    </span>
                                </div>

                                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Est. Total Cost
                                    </span>
                                    <span className="text-xl font-bold font-mono text-white">
                                        ${parseResult.stats.totalEstimatedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Errors
                                    </span>
                                    <span className={`text-xl font-bold font-mono ${parseResult.stats.invalidRows > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                                        {parseResult.stats.invalidRows}
                                    </span>
                                </div>
                            </div>

                            {/* Format Guide for Transactions */}
                            {mode === 'transactions' && (
                                <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                                    <span className="font-bold text-slate-200 text-[11px] uppercase tracking-wider block">
                                        How to format transaction types in CSV:
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-slate-400">
                                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-750">
                                            <span className="font-bold text-white block mb-0.5">Deposit / Withdrawal</span>
                                            Cash amount goes in <span className="text-blue-300 font-mono">Amount</span>. Ticker & Shares stay empty.
                                        </div>
                                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-750">
                                            <span className="font-bold text-white block mb-0.5">Dividend Payout</span>
                                            Stock in <span className="text-blue-300 font-mono">Ticker</span>, cash received in <span className="text-blue-300 font-mono">Amount</span>.
                                        </div>
                                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-750">
                                            <span className="font-bold text-white block mb-0.5">Buy / Sell Order</span>
                                            Stock in <span className="text-blue-300 font-mono">Ticker</span>, <span className="text-blue-300 font-mono">Shares</span>, and <span className="text-blue-300 font-mono">Price</span>.
                                        </div>
                                        <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-750">
                                            <span className="font-bold text-white block mb-0.5">DRIP (Reinvested)</span>
                                            Stock in <span className="text-blue-300 font-mono">Ticker</span>, new shares in <span className="text-blue-300 font-mono">Shares</span>, price in <span className="text-blue-300 font-mono">Price</span>.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Preview Table */}
                            <div className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden">
                                <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                        Data Preview (First {Math.min(50, parseResult.validatedRows.length)} rows)
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                        Review parsed rows before committing
                                    </span>
                                </div>

                                <div className="max-h-60 overflow-y-auto overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2">Status</th>
                                                <th className="px-3 py-2">Row</th>
                                                {mode === 'transactions' && <th className="px-3 py-2">Date</th>}
                                                <th className="px-3 py-2">Ticker</th>
                                                <th className="px-3 py-2">Type</th>
                                                <th className="px-3 py-2 text-right">Shares</th>
                                                <th className="px-3 py-2 text-right">{mode === 'holdings' ? 'Avg Cost' : 'Price'}</th>
                                                <th className="px-3 py-2 text-right">Total</th>
                                                <th className="px-3 py-2">Curr</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/70 font-mono">
                                            {parseResult.validatedRows.slice(0, 50).map(row => {
                                                const tx = row.transaction;
                                                const holding = row.holdingSummary;
                                                return (
                                                    <tr
                                                        key={row.rowNumber}
                                                        className={row.isValid ? 'hover:bg-slate-800/40' : 'bg-red-500/10'}
                                                    >
                                                        <td className="px-3 py-2 font-sans">
                                                            {row.isValid ? (
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400">
                                                                    <CheckCircle2 size={13} /> Ready
                                                                </span>
                                                            ) : (
                                                                <span
                                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"
                                                                    title={row.errors.join(', ')}
                                                                >
                                                                    <AlertCircle size={13} /> {row.errors[0]}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-400">#{row.rowNumber}</td>
                                                        {mode === 'transactions' && (
                                                            <td className="px-3 py-2 text-slate-300">
                                                                {tx?.date || '-'}
                                                            </td>
                                                        )}
                                                        <td className="px-3 py-2 font-bold text-white">
                                                            {tx?.ticker || holding?.ticker || '-'}
                                                        </td>
                                                        <td className="px-3 py-2 font-sans">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200">
                                                                {tx?.type || 'Holdings'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-slate-200">
                                                            {(tx?.shares || holding?.shares || 0).toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-slate-300">
                                                            ${(tx?.pricePerShare || holding?.averageCost || 0).toFixed(2)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-bold text-white">
                                                            ${(tx?.amount || holding?.totalCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-400">
                                                            {tx?.currency || holding?.currency || 'CAD'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Import Options Checkboxes */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={updateCashBalance}
                                        onChange={e => setUpdateCashBalance(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <span>
                                        Adjust account cash balance based on trade amounts
                                    </span>
                                </label>

                                <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={autoFetchPrices}
                                        onChange={e => setAutoFetchPrices(e.target.checked)}
                                        className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0"
                                    />
                                    <span>
                                        Automatically fetch live market quotes for imported assets
                                    </span>
                                </label>

                                {parseResult.stats.invalidRows > 0 && (
                                    <label className="flex items-center gap-2 text-amber-300 cursor-pointer select-none col-span-full">
                                        <input
                                            type="checkbox"
                                            checked={skipInvalidRows}
                                            onChange={e => setSkipInvalidRows(e.target.checked)}
                                            className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0"
                                        />
                                        <span>
                                            Skip {parseResult.stats.invalidRows} invalid row(s) and proceed with valid records
                                        </span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-3">
                        {parseResult && (
                            <button
                                type="button"
                                onClick={resetImporter}
                                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                            >
                                Reset
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleExecuteImport}
                            disabled={!parseResult || parseResult.stats.validRows === 0 || isSubmitting}
                            style={{ color: '#ffffff' }}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-bold shadow-lg transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Importing...</span>
                                </>
                            ) : (
                                <>
                                    <Upload size={16} />
                                    <span>
                                        {parseResult && parseResult.stats.validRows > 0
                                            ? `Import ${parseResult.stats.validRows} ${mode === 'holdings' ? 'Holdings' : 'Transactions'}`
                                            : 'Import Records'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CsvImportModal;
