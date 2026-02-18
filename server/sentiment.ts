import { SentimentData } from '../src/types/index.js';

interface RawSource {
  type: 'news' | 'reddit' | 'stocktwits';
  title: string;
  url?: string;
}

// Simple keyword-based sentiment scoring
const BULLISH_WORDS = [
  'surge', 'soar', 'rally', 'jump', 'gain', 'rise', 'up', 'high', 'bull',
  'buy', 'upgrade', 'beat', 'record', 'strong', 'growth', 'profit', 'boom',
  'breakout', 'moon', 'rocket', 'calls', 'long', 'outperform', 'positive',
  'optimistic', 'recovery', 'rebound', 'innovative', 'exceeds', 'upside',
];
const BEARISH_WORDS = [
  'crash', 'plunge', 'drop', 'fall', 'down', 'low', 'bear', 'sell',
  'downgrade', 'miss', 'loss', 'weak', 'decline', 'dump', 'short', 'puts',
  'underperform', 'negative', 'pessimistic', 'risk', 'warning', 'fear',
  'recession', 'layoff', 'cut', 'bankruptcy', 'fraud', 'overvalued',
];

function scoreSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = text.toLowerCase();
  let score = 0;
  for (const word of BULLISH_WORDS) {
    if (lower.includes(word)) score++;
  }
  for (const word of BEARISH_WORDS) {
    if (lower.includes(word)) score--;
  }
  if (score > 0) return 'bullish';
  if (score < 0) return 'bearish';
  return 'neutral';
}

async function fetchGoogleNews(symbol: string): Promise<RawSource[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(symbol + ' stock')}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Stonker/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    const xml = await res.text();

    const items: RawSource[] = [];
    const titleRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g;
    let match;
    let count = 0;
    while ((match = titleRegex.exec(xml)) !== null && count < 5) {
      const title = match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const link = match[2].trim();
      items.push({ type: 'news', title, url: link });
      count++;
    }
    return items;
  } catch (err) {
    console.warn(`Google News fetch failed for ${symbol}:`, err);
    return [];
  }
}

async function fetchRedditPosts(symbol: string): Promise<RawSource[]> {
  try {
    const subreddits = ['stocks', 'wallstreetbets', 'investing'];
    const results: RawSource[] = [];

    for (const sub of subreddits) {
      try {
        const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&sort=new&restrict_sr=on&limit=3&t=day`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Stonker/1.0' },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) continue;
        const data = await res.json();
        const posts = data?.data?.children ?? [];
        for (const post of posts) {
          results.push({
            type: 'reddit',
            title: post.data.title,
            url: `https://reddit.com${post.data.permalink}`,
          });
        }
      } catch {
        // skip failed subreddit
      }
    }
    return results.slice(0, 5);
  } catch (err) {
    console.warn(`Reddit fetch failed for ${symbol}:`, err);
    return [];
  }
}

async function fetchStockTwits(symbol: string): Promise<RawSource[]> {
  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Stonker/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const messages = data?.messages ?? [];
    return messages.slice(0, 5).map((msg: any) => ({
      type: 'stocktwits' as const,
      title: msg.body?.substring(0, 200) || '',
      url: `https://stocktwits.com/symbol/${symbol}`,
    }));
  } catch (err) {
    console.warn(`StockTwits fetch failed for ${symbol}:`, err);
    return [];
  }
}

function generateSummary(
  symbol: string,
  sources: { title: string; sentiment: 'bullish' | 'bearish' | 'neutral' }[]
): string {
  if (sources.length === 0) {
    return `No recent chatter found for ${symbol}. Trading on fundamentals.`;
  }

  const sentimentCounts = { bullish: 0, bearish: 0, neutral: 0 };
  for (const s of sources) sentimentCounts[s.sentiment]++;

  const total = sources.length;
  const dominant = (Object.entries(sentimentCounts) as [string, number][])
    .sort((a, b) => b[1] - a[1])[0];

  const pct = Math.round((dominant[1] / total) * 100);
  const topSource = sources[0];

  const sentimentLabel = dominant[0] === 'bullish' ? 'Bullish' :
    dominant[0] === 'bearish' ? 'Bearish' : 'Mixed';

  // Pick a representative headline
  const headline = topSource.title.length > 80
    ? topSource.title.substring(0, 77) + '...'
    : topSource.title;

  return `${sentimentLabel} sentiment (${pct}% of ${total} signals). Latest: "${headline}"`;
}

export async function fetchSentiment(symbol: string): Promise<SentimentData> {
  const [newsItems, redditItems, stocktwitsItems] = await Promise.all([
    fetchGoogleNews(symbol),
    fetchRedditPosts(symbol),
    fetchStockTwits(symbol),
  ]);

  const allSources = [...newsItems, ...redditItems, ...stocktwitsItems];

  const scoredSources = allSources.map(source => ({
    ...source,
    sentiment: scoreSentiment(source.title),
  }));

  const overallSentiment = scoreSentiment(
    allSources.map(s => s.title).join(' ')
  );

  const summary = generateSummary(symbol, scoredSources);

  return {
    summary,
    sentiment: overallSentiment,
    sources: scoredSources,
  };
}
