import React, { useState } from 'react';
import { StockData } from '../types';
import { Sparkline } from './Sparkline';

interface Props {
  data: StockData;
  onRemove: (symbol: string) => void;
}

export const StockCard: React.FC<Props> = ({ data, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const { quote, sentiment } = data;
  const isPositive = quote.change >= 0;

  // After-hours swing detection for row tinting
  const ahPct = quote.afterHoursPercent ?? 0;
  const hasSwing = Math.abs(ahPct) >= 0.5;
  const swingClass = hasSwing ? (ahPct > 0 ? 'swing-up' : 'swing-dn') : '';

  const fmtPct = (v: number | undefined) => {
    if (v == null) return '--';
    const s = v >= 0 ? '+' : '';
    return `${s}${v.toFixed(1)}%`;
  };

  return (
    <div className={`stock-row ${expanded ? 'expanded' : ''} ${swingClass}`} onClick={() => setExpanded(!expanded)}>
      {/* Main row: symbol | chart | price */}
      <div className="stock-row-main">
        <div className="stock-row-left">
          <span className="stock-ticker">{quote.symbol}</span>
          <span className="stock-company">{quote.name}</span>
        </div>

        <div className="stock-row-chart">
          {quote.chart && quote.chart.length > 1 && (
            <Sparkline
              points={quote.chart}
              previousClose={quote.previousClose ?? quote.price}
            />
          )}
        </div>

        <div className="stock-row-right">
          <span className="stock-price">${quote.price.toFixed(2)}</span>
          <span className={`stock-delta ${isPositive ? 'up' : 'dn'}`}>
            {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
          </span>
        </div>

        <button
          className="row-remove"
          onClick={(e) => { e.stopPropagation(); onRemove(quote.symbol); }}
        >
          &times;
        </button>
      </div>

      {/* Data indicators row */}
      <div className="stock-row-indicators">
        <span className={`ind-chip ${(quote.weekChange ?? 0) >= 0 ? 'ind-up' : 'ind-dn'}`}>
          1W {fmtPct(quote.weekChange)}
        </span>
        <span className={`ind-chip ${(quote.monthChange ?? 0) >= 0 ? 'ind-up' : 'ind-dn'}`}>
          1M {fmtPct(quote.monthChange)}
        </span>
        {hasSwing && (
          <span className={`ind-chip ${ahPct > 0 ? 'ind-up' : 'ind-dn'}`}>
            AH {fmtPct(ahPct)}
          </span>
        )}
        {quote.signals?.map(sig => (
          <span key={sig} className={`ind-chip ind-signal ${sig.includes('UP') || sig.includes('HIGH') ? 'ind-up' : sig.includes('DN') || sig.includes('LOW') ? 'ind-dn' : 'ind-neutral'}`}>
            {sig}
          </span>
        ))}
      </div>

      {/* Sentiment pill row */}
      {sentiment && (
        <div className="stock-row-sentiment">
          <span className={`pill pill-${sentiment.sentiment}`}>
            {sentiment.sentiment}
          </span>
          <span className="sentiment-text">{sentiment.summary}</span>
        </div>
      )}
      {!sentiment && (
        <div className="stock-row-sentiment">
          <span className="sentiment-text loading-pulse">loading sentiment...</span>
        </div>
      )}

      {/* Expanded detail panel */}
      {expanded && (
        <div className="stock-detail">
          <div className="detail-stats">
            {quote.open != null && <Stat label="Open" value={`$${quote.open.toFixed(2)}`} />}
            {quote.high != null && <Stat label="High" value={`$${quote.high.toFixed(2)}`} />}
            {quote.low != null && <Stat label="Low" value={`$${quote.low.toFixed(2)}`} />}
            {quote.previousClose != null && <Stat label="Prev Close" value={`$${quote.previousClose.toFixed(2)}`} />}
            {quote.volume && <Stat label="Vol" value={quote.volume} />}
            {quote.marketCap && <Stat label="Mkt Cap" value={quote.marketCap} />}
            {quote.fiftyTwoWeekHigh != null && <Stat label="52W H" value={`$${quote.fiftyTwoWeekHigh.toFixed(2)}`} />}
            {quote.fiftyTwoWeekLow != null && <Stat label="52W L" value={`$${quote.fiftyTwoWeekLow.toFixed(2)}`} />}
          </div>

          {sentiment && sentiment.sources.length > 0 && (
            <div className="detail-feed">
              <div className="feed-title">Recent chatter</div>
              {sentiment.sources.slice(0, 6).map((src, i) => (
                <div key={i} className={`feed-item feed-${src.sentiment}`}>
                  <span className={`feed-badge badge-${src.type}`}>{src.type === 'stocktwits' ? 'ST' : src.type === 'reddit' ? 'WSB' : 'News'}</span>
                  {src.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="feed-text"
                    >
                      {src.title.length > 120 ? src.title.substring(0, 117) + '...' : src.title}
                    </a>
                  ) : (
                    <span className="feed-text">
                      {src.title.length > 120 ? src.title.substring(0, 117) + '...' : src.title}
                    </span>
                  )}
                  <span className={`feed-dot dot-${src.sentiment}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="stat">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
  </div>
);
