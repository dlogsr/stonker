import { Router } from 'express';
import { fetchYahooChart, ChartPoint } from './yahoo-chart.js';

export const redditWsbRouter = Router();

// Common words that look like tickers but aren't
const TICKER_BLACKLIST = new Set([
  'A', 'I', 'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF',
  'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'OK', 'ON', 'OR', 'SO', 'TO',
  'UP', 'US', 'WE', 'DD', 'CEO', 'CFO', 'IPO', 'EPS', 'ATH', 'ATL', 'ETF',
  'OTM', 'ITM', 'FD', 'GDP', 'CPI', 'PPI', 'SEC', 'FDA', 'IMO', 'YOLO',
  'FOMO', 'FYI', 'LOL', 'HODL', 'TLDR', 'TL', 'DR', 'OP', 'AMA', 'WSB',
  'THE', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS',
  'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS',
  'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'DID', 'GOT', 'LET',
  'SAY', 'SHE', 'TOO', 'USE', 'RN', 'AI', 'IV', 'TA', 'PM', 'EDIT',
  'PUMP', 'DUMP', 'BULL', 'BEAR', 'CALL', 'PUT', 'PUTS', 'LONG', 'SHORT',
  'BUY', 'SELL', 'HOLD', 'GAIN', 'LOSS', 'RED', 'GREEN', 'MOON', 'DIP',
  'RIP', 'TOP', 'LOW', 'HIGH', 'BIG', 'USD', 'USA', 'UK', 'EU', 'LMAO',
  'NFT', 'OMG', 'WTF', 'SMH', 'PSA', 'IMF', 'DOJ', 'FBI', 'IRS',
  'JUST', 'LIKE', 'THIS', 'THAT', 'WHAT', 'WITH', 'HAVE', 'FROM', 'YOUR',
  'THEY', 'BEEN', 'SOME', 'WHEN', 'WILL', 'MORE', 'MAKE', 'THAN', 'THEM',
  'VERY', 'MUCH', 'MOST', 'ONLY', 'OVER', 'SUCH', 'EACH', 'EVEN',
  'HUGE', 'MEGA', 'REAL', 'EVER', 'BEST', 'KNOW', 'TAKE', 'MADE',
  'FIND', 'HERE', 'BACK', 'MANY', 'WELL', 'ALSO', 'PLAY', 'NEXT',
  'WEEK', 'OPEN', 'MOVE', 'FREE', 'HELP', 'STOP', 'SAFE', 'RISK',
  'DOWN', 'GOOD', 'NEED', 'DOES', 'INTO', 'YEAR', 'THEN', 'LOOK',
  'COME', 'KEEP', 'LAST', 'GIVE', 'MOST', 'PART', 'WENT', 'STILL',
  'YEAH', 'YES', 'POST', 'DEAL', 'VOTE', 'DONT', 'HATE', 'LOVE',
  'CASH', 'DEBT', 'PAYS', 'PAID',
]);

interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  permalink: string;
  link_flair_text: string | null;
  created_utc: number;
}

interface TickerMention {
  symbol: string;
  mentions: number;
  totalScore: number;
  totalComments: number;
  posts: { title: string; score: number; comments: number; url: string }[];
}

export interface WsbBet {
  rank: number;
  symbol: string;
  name: string;
  trendScore: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  bullPct: number;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  chart: ChartPoint[];
  messageCount: number;
  totalLikes: number;
  topMessages: { body: string; sentiment: string; likes: number; url: string }[];
}

// --- Reddit OAuth (app-only) token cache ---
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'stonker:v1.0.0 (by /u/stonker-app)',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    console.error('Reddit OAuth failed:', res.status);
    return null;
  }

  const data = await res.json() as any;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function fetchRedditPosts(): Promise<RedditPost[] | null> {
  // Try OAuth first (works from datacenters)
  const token = await getRedditToken().catch(() => null);
  if (token) {
    const res = await fetch(
      'https://oauth.reddit.com/r/wallstreetbets/hot?limit=75',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'stonker:v1.0.0 (by /u/stonker-app)',
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (res.ok) {
      const data = await res.json() as any;
      return (data?.data?.children ?? []).map((c: any) => c.data);
    }
    console.error('Reddit OAuth listing failed:', res.status);
  }

  // Fallback: public JSON (works from residential IPs / local dev)
  const res = await fetch(
    'https://www.reddit.com/r/wallstreetbets/hot.json?limit=75',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (res.ok) {
    const data = await res.json() as any;
    return (data?.data?.children ?? []).map((c: any) => c.data);
  }

  console.error('Reddit public API failed:', res.status);
  return null;
}

/** Extract $TICKER and ALL_CAPS tickers from text */
function extractTickers(text: string): string[] {
  const tickers: string[] = [];

  const dollarMatches = text.matchAll(/\$([A-Z]{1,5})\b/g);
  for (const m of dollarMatches) {
    const sym = m[1];
    if (!TICKER_BLACKLIST.has(sym) && sym.length >= 2) {
      tickers.push(sym);
    }
  }

  const capsMatches = text.matchAll(/(?:^|\s)([A-Z]{2,5})(?:\s|$|[.,!?;:])/g);
  for (const m of capsMatches) {
    const sym = m[1];
    if (!TICKER_BLACKLIST.has(sym) && !tickers.includes(sym)) {
      tickers.push(sym);
    }
  }

  return tickers;
}

redditWsbRouter.get('/trending', async (_req, res) => {
  try {
    const posts = await fetchRedditPosts();

    if (!posts) {
      res.status(502).json({ error: 'Reddit API unavailable', needsConfig: !process.env.REDDIT_CLIENT_ID });
      return;
    }

    const filtered = posts.filter(
      (p: RedditPost) => !p.link_flair_text?.toLowerCase().includes('meme')
    );

    if (filtered.length === 0) {
      res.json({ bets: [] });
      return;
    }

    // Extract tickers from all posts
    const tickerMap = new Map<string, TickerMention>();

    for (const post of filtered) {
      const combined = `${post.title} ${post.selftext?.substring(0, 500) ?? ''}`;
      const tickers = extractTickers(combined);

      for (const sym of tickers) {
        const existing = tickerMap.get(sym) ?? {
          symbol: sym,
          mentions: 0,
          totalScore: 0,
          totalComments: 0,
          posts: [],
        };
        existing.mentions++;
        existing.totalScore += post.score;
        existing.totalComments += post.num_comments;
        existing.posts.push({
          title: post.title.substring(0, 160),
          score: post.score,
          comments: post.num_comments,
          url: `https://www.reddit.com${post.permalink}`,
        });
        tickerMap.set(sym, existing);
      }
    }

    // Rank by mention count * log(score), take top 8
    const ranked = [...tickerMap.values()]
      .map(t => ({
        ...t,
        hypeScore: t.mentions * Math.log2(Math.max(t.totalScore, 2)),
      }))
      .sort((a, b) => b.hypeScore - a.hypeScore)
      .slice(0, 8);

    if (ranked.length === 0) {
      res.json({ bets: [] });
      return;
    }

    // Enrich with Yahoo chart data
    const enriched = await Promise.all(
      ranked.map(async (ticker, i): Promise<WsbBet> => {
        const chartData = await fetchYahooChart(ticker.symbol).catch(() => null);

        const sortedPosts = [...ticker.posts].sort((a, b) => b.score - a.score);
        const topMessages = sortedPosts.slice(0, 4).map(p => ({
          body: p.title,
          sentiment: p.score > 100 ? 'bullish' : p.score < 10 ? 'bearish' : 'neutral',
          likes: p.score,
          url: p.url,
        }));

        const avgScore = ticker.totalScore / ticker.mentions;
        const bullPct = Math.min(90, Math.max(10, Math.round(50 + Math.log2(Math.max(avgScore, 1)) * 5)));

        return {
          rank: i + 1,
          symbol: ticker.symbol,
          name: chartData?.name ?? ticker.symbol,
          trendScore: ticker.hypeScore,
          sentiment: bullPct >= 60 ? 'bullish' : bullPct <= 40 ? 'bearish' : 'neutral',
          bullPct,
          price: chartData?.price ?? 0,
          change: chartData?.change ?? 0,
          changePercent: chartData?.changePercent ?? 0,
          previousClose: chartData?.previousClose ?? 0,
          chart: chartData?.chart ?? [],
          messageCount: ticker.mentions,
          totalLikes: ticker.totalScore,
          topMessages,
        };
      })
    );

    const valid = enriched.filter(b => b.price > 0);

    res.json({ bets: valid });
  } catch (err) {
    console.error('Reddit WSB trending error:', err);
    res.status(500).json({ error: 'Failed to fetch WSB trending' });
  }
});
