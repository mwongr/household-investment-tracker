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
    Info,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useVersion } from '../hooks/useVersion';
import '../styles/navbar.css';

const Navbar = () => {
    const { assets, accounts, preferences } = useData();
    const { theme, toggleTheme } = useTheme();
    const { versionInfo } = useVersion();
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
                        <img
                            src={theme === 'dark' ? '/Household-Investment-Tracker-Logo-white.svg' : '/Household-Investment-Tracker-Logo-black.svg'}
                            alt="Household Investment Tracker"
                            className="brand-logo-img"
                        />
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

                    <NavLink
                        to="/about"
                        title={
                            versionInfo?.updateAvailable
                                ? `Update available (v${versionInfo.latestVersion}) - About`
                                : 'About Household Investment Tracker'
                        }
                        className={({ isActive }) =>
                            `nav-icon-btn relative ${isActive ? 'text-blue-400 border-blue-500/50' : ''}`
                        }
                        aria-label="About"
                    >
                        <Info size={17} />
                        {versionInfo?.updateAvailable && (
                            <span
                                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse ring-2 ring-slate-900"
                                aria-label="Update available"
                            />
                        )}
                    </NavLink>

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
                    <NavLink
                        to="/about"
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                        <div className="relative inline-flex items-center">
                            <Info size={16} className="nav-icon" />
                            {versionInfo?.updateAvailable && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            )}
                        </div>
                        <span className="nav-label">About</span>
                        {versionInfo?.updateAvailable && (
                            <span className="ml-auto text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Update
                            </span>
                        )}
                    </NavLink>
                </nav>
            )}
        </>
    );
};

export default Navbar;
