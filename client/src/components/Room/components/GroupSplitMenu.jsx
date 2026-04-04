import { useState, useRef, useEffect } from "react";

/**
 * Given the number of cards, returns the valid split configurations.
 * Each config is an array of group sizes that sum to `count`.
 */
function getSplitOptions(count) {
  // `count` is the number of KEEP cards. Because `hasDrawn` determines the discard slot,
  // `keepCards` is ALWAYS the base hand size (7, 10, or 13) whether drawn or not.
  const MAP = {
    7:  [[3, 4]],
    10: [[3, 3, 4], [5, 5]],
    13: [[3, 3, 3, 4], [3, 5, 5], [4, 4, 5], [6, 7]],
  };
  return MAP[count] || [];
}



const GroupSplitMenu = ({ cardCount, activeSplit, onApplySplit }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const options = getSplitOptions(cardCount);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // If no split options for this count, render nothing
  if (options.length === 0) return null;

  const handleSelect = (groups) => {
    const key = groups.join("-");
    // Toggle: clicking the active split removes it
    if (activeSplit === key) {
      onApplySplit(null);
    } else {
      onApplySplit(key);
    }
    setOpen(false);
  };

  const hasActive = activeSplit != null;

  return (
    <div className={`gsm-wrap${hasActive ? " gsm-wrap--active" : ""}`} ref={menuRef}>
      <button
        className={`gsm-trigger${hasActive ? " gsm-trigger--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Group cards"
      >
        <span className="gsm-trigger-label">Groups</span>
        {/* <span className={`gsm-trigger-caret${open ? " gsm-trigger-caret--open" : ""}`}>▾</span> */}
      </button>

      {open && (
        <div className="gsm-menu">
          <p className="gsm-menu-hint">Split cards into groups</p>
          {options.map((groups) => {
            const key = groups.join("-");
            const isActive = activeSplit === key;
            return (
              <button
                key={key}
                className={`gsm-option${isActive ? " gsm-option--active" : ""}`}
                onClick={() => handleSelect(groups)}
              >
                <span className="gsm-option-label">{groups.join(" + ")}</span>
                {isActive && <span className="gsm-option-check">✓</span>}
              </button>
            );
          })}
          {hasActive && (
            <button className="gsm-clear" onClick={() => { onApplySplit(null); setOpen(false); }}>
              Clear grouping
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupSplitMenu;
export { getSplitOptions };
