import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey', 'cookie'] });

async function run() {
  try {
    const res = await yahooFinance.historical('XEQT.TO', {
      period1: '2026-04-06',
      period2: '2026-05-06',
      interval: '1d'
    });
    console.log('SUCCESS length:', res.length);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
run();
