# Stonker

Real-time stock ticker PWA with sentiment-driven trend summaries.

## Features

- **Live stock quotes** via Yahoo Finance (price, change, volume, market cap, 52-week range)
- **Sentiment summaries** — 1-2 line trend blurbs per stock from Google News, Reddit (r/stocks, r/wallstreetbets, r/investing), and StockTwits
- **Google Finance watchlist import** — paste tickers in any format (comma-separated, one-per-line, `NASDAQ:AAPL`)
- **Installable PWA** — add to macOS dock via Chrome/Edge "Install App"
- **Auto-refresh** — quotes every 30s, sentiment every 5m
- **Dark finance theme** — clean, information-dense UI

## Quick Start

```bash
npm install
npm run dev
```

This starts both the Vite dev server (port 5173) and the API server (port 3001).

Or run them separately:

```bash
npm run dev:client   # Vite frontend on :5173
npm run dev:server   # Express API on :3001
```

## Install as macOS Desktop App

1. Open `http://localhost:5173` in Chrome or Edge
2. Click the install icon in the address bar (or Menu > "Install Stonker...")
3. The app appears in your Dock as a standalone window

## Import Your Google Finance Watchlist

1. Open [Google Finance](https://www.google.com/finance/watchlists)
2. Copy your ticker symbols
3. In Stonker, click **Import** and paste them

Supported formats:
- `AAPL, GOOGL, MSFT`
- One ticker per line
- Google Finance format: `NASDAQ:AAPL`

## Architecture

```
stonker/
├── server/           # Express API proxy
│   ├── index.ts      # Quote + search endpoints (Yahoo Finance)
│   └── sentiment.ts  # News/Reddit/StockTwits aggregation
├── src/              # React frontend
│   ├── components/   # StockCard, AddStock, ImportModal, Header
│   ├── hooks/        # useStockData, useWatchlist
│   └── types/        # TypeScript interfaces
├── public/           # PWA assets
└── vite.config.ts    # Vite + PWA plugin config
```

## Production Build

```bash
npm run build        # Output in dist/
npm run preview      # Preview production build
npm run server       # Run API server separately
```
