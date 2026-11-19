import React from 'react';
import { AlertCircle, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import type { AccountIncomeGroup } from '../../types/dividends';

interface AccountTaxBreakdownProps {
    groups: AccountIncomeGroup[];
    metadataLoading: boolean;
}

const fmtCad = (val: number) =>
    new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(val);

export const AccountTaxBreakdown: React.FC<AccountTaxBreakdownProps> = React.memo(
    ({ groups, metadataLoading }) => {
        return (
            <section className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-2.5 mb-4">
                    <ShieldCheck size={18} className="text-blue-400" />
                    <div>
                        <h2 className="text-base font-bold text-white tracking-tight">
                            Account &amp; Canadian Tax Breakdown
                        </h2>
                        <p className="text-xs text-slate-400">
                            Income by account type &amp; US 15% withholding tax efficiency
                        </p>
                    </div>
                </div>

                {metadataLoading ? (
                    <div className="space-y-3">
                        <div className="h-16 bg-slate-700/50 rounded-xl animate-pulse" />
                        <div className="h-16 bg-slate-700/40 rounded-xl animate-pulse" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-700/80 rounded-xl">
                        No account dividend income to display yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {groups.map((group) => (
                            <div
                                key={group.accountType}
                                className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-3.5"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-sm text-white">
                                            {group.accountType}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-[11px] text-slate-300">
                                            {group.taxBucket}
                                        </span>
                                        {group.hasUsWithholdingWarning && (
                                            <span
                                                title="US-listed dividends in a TFSA or FHSA are subject to 15% non-recoverable US withholding tax."
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-blue-500/40 bg-slate-900 text-blue-400 text-[11px] font-medium"
                                            >
                                                <AlertCircle size={11} />
                                                US · 15% withholding
                                            </span>
                                        )}
                                        {group.hasTreatyExemptUs && (
                                            <span
                                                title="Exempt from 15% US dividend withholding tax under the Canada–US tax treaty."
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/40 bg-slate-900 text-emerald-400 text-[11px] font-medium"
                                            >
                                                <CheckCircle2 size={11} />
                                                US treaty exempt
                                            </span>
                                        )}
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="font-mono font-bold text-sm text-emerald-400 tabular-nums">
                                            {fmtCad(group.projectedAnnualCad)}/yr
                                        </p>
                                        <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                                            YTD {fmtCad(group.ytdCad)} · {group.shareOfTotalPct.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>

                                {group.usPayers.length > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap gap-1.5">
                                        {group.usPayers.map((payer, idx) => (
                                            <span
                                                key={`${payer.ticker}-${payer.accountName}-${idx}`}
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border bg-slate-900 ${
                                                    payer.taxTreatment === 'withholding-lost'
                                                        ? 'border-blue-500/40 text-blue-300'
                                                        : payer.taxTreatment === 'treaty-exempt'
                                                            ? 'border-emerald-500/40 text-emerald-300'
                                                            : 'border-slate-700 text-slate-300'
                                                }`}
                                            >
                                                {payer.ticker}
                                                {payer.taxTreatment === 'recoverable' && (
                                                    <span className="text-[10px] text-slate-400 font-sans">
                                                        (FTC)
                                                    </span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}

                        <p className="flex items-start gap-1.5 text-[11px] text-slate-400 pt-1">
                            <Info size={13} className="shrink-0 mt-0.5 text-slate-500" />
                            <span>
                                US-listed dividends held in RRSP, Spousal RRSP, LIRA, or RRIF accounts are exempt from the 15% US withholding tax under the Canada–US tax treaty; TFSA and FHSA accounts are not exempt.
                            </span>
                        </p>
                    </div>
                )}
            </section>
        );
    }
);

AccountTaxBreakdown.displayName = 'AccountTaxBreakdown';
