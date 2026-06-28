import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function test() {
    try {
        const targetDate = new Date('2024-06-10'); 
        const period1 = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const period2 = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
        
        console.log("Fetching AAPL...");
        const hist = await yahooFinance.chart('AAPL', {
            period1: period1,
            period2: period2,
            interval: '1d'
        });
        console.log("AAPL Result length:", hist?.quotes?.length);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

test();
