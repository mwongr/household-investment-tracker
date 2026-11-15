import React from 'react';

export interface KofiButtonProps {
    href?: string;
    label?: string;
    size?: 'sm' | 'md';
    className?: string;
}

const DEFAULT_KOFI_URL = 'https://ko-fi.com/mwongr';

/**
 * Reusable static Ko-fi donation button styled to match the app's slate card design system.
 */
export const KofiButton: React.FC<KofiButtonProps> = ({
    href = DEFAULT_KOFI_URL,
    label = 'Buy me a beer',
    size = 'md',
    className = '',
}) => {
    const sizeClasses =
        size === 'sm'
            ? 'px-3.5 py-2 text-xs rounded-lg gap-2'
            : 'px-4 py-2.5 text-xs rounded-xl gap-2';

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center justify-center font-bold bg-slate-900/80 hover:bg-slate-750 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white shadow-sm transition-colors shrink-0 ${sizeClasses} ${className}`}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="w-4 h-4 shrink-0 text-slate-200"
            >
                <path
                    d="M4 7h12.5a3.5 3.5 0 0 1 0 7H16v1a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7Z"
                    fill="currentColor"
                    fillOpacity="0.12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                />
                <path
                    d="M16 9h.5a2 2 0 0 1 0 4H16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                />
                <path
                    d="M10 14.8s-2.2-1.45-2.2-2.9a1.3 1.3 0 0 1 2.2-.92 1.3 1.3 0 0 1 2.2.92c0 1.45-2.2 2.9-2.2 2.9Z"
                    fill="#FF5E5B"
                />
            </svg>
            <span>{label}</span>
        </a>
    );
};

export default KofiButton;
