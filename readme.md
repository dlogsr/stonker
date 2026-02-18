# Stonker

Real-time stock ticker PWA with sentiment-driven trend summaries.

## Features

- **Google Sign-In** — log in with your Google account and auto-sync your Google Finance watchlist
- **Live stock quotes** via Yahoo Finance (price, change, volume, market cap, 52-week range)
- **Sentiment summaries** — 1-2 line trend blurbs per stock from Google News, Reddit (r/stocks, r/wallstreetbets, r/investing), and StockTwits
- **Google Finance watchlist import** — paste tickers in any format (comma-separated, one-per-line, `NASDAQ:AAPL`)
- **Installable PWA** — add to macOS dock via Chrome/Edge "Install App"
- **Auto-refresh** — quotes every 30s, sentiment every 5m
- **Dark finance theme** — clean, information-dense UI

## Quick Start

```bash
npm install
cp .env.example .env   # then fill in your Google OAuth credentials
npm run dev
```

This starts both the Vite dev server (port 5173) and the API server (port 3001).

## Google Sign-In Setup

To enable the "Sign in with Google" button and automatic watchlist sync:

### 1. Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)

### 2. Configure OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** user type
3. Fill in the app name ("Stonker") and your email
4. Add scopes: `openid`, `email`, `profile`
5. Add your email as a test user (while in testing mode)

### 3. Create OAuth credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URIs: `http://localhost:3001/api/auth/callback`
5. Copy the **Client ID** and **Client Secret**

### 4. Configure your `.env` file

```bash
cp .env.example .env
```

Edit `.env`:
```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/callback
SESSION_SECRET=any-random-string-here
```

### 5. Run and sign in

```bash
npm run dev
```

Open `http://localhost:5173`, click **Sign in with Google**, then click **Sync Google** to pull your watchlist.

> **Note:** Google Finance doesn't have an official API. The sync feature attempts to parse your watchlist from the Google Finance page. If auto-sync doesn't find your tickers, you can always use the **Import** button to paste them manually.

## Install as macOS Desktop App

1. Open `http://localhost:5173` in Chrome or Edge
2. Click the install icon in the address bar (or Menu > "Install Stonker...")
3. The app appears in your Dock as a standalone window

## Architecture

```
stonker/
├── server/
│   ├── index.ts             # Express server, quotes, search
│   ├── auth.ts              # Google OAuth login/callback/session
│   ├── google-finance.ts    # Google Finance watchlist parser
│   └── sentiment.ts         # News/Reddit/StockTwits aggregation
├── src/
│   ├── components/          # StockCard, AddStock, ImportModal, Header
│   ├── hooks/               # useStockData, useWatchlist, useAuth
│   └── types/               # TypeScript interfaces
├── public/                  # PWA assets
├── .env.example             # Environment variable template
└── vite.config.ts           # Vite + PWA plugin config
```

## Production Build

```bash
npm run build        # Output in dist/
npm run preview      # Preview production build
npm run server       # Run API server separately
```
