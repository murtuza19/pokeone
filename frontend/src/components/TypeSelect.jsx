import { useState, useRef, useEffect } from 'react';

const TYPES = ['Fire', 'Water', 'Electric', 'Grass', 'Psychic', 'Fighting'];

const TYPE_COLORS = {
  Fire: '#ff6b35',
  Water: '#3692dc',
  Electric: '#ffcb05',
  Grass: '#5dbd63',
  Psychic: '#a855f7',
  Fighting: '#f97316',
};

export function TypeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="type-select" ref={ref}>
      <button
        type="button"
        className="type-select-trigger"
        onClick={() => setOpen(!open)}
        style={{ '--type-color': TYPE_COLORS[value] || TYPE_COLORS.Electric }}
      >
        <span className="type-select-value">{value}</span>
        <span className="type-select-arrow">{open ? '▲' : '▾'}</span>
      </button>
      {open && (
        <div className="type-select-dropdown">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`type-select-option ${t === value ? 'selected' : ''}`}
              style={{ '--type-color': TYPE_COLORS[t] }}
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
