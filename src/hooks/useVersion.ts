import { useContext } from 'react';
import { VersionContext, type VersionContextValue } from '../context/versionContextDef';

export const useVersion = (): VersionContextValue => {
    const context = useContext(VersionContext);
    if (!context) {
        throw new Error('useVersion must be used within a VersionProvider');
    }
    return context;
};
