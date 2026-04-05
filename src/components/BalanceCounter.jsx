import { useState } from 'react';
import { useStore } from '../store';
import './BalanceCounter.css';

export default function BalanceCounter() {
  const { balance, setBalance } = useStore();
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const handleClick = () => {
    setInputVal(String(balance));
    setEditing(true);
  };

  const handleCommit = () => {
    const val = parseFloat(inputVal);
    if (!isNaN(val)) setBalance(val);
    setEditing(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') handleCommit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className={`balance${editing ? ' balance--editing' : ''}`} onClick={!editing ? handleClick : undefined} title="Click to edit balance">
      {editing ? (
        <input
          className="balance__input"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKey}
          autoFocus
          type="number"
        />
      ) : (
        <span className={`balance__amount ${balance < 0 ? 'balance__amount--negative' : ''}`}>
          ${balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      )}
    </div>
  );
}
