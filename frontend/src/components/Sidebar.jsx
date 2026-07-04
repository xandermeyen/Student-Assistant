import { getLastSevenDays } from '../utils/format';

export default function Sidebar({ open, onToggle, isDashboard, onDashboard, onNewTopic, stats, theme, onToggleTheme }) {
  const weekDays = getLastSevenDays();

  return (
    <aside className={`sidebar ${open ? '' : 'sidebar-collapsed'}`}>
      <div className="brand">
        <button className="burger" onClick={onToggle} title="Toggle sidebar">
          <span /><span /><span />
        </button>
        {open && <span className="brand-name">Recall</span>}
      </div>

      {open && (
        <>
          <button className="new-topic-btn" onClick={onNewTopic}>
            <span className="plus">+</span> New topic
          </button>

          <nav className="sidebar-nav">
            <button className={`nav-item ${isDashboard ? 'active' : ''}`} onClick={onDashboard}>
              Dashboard
            </button>
          </nav>

          <div className="streak-widget">
            <div className="streak-label">Study streak</div>
            <div className="streak-row">
              <span className="streak-num">{stats.streak}</span>
              <span className="streak-unit">days in a row</span>
            </div>
            <div className="streak-days">
              {weekDays.map(({ dateStr, label }, i) => (
                <div key={i} className={`streak-day ${stats.reviewedDays.includes(dateStr) ? 'on' : 'off'}`}>
                  {label}
                </div>
              ))}
            </div>
          </div>

          <button className="theme-toggle" onClick={onToggleTheme}>
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </>
      )}
    </aside>
  );
}
