# Household Investment Tracker

A comprehensive personal finance and investment analysis application designed to track household investments, analyze portfolio performance, manage assets across multiple family members and institutions, and optimize tax strategies. Built with React 19, TypeScript, Tailwind CSS, lightweight-charts, and a local Express backend.

## 🚀 Features

### 📊 Portfolio Dashboard & Management
*   **Household Overview**: Real-time tracking of net worth, daily performance, and asset allocation.
*   **Multi-Member Support**: Track investments for multiple family members separately or aggregately. Member and institution management is integrated into the settings panel.
*   **Asset Management**: Detailed tracking for Stocks, ETFs, Mutual Funds, and Cash with support for custom book costs.
*   **Live Market Data**: Yahoo Finance integration for real-time price quotes, daily changes, and sparkline charts.
*   **Watchlist**: Keep tabs on key securities with detailed metrics (volume, average volume, 52-week high/low) and technical indicators.
*   **Theme Toggle**: Sleek, harmonious dark and light modes accessible from the navigation bar.

### 🛡️ Tax Bracket Optimizer
*   **Bracket Drop Optimization**: Custom tax engine that models combined Federal & Provincial/State brackets, with support for customizable tax rates and regional abatements.
*   **"Sweet Spot" Analysis**: Calculates the exact RRSP contribution needed to drop taxable income into the next lower combined tax bracket to maximize refund rates.
*   **Interactive Simulation**: RRSP contribution slider with live feedback on estimated refunds (Federal & Provincial/State), effective savings rate, top marginal rate, and final taxable income.
*   **Funding Schedule Widget**: Link to a specific RRSP account, track year-to-date deposits, and calculate the required monthly, bi-weekly, or weekly contributions needed to meet your tax target before the RRSP deadline.
*   **Scenario Snapshots**: Save, load, or delete optimized tax scenario snapshots stored in your local database. Tax brackets and parameters are fully customizable via the Settings interface.

### 🧮 Adjusted Cost Base (ACB) Tracker
*   **Capital Gains Calculation**: Dedicated tracker for non-registered investment accounts to calculate capital gains/losses for tax reporting.
*   **Comprehensive Transaction Types**: Supports Buy, Sell, Return of Capital (RoC), Capital Gains Dividend, Reinvested Dividend (DRIP), Reinvested Capital Gains Distribution, and Stock Splits.
*   **Running Log**: Computes running share counts, adjusted cost base changes, total ACB, ACB per share, and realized capital gains/losses on every transaction.
*   **Data Portability**: Filter tracking history by year and export detailed ACB transaction ledgers to CSV.

### 📈 Advanced Stock Research & Analytics
*   **Interactive Candlestick Charts**: Render interactive OHLCV data using high-performance Lightweight Charts (`lightweight-charts`).
*   **Trend & Volatility Indicators**: Overlaid EMA 50/200 lines, RSI (14) gauge with oversold (<30) and overbought (>70) alert zones, MACD (12, 26, 9) histogram panels, and Bollinger Band metrics.
*   **Target Entry Levels**: Display suggested buy zones (lower Bollinger Band), sell zones (upper Bollinger Band), and Fibonacci 61.8% entry levels alongside 52-week high/low overlays.
*   **Multi-Ticker Comparison**: Compare historical normalized returns starting at 0% for up to 8 tickers simultaneously across multiple timeframes (`1M`, `6M`, `1Y`, `5Y`, `YTD`).

### 💰 Net Worth & Cashflow Dashboard
*   **Full Balance Sheet**: Record bank account balances (checking/savings) and liabilities (mortgages, credit cards, loans) alongside investment holdings.
*   **Debt-to-Asset Analysis**: Visual distribution bar showing the percentage split of investments, cash, and debt.
*   **Passive Income & Cashflow Projections**: Estimates a monthly income stream using the 4% safe withdrawal rate rule of thumb and compares it to household expenses for a passive net cashflow projection.
*   **Exportable Reports**: Generate print-ready PDF reports (via `html2canvas` and `jspdf`) or export comprehensive financial balance sheets to CSV (via `papaparse`).

### 🧰 Investment Tools Suite
*   **Stock Buying Planner**: Select accounts, fetch live market prices, input purchase plans, and preview how new buys will impact cash balances and average cost bases.
*   **Profit/Loss & Risk-Reward Calculator**: Model entry, target, and stop-loss levels to compute risk-reward ratios with a quick "Auto 1:2" stop-loss helper.
*   **Position Sizing Calculator**: Determine recommended shares and total position size based on portfolio risk tolerance. Integrates ATR (Average True Range) volatility lookups to dynamically establish stop-loss levels.
*   **Portfolio Allocation Splitter**: Divide cash sums across custom asset weights with instant dollar calculations.
*   **DRIP Calculator**: Simulates wealth compound differentials of reinvesting dividends vs. taking them as cash over up to 50 years.

## 🛠️ Technology Stack

*   **Frontend**: React 19, TypeScript, Vite, Recharts, Lightweight Charts (by TradingView)
*   **Reporting & Data**: jsPDF, html2canvas, PapaParse
*   **Styling**: Tailwind CSS, Lucide Icons
*   **Backend**: Node.js, Express, Yahoo Finance API integration (`yahoo-finance2`), Technical Indicators API (`technicalindicators`)
*   **Data Storage**: Local JSON database (`server/database.json`) with auto-sync and local file system backup logic.

## 📋 Prerequisites

*   [Node.js](https://nodejs.org/) (Version 18 or higher recommended)
*   Windows OS (for the easy start batch script) - *App runs on Mac/Linux via terminal commands.*

## 💿 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/mwongr/investment-tracker.git
    cd investment-tracker
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## ▶️ How to Run

### **Option 1: Windows Easy Start (Recommended)**
Double-click the included `Start App.bat` file in the root directory.
*   This will launch the local backend server and the frontend application concurrently.
*   It also handles the automated backup process when you exit.

### **Option 2: Manual Start (Command Line)**
Open a terminal in the project directory and run:
```bash
npm run dev
```
Access the application at `http://localhost:5847`.

## 💾 Backup & Data Management

### **Automated Backups**
1.  Go to the **Settings** page in the application.
2.  Enter a local folder path in the **Automated Backup Location** field (e.g., `D:\MyBackups`).
3.  When you use `Start App.bat` to run the app, closing the terminal window (Ctrl+C) will prompt you to create a timestamped backup of your data.

### **Manual Import/Export**
*   **Export**: Click "Export Backup" in Settings to download a JSON snapshot.
*   **Restore**: Use "Import Backup" to load a previously saved JSON file (either from the automated system or a manual export).

## 🔒 Security Note
This application runs locally. Your financial data is stored in `server/database.json` and is **not** uploaded to any cloud service by the application itself. Ensure you include `server/database.json` in your `.gitignore` if you fork this repository (already configured by default).

