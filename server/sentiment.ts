import { SentimentData } from '../src/types/index.js';

const BULLISH_WORDS = [
  'surge', 'soar', 'rally', 'jump', 'gain', 'rise', 'bull', 'buy', 'upgrade',
  'beat', 'record', 'strong', 'growth', 'profit', 'boom', 'breakout', 'moon',
  'rocket', 'calls', 'long', 'outperform', 'positive', 'optimistic', 'rebound',
  'exceeds', 'upside', 'tendies', 'diamond', 'hands', 'yolo', 'lfg', 'rip',
  'squeeze', 'gamma', 'send', 'lambo', 'alpha', 'dip buy',
];

const BEARISH_WORDS = [
  'crash', 'plunge', 'drop', 'fall', 'down', 'bear', 'sell', 'downgrade',
  'miss', 'loss', 'weak', 'decline', 'dump', 'short', 'puts', 'underperform',
  'negative', 'pessimistic', 'risk', 'warning', 'fear', 'recession', 'layoff',
  'cut', 'bankruptcy', 'fraud', 'overvalued', 'bag', 'guh', 'rug', 'rekt',
  'drilling', 'crater', 'tanking', 'dead cat', 'trap',
];

function scoreSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = text.toLowerCase();
  let score = 0;
  for (const word of BULLISH_WORDS) if (lower.includes(word)) score++;
  for (const word of BEARISH_WORDS) if (lower.includes(word)) score--;
  if (score > 0) return 'bullish';
  if (score < 0) return 'bearish';
  return 'neutral';
}

interface RawSource {
  type: 'stocktwits' | 'reddit' | 'news';
  title: string;
  url?: string;
  userSentiment?: 'bullish' | 'bearish' | null;
  score?: number;
}

// --- StockTwits (primary source) ---
async function fetchStockTwits(symbol: string): Promise<RawSource[]> {
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(symbol)}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json() as any;
    const messages = data?.messages ?? [];
    return messages.slice(0, 15).map((msg: any) => {
      const st = (msg.entities?.sentiment)?.basic;
      return {
        type: 'stocktwits' as const,
        title: (msg.body ?? '').substring(0, 240),
        url: `https://stocktwits.com/${msg.user?.username}/message/${msg.id}`,
        userSentiment: st === 'Bullish' ? 'bullish' : st === 'Bearish' ? 'bearish' : null,
        score: (msg.likes?.total ?? 0) + 1,
      };
    });
  } catch (err) {
    console.warn(`StockTwits fetch failed for ${symbol}:`, (err as Error).message);
    return [];
  }
}

// --- Reddit WSB + stocks ---
async function fetchReddit(symbol: string): Promise<RawSource[]> {
  const subs = ['wallstreetbets', 'stocks'];
  const results: RawSource[] = [];

  for (const sub of subs) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent('$' + symbol)}&sort=new&restrict_sr=on&limit=5&t=week`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json() as any;
      const posts = data?.data?.children ?? [];
      for (const post of posts) {
        const d = post.data;
        results.push({
          type: 'reddit',
          title: d.title,
          url: `https://reddit.com${d.permalink}`,
          score: (d.score ?? 0),
        });
      }
    } catch {
      // skip
    }
  }
  return results.slice(0, 8);
}

// --- Google News (lightweight fallback) ---
async function fetchGoogleNews(symbol: string): Promise<RawSource[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + ' stock')}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Stonker/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const xml = await res.text();
    const items: RawSource[] = [];
    const re = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g;
    let m;
    while ((m = re.exec(xml)) !== null && items.length < 5) {
      items.push({
        type: 'news',
        title: m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        url: m[2].trim(),
      });
    }
    return items;
  } catch {
    return [];
  }
}

function generateSummary(
  symbol: string,
  scoredSources: { title: string; sentiment: 'bullish' | 'bearish' | 'neutral'; type: string }[],
  stBull: number,
  stBear: number,
): string {
  const total = stBull + stBear;
  if (total === 0 && scoredSources.length === 0) {
    return `No recent chatter on $${symbol}.`;
  }

  if (total >= 2) {
    const pct = Math.round((stBull / total) * 100);
    const label = pct >= 60 ? 'Bullish' : pct <= 40 ? 'Bearish' : 'Mixed';
    return `${label} on StockTwits (${pct}% bull of ${total} tagged). ${scoredSources.length} signals total.`;
  }

  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  for (const s of scoredSources) counts[s.sentiment]++;
  if (counts.bullish === counts.bearish) {
    return `Mixed signals across ${scoredSources.length} posts for $${symbol}.`;
  }
  const label = counts.bullish > counts.bearish ? 'Leaning bullish' : 'Leaning bearish';
  return `${label} across ${scoredSources.length} posts for $${symbol}.`;
}

export async function fetchSentiment(symbol: string): Promise<SentimentData> {
  const [stItems, redditItems, newsItems] = await Promise.all([
    fetchStockTwits(symbol),
    fetchReddit(symbol),
    fetchGoogleNews(symbol),
  ]);

  const allSources = [...stItems, ...redditItems, ...newsItems];

  let stBull = 0;
  let stBear = 0;
  for (const s of stItems) {
    if (s.userSentiment === 'bullish') stBull++;
    else if (s.userSentiment === 'bearish') stBear++;
  }

  const scoredSources = allSources.map(source => ({
    ...source,
    sentiment: source.userSentiment ?? scoreSentiment(source.title),
  }));

  let overallSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (stBull + stBear >= 2) {
    const ratio = stBull / (stBull + stBear);
    overallSentiment = ratio >= 0.6 ? 'bullish' : ratio <= 0.4 ? 'bearish' : 'neutral';
  } else {
    overallSentiment = scoreSentiment(allSources.map(s => s.title).join(' '));
  }

  // Interleave sources: every 3 social items, insert 1 news item (~25% news)
  const social = scoredSources.filter(s => s.type !== 'news');
  const news = scoredSources.filter(s => s.type === 'news');
  const interleaved: typeof scoredSources = [];
  let ni = 0;
  for (let i = 0; i < social.length; i++) {
    interleaved.push(social[i]);
    if ((i + 1) % 3 === 0 && ni < news.length) {
      interleaved.push(news[ni++]);
    }
  }
  // Append any remaining news at the end
  while (ni < news.length) interleaved.push(news[ni++]);

  return {
    summary: generateSummary(symbol, scoredSources, stBull, stBear),
    sentiment: overallSentiment,
    sources: interleaved.map(s => ({
      type: s.type as 'stocktwits' | 'reddit' | 'news',
      title: s.title,
      url: s.url,
      sentiment: s.sentiment,
    })),
  };
}
