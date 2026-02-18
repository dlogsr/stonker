import React, { useState } from 'react';
import { MemeBet } from '../hooks/useMemeBets';

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

                <div className="meme-row-stats">
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

              {isExpanded && (
                <div className="meme-detail">
                  {bet.summary && (
                    <p className="meme-summary">{bet.summary}</p>
                  )}

                  <div className="meme-meta">
                    <span>Watchers: {(bet.watchers / 1000).toFixed(1)}K</span>
                    {bet.marketCap && <span>Mkt Cap: ${bet.marketCap}</span>}
                    {bet.beta != null && <span>Beta: {bet.beta.toFixed(2)}</span>}
                    {bet.peRatio != null && <span>P/E: {bet.peRatio.toFixed(1)}</span>}
                    <span>Hype: {bet.trendScore.toFixed(1)}</span>
                  </div>

                  {bet.topMessages.length > 0 && (
                    <div className="meme-chatter">
                      {bet.topMessages.map((msg, j) => (
                        <div key={j} className="meme-msg">
                          <span className={`feed-dot dot-${msg.sentiment}`} />
                          <span className="meme-msg-text">{msg.body}</span>
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
