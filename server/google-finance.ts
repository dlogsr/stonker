import { Request, Response, Router } from 'express';

export const financeRouter = Router();

/**
 * Fetches the user's Google Finance watchlist tickers.
 *
 * Google Finance doesn't have an official API, so we fetch the watchlist page
 * using the user's Google session and parse ticker symbols from the HTML/JSON
 * embedded in the response.
 */
financeRouter.get('/watchlist', async (req: Request, res: Response) => {
  const tokens = req.session.tokens;
  if (!tokens?.access_token) {
    res.status(401).json({ error: 'Not authenticated. Please log in with Google first.' });
    return;
  }

  try {
    // Fetch Google Finance main page (which includes watchlist data for authenticated users)
    const response = await fetch('https://www.google.com/finance', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Google Finance responded with ${response.status}`);
      res.status(502).json({
        error: 'Could not reach Google Finance. Token may have expired — try logging in again.',
      });
      return;
    }

    const html = await response.text();
    const tickers = parseTickersFromHTML(html);

    if (tickers.length === 0) {
      // Fallback: try the watchlist-specific endpoint
      const fallbackTickers = await tryWatchlistEndpoint(tokens.access_token);
      if (fallbackTickers.length > 0) {
        res.json({ tickers: fallbackTickers, source: 'watchlist-api' });
        return;
      }

      res.json({
        tickers: [],
        message: 'No tickers found. Google may require browser cookies for watchlist access. Try using the Import feature with your tickers copied from Google Finance.',
      });
      return;
    }

    res.json({ tickers, source: 'google-finance' });
  } catch (err) {
    console.error('Google Finance fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

/**
 * Parse ticker symbols from Google Finance HTML.
 * Google Finance embeds structured data in the page that contains watchlist info.
 */
function parseTickersFromHTML(html: string): string[] {
  const tickers = new Set<string>();

  // Pattern 1: Match data-symbol attributes (e.g., data-symbol="AAPL")
  const symbolAttrRegex = /data-symbol="([A-Z]{1,5})"/g;
  let match;
  while ((match = symbolAttrRegex.exec(html)) !== null) {
    tickers.add(match[1]);
  }

  // Pattern 2: Match ticker patterns in structured data like ["NASDAQ","AAPL"] or "NASDAQ:AAPL"
  const exchangeTickerRegex = /(?:NASDAQ|NYSE|NYSEARCA|NYSEMKT|BATS|CBOE|OTC)\s*[:",]\s*([A-Z]{1,5})/g;
  while ((match = exchangeTickerRegex.exec(html)) !== null) {
    tickers.add(match[1]);
  }

  // Pattern 3: Match watchlist section tickers in the embedded JSON data
  const jsonDataRegex = /\["([A-Z]{1,5})","(?:NASDAQ|NYSE|NYSEARCA)"/g;
  while ((match = jsonDataRegex.exec(html)) !== null) {
    tickers.add(match[1]);
  }

  // Pattern 4: Look for tickers in the AF_initDataCallback format Google uses
  const afDataRegex = /"([A-Z]{1,5})"[,\]]\s*"(?:NASDAQ|NYSE|NYSEARCA|NYSEMKT)"/g;
  while ((match = afDataRegex.exec(html)) !== null) {
    tickers.add(match[1]);
  }

  return Array.from(tickers);
}

/**
 * Try Google Finance's internal watchlist data endpoint.
 */
async function tryWatchlistEndpoint(accessToken: string): Promise<string[]> {
  try {
    // Google Finance uses an internal batch endpoint for data
    const url = 'https://www.google.com/finance/api/data';
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];
    const text = await response.text();

    const tickers: string[] = [];
    const tickerRegex = /"([A-Z]{1,5})"/g;
    let match;
    while ((match = tickerRegex.exec(text)) !== null) {
      const t = match[1];
      // Filter to likely stock tickers (avoid common short English words)
      if (t.length >= 2 && !COMMON_WORDS.has(t)) {
        tickers.push(t);
      }
    }
    return [...new Set(tickers)];
  } catch {
    return [];
  }
}

const COMMON_WORDS = new Set([
  'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'IF', 'IN', 'IS', 'IT',
  'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE',
  'AM', 'HE', 'OK', 'OUR', 'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT',
  'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'HAS', 'HIS', 'HOW',
  'GET', 'SET', 'NEW', 'OLD', 'URL', 'API', 'CSS', 'DOM',
]);
