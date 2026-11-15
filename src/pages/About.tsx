import React, { useState } from 'react';
import {
    ArrowUpCircle,
    Check,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    Github,
    RefreshCw,
    Sparkles,
    Terminal,
    AlertCircle,
    Layers,
    DollarSign,
    Lock,
} from 'lucide-react';
import { useVersion } from '../hooks/useVersion';
import { useTheme } from '../context/ThemeContext';
import KofiButton from '../components/KofiButton';
import '../styles/shared.css';

const About: React.FC = () => {
    const { versionInfo, isChecking, checkForUpdates, openModal } = useVersion();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [copied, setCopied] = useState(false);

    const commandText = 'git pull origin main && npm install';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(commandText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = commandText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        }
    };

    const currentVersion = versionInfo?.currentVersion || (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0');

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-200">
            {/* Top Hero Banner */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left relative z-10">
                    <img
                        src={isDark ? '/Household-Investment-Tracker-Logo-white.svg' : '/Household-Investment-Tracker-Logo-black.svg'}
                        alt="Household Investment Tracker Logo"
                        className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-sm shrink-0"
                    />

                    <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                                Household Investment Tracker
                            </h1>
                            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                v{currentVersion}
                            </span>
                        </div>

                        <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
                            A privacy-first, local-first personal finance, portfolio analytics, and tax planning
                            platform — built and optimized for Canadian investors and multi-member households.
                        </p>

                        <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-400">
                            <div>
                                <span className="text-slate-400">Author:</span>{' '}
                                <span className="text-slate-200 font-medium">Mike Wong</span>
                            </div>
                            <div>
                                <span className="text-slate-400">License:</span>{' '}
                                <span className="text-slate-200 font-medium">CC-BY-NC-4.0</span>
                            </div>
                            <a
                                href={versionInfo?.githubUrl || 'https://github.com/mwongr/household-investment-tracker'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline"
                            >
                                <Github className="w-3.5 h-3.5" />
                                <span>GitHub Repository</span>
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>

                    <div className="shrink-0 sm:self-start">
                        <KofiButton size="sm" />
                    </div>
                </div>
            </div>

            {/* Version & Update Card */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700 pb-4">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-emerald-400" />
                            Software Updates
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Check for newer releases from the project repository.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => checkForUpdates(true)}
                        disabled={isChecking}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors shadow-sm self-start sm:self-auto"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                        <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
                    </button>
                </div>

                {/* Status Block */}
                {versionInfo?.updateAvailable ? (
                    <div className={`${isDark ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'} border rounded-xl p-5 space-y-4`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                    <ArrowUpCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-emerald-300 text-sm">
                                            Update Available: v{versionInfo.latestVersion}
                                        </h3>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                                            New
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">
                                        You are currently on v{versionInfo.currentVersion}.
                                        {versionInfo.releaseDate && ` Released on ${versionInfo.releaseDate}.`}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={openModal}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors self-start sm:self-auto"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Update Instructions</span>
                            </button>
                        </div>

                        {versionInfo.releaseNotes && (
                            <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
                                <span className="font-semibold text-slate-200 block mb-1">Release Highlights:</span>
                                <p className="whitespace-pre-wrap">{versionInfo.releaseNotes}</p>
                            </div>
                        )}
                    </div>
                ) : versionInfo?.error ? (
                    <div className={`${isDark ? 'bg-amber-950/20 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'} border rounded-xl p-4 flex items-start gap-3 text-xs`}>
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold text-amber-300 block">Unable to fetch latest release</span>
                            <span className="text-slate-400 mt-0.5 block">{versionInfo.error}</span>
                            <span className="text-slate-400 mt-1 block">
                                Running locally offline or unable to reach update server. You can still check releases on GitHub.
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div>
                                <span className="text-sm font-semibold text-slate-200 block">
                                    You are running the latest version (v{currentVersion})
                                </span>
                                <span className="text-xs text-slate-400 block mt-0.5">
                                    {versionInfo?.checkedAt
                                        ? `Last checked: ${new Date(versionInfo.checkedAt).toLocaleTimeString()}`
                                        : 'Version up to date.'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Git Pull Instructions Card */}
                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                            <Terminal className="w-4 h-4 text-emerald-400" />
                            Update via Command Line
                        </span>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition-colors"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy Commands</span>
                                </>
                            )}
                        </button>
                    </div>

                    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 font-mono text-xs text-emerald-400 font-semibold overflow-x-auto">
                        <code>{commandText}</code>
                    </div>

                    <p className="text-xs text-slate-400">
                        In your command prompt or terminal in the project folder, stop the app (<kbd className="px-1.5 py-0.5 bg-slate-900 text-slate-200 rounded border border-slate-700">Ctrl + C</kbd>), run the command above, then start the app again with <kbd className="px-1.5 py-0.5 bg-slate-900 text-slate-200 rounded border border-slate-700">Start App.bat</kbd>.
                    </p>
                </div>
            </div>

            {/* Core Features & Canadian Optimization Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2 shadow-md">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <DollarSign className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-100 text-sm">Optimized for Canada</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Full support for TFSA, RRSP, FHSA, and Non-Registered accounts. Combined CRA and Revenu Québec bracket drop simulations and ACB ledger tracking.
                    </p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2 shadow-md">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <Lock className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-100 text-sm">100% Local & Private</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Financial data is stored strictly on your local disk in <code className="text-slate-200 font-medium">server/database.json</code> with atomic writes and rolling backups. No cloud accounts required.
                    </p>
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-2 shadow-md">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <Layers className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-slate-100 text-sm">Modern Stack</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Built with React 19, TypeScript, Vite 7, Express 5, Recharts, TradingView Lightweight Charts, and Tailwind CSS for speed and responsiveness.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default About;
