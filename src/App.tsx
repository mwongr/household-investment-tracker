import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { DataProvider } from './context/DataContext';
import { ThemeProvider } from './context/ThemeContext';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Accounts = lazy(() => import('./pages/Accounts'));
const AccountDetails = lazy(() => import('./pages/AccountDetails'));
const Reports = lazy(() => import('./pages/Reports'));
const StockResearch = lazy(() => import('./pages/StockResearch'));
const Settings = lazy(() => import('./pages/Settings'));
const AcbTracker = lazy(() => import('./pages/AcbTracker'));
const NetWorth = lazy(() => import('./pages/NetWorth'));
const TaxOptimizer = lazy(() => import('./pages/TaxOptimizer'));
const Tools = lazy(() => import('./pages/Tools'));

const PageFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
);

function App() {
    return (
        <ThemeProvider>
            <DataProvider>
                <BrowserRouter>
                    <Suspense fallback={<PageFallback />}>
                        <Routes>
                            <Route path="/" element={<Layout />}>
                                <Route index element={<Dashboard />} />
                                <Route path="members" element={<Navigate to="/settings" replace />} />
                                <Route path="institutions" element={<Navigate to="/settings" replace />} />
                                <Route path="accounts" element={<Accounts />} />
                                <Route path="accounts/:id" element={<AccountDetails />} />
                                <Route path="reports" element={<Reports />} />
                                <Route path="research" element={<StockResearch />} />
                                <Route path="acb" element={<AcbTracker />} />
                                <Route path="networth" element={<NetWorth />} />
                                <Route path="tax" element={<TaxOptimizer />} />
                                <Route path="tools" element={<Tools />} />
                                <Route path="settings" element={<Settings />} />
                            </Route>
                        </Routes>
                    </Suspense>
                </BrowserRouter>
            </DataProvider>
        </ThemeProvider>
    );
}

export default App;
