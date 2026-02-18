import React, { useState } from 'react';
import { StockData } from '../types';

interface Props {
  data: StockData;
  onRemove: (symbol: string) => void;
}

export const StockCard: React.FC<Props> = ({ data, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const { quote, sentiment } = data;
  const isPositive = quote.change >= 0;

  return (
    <div className="stock-card" onClick={() => setExpanded(!expanded)}>
      <div className="stock-card-header">
        <div className="stock-card-left">
          <div className="stock-symbol">{quote.symbol}</div>
          <div className="stock-name">{quote.name}</div>
        </div>
        <div className="stock-card-right">
          <div className="stock-price">${quote.price.toFixed(2)}</div>
          <div className={`stock-change ${isPositive ? 'positive' : 'negative'}`}>
            {isPositive ? '+' : ''}{quote.change.toFixed(2)} ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
          </div>
        </div>
        <button
          className="remove-btn"
          onClick={(e) => { e.stopPropagation(); onRemove(quote.symbol); }}
          title="Remove from watchlist"
        >
          &times;
        </button>
      </div>

      {sentiment && (
        <div className={`sentiment-row sentiment-${sentiment.sentiment}`}>
          <span className="sentiment-badge">{sentiment.sentiment}</span>
          <span className="sentiment-summary">{sentiment.summary}</span>
        </div>
      )}

      {!sentiment && (
        <div className="sentiment-row sentiment-loading">
          <span className="sentiment-summary loading-text">Loading sentiment...</span>
        </div>
      )}

      {expanded && (
        <div className="stock-details">
          <div className="detail-grid">
            {quote.open != null && (
              <div className="detail-item">
                <span className="detail-label">Open</span>
                <span className="detail-value">${quote.open.toFixed(2)}</span>
              </div>
            )}
            {quote.high != null && (
              <div className="detail-item">
                <span className="detail-label">High</span>
                <span className="detail-value">${quote.high.toFixed(2)}</span>
              </div>
            )}
            {quote.low != null && (
              <div className="detail-item">
                <span className="detail-label">Low</span>
                <span className="detail-value">${quote.low.toFixed(2)}</span>
              </div>
            )}
            {quote.previousClose != null && (
              <div className="detail-item">
                <span className="detail-label">Prev Close</span>
                <span className="detail-value">${quote.previousClose.toFixed(2)}</span>
              </div>
            )}
            {quote.marketCap && (
              <div className="detail-item">
                <span className="detail-label">Mkt Cap</span>
                <span className="detail-value">{quote.marketCap}</span>
              </div>
            )}
            {quote.volume && (
              <div className="detail-item">
                <span className="detail-label">Volume</span>
                <span className="detail-value">{quote.volume}</span>
              </div>
            )}
            {quote.fiftyTwoWeekHigh != null && (
              <div className="detail-item">
                <span className="detail-label">52W High</span>
                <span className="detail-value">${quote.fiftyTwoWeekHigh.toFixed(2)}</span>
              </div>
            )}
            {quote.fiftyTwoWeekLow != null && (
              <div className="detail-item">
                <span className="detail-label">52W Low</span>
                <span className="detail-value">${quote.fiftyTwoWeekLow.toFixed(2)}</span>
              </div>
            )}
          </div>

          {sentiment && sentiment.sources.length > 0 && (
            <div className="sources-section">
              <div className="sources-title">Recent signals</div>
              {sentiment.sources.slice(0, 5).map((source, i) => (
                <div key={i} className={`source-item source-${source.sentiment}`}>
                  <span className="source-type">{source.type}</span>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="source-title"
                    >
                      {source.title.length > 100
                        ? source.title.substring(0, 97) + '...'
                        : source.title}
                    </a>
                  ) : (
                    <span className="source-title">
                      {source.title.length > 100
                        ? source.title.substring(0, 97) + '...'
                        : source.title}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
