import React, { useState } from 'react';
import { MemeBet } from '../hooks/useMemeBets';
import { Sparkline } from './Sparkline';

interface Props {
  bets: MemeBet[];
  loading: boolean;
  onAddTicker: (symbol: string) => void;
  existingSymbols: string[];
}

export const MemeBets: React.FC<Props> = ({ bets, loading, onAddTicker, existingSymbols }) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (loading) {
    return (
      <section className="meme-section">
        <div className="meme-header">
          <h2 className="meme-title">CRAZY MEME BETS</h2>
          <span className="meme-subtitle">loading trending...</span>
        </div>
        <div className="meme-loading">
          <div className="loading-spinner" />
        </div>
      </section>
    );
  }

  if (bets.length === 0) return null;

  return (
    <section className="meme-section">
      <div className="meme-header">
        <div>
          <h2 className="meme-title">CRAZY MEME BETS</h2>
          <span className="meme-subtitle">Trending on StockTwits &amp; WSB &middot; ranked by hype</span>
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
                    <span className="meme-symbol">${bet.symbol}</span>
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
                <span className="meme-eng-item" title="Messages in last batch">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z"/></svg>
                  {bet.messageCount} posts
                </span>
                <span className="meme-eng-item" title="Total likes/upvotes across posts">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.314C3.562-1.627 0 3.28 0 6.3c0 3.02 3.562 6.3 8 9.7 4.438-3.4 8-6.68 8-9.7 0-3.02-3.562-7.927-8-4.986z"/></svg>
                  {bet.totalLikes} likes
                </span>
                <span className="meme-eng-item" title="StockTwits watchers">
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3C4.5 3 1.7 5.1.3 8c1.4 2.9 4.2 5 7.7 5s6.3-2.1 7.7-5c-1.4-2.9-4.2-5-7.7-5zm0 8a3 3 0 110-6 3 3 0 010 6z"/></svg>
                  {(bet.watchers / 1000).toFixed(1)}K watching
                </span>
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
                      <div className="feed-title">Top posts by upvotes</div>
                      {bet.topMessages.map((msg, j) => (
                        <div key={j} className="meme-msg">
                          <span className={`feed-dot dot-${msg.sentiment}`} />
                          <span className="meme-msg-text">{msg.body}</span>
                          {msg.likes > 0 && (
                            <span className="meme-msg-likes">+{msg.likes}</span>
                          )}
                        </div>
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
