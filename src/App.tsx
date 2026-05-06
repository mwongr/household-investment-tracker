
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { DataProvider } from './context/DataContext';
import Members from './pages/Members';
import Institutions from './pages/Institutions';
import Accounts from './pages/Accounts';
import AccountDetails from './pages/AccountDetails';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import StockResearch from './pages/StockResearch';
import Settings from './pages/Settings';
import AcbTracker from './pages/AcbTracker';
import NetWorth from './pages/NetWorth';
import TaxOptimizer from './pages/TaxOptimizer';

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="members" element={<Members />} />
            <Route path="institutions" element={<Institutions />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="accounts/:id" element={<AccountDetails />} />
            <Route path="reports" element={<Reports />} />
            <Route path="research" element={<StockResearch />} />
            <Route path="acb" element={<AcbTracker />} />
            <Route path="networth" element={<NetWorth />} />
            <Route path="tax" element={<TaxOptimizer />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
