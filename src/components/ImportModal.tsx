import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string) => number;
}

export const ImportModal: React.FC<Props> = ({ isOpen, onClose, onImport }) => {
  const [text, setText] = useState('');
  const [result, setResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImport = () => {
    const count = onImport(text);
    if (count > 0) {
      setResult(`Imported ${count} ticker${count > 1 ? 's' : ''}`);
      setText('');
      setTimeout(() => {
        setResult(null);
        onClose();
      }, 1500);
    } else {
      setResult('No valid tickers found. Use format: AAPL, GOOGL, MSFT');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import Watchlist</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <p className="modal-description">
            Paste your tickers from Google Finance. Supports formats:
          </p>
          <ul className="modal-formats">
            <li>Comma-separated: <code>AAPL, GOOGL, MSFT</code></li>
            <li>One per line: <code>AAPL<br/>GOOGL<br/>MSFT</code></li>
            <li>Google Finance format: <code>NASDAQ:AAPL</code></li>
          </ul>
          <p className="modal-hint">
            To export from Google Finance: open your watchlist, select all tickers, and copy.
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste tickers here..."
            className="modal-textarea"
            rows={6}
          />
          {result && (
            <div className={`modal-result ${result.startsWith('No') ? 'error' : 'success'}`}>
              {result}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={!text.trim()}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
};
