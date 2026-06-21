import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

async function test() {
    const originalTicker = 'SHOP.TO';
    const conversionDate = '2023-01-01'; // Sunday
    
    const targetDate = new Date(conversionDate);
    // Fetch from 7 days prior to 1 day after to ensure we capture the closest trading day
    const period1 = new Date(targetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    const period2 = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    console.log('Testing yahooFinance.chart with:', period1, period2);

    try {
        const hist = await yahooFinance.chart(originalTicker, {
            period1: period1,
            period2: period2,
            interval: '1d'
        });
        
        if (hist && hist.quotes && hist.quotes.length > 0) {
            // Filter quotes that are on or before the conversionDate
            // and get the last one
            const validQuotes = hist.quotes.filter(q => new Date(q.date) <= targetDate);
            if (validQuotes.length > 0) {
                // The last valid quote
                const closestQuote = validQuotes[validQuotes.length - 1];
                console.log('Found closest quote:', closestQuote);
            } else {
                console.log('No valid quotes before target date');
            }
        } else {
            console.log('No quotes returned');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
