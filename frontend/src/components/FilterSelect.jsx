import { useState, useRef, useEffect } from 'react';

export function FilterSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = options.find((o) => o.value === value);
  const displayValue = selectedOpt?.label ?? value ?? placeholder;
  const triggerColor = selectedOpt?.color;

  return (
    <div className="filter-select-wrap" ref={ref}>
      <button
        type="button"
        className="filter-select-trigger"
        style={triggerColor ? { '--type-color': triggerColor } : {}}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="filter-select-value">{displayValue}</span>
        <span className="filter-select-arrow">{open ? '▲' : '▾'}</span>
      </button>
      {open && (
        <div className="filter-select-dropdown" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`filter-select-option ${opt.value === value ? 'selected' : ''} ${opt.color ? 'has-color' : ''}`}
              style={opt.color ? { '--option-color': opt.color } : {}}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
