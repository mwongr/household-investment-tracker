import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, HandCoins, RefreshCw, Wallet } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useChartTheme } from '../hooks/useChartTheme';
import { useDividendMetadata } from '../hooks/useDividendMetadata';
import {
    buildUpcomingPayouts,
    computeAnnualPayouts,
    computeHoldingIncome,
    computeKpis,
    computeMonthlyPayouts,
    computeYtd,
    groupByAccount,
    isAnyDividend,
} from '../utils/dividendAnalytics';
import { DividendKpiStrip } from '../components/dividends/DividendKpiStrip';
import { MonthlyPayoutsChart } from '../components/dividends/MonthlyPayoutsChart';
import { IncomeByHolding } from '../components/dividends/IncomeByHolding';
import { AccountTaxBreakdown } from '../components/dividends/AccountTaxBreakdown';
import { UpcomingPayouts } from '../components/dividends/UpcomingPayouts';

const Dividends = () => {
    const { assets, transactions, accounts, exchangeRate } = useData();
    const chartTheme = useChartTheme();
    const { metadataMap, loading: metadataLoading, error: metadataError, refresh } =
        useDividendMetadata(assets);

    const today = useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();

    const hasHoldings = useMemo(
        () => assets.some((a) => a.quantity > 0),
        [assets]
    );

    const hasDividendHistory = useMemo(
        () => transactions.some((tx) => isAnyDividend(tx) && tx.amount > 0),
        [transactions]
    );

    const ytd = useMemo(
        () => computeYtd(transactions, assets, today, exchangeRate),
        [transactions, assets, today, exchangeRate]
    );

    const monthlyData = useMemo(
        () => computeMonthlyPayouts(transactions, assets, currentYear, exchangeRate),
        [transactions, assets, currentYear, exchangeRate]
    );

    const annualData = useMemo(
        () => computeAnnualPayouts(transactions, assets, exchangeRate),
        [transactions, assets, exchangeRate]
    );

    const holdingRows = useMemo(
        () => computeHoldingIncome(assets, accounts, metadataMap, exchangeRate),
        [assets, accounts, metadataMap, exchangeRate]
    );

    const kpis = useMemo(
        () => computeKpis(holdingRows, ytd),
        [holdingRows, ytd]
    );

    const accountGroups = useMemo(
        () => groupByAccount(holdingRows, accounts, transactions, assets, today, exchangeRate),
        [holdingRows, accounts, transactions, assets, today, exchangeRate]
    );

    const cutoff30Iso = useMemo(
        () => new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        [today]
    );

    const upcoming60 = useMemo(
        () => buildUpcomingPayouts(holdingRows, metadataMap, today, 60, exchangeRate),
        [holdingRows, metadataMap, today, exchangeRate]
    );

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-blue-500/40 text-blue-400">
                        <HandCoins size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            Dividends
                        </h1>
                        <p className="text-xs text-slate-400">
                            Historical dividend income &amp; forward 12-month projections (CAD)
                        </p>
                    </div>
                </div>

                {hasHoldings && (
                    <button
                        type="button"
                        onClick={refresh}
                        disabled={metadataLoading}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw
                            size={14}
                            className={metadataLoading ? 'animate-spin' : ''}
                        />
                        Refresh Dividend Data
                    </button>
                )}
            </header>

            {metadataError && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-blue-500/40 bg-slate-900 text-blue-300 text-xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>
                            Could not load live dividend metadata ({metadataError}). Historical dividend charts remain available.
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={refresh}
                        className="px-2.5 py-1 rounded-lg border border-blue-500/40 hover:bg-slate-800 font-semibold shrink-0"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!hasHoldings && !hasDividendHistory ? (
                <div className="bg-slate-800/95 border border-slate-700/90 rounded-2xl p-10 text-center max-w-xl mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <Wallet size={22} />
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">
                        No dividend data yet
                    </h2>
                    <p className="text-sm text-slate-400 mb-5">
                        Add holdings or record dividend transactions in your accounts to track passive income, yield on cost, and upcoming payouts.
                    </p>
                    <Link
                        to="/accounts"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                    >
                        Go to Accounts
                    </Link>
                </div>
            ) : (
                <>
                    <DividendKpiStrip kpis={kpis} metadataLoading={metadataLoading} />

                    <MonthlyPayoutsChart
                        data={monthlyData}
                        annualData={annualData}
                        currentYear={currentYear}
                        chartTheme={chartTheme}
                    />

                    <IncomeByHolding
                        rows={holdingRows}
                        metadataLoading={metadataLoading}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <AccountTaxBreakdown
                            groups={accountGroups}
                            metadataLoading={metadataLoading}
                        />
                        <UpcomingPayouts
                            payouts60={upcoming60}
                            cutoff30Iso={cutoff30Iso}
                            metadataLoading={metadataLoading}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default Dividends;
