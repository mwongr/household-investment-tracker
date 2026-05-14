
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { DataProvider } from './context/DataContext';
import Accounts from './pages/Accounts';
import AccountDetails from './pages/AccountDetails';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import StockResearch from './pages/StockResearch';
import Settings from './pages/Settings';
import AcbTracker from './pages/AcbTracker';
import NetWorth from './pages/NetWorth';
import TaxOptimizer from './pages/TaxOptimizer';
import Tools from './pages/Tools';

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
