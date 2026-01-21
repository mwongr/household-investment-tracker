# Household Investment Tracker

A personal finance application designed to track household investments, analyze portfolio performance, and manage assets across multiple family members and institutions. Built with React, TypeScript, Tailwind CSS, and a local Express backend.

## 🚀 Features

*   **Portfolio Dashboard**: Real-time overview of net worth, daily performance, and asset allocation.
*   **Multi-Member Support**: Track investments for multiple family members separately or aggregately.
*   **Asset Management**: detailed tracking for Stocks, ETFs, Mutual Funds, and Cash.
*   **Live Market Data**: Integrates with Yahoo Finance API for real-time price updates and sparkline charts.
*   **Reports & Screeners**: Generate PDF reports and discover new investment opportunities.
*   **Data Privacy**: All data is stored locally on your machine (`server/database.json`).
*   **Automated Backups**: Configurable flexible backup system to keep your data safe.

## 🛠️ Technology Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **Styling**: Tailwind CSS, Lucide Icons
*   **Backend**: Node.js, Express (Local proxy server for API requests)
*   **Data Storage**: Local JSON file system

## 📋 Prerequisites

*   [Node.js](https://nodejs.org/) (Version 18 or higher recommended)
*   Windows OS (for the batch script) - *App runs on Mac/Linux via terminal commands.*

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
*   This will launch the local server and the frontend application automatically.
*   It also handles the automated backup process when you exit.

### **Option 2: Manual Start (Command Line)**
Open a terminal in the project directory and run:
```bash
npm run dev
```
Access the application at `http://localhost:5173`.

## 💾 Backup & Data Management

### **Automated Backups**
1.  Go to the **Settings** page in the application.
2.  Enter a local folder path in the **Automated Backup Location** field (e.g., `D:\MyBackups`).
3.  When you use `Start App.bat` to run the app, closing the terminal window (Ctrl+C) will prompt you to creating a timestamped backup of your data.

### **Manual Import/Export**
*   **Export**: specific "Export Backup" in Settings to download a JSON snapshot.
*   **Restore**: Use "Import Backup" to load a previously saved JSON file (either from the automated system or a manual export).

## 🔒 Security Note
This application runs locally. Your financial data is stored in `server/database.json` and is **not** uploaded to any cloud service by the application itself. Ensure you include `server/database.json` in your `.gitignore` if you fork this repository (already configured by default).
