import React, { useState } from 'react';
import {
    ArrowRight,
    Check,
    Copy,
    Download,
    ExternalLink,
    Info,
    RotateCcw,
    Sparkles,
    Terminal,
    X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVersion } from '../hooks/useVersion';

export const UpdateModal: React.FC = () => {
    const {
        versionInfo,
        distribution,
        updateState,
        downloadPercent,
        showModal,
        closeModal,
        dismissForSession,
        skipThisVersion,
        installUpdate,
    } = useVersion();
    const [copied, setCopied] = useState(false);
    const navigate = useNavigate();

    if (!showModal || !versionInfo || !versionInfo.updateAvailable) {
        return null;
    }

    const isExe = distribution === 'exe';
    const isDownloaded = isExe && updateState === 'downloaded';

    const commandText = 'git pull origin main && npm install';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(commandText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch {
            // fallback if clipboard api fails
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

    const handleViewAbout = () => {
        closeModal();
        navigate('/about');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-blue-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                Update Available
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    v{versionInfo.latestVersion}
                                </span>
                            </h2>
                            <p className="text-sm text-slate-400 mt-0.5">
                                A newer version of Household Investment Tracker is ready.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={closeModal}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-5 text-slate-200 text-sm">
                    {/* Version Comparison Card */}
                    <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <span className="text-xs text-slate-400 uppercase tracking-wider block">Current</span>
                            <span className="text-base font-semibold text-slate-300">
                                v{versionInfo.currentVersion}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-400">
                            <ArrowRight className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-slate-400 uppercase tracking-wider block">Latest</span>
                            <span className="text-base font-bold text-emerald-400">
                                v{versionInfo.latestVersion}
                            </span>
                            {versionInfo.releaseDate && (
                                <span className="text-xs text-slate-400 block mt-0.5">
                                    Released {versionInfo.releaseDate}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Release Notes */}
                    {versionInfo.releaseNotes && (
                        <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-blue-400 font-semibold mb-1.5">
                                <Info className="w-4 h-4 shrink-0" />
                                <span>Release Notes</span>
                            </div>
                            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {versionInfo.releaseNotes}
                            </p>
                        </div>
                    )}

                    {/* Step-by-Step Update Instructions (DIY) or Auto-Updater Status (EXE) */}
                    {isExe ? (
                        <div className="bg-slate-800/50 border border-slate-700/70 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                                <span className="flex items-center gap-2">
                                    <Download className="w-4 h-4 text-emerald-400" />
                                    {isDownloaded
                                        ? 'Update downloaded and ready to install'
                                        : updateState === 'downloading'
                                        ? 'Downloading update...'
                                        : 'Preparing update download...'}
                                </span>
                                {typeof downloadPercent === 'number' && !isDownloaded && (
                                    <span className="text-emerald-400 tabular-nums">
                                        {downloadPercent}%
                                    </span>
                                )}
                            </div>
                            {!isDownloaded && (
                                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${Math.min(100, Math.max(0, downloadPercent ?? 10))}%` }}
                                    />
                                </div>
                            )}
                            <p className="text-xs text-slate-400">
                                {isDownloaded
                                    ? 'Click "Restart & Install" below to apply the update. Your portfolio data in AppData will be preserved.'
                                    : 'The installer is downloading in the background. You can continue using the app while it finishes.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                                    <Terminal className="w-4 h-4 text-emerald-400" />
                                    <span>How to Update via Git</span>
                                </div>
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

                            {/* Terminal snippet */}
                            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-emerald-300 flex items-center justify-between overflow-x-auto">
                                <code>{commandText}</code>
                            </div>

                            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-400 pl-1">
                                <li>
                                    Stop the running app (<kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">Ctrl + C</kbd> in your terminal window).
                                </li>
                                <li>Run the git pull and npm install command above in your project root.</li>
                                <li>
                                    Restart with <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">Start App.bat</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-200 rounded border border-slate-700">npm run dev</kbd>.
                                </li>
                            </ol>
                        </div>
                    )}

                    {/* GitHub repo link */}
                    <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
                        <span>Check commits & releases on GitHub:</span>
                        <a
                            href={versionInfo.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline"
                        >
                            <span>mwongr/household-investment-tracker</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-4 bg-slate-950/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={skipThisVersion}
                        className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                    >
                        Skip this version
                    </button>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={dismissForSession}
                            className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                        >
                            Remind Me Later
                        </button>
                        {isDownloaded ? (
                            <button
                                type="button"
                                onClick={() => void installUpdate()}
                                className="px-4 py-2 text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restart &amp; Install</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleViewAbout}
                                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>View About &amp; Update</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
