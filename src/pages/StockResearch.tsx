import { useState } from 'react';
import StockSearch from '../components/StockSearch';
import StockDetails from '../components/StockDetails';
import ScreenerWidget from '../components/ScreenerWidget';

const StockResearch = () => {
    const [searchData, setSearchData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (symbol: string) => {
        setLoading(true);
        setError('');
        setSearchData(null);

        try {
            const res = await fetch(`http://localhost:3001/api/quote-detailed?symbol=${symbol}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error('Stock not found');
                throw new Error('Failed to fetch data');
            }
            const data = await res.json();
            setSearchData(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSearchData(null);
        setError('');
    };

    return (
        <div className="content-container">
            <h1 className="text-3xl font-bold mb-8 text-white">Stock Research</h1>

            <StockSearch onSearch={handleSearch} isLoading={loading} />

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg mb-8 text-center flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">Close</button>
                </div>
            )}

            {searchData && <StockDetails data={searchData} onClose={handleClose} />}

            <div className="mt-12">
                <h2 className="text-2xl font-bold mb-6 text-white text-center md:text-left">Market Screeners (Canada)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ScreenerWidget title="Day Gainers" type="day_gainers" />
                    <ScreenerWidget title="Day Losers" type="day_losers" />
                    <ScreenerWidget title="Most Active" type="most_actives" />
                </div>
            </div>
        </div>
    );
};

export default StockResearch;
