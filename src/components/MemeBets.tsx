import React, { useState } from 'react';
import { MemeBet } from '../hooks/useMemeBets';
import { Sparkline } from './Sparkline';

interface Props {
  bets: MemeBet[];
  loading: boolean;
  error?: string | null;
  onAddTicker: (symbol: string) => void;
  existingSymbols: string[];
  source: 'stocktwits' | 'wsb';
}

const CONFIG = {
  stocktwits: {
    title: 'STOCKTWITS TRENDING',
    subtitle: 'Trending on StockTwits \u00b7 ranked by hype',
    loadingText: 'loading StockTwits...',
    postsLabel: 'posts',
    likesLabel: 'likes',
    topPostsTitle: 'Top posts by likes',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  wsb: {
    title: 'WSB CHAOS',
    subtitle: 'Trending on r/wallstreetbets \u00b7 ranked by hype',
    loadingText: 'scraping WSB...',
    postsLabel: 'mentions',
    likesLabel: 'upvotes',
    topPostsTitle: 'Top threads by upvotes',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
  },
};

export const MemeBets: React.FC<Props> = ({ bets, loading, error, onAddTicker, existingSymbols, source }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const cfg = CONFIG[source];

  if (loading) {
    return (
      <section className={`meme-section meme-${source}`}>
        <div className="meme-header">
          <div>
            <h2 className="meme-title">{cfg.icon}{cfg.title}</h2>
            <span className="meme-subtitle">{cfg.loadingText}</span>
          </div>
        </div>
        <div className="meme-loading">
          <div className="loading-spinner" />
        </div>
      </section>
    );
  }

  if (error || bets.length === 0) {
    return (
      <section className={`meme-section meme-${source}`}>
        <div className="meme-header">
          <div>
            <h2 className="meme-title">{cfg.icon}{cfg.title}</h2>
            <span className="meme-subtitle">{cfg.subtitle}</span>
          </div>
        </div>
        <div className="meme-empty">
          {error === 'needs_config'
            ? 'Add REDDIT_CLIENT_ID & REDDIT_CLIENT_SECRET env vars to enable WSB scraping'
            : error
              ? 'Reddit API unavailable — retrying in 5m'
              : 'No trending tickers right now'}
        </div>
      </section>
    );
  }

  return (
    <section className={`meme-section meme-${source}`}>
      <div className="meme-header">
        <div>
          <h2 className="meme-title">
            {cfg.icon}
            {cfg.title}
          </h2>
          <span className="meme-subtitle">{cfg.subtitle}</span>
        </div>
      </div>

      <div className="meme-list">
        {bets.map((bet, i) => {
          const isExpanded = expandedIdx === i;
          const isTracked = existingSymbols.includes(bet.symbol);
          const isUp = bet.change >= 0;

          return (
            <div
              key={bet.symbol}
              className={`meme-row ${isExpanded ? 'expanded' : ''}`}
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
            >
              <div className="meme-row-main">
                <span className="meme-rank">#{bet.rank}</span>

                <div className="meme-row-info">
                  <div className="meme-row-top">
                    <a
                      className="meme-symbol meme-ticker-link"
                      href={`https://www.google.com/finance/quote/${bet.symbol}:NASDAQ`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                    >
                      ${bet.symbol}
                    </a>
                    <span className={`pill pill-${bet.sentiment}`}>{bet.sentiment}</span>
                  </div>
                  <span className="meme-name">{bet.name}</span>
                </div>

                <div className="meme-row-chart">
                  {bet.chart.length > 1 && (
                    <Sparkline
                      points={bet.chart}
                      previousClose={bet.previousClose}
                    />
                  )}
                </div>

                <div className="meme-row-price">
                  {bet.price > 0 && (
                    <>
                      <span className="meme-price">${bet.price.toFixed(2)}</span>
                      <span className={`meme-delta ${isUp ? 'up' : 'dn'}`}>
                        {isUp ? '+' : ''}{bet.changePercent.toFixed(2)}%
                      </span>
                    </>
                  )}
                </div>

                <div className="meme-row-volume">
                  <div className="meme-bar-wrap">
                    <div className="meme-bar">
                      <div
                        className="meme-bar-fill"
                        style={{ width: `${bet.bullPct}%` }}
                      />
                    </div>
                    <span className="meme-bar-label">{bet.bullPct}% bull</span>
                  </div>
                </div>

                <button
                  className={`meme-add ${isTracked ? 'tracked' : ''}`}
                  onClick={(e) => { e.stopPropagation(); if (!isTracked) onAddTicker(bet.symbol); }}
                  disabled={isTracked}
                  title={isTracked ? 'Already tracking' : `Add ${bet.symbol} to watchlist`}
                >
                  {isTracked ? '...' : '+'}
                </button>
              </div>

              {/* Engagement stats inline */}
              <div className="meme-row-engagement">
                <span className="meme-eng-item" title="Messages / mentions">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z"/></svg>
                  {bet.messageCount} {cfg.postsLabel}
                </span>
                <span className="meme-eng-item" title="Total likes/upvotes">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.314C3.562-1.627 0 3.28 0 6.3c0 3.02 3.562 6.3 8 9.7 4.438-3.4 8-6.68 8-9.7 0-3.02-3.562-7.927-8-4.986z"/></svg>
                  {bet.totalLikes} {cfg.likesLabel}
                </span>
                {bet.watchers != null && bet.watchers > 0 && (
                  <span className="meme-eng-item" title="StockTwits watchers">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4.5 3 1.7 5.1.3 8c1.4 2.9 4.2 5 7.7 5s6.3-2.1 7.7-5c-1.4-2.9-4.2-5-7.7-5zm0 8a3 3 0 110-6 3 3 0 010 6z"/></svg>
                    {(bet.watchers / 1000).toFixed(1)}K watching
                  </span>
                )}
              </div>

              {isExpanded && (
                <div className="meme-detail">
                  {bet.summary && (
                    <p className="meme-summary">{bet.summary}</p>
                  )}

                  <div className="meme-meta">
                    {bet.marketCap && <span>Mkt Cap: ${bet.marketCap}</span>}
                    {bet.beta != null && <span>Beta: {bet.beta.toFixed(2)}</span>}
                    {bet.peRatio != null && <span>P/E: {bet.peRatio.toFixed(1)}</span>}
                    <span>Hype Score: {bet.trendScore.toFixed(1)}</span>
                  </div>

                  {bet.topMessages.length > 0 && (
                    <div className="meme-chatter">
                      <div className="feed-title">{cfg.topPostsTitle}</div>
                      {bet.topMessages.map((msg, j) => (
                        <a
                          key={j}
                          className="meme-msg"
                          href={msg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className={`feed-dot dot-${msg.sentiment}`} />
                          <span className="meme-msg-text">{msg.body}</span>
                          {msg.likes > 0 && (
                            <span className="meme-msg-likes">+{msg.likes}</span>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
