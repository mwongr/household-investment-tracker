import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    Wallet,
    FileBarChart,
    Settings,
    Search,
    Calculator,
    TrendingUp,
    Percent,
    Wrench,
    Sun,
    Moon,
    Menu,
    X,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import '../styles/navbar.css';

const Navbar = () => {
    const { assets, accounts, preferences } = useData();
    const { theme, toggleTheme } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);

    const totalPortfolioValue =
        assets.reduce((sum, a) => sum + (a.cadMarketValue || a.marketValue || 0), 0) +
        accounts.reduce((sum, a) => sum + (a.cashBalance || 0), 0);

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
        <>
            <header className="navbar">
                <div className="navbar-left">
                    <Link to="/" className="brand-logo" onClick={() => setMobileOpen(false)}>
                        <span className="brand-mark" aria-hidden="true">
                            <TrendingUp size={16} strokeWidth={2.5} />
                        </span>
                        <span className="brand-text">
                            <span className="brand-main">Household</span>
                            <span className="brand-sub">Investment Tracker</span>
                        </span>
                    </Link>

                    <nav className="navbar-nav" aria-label="Primary navigation">
                        {navItems.map(item => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <item.icon size={16} className="nav-icon" />
                                <span className="nav-label">{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="navbar-right">
                    <div className="net-worth-pill">
                        <span className="label">Total Portfolio</span>
                        <span className="value">
                            ${totalPortfolioValue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        className="nav-icon-btn"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                    </button>

                    <button
                        type="button"
                        onClick={() => setMobileOpen(prev => !prev)}
                        className="nav-icon-btn mobile-menu-btn"
                        aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
                        aria-expanded={mobileOpen}
                    >
                        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
            </header>

            {mobileOpen && (
                <nav className="mobile-nav-drawer" aria-label="Mobile navigation">
                    {navItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <item.icon size={16} className="nav-icon" />
                            <span className="nav-label">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            )}
        </>
    );
};

export default Navbar;
