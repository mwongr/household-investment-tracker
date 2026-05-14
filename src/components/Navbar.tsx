import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Building, Wallet, FileBarChart, Settings, Search, Calculator, TrendingUp, Percent, Wrench } from 'lucide-react';
import { useData } from '../context/DataContext';
import '../styles/navbar.css';

const Navbar = () => {
    const { assets, accounts, bankAccounts, liabilities } = useData();

    // Calculate total net worth dynamically
    const totalAssetValue = assets.reduce((sum, a) => sum + (a.marketValue || 0), 0)
        + accounts.reduce((sum, a) => sum + (a.cashBalance || 0), 0);
    const totalCash = bankAccounts ? bankAccounts.reduce((sum, b) => sum + (b.balance || 0), 0) : 0;
    const totalLiabilities = liabilities ? liabilities.reduce((sum, l) => sum + (l.balance || 0), 0) : 0;

    const totalValue = totalAssetValue + totalCash - totalLiabilities;

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Members', path: '/members' },
        { icon: Building, label: 'Institutions', path: '/institutions' },
        { icon: Wallet, label: 'Accounts', path: '/accounts' },
        { icon: TrendingUp, label: 'Net Worth', path: '/networth' },
        { icon: FileBarChart, label: 'Reports', path: '/reports' },
        { icon: Search, label: 'Research', path: '/research' },
        { icon: Calculator, label: 'ACB Tracker', path: '/acb' },
        { icon: Percent, label: 'Tax Optimizer', path: '/tax' },
        { icon: Wrench, label: 'Tools', path: '/tools' },
        { icon: Settings, label: 'Settings', path: '/settings' },
    ];

    return (
        <header className="navbar">
            <div className="navbar-left">
                <Link to="/" className="brand-logo">
                    WealthTracker
                </Link>

                <nav className="navbar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={18} className="nav-icon" />
                            <span className="nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </div>

            <div className="navbar-right">
                <div className="net-worth-summary">
                    <span className="label">Total Net Worth</span>
                    <span className="value">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
