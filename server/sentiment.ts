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

// --- StockTwits trending summary (cached, refreshed every 10 min) ---
let trendingCache: { summaries: Map<string, string>; fetchedAt: number } | null = null;

async function getStockTwitsTrendingSummary(symbol: string): Promise<string | null> {
  const now = Date.now();
  if (trendingCache && now - trendingCache.fetchedAt < 10 * 60 * 1000) {
    return trendingCache.summaries.get(symbol.toUpperCase()) ?? null;
  }
  try {
    const res = await fetch('https://api.stocktwits.com/api/2/trending/symbols/equities.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const symbols: any[] = data?.symbols ?? [];
    const summaries = new Map<string, string>();
    for (const sym of symbols) {
      const s = sym?.trends?.summary;
      if (sym?.symbol && s) summaries.set(sym.symbol.toUpperCase(), s);
    }
    trendingCache = { summaries, fetchedAt: now };
    return summaries.get(symbol.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

const TOPIC_PATTERNS: [RegExp, string][] = [
  [/\b(acqui|takeover|buyout|merger|bid\b|buying|purchase)/i, 'acquisition activity'],
  [/\b(earn|EPS|revenue|quarterly|beat|miss|guidance|results)\b/i, 'earnings'],
  [/\b(upgrade|downgrade|price target|analyst|rating|outperform|underperform)\b/i, 'analyst coverage'],
  [/\b(FDA|approval|clinical|trial|drug|pharma|pipeline)\b/i, 'FDA/clinical news'],
  [/\b(layoff|restructur|cut.*job|job.*cut|workforce)\b/i, 'restructuring'],
  [/\b(IPO|offering|dilut|share.*sale|secondary)\b/i, 'share offering concerns'],
  [/\b(divid|buyback|repurchas|return.*capital)\b/i, 'capital returns'],
  [/\b(CEO|executive|board|leadership|resign|appoint)\b/i, 'leadership changes'],
  [/\b(squeeze|short.*interest|gamma|options.*flow)\b/i, 'short squeeze speculation'],
  [/\b(AI|artificial intelligence|machine learning|chip|semiconductor|GPU)\b/i, 'AI/tech momentum'],
  [/\b(lawsuit|sued|SEC|investigat|fraud|settlement)\b/i, 'legal/regulatory issues'],
  [/\b(partner|deal|contract|agreement|collaboration)\b/i, 'partnership/deal news'],
  [/\b(split|stock.*split)\b/i, 'stock split'],
  [/\b(debt|bond|credit|bankrupt|default)\b/i, 'debt/credit concerns'],
  [/\b(insider|bought|sold.*shares|filing)\b/i, 'insider activity'],
  [/\b(rally|surge|soar|moon|rocket|breakout|rip)\b/i, 'bullish momentum'],
  [/\b(crash|plunge|dump|tank|drill|crater)\b/i, 'bearish pressure'],
];

function extractTopics(sources: { title: string; type: string }[]): string[] {
  const topicHits = new Map<string, number>();
  for (const src of sources) {
    for (const [pattern, topic] of TOPIC_PATTERNS) {
      if (pattern.test(src.title)) {
        topicHits.set(topic, (topicHits.get(topic) ?? 0) + 1);
      }
    }
  }
  return [...topicHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);
}

function extractKeyPhrases(newsHeadlines: string[], symbol: string): string[] {
  const phrases: string[] = [];
  for (const headline of newsHeadlines.slice(0, 5)) {
    let cleaned = headline
      .replace(/\s*[-–—|]\s*(Reuters|Bloomberg|CNBC|MarketWatch|Yahoo|Forbes|Barron's|WSJ|AP|Stock Titan|Stocktwits|MSN|Trefis|Motley Fool|Seeking Alpha|Investor's Business Daily|Business Insider).*$/i, '')
      .replace(new RegExp(`\\$?${symbol}\\b`, 'gi'), '')
      .replace(/\b(stock|shares?|Inc\.?|Corp\.?|Co\.?|Ltd\.?)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (cleaned.length > 15 && cleaned.length < 120) {
      phrases.push(cleaned);
    }
  }
  return phrases;
}

function generateSummary(
  symbol: string,
  scoredSources: { title: string; sentiment: 'bullish' | 'bearish' | 'neutral'; type: string }[],
  stBull: number,
  stBear: number,
): string {
  if (scoredSources.length === 0) {
    return `No recent chatter on $${symbol}.`;
  }

  const parts: string[] = [];

  const newsItems = scoredSources.filter(s => s.type === 'news');
  const socialItems = scoredSources.filter(s => s.type !== 'news');
  const topics = extractTopics(scoredSources);
  const keyPhrases = extractKeyPhrases(newsItems.map(s => s.title), symbol);

  if (keyPhrases.length > 0) {
    const topHeadline = keyPhrases[0];
    if (keyPhrases.length > 1) {
      parts.push(`Headlines are focused on ${topHeadline.toLowerCase()}, with additional coverage around ${keyPhrases[1].toLowerCase()}.`);
    } else {
      parts.push(`The latest headline: ${topHeadline}.`);
    }
  } else if (topics.length > 0) {
    parts.push(`Recent discussion is centered on ${topics.join(' and ')}.`);
  }

  const total = stBull + stBear;
  const counts = { bullish: 0, bearish: 0, neutral: 0 };
  for (const s of scoredSources) counts[s.sentiment]++;

  if (total >= 3) {
    const pct = Math.round((stBull / total) * 100);
    if (pct >= 70) {
      parts.push(`StockTwits sentiment is strongly bullish at ${pct}% (${total} tagged posts).`);
    } else if (pct >= 55) {
      parts.push(`StockTwits leans bullish at ${pct}% (${total} tagged), though some bears remain.`);
    } else if (pct <= 30) {
      parts.push(`StockTwits sentiment is heavily bearish at ${100 - pct}% bear (${total} tagged posts).`);
    } else if (pct <= 45) {
      parts.push(`StockTwits is tilting bearish with only ${pct}% bulls (${total} tagged posts).`);
    } else {
      parts.push(`Community is divided — ${pct}% bullish across ${total} tagged posts on StockTwits.`);
    }
  } else if (socialItems.length > 0) {
    const socialBull = socialItems.filter(s => s.sentiment === 'bullish').length;
    const socialBear = socialItems.filter(s => s.sentiment === 'bearish').length;
    if (socialBull > socialBear * 2) {
      parts.push(`Social chatter is predominantly bullish across ${socialItems.length} posts.`);
    } else if (socialBear > socialBull * 2) {
      parts.push(`Social sentiment skews bearish across ${socialItems.length} posts.`);
    } else {
      parts.push(`Mixed social signals across ${socialItems.length} posts.`);
    }
  }

  if (topics.length > 0 && keyPhrases.length > 0) {
    const remainingTopics = topics.filter(t =>
      !keyPhrases.some(p => p.toLowerCase().includes(t.split('/')[0].toLowerCase()))
    );
    if (remainingTopics.length > 0) {
      parts.push(`Key themes: ${remainingTopics.join(', ')}.`);
    }
  }

  if (counts.bullish > 0 && counts.bearish > 0) {
    const bullPhrases = scoredSources.filter(s => s.sentiment === 'bullish').slice(0, 2);
    const bearPhrases = scoredSources.filter(s => s.sentiment === 'bearish').slice(0, 2);
    if (bullPhrases.length > 0 && bearPhrases.length > 0) {
      const bullTopics = extractTopics(bullPhrases);
      const bearTopics = extractTopics(bearPhrases);
      if (bullTopics.length > 0 && bearTopics.length > 0 && bullTopics[0] !== bearTopics[0]) {
        parts.push(`Bulls cite ${bullTopics[0]}, while bears point to ${bearTopics[0]}.`);
      }
    }
  }

  if (newsItems.length > 0 && socialItems.length > 0) {
    const newsOverall = newsItems.filter(s => s.sentiment === 'bullish').length > newsItems.filter(s => s.sentiment === 'bearish').length ? 'bullish' : 'bearish';
    const socialOverall = socialItems.filter(s => s.sentiment === 'bullish').length > socialItems.filter(s => s.sentiment === 'bearish').length ? 'bullish' : 'bearish';
    if (newsOverall !== socialOverall) {
      parts.push(`Notably, news coverage leans ${newsOverall} while social sentiment is more ${socialOverall}.`);
    }
  }

  return parts.join(' ') || `Tracking ${scoredSources.length} signals for $${symbol}.`;
}

export async function fetchSentiment(symbol: string): Promise<SentimentData> {
  const [stItems, redditItems, newsItems, stTrendingSummary] = await Promise.all([
    fetchStockTwits(symbol),
    fetchReddit(symbol),
    fetchGoogleNews(symbol),
    getStockTwitsTrendingSummary(symbol),
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
    summary: stTrendingSummary ?? generateSummary(symbol, scoredSources, stBull, stBear),
    sentiment: overallSentiment,
    sources: interleaved.map(s => ({
      type: s.type as 'stocktwits' | 'reddit' | 'news',
      title: s.title,
      url: s.url,
      sentiment: s.sentiment,
    })),
  };
}
