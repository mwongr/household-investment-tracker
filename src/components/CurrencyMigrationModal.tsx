import React, { useState, useMemo } from 'react';
import { AlertTriangle, X, Save } from 'lucide-react';
import { useData } from '../context/DataContext';

interface Props {
  onClose: () => void;
  defaultAssetId?: string;
}

const CurrencyMigrationModal: React.FC<Props> = ({ onClose, defaultAssetId }) => {
  const { assets, accounts, migrateCurrency } = useData();
  
  // Only show active assets (quantity > 0)
  const activeAssets = useMemo(() => assets.filter(a => a.quantity > 0), [assets]);

  const [selectedAssetId, setSelectedAssetId] = useState<string>(defaultAssetId || '');
  const [newTicker, setNewTicker] = useState('');
  const [conversionDate, setConversionDate] = useState(new Date().toISOString().split('T')[0]);
  const [newUsdCostBasis, setNewUsdCostBasis] = useState('');
  const [shares, setShares] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsManualPrice, setNeedsManualPrice] = useState(false);
  const [manualClosePrice, setManualClosePrice] = useState('');

  const selectedAsset = useMemo(() => activeAssets.find(a => a.id === selectedAssetId), [activeAssets, selectedAssetId]);
  
  // Auto-fill shares and new ticker when asset selected
  React.useEffect(() => {
    if (selectedAsset) {
      setShares(selectedAsset.quantity.toString());
      if (!newTicker) {
        // Simple heuristic: remove .TO if it exists
        setNewTicker(selectedAsset.ticker.replace('.TO', ''));
      }
    }
  }, [selectedAsset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;
    if (!newTicker || !conversionDate || !newUsdCostBasis || !shares) {
      setError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await migrateCurrency(
        selectedAsset.ticker,
        newTicker,
        conversionDate,
        parseFloat(newUsdCostBasis),
        parseFloat(shares),
        selectedAsset.accountId,
        needsManualPrice && manualClosePrice ? parseFloat(manualClosePrice) : undefined
      );
      onClose();
    } catch (err: any) {
      if (err.requiresManualPrice) {
        setNeedsManualPrice(true);
      }
      setError(err.message || "Failed to migrate currency.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Currency Migration Wizard</h2>
            <p className="text-sm text-slate-400 mt-1">Migrate CAD stocks uplisted to US exchanges.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          
          <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 mb-6 flex gap-3 text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <strong className="block text-amber-500 mb-1">Important Action</strong>
              This action will lock in the historical CAD performance by realizing the current profit/loss and start tracking the new asset in USD going forward. Ensure you have the exact USD book value provided by your broker.
            </div>
          </div>

          <form id="migration-form" onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Original Asset (CAD)</label>
              <select 
                value={selectedAssetId}
                onChange={e => setSelectedAssetId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                required
              >
                <option value="" disabled>Select an asset...</option>
                {activeAssets.map(a => {
                  const acc = accounts.find(ac => ac.id === a.accountId);
                  return (
                    <option key={a.id} value={a.id}>
                      {a.ticker} - {acc?.name} ({a.quantity} shares)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">New Ticker (USD)</label>
                <input 
                  type="text"
                  value={newTicker}
                  onChange={e => setNewTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. SHOP"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none uppercase transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Shares</label>
                <input 
                  type="number"
                  step="any"
                  value={shares}
                  onChange={e => setShares(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Conversion Date</label>
                <input 
                  type="date"
                  value={conversionDate}
                  onChange={e => setConversionDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">New USD Book Value</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500">$</span>
                  </div>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={newUsdCostBasis}
                    onChange={e => setNewUsdCostBasis(e.target.value)}
                    placeholder="Total Cost in USD"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1.5">Total cost basis, not per-share.</p>
              </div>
            </div>
            
            {needsManualPrice && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mt-4">
                <label className="block text-sm font-medium text-blue-300 mb-1.5">Original Close Price (CAD)</label>
                <p className="text-xs text-slate-400 mb-3">
                  Historical data could not be fetched for this date automatically. Please provide the closing price of the original asset in CAD on the conversion date.
                </p>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500">$</span>
                  </div>
                  <input 
                    type="number"
                    step="0.0001"
                    min="0"
                    value={manualClosePrice}
                    onChange={e => setManualClosePrice(e.target.value)}
                    placeholder="e.g. 15.50"
                    className="w-full bg-slate-800 border border-blue-500/30 rounded-lg pl-8 pr-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end gap-3">
          <button 
            type="button"
            onClick={onClose} 
            className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit"
            form="migration-form"
            disabled={isSubmitting || !selectedAsset}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Execute Migration
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CurrencyMigrationModal;
