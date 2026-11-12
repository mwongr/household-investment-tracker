import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { DemoModeBanner } from './DemoModeBanner';
import { OnboardingModal } from './OnboardingModal';
import { CsvImportModal } from './CsvImportModal';
import { useData } from '../context/DataContext';
import '../styles/layout.css';

const Layout = () => {
    const { pathname } = useLocation();
    const { members, accounts, isDemoData } = useData();
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);
    const [csvModalOpen, setCsvModalOpen] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    // Show onboarding if there are no members and no accounts and not in demo mode
    const isBlank = members.length === 0 && accounts.length === 0 && !isDemoData;
    const showOnboarding = isBlank && !onboardingDismissed;

    return (
        <div className="app-layout">
            <Navbar />
            <main className="main-content">
                <div className="content-container">
                    <DemoModeBanner />
                    <Outlet />
                </div>
            </main>

            {showOnboarding && (
                <OnboardingModal
                    isOpen={showOnboarding}
                    onClose={() => setOnboardingDismissed(true)}
                    onOpenCsvImport={() => setCsvModalOpen(true)}
                />
            )}

            {csvModalOpen && (
                <CsvImportModal
                    isOpen={csvModalOpen}
                    onClose={() => setCsvModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Layout;
