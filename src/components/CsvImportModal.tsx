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
    Tag,
    ArrowRight,
    RotateCcw,
    Maximize2,
    Minimize2,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import {
    parseCsvContent,
    downloadSampleCsv,
    type ImportMode,
    type ColumnMapping,
    type CsvParseResult,
    type TickerOverridesMap,
} from '../utils/csvImport';
import type { AccountType } from '../types';

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultAccountId?: string;
    initialTargetType?: 'existing' | 'new';
    initialAccountName?: string;
    initialAccountType?: AccountType;
    initialMemberId?: string;
    initialInstitutionId?: string;
    onSuccess?: (accountId: string) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
    isOpen,
    onClose,
    defaultAccountId,
    initialTargetType,
    initialAccountName,
    initialAccountType,
    initialMemberId,
    initialInstitutionId,
    onSuccess,
}) => {
    const {
        accounts,
        members,
        institutions,
        accountTypes,
        addAccount,
        addInstitution,
        addMember,
        addTransactions,
        refreshPrices,
    } = useData();

    // Account Selection / Creation State
    const [targetType, setTargetType] = useState<'existing' | 'new'>(() =>
        initialTargetType || (accounts.length === 0 ? 'new' : defaultAccountId ? 'existing' : 'existing')
    );
    const [selectedAccountId, setSelectedAccountId] = useState<string>(() =>
        defaultAccountId || (accounts[0] ? accounts[0].id : '')
    );

    // Track whether user explicitly typed/selected name or type to prevent auto-overwrites
    const userModifiedNameRef = useRef<boolean>(!!initialAccountName);
    const userModifiedTypeRef = useRef<boolean>(!!initialAccountType);

    // New Account Form state
    const [newAccountName, setNewAccountName] = useState(initialAccountName || '');
    const [newMemberId, setNewMemberId] = useState(() => initialMemberId || (members[0] ? members[0].id : ''));
    const [newInstitutionId, setNewInstitutionId] = useState(() => initialInstitutionId || (institutions[0] ? institutions[0].id : ''));
    const [newAccType, setNewAccType] = useState<AccountType>(() => initialAccountType || (accountTypes[0] as AccountType) || 'TFSA');
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
    const [showTickerReview, setShowTickerReview] = useState(true);
    const [updateCashBalance, setUpdateCashBalance] = useState<boolean>(true);
    const [autoFetchPrices, setAutoFetchPrices] = useState<boolean>(true);
    const [skipInvalidRows, setSkipInvalidRows] = useState<boolean>(true);

    // Ticker Symbol & Currency Overrides (saved across sessions)
    const [tickerOverrides, setTickerOverrides] = useState<TickerOverridesMap>(() => {
        try {
            const saved = localStorage.getItem('investment_tracker_ticker_overrides');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Status State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
    const [isMaximized, setIsMaximized] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
    const modalBodyRef = useRef<HTMLDivElement>(null);

    // Update selectedAccountId & targetType when modal opens or props change
    useEffect(() => {
        if (!isOpen) return;
        if (initialTargetType) {
            setTargetType(initialTargetType);
        } else if (defaultAccountId) {
            setSelectedAccountId(defaultAccountId);
            setTargetType('existing');
        } else if (accounts.length === 0) {
            setTargetType('new');
        }

        if (defaultAccountId) {
            setSelectedAccountId(defaultAccountId);
        } else if (accounts.length > 0 && (!selectedAccountId || !accounts.some(a => a.id === selectedAccountId))) {
            setSelectedAccountId(accounts[0].id);
        }

        if (initialAccountName) {
            setNewAccountName(initialAccountName);
            userModifiedNameRef.current = true;
        }
        if (initialAccountType) {
            setNewAccType(initialAccountType);
            userModifiedTypeRef.current = true;
        }
        if (initialMemberId) {
            setNewMemberId(initialMemberId);
        }
        if (initialInstitutionId) {
            setNewInstitutionId(initialInstitutionId);
        }
    }, [isOpen, initialTargetType, defaultAccountId, accounts, selectedAccountId, initialAccountName, initialAccountType, initialMemberId, initialInstitutionId]);

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

    // Parse CSV dynamically whenever content, mode override, mapping, or ticker overrides change
    const parseResult: CsvParseResult | null = useMemo(() => {
        if (!csvText.trim()) return null;
        try {
            const activeAccountId = targetType === 'existing' ? selectedAccountId : 'temp-account-id';
            const res = parseCsvContent(
                csvText,
                activeAccountId,
                mode || undefined,
                customMapping,
                'CAD',
                tickerOverrides
            );
            return res;
        } catch (err: any) {
            console.error('CSV parse error:', err);
            return null;
        }
    }, [csvText, mode, customMapping, targetType, selectedAccountId, tickerOverrides]);

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

    // Auto-populate new account details if broker preset detected AND user hasn't typed/chosen their own
    useEffect(() => {
        if (!parseResult) return;

        // Auto-select / auto-create institution if not manually chosen
        if (parseResult.detectedInstitution && !initialInstitutionId) {
            const matchInst = institutions.find(i =>
                i.name.toLowerCase().includes(parseResult.detectedInstitution!.toLowerCase())
            );
            if (matchInst) {
                if (newInstitutionId !== matchInst.id) {
                    setNewInstitutionId(matchInst.id);
                }
            } else {
                // Auto-create institution so user has it immediately in the selector
                const created = addInstitution(parseResult.detectedInstitution);
                setNewInstitutionId(created.id);
            }
        }

        // Auto-select account type ONLY IF the user hasn't explicitly chosen/typed one
        if (parseResult.detectedAccountType && !userModifiedTypeRef.current) {
            const matchType = accountTypes.find(t =>
                t.toLowerCase() === parseResult.detectedAccountType!.toLowerCase()
            );
            if (matchType) {
                setNewAccType(matchType as AccountType);
            }
        }

        // Auto-populate account name ONLY IF the user hasn't explicitly typed one
        if (!userModifiedNameRef.current && parseResult.detectedInstitution) {
            setNewAccountName(`${parseResult.detectedInstitution} ${parseResult.detectedAccountType || 'Account'}`);
        }
    }, [parseResult, institutions, accountTypes, initialInstitutionId, addInstitution]);

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

    const handleUpdateTicker = (rawTicker: string, newTarget: string) => {
        const trimmed = newTarget.trim().toUpperCase();
        setTickerOverrides(prev => {
            const current = prev[rawTicker] || { targetTicker: rawTicker };
            const updated = {
                ...prev,
                [rawTicker]: {
                    ...current,
                    targetTicker: trimmed,
                },
            };
            try {
                localStorage.setItem('investment_tracker_ticker_overrides', JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save ticker overrides', e);
            }
            return updated;
        });
    };

    const handleUpdateCurrency = (rawTicker: string, newCurrency: 'CAD' | 'USD') => {
        setTickerOverrides(prev => {
            const current = prev[rawTicker] || { targetTicker: rawTicker };
            const updated = {
                ...prev,
                [rawTicker]: {
                    ...current,
                    currency: newCurrency,
                },
            };
            try {
                localStorage.setItem('investment_tracker_ticker_overrides', JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save ticker overrides', e);
            }
            return updated;
        });
    };

    const handleApplySuffix = (rawTicker: string, currentTarget: string, suffix: string) => {
        const base = currentTarget.replace(/\.(TO|CN|NE|V|VN)$/i, '');
        if (suffix === 'NONE') {
            handleUpdateTicker(rawTicker, base);
        } else {
            handleUpdateTicker(rawTicker, `${base}${suffix}`);
            handleUpdateCurrency(rawTicker, 'CAD');
        }
    };

    const handleResetTicker = (rawTicker: string) => {
        setTickerOverrides(prev => {
            const updated = { ...prev };
            delete updated[rawTicker];
            try {
                localStorage.setItem('investment_tracker_ticker_overrides', JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save ticker overrides', e);
            }
            return updated;
        });
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
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        const validRows = parseResult.validatedRows.filter(r => r.isValid);
        if (validRows.length === 0) {
            setImportError('No valid rows found to import. Please check column mappings and data errors.');
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!skipInvalidRows && parseResult.stats.invalidRows > 0) {
            setImportError(`There are ${parseResult.stats.invalidRows} invalid rows. Please resolve them or enable "Skip invalid rows".`);
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsSubmitting(true);

        try {
            let finalAccountId = selectedAccountId;

            // 1. Create Account if target is 'new'
            if (targetType === 'new') {
                const finalAccountName =
                    newAccountName.trim() ||
                    `${parseResult.detectedInstitution || 'New'} ${parseResult.detectedAccountType || 'Investment'} Account`;

                // Resolve or create Member
                let targetMemberId = newMemberId;
                if (!targetMemberId) {
                    if (members.length > 0) {
                        targetMemberId = members[0].id;
                    } else {
                        const newMem = addMember('Primary User');
                        targetMemberId = newMem.id;
                    }
                }

                // Resolve or create Institution
                let targetInstitutionId = newInstitutionId;
                if (!targetInstitutionId) {
                    const instName = parseResult.detectedInstitution || (institutions[0]?.name ?? 'Primary Institution');
                    const existingInst = institutions.find(i => i.name.toLowerCase() === instName.toLowerCase());
                    if (existingInst) {
                        targetInstitutionId = existingInst.id;
                    } else {
                        const createdInst = addInstitution(instName);
                        targetInstitutionId = createdInst.id;
                    }
                }

                const cashParsed = parseFloat(newCashBalance) || 0;
                const createdAcc = addAccount({
                    name: finalAccountName,
                    memberId: targetMemberId,
                    institutionId: targetInstitutionId,
                    type: newAccType,
                    cashBalance: cashParsed,
                });
                finalAccountId = createdAcc.id;
            }

            if (!finalAccountId) {
                setImportError('No valid account selected.');
                modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
            setImportSuccessMessage(
                targetType === 'new'
                    ? `Created account & successfully imported ${count} ${modeLabel}!`
                    : `Successfully imported ${count} ${modeLabel}!`
            );

            setTimeout(() => {
                onSuccess?.(finalAccountId);
                onClose();
            }, 1200);
        } catch (err: any) {
            console.error('Import execution failed:', err);
            setImportError(err.message || 'Failed to complete import.');
            modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-200 ${isMaximized ? 'p-2 sm:p-4' : 'p-4'}`}>
            <div className={`bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
                isMaximized
                    ? 'w-[98vw] max-w-[1600px] h-[95vh] rounded-2xl'
                    : 'w-full max-w-5xl rounded-2xl max-h-[92vh]'
            }`}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/15 rounded-xl border border-blue-500/30 text-blue-400">
                            <Upload size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                Import Investments
                                {parseResult?.brokerPreset === 'wealthsimple' && (
                                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        ✓ Wealthsimple Detected
                                    </span>
                                )}
                                {parseResult?.brokerPreset === 'questrade' && (
                                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-green-500/20 text-green-300 border border-green-500/30">
                                        ✓ Questrade Detected
                                    </span>
                                )}
                                {(!parseResult || parseResult.brokerPreset === 'generic') && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        CSV
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Import current portfolio holdings or historical transactions into an account
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setIsMaximized(prev => !prev)}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            aria-label={isMaximized ? "Standard size" : "Maximize dialog"}
                            title={isMaximized ? "Switch to standard dialog" : "Expand to wide view"}
                        >
                            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            aria-label="Close dialog"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div ref={modalBodyRef} className="flex-1 overflow-y-auto p-6 space-y-6">
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                    <Wallet size={15} className="text-blue-400" /> Destination Account
                                </label>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {targetType === 'new'
                                        ? 'A new investment account will be created and populated with these records.'
                                        : 'Records will be added to the selected existing account.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs font-semibold self-start sm:self-auto">
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
                                        onChange={e => {
                                            userModifiedNameRef.current = true;
                                            setNewAccountName(e.target.value);
                                        }}
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
                                        onChange={e => {
                                            userModifiedTypeRef.current = true;
                                            setNewAccType(e.target.value as AccountType);
                                        }}
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
                                <div className="flex flex-wrap items-center gap-2.5">
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
                                    {parseResult.brokerPreset === 'wealthsimple' && (
                                        <span className="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                            Wealthsimple Native Parser Active
                                        </span>
                                    )}
                                    {parseResult.brokerPreset === 'questrade' && (
                                        <span className="text-[11px] px-2.5 py-1 rounded-lg font-bold bg-green-500/15 text-green-300 border border-green-500/30">
                                            Questrade Native Parser Active
                                        </span>
                                    )}
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
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-800">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                            Column Header Mapping ({parseResult.headers.length} headers detected)
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            {parseResult.brokerPreset === 'wealthsimple'
                                                ? '✨ Auto-mapped via Wealthsimple native engine'
                                                : parseResult.brokerPreset === 'questrade'
                                                ? '✨ Auto-mapped via Questrade native engine'
                                                : 'Auto-detected from CSV headers'}
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

                            {/* Review & Correct Ticker Symbols */}
                            {parseResult.detectedTickers.length > 0 && (
                                <div className="bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-lg">
                                    <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                <Tag size={16} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                                                        Review &amp; Correct Stock Symbols
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                                                        {parseResult.detectedTickers.length} Symbols
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    Assign exchange suffixes (e.g. <span className="font-mono text-slate-200">CL.CN</span>, <span className="font-mono text-slate-200">AYR-A.CN</span>) or set currency (e.g. <span className="font-mono text-slate-200">TRUL</span> in USD). Mappings are saved for future imports.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowTickerReview(!showTickerReview)}
                                            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 self-start sm:self-auto shrink-0"
                                        >
                                            {showTickerReview ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                            {showTickerReview ? 'Hide Symbols' : 'Show Symbols'}
                                        </button>
                                    </div>

                                    {showTickerReview && (
                                        <div className="p-3 divide-y divide-slate-800/60 max-h-72 overflow-y-auto space-y-2">
                                            {parseResult.detectedTickers.map(item => {
                                                const currentTarget = tickerOverrides[item.rawTicker]?.targetTicker || item.rawTicker;
                                                const currentCurrency = tickerOverrides[item.rawTicker]?.currency || item.defaultCurrency;
                                                const isCustomized = Boolean(tickerOverrides[item.rawTicker]);

                                                return (
                                                    <div
                                                        key={item.rawTicker}
                                                        className={`pt-2 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-3 p-2.5 rounded-xl transition-all ${
                                                            isCustomized
                                                                ? 'bg-blue-950/30 border border-blue-500/30 shadow-sm'
                                                                : 'hover:bg-slate-800/40 border border-transparent'
                                                        }`}
                                                    >
                                                        {/* Raw CSV Symbol Info */}
                                                        <div className="flex items-center gap-2.5 min-w-[220px]">
                                                            <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-mono font-bold text-xs border border-slate-700 shadow-sm">
                                                                {item.rawTicker}
                                                            </span>
                                                            <div className="min-w-0">
                                                                {item.sampleName && (
                                                                    <div className="text-xs font-semibold text-slate-200 truncate max-w-[200px]" title={item.sampleName}>
                                                                        {item.sampleName}
                                                                    </div>
                                                                )}
                                                                <span className="text-[11px] text-slate-400 font-mono">
                                                                    {item.count} {item.count === 1 ? 'transaction' : 'transactions'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <ArrowRight size={14} className="text-slate-600 hidden md:block shrink-0" />

                                                        {/* Target Symbol & Controls */}
                                                        <div className="flex flex-wrap items-center gap-2 flex-1 justify-start md:justify-end">
                                                            {/* Editable Target Symbol Input */}
                                                            <div className="flex items-center gap-1.5">
                                                                <label className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline">
                                                                    Map to:
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={currentTarget}
                                                                    onChange={e => handleUpdateTicker(item.rawTicker, e.target.value)}
                                                                    placeholder="Target Ticker"
                                                                    className="w-28 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 focus:border-blue-500 text-white font-mono font-bold text-xs outline-none shadow-inner"
                                                                />
                                                            </div>

                                                            {/* Quick Exchange Suffix Buttons */}
                                                            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[10px] font-mono">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApplySuffix(item.rawTicker, currentTarget, '.CN')}
                                                                    title="Canadian Securities Exchange (.CN)"
                                                                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                                                                        currentTarget.endsWith('.CN')
                                                                            ? 'bg-emerald-600 text-white'
                                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    .CN
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApplySuffix(item.rawTicker, currentTarget, '.TO')}
                                                                    title="Toronto Stock Exchange (.TO)"
                                                                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                                                                        currentTarget.endsWith('.TO')
                                                                            ? 'bg-blue-600 text-white'
                                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    .TO
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApplySuffix(item.rawTicker, currentTarget, '.V')}
                                                                    title="TSX Venture (.V)"
                                                                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                                                                        currentTarget.endsWith('.V')
                                                                            ? 'bg-purple-600 text-white'
                                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    .V
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApplySuffix(item.rawTicker, currentTarget, '.NE')}
                                                                    title="NEO / Cboe Canada (.NE)"
                                                                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                                                                        currentTarget.endsWith('.NE')
                                                                            ? 'bg-cyan-600 text-white'
                                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    .NE
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApplySuffix(item.rawTicker, currentTarget, 'NONE')}
                                                                    title="US or raw unsuffixed symbol (e.g. TRUL, AAPL)"
                                                                    className={`px-1.5 py-0.5 rounded font-bold transition-colors ${
                                                                        !/\.(TO|CN|NE|V|VN)$/i.test(currentTarget)
                                                                            ? 'bg-amber-600 text-white'
                                                                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                                    }`}
                                                                >
                                                                    US / Raw
                                                                </button>
                                                            </div>

                                                            {/* Currency Selector */}
                                                            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-[10px] font-bold">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateCurrency(item.rawTicker, 'CAD')}
                                                                    className={`px-2 py-0.5 rounded transition-colors ${
                                                                        currentCurrency === 'CAD'
                                                                            ? 'bg-blue-600 text-white'
                                                                            : 'text-slate-400 hover:text-white'
                                                                    }`}
                                                                >
                                                                    CAD
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateCurrency(item.rawTicker, 'USD')}
                                                                    className={`px-2 py-0.5 rounded transition-colors ${
                                                                        currentCurrency === 'USD'
                                                                            ? 'bg-emerald-600 text-white'
                                                                            : 'text-slate-400 hover:text-white'
                                                                    }`}
                                                                >
                                                                    USD
                                                                </button>
                                                            </div>

                                                            {/* Reset Button */}
                                                            {isCustomized && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleResetTicker(item.rawTicker)}
                                                                    title="Reset to original symbol"
                                                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                                                                >
                                                                    <RotateCcw size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
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

                                <div className={`${isMaximized ? 'max-h-[48vh]' : 'max-h-72'} overflow-y-auto overflow-x-auto`}>
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-950 text-slate-300 border-b border-slate-700/80 sticky top-0 z-10 shadow-sm">
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
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{tx?.ticker || holding?.ticker || '-'}</span>
                                                                {row.raw && (row.raw.symbol || row.raw.Symbol || row.raw.ticker || row.raw.Ticker) &&
                                                                 (tx?.ticker || holding?.ticker) !== (row.raw.symbol || row.raw.Symbol || row.raw.ticker || row.raw.Ticker)?.trim()?.toUpperCase() && (
                                                                    <span className="text-[9px] font-sans font-bold px-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30" title="Symbol customized">
                                                                        Mapped
                                                                    </span>
                                                                )}
                                                            </div>
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
                                                        <td className="px-3 py-2 font-mono">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                (tx?.currency || holding?.currency) === 'USD'
                                                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                                    : 'text-slate-400'
                                                            }`}>
                                                                {tx?.currency || holding?.currency || 'CAD'}
                                                            </span>
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
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/90">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        {importError && (
                            <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-xl animate-in fade-in max-w-sm sm:max-w-md">
                                <AlertCircle size={15} className="shrink-0 text-red-400" />
                                <span className="font-semibold truncate">{importError}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3">
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
