import { useState, useRef } from 'react';
import { api } from '../api';
import { timeAgo, getMastery, daysUntil, downloadJson } from '../utils/format';

export default function Dashboard({
  topics, stats, backendOnline, reload,
  onOpenTopic, onQuiz, onReviewTopic, onReviewAll, onCreate, onDeleteTopic,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const searchTimer = useRef(null);

  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [examEditingId, setExamEditingId] = useState(null);
  const [examDraft, setExamDraft] = useState('');
  const [importError, setImportError] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const totalDue = topics.reduce((sum, t) => sum + (t.due_count || 0), 0);
  const topicsWithDue = topics.filter(t => t.due_count > 0).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  function handleSearch(q) {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        setSearchResults(await api.get(`/api/search?q=${encodeURIComponent(q)}`));
      } catch { /* results simply stay stale while typing */ }
    }, 300);
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults(null);
  }

  async function saveRename(id) {
    if (!renameDraft.trim()) return;
    await api.patch(`/api/topics/${id}`, { name: renameDraft });
    setRenamingId(null);
    reload();
  }

  async function saveExamDate(id) {
    await api.patch(`/api/topics/${id}`, { exam_date: examDraft || null });
    setExamEditingId(null);
    reload();
  }

  async function exportTopic(id, name) {
    const data = await api.get(`/api/topics/${id}`);
    downloadJson(
      { name: data.topic.name, flashcards: data.flashcards.map(c => ({ question: c.question, answer: c.answer })) },
      `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`,
    );
  }

  async function exportAll() {
    const data = await api.get('/api/export');
    downloadJson(data, `recall-backup-${new Date().toLocaleDateString('en-CA')}.json`);
  }

  async function importTopic(file) {
    setImportError('');
    try {
      const data = JSON.parse(await file.text());
      if (!data.name || !Array.isArray(data.flashcards) || data.flashcards.length === 0) {
        setImportError('Invalid file. Make sure it is a Recall export.');
        return;
      }
      await api.post('/api/topics', { name: data.name, flashcards: data.flashcards });
      reload();
    } catch (err) {
      setImportError(err.message || 'Could not read the file. Make sure it is a valid JSON file.');
    }
  }

  return (
    <div className="screen-pad">
      <div className="dash-header">
        <div>
          <div className="dash-date">{today}</div>
          <h1 className="dash-greeting">{greeting}</h1>
          <p className="dash-sub">
            You have {topics.length} topic{topics.length !== 1 ? 's' : ''}.
            {stats.todayCount > 0 && ` ${stats.todayCount} card${stats.todayCount !== 1 ? 's' : ''} reviewed today.`}
          </p>
        </div>
        <div className="dash-actions">
          <button className="import-btn" onClick={exportAll} title="Download a backup of all your topics and cards">Export all</button>
          <label className="import-btn" title="Import a topic from a .json file">
            Import topic
            <input
              type="file" accept=".json" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) importTopic(e.target.files[0]); e.target.value = ''; }}
            />
          </label>
          <button className="accent-btn" onClick={onCreate}><span className="plus">+</span> New topic</button>
        </div>
      </div>

      {!backendOnline && (
        <div className="offline-banner">
          Cannot reach the backend. Make sure it is running with <code>pnpm dev</code> and refresh.
        </div>
      )}

      {importError && <div className="error-box">{importError}</div>}

      {totalDue > 0 && !bannerDismissed && (
        <div className="due-banner">
          <span>
            You have <strong>{totalDue} card{totalDue !== 1 ? 's' : ''}</strong> due
            across {topicsWithDue} topic{topicsWithDue !== 1 ? 's' : ''} today.
          </span>
          <div className="due-banner-actions">
            <button className="review-all-btn" onClick={onReviewAll}>Review all now</button>
            <button className="banner-dismiss" onClick={() => setBannerDismissed(true)}>x</button>
          </div>
        </div>
      )}

      <div className="search-wrap">
        <input
          className="search-input"
          placeholder="Search topics and cards..."
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
        />
        {searchQuery && <button className="search-clear" onClick={clearSearch}>x</button>}
      </div>

      {searchResults && (
        <div className="search-results">
          {searchResults.topics.length === 0 && searchResults.cards.length === 0 && (
            <p className="muted">No results for "{searchQuery}"</p>
          )}
          {searchResults.topics.length > 0 && (
            <>
              <div className="search-group-label">Topics</div>
              {searchResults.topics.map(t => (
                <button key={t.id} className="search-result-row" onClick={() => { clearSearch(); onOpenTopic(t.id); }}>
                  <span className="sr-title">{t.name}</span>
                </button>
              ))}
            </>
          )}
          {searchResults.cards.length > 0 && (
            <>
              <div className="search-group-label">Cards</div>
              {searchResults.cards.map(c => (
                <button key={c.id} className="search-result-row" onClick={() => { clearSearch(); onOpenTopic(c.topic_id); }}>
                  <span className="sr-topic">{c.topic_name}</span>
                  <span className="sr-title">{c.question}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {!searchResults && (
        <>
          <div className="section-title">Your topics</div>
          {topics.length === 0 ? (
            <p className="muted">No topics yet. Create your first one above.</p>
          ) : (
            <div className="topics-grid">
              {topics.map(t => {
                const mastery = getMastery(t);
                const examDays = daysUntil(t.exam_date);
                return (
                  <div key={t.id} className="topic-card">
                    <div className="topic-card-header">
                      {renamingId === t.id ? (
                        <input
                          className="rename-input" value={renameDraft} autoFocus
                          onChange={e => setRenameDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(t.id); if (e.key === 'Escape') setRenamingId(null); }}
                        />
                      ) : (
                        <h3 className="topic-title">{t.name}</h3>
                      )}
                      <div className="topic-card-right">
                        <span className="topic-count">{t.card_count} cards</span>
                        <div className="topic-menu-wrap">
                          <button
                            className="topic-menu-btn"
                            onClick={() => { setMenuOpenId(menuOpenId === t.id ? null : t.id); setRenamingId(null); setExamEditingId(null); }}
                          >&#8943;</button>
                          {menuOpenId === t.id && (
                            <div className="topic-menu">
                              <button className="menu-item" onClick={() => { setRenamingId(t.id); setRenameDraft(t.name); setMenuOpenId(null); }}>Rename</button>
                              <button className="menu-item" onClick={() => { setExamEditingId(t.id); setExamDraft(t.exam_date || ''); setMenuOpenId(null); }}>Exam date</button>
                              <button className="menu-item" onClick={() => { exportTopic(t.id, t.name); setMenuOpenId(null); }}>Export</button>
                              <button className="menu-item menu-item-danger" onClick={() => { setMenuOpenId(null); onDeleteTopic(t.id, t.name); }}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {examEditingId === t.id && (
                      <div className="exam-edit-row">
                        <input
                          type="date" className="field-input exam-date-input" value={examDraft}
                          min={new Date().toLocaleDateString('en-CA')}
                          onChange={e => setExamDraft(e.target.value)}
                        />
                        <button className="cancel-btn" onClick={() => setExamEditingId(null)}>Cancel</button>
                        {t.exam_date && <button className="cancel-btn" onClick={() => { setExamDraft(''); saveExamDate(t.id); }}>Clear</button>}
                        <button className="accent-btn compact-btn" onClick={() => saveExamDate(t.id)}>Save</button>
                      </div>
                    )}

                    <div className="mastery-row">
                      <div className="mastery-bar-wrap">
                        <div className="mastery-bar-fill" style={{ width: mastery !== null ? `${mastery}%` : '0%' }} />
                      </div>
                      <span className="mastery-label">{mastery === null ? 'Not started' : `${mastery}% mastery`}</span>
                    </div>

                    <div className="topic-card-footer">
                      <span className="topic-meta">{timeAgo(t.created_at)}</span>
                      <div className="topic-badges">
                        {examDays !== null && examDays >= 0 && (
                          <span className="exam-badge">{examDays === 0 ? 'Exam today' : `Exam in ${examDays}d`}</span>
                        )}
                        {t.due_count > 0 && <span className="due-badge">{t.due_count} due</span>}
                      </div>
                    </div>

                    <div className="topic-actions">
                      <button className="study-btn" onClick={() => onOpenTopic(t.id)}>Study</button>
                      {t.due_count > 0 && <button className="review-btn" onClick={() => onReviewTopic(t.id)}>Review</button>}
                      <button className="quiz-outline-btn" onClick={() => onQuiz(t.id)}>Quiz</button>
                    </div>

                    {renamingId === t.id && (
                      <div className="rename-actions">
                        <button className="cancel-btn" onClick={() => setRenamingId(null)}>Cancel</button>
                        <button className="accent-btn compact-btn" onClick={() => saveRename(t.id)}>Save</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {stats.weakCards.length > 0 && (
            <>
              <div className="section-title section-gap">Cards to focus on</div>
              <div className="weak-cards-list">
                {stats.weakCards.map(card => (
                  <div key={card.id} className="weak-card-row">
                    <div className="weak-card-info">
                      <span className="weak-card-topic">{card.topic_name}</span>
                      <span className="weak-card-question">{card.question}</span>
                    </div>
                    <div className="weak-card-bar-wrap">
                      <div
                        className="weak-card-bar-fill"
                        style={{ width: `${Math.min(100, ((card.easiness_factor - 1.3) / (2.5 - 1.3)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
