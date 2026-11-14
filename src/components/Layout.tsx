import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { DemoModeBanner } from './DemoModeBanner';
import { OnboardingModal } from './OnboardingModal';
import { UpdateModal } from './UpdateModal';
import { useData } from '../context/DataContext';
import '../styles/layout.css';

const Layout = () => {
    const { pathname } = useLocation();
    const { members, accounts, isDemoData } = useData();
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    // Show onboarding if there are no members and no accounts and not in demo mode
    const isBlank = members.length === 0 && accounts.length === 0 && !isDemoData;
    const showOnboarding = isBlank && !onboardingDismissed;
    const isDashboard = pathname === '/';

    return (
        <div className="app-layout">
            <Navbar />
            <UpdateModal />
            <main className="main-content">
                <div className="content-container">
                    <DemoModeBanner />
                    {showOnboarding && isDashboard ? (
                        <OnboardingModal
                            isOpen={true}
                            isInline={true}
                            onClose={() => setOnboardingDismissed(true)}
                        />
                    ) : (
                        <Outlet />
                    )}
                </div>
            </main>
        </div>
    );
};

export default Layout;
