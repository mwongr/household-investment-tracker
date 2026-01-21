import { NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Building, Wallet, FileBarChart, Settings, Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import '../styles/navbar.css';

const Navbar = () => {
    const { assets, accounts } = useData();

    // Calculate total net worth dynamically
    const totalValue = assets.reduce((sum, a) => sum + a.marketValue, 0)
        + accounts.reduce((sum, a) => sum + a.cashBalance, 0);

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: Users, label: 'Members', path: '/members' },
        { icon: Building, label: 'Institutions', path: '/institutions' },
        { icon: Wallet, label: 'Accounts', path: '/accounts' },
        { icon: FileBarChart, label: 'Reports', path: '/reports' },
        { icon: Search, label: 'Research', path: '/research' },
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
