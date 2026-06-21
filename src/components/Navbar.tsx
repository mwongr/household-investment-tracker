import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Wallet, FileBarChart, Settings, Search, Calculator, TrendingUp, Percent, Wrench, Sun, Moon } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/navbar.css';

const Navbar = () => {
    const { assets, accounts, preferences } = useData();
    const { theme, toggleTheme } = useTheme();

    const totalPortfolioValue = assets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0)
        + accounts.reduce((sum, a) => sum + (a.cashBalance || 0), 0);

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Wallet, label: 'Accounts', path: '/accounts' },
        { icon: Search, label: 'Research', path: '/research' },
        { icon: Wrench, label: 'Tools', path: '/tools' },
        { icon: FileBarChart, label: 'Reports', path: '/reports' },
        ...(preferences.enableAcbTracker ? [{ icon: Calculator, label: 'ACB Tracker', path: '/acb' }] : []),
        ...(preferences.enableTaxOptimizer ? [{ icon: Percent, label: 'Tax Optimizer', path: '/tax' }] : []),
        ...(preferences.enableNetWorth ? [{ icon: TrendingUp, label: 'Net Worth', path: '/networth' }] : []),
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
                    <span className="label">Total Portfolio</span>
                    <span className="value">${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                {/* Theme toggle button */}
                <button
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    className="theme-toggle-btn"
                    aria-label="Toggle theme"
                >
                    {theme === 'dark'
                        ? <Sun size={18} />
                        : <Moon size={18} />}
                </button>
            </div>
        </header>
    );
};

export default Navbar;
