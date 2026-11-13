import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { DemoModeBanner } from './DemoModeBanner';
import { OnboardingModal } from './OnboardingModal';
import { CsvImportModal } from './CsvImportModal';
import { useData } from '../context/DataContext';
import '../styles/layout.css';

const Layout = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { members, accounts, isDemoData } = useData();
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);
    const [csvModalOpen, setCsvModalOpen] = useState(false);
    const [importAccountId, setImportAccountId] = useState<string | undefined>(undefined);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    // Show onboarding if there are no members and no accounts and not in demo mode
    const isBlank = members.length === 0 && accounts.length === 0 && !isDemoData;
    const showOnboarding = isBlank && !onboardingDismissed;
    const isDashboard = pathname === '/';

    const handleOpenCsvImport = (accountId?: string) => {
        setImportAccountId(accountId);
        setCsvModalOpen(true);
    };

    const handleCsvSuccess = (accountId: string) => {
        setCsvModalOpen(false);
        setOnboardingDismissed(true);
        navigate(`/accounts/${accountId}`);
    };

    return (
        <div className="app-layout">
            <Navbar />
            <main className="main-content">
                <div className="content-container">
                    <DemoModeBanner />
                    {showOnboarding && isDashboard ? (
                        <OnboardingModal
                            isOpen={true}
                            isInline={true}
                            onClose={() => setOnboardingDismissed(true)}
                            onOpenCsvImport={handleOpenCsvImport}
                        />
                    ) : (
                        <Outlet />
                    )}
                </div>
            </main>

            {csvModalOpen && (
                <CsvImportModal
                    isOpen={csvModalOpen}
                    defaultAccountId={importAccountId}
                    onClose={() => {
                        setCsvModalOpen(false);
                        if (importAccountId) {
                            setOnboardingDismissed(true);
                            navigate(`/accounts/${importAccountId}`);
                        }
                    }}
                    onSuccess={handleCsvSuccess}
                />
            )}
        </div>
    );
};

export default Layout;
