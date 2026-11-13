import React, { useState } from 'react';
import {
    Sparkles,
    Users,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Upload,
    FileSpreadsheet,
    Shield,
    X,
    TrendingUp,
    Wallet,
    Settings as SettingsIcon,
    DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

interface OnboardingModalProps {
    isOpen: boolean;
    onClose?: () => void;
    onOpenCsvImport?: (accountId?: string) => void;
    isInline?: boolean;
}

const COMMON_INSTITUTIONS = [
    'Wealthsimple',
    'Questrade',
    'TD Direct Investing',
    'RBC Direct Investing',
    'BMO InvestorLine',
    'Interactive Brokers',
    'Scotiabank iTRADE'
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
    isOpen,
    onClose,
    onOpenCsvImport,
    isInline = false
}) => {
    const navigate = useNavigate();
    const {
        setupHousehold,
        accountTypes,
        loadDemoData
    } = useData();

    // Mode: 'choose' | 'wizard'
    const [mode, setMode] = useState<'choose' | 'wizard'>('choose');
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Form inputs
    const [memberName, setMemberName] = useState('');
    const [institutionName, setInstitutionName] = useState('');
    const [customInstitution, setCustomInstitution] = useState('');
    const [accountName, setAccountName] = useState('');
    const [accountType, setAccountType] = useState('TFSA');
    const [cashBalance, setCashBalance] = useState('0.00');

    // Account created in step 3 to guide step 4
    const [createdAccount, setCreatedAccount] = useState<{
        id: string;
        name: string;
        type: string;
        institution: string;
        member: string;
        cash: number;
    } | null>(null);

    if (!isOpen) return null;

    const selectedInstitution = institutionName === 'Other' ? customInstitution.trim() : institutionName;

    const handleNextFromStep1 = (e: React.FormEvent) => {
        e.preventDefault();
        if (!memberName.trim()) return;
        setStep(2);
    };

    const handleNextFromStep2 = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedInstitution) return;
        // Auto-suggest account name if empty
        if (!accountName.trim()) {
            setAccountName(`${memberName.trim()} ${accountType}`);
        }
        setStep(3);
    };

    const handleCreateAccountStep3 = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedAccount = accountName.trim() || `${memberName.trim()} ${accountType}`;
        const trimmedMember = memberName.trim() || 'My Household';
        const trimmedInst = selectedInstitution || 'Wealthsimple';
        const parsedCash = parseFloat(cashBalance) || 0;

        const result = setupHousehold(trimmedMember, trimmedInst, {
            name: trimmedAccount,
            type: accountType,
            cashBalance: parsedCash
        });

        setCreatedAccount({
            id: result.accountId,
            name: trimmedAccount,
            type: accountType,
            institution: trimmedInst,
            member: trimmedMember,
            cash: parsedCash
        });

        // Advance to Step 4: Next Steps / Import or Skip
        setStep(4);
    };

    const handleTryDemo = () => {
        loadDemoData();
        if (onClose) onClose();
        navigate('/');
    };

    const handleStartImport = () => {
        if (onOpenCsvImport && createdAccount) {
            onOpenCsvImport(createdAccount.id);
        } else if (onOpenCsvImport) {
            onOpenCsvImport();
        }
    };

    const handleGoToCreatedAccount = () => {
        if (onClose) onClose();
        if (createdAccount) {
            navigate(`/accounts/${createdAccount.id}`);
        } else {
            navigate('/accounts');
        }
    };

    const handleGoToSettings = () => {
        if (onClose) onClose();
        navigate('/settings');
    };

    const handleGoToDashboard = () => {
        if (onClose) onClose();
        navigate('/');
    };

    const cardContent = (
        <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-4 sm:my-8 mx-auto">
            {/* Header Banner */}
            <div className="relative p-6 sm:p-8 bg-gradient-to-br from-blue-600/20 via-indigo-600/15 to-purple-600/10 border-b border-slate-700/80">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
                        aria-label="Close onboarding"
                        title="Skip setup and go to dashboard"
                    >
                        <X size={18} />
                    </button>
                )}

                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-500/35 text-blue-400">
                        <TrendingUp size={22} />
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                            Getting Started
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                            Welcome to Household Investment Tracker
                        </h2>
                    </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
                    Track multi-brokerage portfolios, calculate adjusted cost base, optimize spousal RRSP taxes, and monitor net worth—100% private and stored locally.
                </p>
            </div>

            {/* Content Body */}
            <div className="p-6 sm:p-8">
                {mode === 'choose' ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Option 1: Start Fresh */}
                            <div
                                onClick={() => {
                                    setMode('wizard');
                                    setStep(1);
                                }}
                                className="group relative cursor-pointer rounded-2xl p-5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/60 shadow-lg hover:shadow-blue-500/10 transition-all flex flex-col justify-between gap-4"
                            >
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        <Users size={20} />
                                    </div>
                                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                                        Start Blank &amp; Setup
                                        <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                                    </h3>
                                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                                        Begin with a clean slate. Set up your household name, brokerage, and first account, with an optional instant CSV import.
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs font-semibold text-blue-400">
                                    <span>Guided quick setup</span>
                                    <ArrowRight size={14} />
                                </div>
                            </div>

                            {/* Option 2: Explore Demo Data */}
                            <div
                                onClick={handleTryDemo}
                                className="group relative cursor-pointer rounded-2xl p-5 bg-gradient-to-b from-amber-500/10 to-indigo-500/10 hover:from-amber-500/15 hover:to-indigo-500/15 border border-amber-500/30 hover:border-amber-400/60 shadow-lg hover:shadow-amber-500/10 transition-all flex flex-col justify-between gap-4"
                            >
                                <div>
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/35 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                        <Sparkles size={20} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                                            Explore Demo Data
                                        </h3>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                            Recommended
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                                        Try the app with realistic sample holdings (XEQT, VFV, AAPL, MSFT), transactions, and charts. Wipes clean anytime.
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-xs font-semibold text-amber-300">
                                    <span>1-Click Instant Preview</span>
                                    <Sparkles size={14} />
                                </div>
                            </div>
                        </div>

                        {/* Existing Backups or CSV Import shortcut */}
                        <div className="rounded-2xl p-4 bg-slate-800/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 text-slate-300 text-center sm:text-left">
                                <Shield size={16} className="text-green-400 shrink-0" />
                                <span>Already have statements or a backup?</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {onOpenCsvImport && (
                                    <button
                                        onClick={() => {
                                            if (onClose) onClose();
                                            onOpenCsvImport();
                                        }}
                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium transition-colors flex items-center gap-1.5"
                                    >
                                        <FileSpreadsheet size={13} className="text-blue-400" />
                                        Import CSV
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (onClose) onClose();
                                        navigate('/settings');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium transition-colors flex items-center gap-1.5"
                                >
                                    <Upload size={13} className="text-purple-400" />
                                    Restore Backup
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Guided Wizard */
                    <div>
                        {/* Stepper Indicator */}
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                {step < 4 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (step === 1) setMode('choose');
                                            else setStep((s) => (s - 1) as any);
                                        }}
                                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                        aria-label="Back to previous step"
                                    >
                                        <ArrowLeft size={16} />
                                    </button>
                                ) : (
                                    <div className="p-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30">
                                        <CheckCircle2 size={16} />
                                    </div>
                                )}
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                                        Step {step} of 4
                                    </span>
                                    <h3 className="text-base font-bold text-white">
                                        {step === 1 && 'Household Member'}
                                        {step === 2 && 'Financial Institution'}
                                        {step === 3 && 'First Account'}
                                        {step === 4 && 'Account Ready! Next Steps'}
                                    </h3>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4].map((s) => (
                                    <div
                                        key={s}
                                        className={`w-6 h-1.5 rounded-full transition-colors ${
                                            step >= s ? 'bg-blue-500' : 'bg-slate-800'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Step 1: Member Name */}
                        {step === 1 && (
                            <form onSubmit={handleNextFromStep1} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                                        What should we call you?
                                    </label>
                                    <input
                                        type="text"
                                        value={memberName}
                                        onChange={(e) => setMemberName(e.target.value)}
                                        placeholder="e.g. Alex, Sarah, or Mike"
                                        autoFocus
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-white rounded-xl text-sm placeholder-slate-500 outline-none transition-all"
                                    />
                                    <p className="text-xs text-slate-400 mt-2">
                                        You can add more household members (like a partner or spouse) anytime in Settings.
                                    </p>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={!memberName.trim()}
                                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        Next: Institution <ArrowRight size={14} />
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Step 2: Institution */}
                        {step === 2 && (
                            <form onSubmit={handleNextFromStep2} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2">
                                        Where do you invest?
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                                        {COMMON_INSTITUTIONS.map((inst) => (
                                            <button
                                                key={inst}
                                                type="button"
                                                onClick={() => setInstitutionName(inst)}
                                                className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                                                    institutionName === inst
                                                        ? 'bg-blue-600/20 border-blue-500 text-white'
                                                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                                                }`}
                                            >
                                                {inst}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setInstitutionName('Other')}
                                            className={`px-3 py-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                                                institutionName === 'Other'
                                                    ? 'bg-blue-600/20 border-blue-500 text-white'
                                                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                                            }`}
                                        >
                                            Other / Custom...
                                        </button>
                                    </div>

                                    {institutionName === 'Other' && (
                                        <input
                                            type="text"
                                            value={customInstitution}
                                            onChange={(e) => setCustomInstitution(e.target.value)}
                                            placeholder="Enter brokerage or bank name..."
                                            autoFocus
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white rounded-xl text-sm outline-none"
                                        />
                                    )}
                                </div>

                                <div className="pt-4 flex justify-between items-center">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!selectedInstitution}
                                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        Next: First Account <ArrowRight size={14} />
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Step 3: Account */}
                        {step === 3 && (
                            <form onSubmit={handleCreateAccountStep3} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                                        Account Name
                                    </label>
                                    <input
                                        type="text"
                                        value={accountName}
                                        onChange={(e) => setAccountName(e.target.value)}
                                        placeholder="e.g. Primary TFSA"
                                        autoFocus
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white rounded-xl text-sm outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                                            Account Type
                                        </label>
                                        <select
                                            value={accountType}
                                            onChange={(e) => setAccountType(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white rounded-xl text-sm outline-none"
                                        >
                                            {accountTypes.map((type) => (
                                                <option key={type} value={type}>
                                                    {type}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5">
                                            Starting Cash ($ CAD)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={cashBalance}
                                            onChange={(e) => setCashBalance(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 focus:border-blue-500 text-white rounded-xl text-sm outline-none font-mono"
                                        />
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs text-slate-300">
                                    <div className="font-semibold text-white mb-0.5">Ready to create:</div>
                                    <div>
                                        • Member: <span className="text-blue-400 font-medium">{memberName}</span>
                                        <br />
                                        • Institution: <span className="text-green-400 font-medium">{selectedInstitution}</span>
                                        <br />
                                        • Account: <span className="text-purple-400 font-medium">{accountName || `${memberName} ${accountType}`}</span> ({accountType})
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-between items-center">
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!accountName.trim() && !memberName.trim()}
                                        className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        Create Account &amp; Continue <ArrowRight size={15} />
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Step 4: Account Ready / Next Steps */}
                        {step === 4 && createdAccount && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Success confirmation */}
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-blue-500/15 to-purple-500/10 border border-emerald-500/30 flex items-start gap-3.5">
                                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 mt-0.5">
                                        <CheckCircle2 size={22} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                            {createdAccount.name} is ready!
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                                                {createdAccount.type}
                                            </span>
                                        </h4>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            Your account has been created under <span className="text-white font-medium">{createdAccount.member}</span> at <span className="text-white font-medium">{createdAccount.institution}</span>
                                            {createdAccount.cash > 0 ? ` with $${createdAccount.cash.toFixed(2)} cash balance.` : '.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Primary Actions: Import vs Skip */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Action 1: Import CSV */}
                                    <div
                                        onClick={handleStartImport}
                                        className="group relative cursor-pointer rounded-2xl p-5 bg-gradient-to-b from-blue-600/15 to-slate-800/90 hover:from-blue-600/25 hover:to-slate-800 border border-blue-500/40 hover:border-blue-400 shadow-xl hover:shadow-blue-500/20 transition-all flex flex-col justify-between gap-4"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                                                    <FileSpreadsheet size={20} />
                                                </div>
                                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                                    Fastest
                                                </span>
                                            </div>
                                            <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-1.5">
                                                Import Portfolio (CSV)
                                                <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                                            </h4>
                                            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                                                Upload or paste a statement CSV from {createdAccount.institution} or any brokerage to import holdings, prices, and past trades instantly.
                                            </p>
                                        </div>
                                        <div className="pt-2 border-t border-blue-500/20 flex items-center justify-between text-xs font-bold text-blue-400">
                                            <span>Launch Importer</span>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>

                                    {/* Action 2: Go to Account (Skip Import) */}
                                    <div
                                        onClick={handleGoToCreatedAccount}
                                        className="group relative cursor-pointer rounded-2xl p-5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/60 shadow-lg hover:shadow-emerald-500/10 transition-all flex flex-col justify-between gap-4"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                                                    <Wallet size={20} />
                                                </div>
                                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600">
                                                    Manual
                                                </span>
                                            </div>
                                            <h4 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                                                Go to Account (Skip Import)
                                                <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                                            </h4>
                                            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                                                Skip importing for now. Land directly in your new account details where you can add transactions manually, manage cash, or import anytime.
                                            </p>
                                        </div>
                                        <div className="pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs font-semibold text-emerald-400">
                                            <span>Open {createdAccount.name}</span>
                                            <ArrowRight size={14} />
                                        </div>
                                    </div>
                                </div>

                                {/* Household & Settings Link */}
                                <div className="rounded-2xl p-4 bg-slate-800/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2.5 text-slate-300 text-center sm:text-left">
                                        <Users size={16} className="text-purple-400 shrink-0" />
                                        <span>
                                            Have a spouse or partner? You can add more members and institutions in <span className="text-white font-medium">Settings</span>.
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleGoToSettings}
                                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium transition-colors flex items-center gap-1.5"
                                        >
                                            <SettingsIcon size={13} className="text-purple-400" />
                                            Configure Settings
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleGoToDashboard}
                                            className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white font-medium transition-colors"
                                        >
                                            Dashboard
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // If inline (inside Layout page container), render directly without fixed modal backdrop
    if (isInline) {
        return (
            <div className="w-full py-4 animate-fade-in">
                {cardContent}
            </div>
        );
    }

    // Modal wrapper for when invoked as a dialog
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
            {cardContent}
        </div>
    );
};

export default OnboardingModal;
