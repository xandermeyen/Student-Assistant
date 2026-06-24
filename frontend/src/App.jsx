import { useState, useEffect, useRef } from 'react';

const STOP_WORDS = new Set(['the','a','an','is','are','was','were','of','in','to','for','on','with','and','or','but','not','this','that','it','its','by','at','be','has','have','had','can','will','from','they','their','which','also','when','where','how','what','who']);

function generateFillBlank(card) {
  const words = card.answer.split(/\s+/);
  const candidates = words.filter(w => {
    const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return clean.length > 4 && !STOP_WORDS.has(clean);
  });
  if (!candidates.length) return null;
  const target = candidates.reduce((best, w) => w.length > best.length ? w : best, '');
  const cleanTarget = target.replace(/[^a-zA-Z0-9]/g, '');
  return { blanked: card.answer.replace(target, '_____'), target: cleanTarget };
}

function buildMixedQuiz(cards) {
  if (cards.length < 2) return [];
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
  const questions = shuffle(cards).slice(0, Math.min(6, cards.length));
  return questions.map((card, _, arr) => {
    const fb = generateFillBlank(card);
    // Alternate between fill-in-the-blank and multiple choice when possible
    if (fb && Math.random() > 0.5) {
      return { type: 'fillblank', question: card.question, blanked: fb.blanked, target: fb.target, fullAnswer: card.answer };
    }
    const wrong = shuffle(arr.filter(c => c.id !== card.id).map(c => c.answer)).slice(0, 3);
    const options = shuffle([card.answer, ...wrong]);
    return { type: 'mc', question: card.question, options, correctIndex: options.indexOf(card.answer) };
  });
}

function timeAgo(dateStr) {
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const diff = Math.floor((Date.now() - new Date(normalized)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function getLastSevenDays() {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { dateStr: d.toLocaleDateString('en-CA'), label: labels[d.getDay()] };
  });
}

// Mastery %: easiness factor 1.3 = 0%, 2.5 = 100%
function getMastery(topic) {
  if (!topic.reviewed_count || topic.reviewed_count === 0) return null;
  return Math.round(Math.min(100, Math.max(0, ((topic.avg_ef - 1.3) / (2.5 - 1.3)) * 100)));
}

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [topics, setTopics] = useState([]);
  const [stats, setStats] = useState({ streak: 0, reviewedDays: [], weakCards: [], todayCount: 0 });
  const [activeTopic, setActiveTopic] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const searchTimer = useRef(null);

  // Flashcard
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledCards, setShuffledCards] = useState([]);

  // Card editor
  const [editCards, setEditCards] = useState([]);
  const [editingCardId, setEditingCardId] = useState(null);
  const [editDraft, setEditDraft] = useState({ question: '', answer: '' });
  const [newCardQ, setNewCardQ] = useState('');
  const [newCardA, setNewCardA] = useState('');
  const [addingCard, setAddingCard] = useState(false);

  // Create
  const [inputMode, setInputMode] = useState('text');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [pdfStatus, setPdfStatus] = useState('idle');
  const [pdfError, setPdfError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [genStatus, setGenStatus] = useState('idle');
  const [genError, setGenError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  // Quiz
  const [quiz, setQuiz] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelected, setQuizSelected] = useState(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Review
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [reviewResults, setReviewResults] = useState({ correct: 0, incorrect: 0 });
  const [reviewDone, setReviewDone] = useState(false);

  // Open practice
  const [practiceQueue, setPracticeQueue] = useState([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceChecked, setPracticeChecked] = useState(false);
  const [practiceResults, setPracticeResults] = useState({ correct: 0, incorrect: 0 });
  const [practiceDone, setPracticeDone] = useState(false);

  // Quiz fill-in-the-blank
  const [fillBlankInput, setFillBlankInput] = useState('');
  const [fillBlankCorrect, setFillBlankCorrect] = useState(null);

  // Quiz explanation
  const [explanation, setExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  // Topic sharing
  const [importError, setImportError] = useState('');

  // Due banner
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Backend status
  const [backendOnline, setBackendOnline] = useState(true);

  // Topic management
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name, timer }
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (screen === 'dashboard') { loadTopics(); loadStats(); }
  }, [screen]);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => { if (prev <= 1) { clearInterval(cooldownRef.current); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown]);

  async function loadTopics() {
    try {
      const res = await fetch('/api/topics');
      const data = await res.json();
      setTopics(data.topics);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }

  async function loadStats() {
    try { const res = await fetch('/api/stats'); const data = await res.json(); setStats(data); } catch {}
  }

  // Search with 300ms debounce
  function handleSearch(q) {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data);
    }, 300);
  }

  async function openTopic(id) {
    const res = await fetch(`/api/topics/${id}`);
    const data = await res.json();
    setActiveTopic(data);
    setCardIndex(0);
    setFlipped(false);
    setIsShuffled(false);
    setShuffledCards([]);
    setScreen('flashcards');
  }

  async function openEdit(topicData) {
    // Always fetch fresh cards before editing
    const res = await fetch(`/api/topics/${topicData.topic.id}`);
    const data = await res.json();
    setActiveTopic(data);
    setEditCards([...data.flashcards]);
    setEditingCardId(null);
    setNewCardQ('');
    setNewCardA('');
    setAddingCard(false);
    setScreen('edit');
  }

  async function saveCardEdit(cardId) {
    if (!editDraft.question.trim() || !editDraft.answer.trim()) return;
    await fetch(`/api/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft),
    });
    setEditCards(prev => prev.map(c => c.id === cardId ? { ...c, ...editDraft } : c));
    setEditingCardId(null);
  }

  async function deleteCard(cardId) {
    await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
    setEditCards(prev => prev.filter(c => c.id !== cardId));
  }

  async function addCard() {
    if (!newCardQ.trim() || !newCardA.trim()) return;
    const res = await fetch(`/api/topics/${activeTopic.topic.id}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: newCardQ, answer: newCardA }),
    });
    const newCard = await res.json();
    setEditCards(prev => [...prev, newCard]);
    setNewCardQ('');
    setNewCardA('');
    setAddingCard(false);
  }

  function toggleShuffle() {
    const base = activeTopic?.flashcards || [];
    if (!isShuffled) {
      setShuffledCards([...base].sort(() => Math.random() - 0.5));
      setCardIndex(0);
      setFlipped(false);
    }
    setIsShuffled(s => !s);
  }

  async function openReview(id) {
    const res = await fetch(`/api/topics/${id}/due`);
    const data = await res.json();
    setActiveTopic(data);
    setReviewQueue(data.flashcards);
    setReviewIndex(0);
    setReviewFlipped(false);
    setReviewResults({ correct: 0, incorrect: 0 });
    setReviewDone(false);
    setScreen('review');
  }

  async function submitReview(correct) {
    const card = reviewQueue[reviewIndex];
    fetch(`/api/cards/${card.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct }),
    });
    setReviewResults(prev => ({ correct: prev.correct + (correct ? 1 : 0), incorrect: prev.incorrect + (correct ? 0 : 1) }));
    if (reviewIndex >= reviewQueue.length - 1) { setReviewDone(true); }
    else { setReviewIndex(i => i + 1); setReviewFlipped(false); }
  }

  function launchQuiz(topicData) {
    setQuiz(buildMixedQuiz(topicData.flashcards));
    setQuizIndex(0); setQuizSelected(null); setQuizAnswered(false); setQuizScore(0); setQuizFinished(false);
    setFillBlankInput(''); setFillBlankCorrect(null);
    setExplanation(null); setExplanationLoading(false);
    setScreen('quiz');
  }

  function launchOpenPractice(topicData) {
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
    setPracticeQueue(shuffle(topicData.flashcards));
    setPracticeIndex(0);
    setPracticeInput('');
    setPracticeChecked(false);
    setPracticeResults({ correct: 0, incorrect: 0 });
    setPracticeDone(false);
    setScreen('practice');
  }

  async function submitPractice(correct) {
    const card = practiceQueue[practiceIndex];
    fetch(`/api/cards/${card.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct }),
    });
    setPracticeResults(prev => ({ correct: prev.correct + (correct ? 1 : 0), incorrect: prev.incorrect + (correct ? 0 : 1) }));
    if (practiceIndex >= practiceQueue.length - 1) {
      setPracticeDone(true);
    } else {
      setPracticeIndex(i => i + 1);
      setPracticeInput('');
      setPracticeChecked(false);
    }
  }

  async function handlePdfFile(file) {
    if (!file || file.type !== 'application/pdf') { setPdfError('Please upload a PDF file.'); return; }
    setPdfStatus('loading'); setPdfError(''); setDraftText('');
    const form = new FormData();
    form.append('pdf', file);
    try {
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setPdfError(data.error); setPdfStatus('error'); return; }
      setDraftText(data.text); setPdfStatus('idle');
    } catch { setPdfError('Could not read the file. Is the backend running?'); setPdfStatus('error'); }
  }

  function handleDrop(e) { e.preventDefault(); setIsDragging(false); handlePdfFile(e.dataTransfer.files[0]); }

  async function handleGenerate() {
    if (!draftTitle.trim() || !draftText.trim() || cooldown > 0 || genStatus === 'loading') return;
    setGenStatus('loading'); setGenError('');
    try {
      const genRes = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: draftText }) });
      const genData = await genRes.json();
      if (genRes.status === 429) { setGenError(genData.error); setCooldown(60); setGenStatus('error'); return; }
      if (!genRes.ok) { setGenError(genData.error || 'Failed to generate cards.'); setGenStatus('error'); return; }
      const saveRes = await fetch('/api/topics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: draftTitle.trim(), flashcards: genData.flashcards }) });
      const saveData = await saveRes.json();
      setActiveTopic({ topic: { id: saveData.id, name: saveData.name }, flashcards: genData.flashcards });
      setCardIndex(0); setFlipped(false); setIsShuffled(false);
      setDraftTitle(''); setDraftText(''); setGenStatus('idle');
      setScreen('flashcards');
    } catch { setGenError('Something went wrong. Is the backend running?'); setGenStatus('idle'); }
  }

  function softDeleteTopic(id, name) {
    setMenuOpenId(null);
    setTopics(prev => prev.filter(t => t.id !== id)); // optimistic remove
    const timer = setTimeout(async () => {
      await fetch(`/api/topics/${id}`, { method: 'DELETE' });
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ id, name, timer });
  }

  function undoDelete() {
    clearTimeout(pendingDelete.timer);
    setPendingDelete(null);
    loadTopics(); // restore
  }

  async function exportAllData() {
    const res = await fetch('/api/export');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recall-backup-${new Date().toLocaleDateString('en-CA')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  async function renameTopic(id) {
    if (!editingName.trim()) return;
    await fetch(`/api/topics/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editingName }) });
    setEditingId(null); setMenuOpenId(null); loadTopics();
  }

  function goCreate() {
    setGenStatus('idle'); setGenError(''); setPdfStatus('idle'); setPdfError('');
    setDraftTitle(''); setDraftText(''); setInputMode('text'); setScreen('create');
  }

  async function fetchExplanation(question, answer) {
    setExplanationLoading(true);
    setExplanation(null);
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer }),
      });
      const data = await res.json();
      setExplanation(data.explanation || data.error);
    } catch {
      setExplanation('Could not load explanation right now.');
    } finally {
      setExplanationLoading(false);
    }
  }

  async function exportTopic(id, name) {
    const res = await fetch(`/api/topics/${id}`);
    const data = await res.json();
    const payload = {
      name: data.topic.name,
      flashcards: data.flashcards.map(c => ({ question: c.question, answer: c.answer })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importTopic(file) {
    setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.name || !Array.isArray(data.flashcards) || data.flashcards.length === 0) {
        setImportError('Invalid file. Make sure it is a Recall export.');
        return;
      }
      await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, flashcards: data.flashcards }),
      });
      loadTopics();
    } catch {
      setImportError('Could not read the file. Make sure it is a valid JSON file.');
    }
  }

  const rawCards = activeTopic?.flashcards || [];
  const displayCards = isShuffled ? shuffledCards : rawCards;
  const currentCard = displayCards[cardIndex] || { question: '', answer: '' };
  const reviewCard = reviewQueue[reviewIndex] || { question: '', answer: '' };
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const currentQ = quiz[quizIndex];
  const weekDays = getLastSevenDays();

  return (
    <div className="app-shell">

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        <div className="brand">
          <button className="burger" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">
            <span /><span /><span />
          </button>
          {sidebarOpen && <span className="brand-name">Recall</span>}
        </div>
        {sidebarOpen && (
          <>
            <button className="new-topic-btn" onClick={goCreate}><span className="plus">+</span> New topic</button>
            <nav className="sidebar-nav">
              <button className={`nav-item ${screen === 'dashboard' ? 'active' : ''}`} onClick={() => setScreen('dashboard')}>Dashboard</button>
            </nav>
            <div className="streak-widget">
              <div className="streak-label">Study streak</div>
              <div className="streak-row"><span className="streak-num">{stats.streak}</span><span className="streak-unit">days in a row</span></div>
              <div className="streak-days">
                {weekDays.map(({ dateStr, label }, i) => (
                  <div key={i} className={`streak-day ${stats.reviewedDays.includes(dateStr) ? 'on' : 'off'}`}>{label}</div>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>

      <main className="main-area">

        {/* Dashboard */}
        {screen === 'dashboard' && (
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className="import-btn" onClick={exportAllData} title="Download a backup of all your topics and cards">Export all</button>
                <label className="import-btn" title="Import a topic from a .json file">
                  Import topic
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) importTopic(e.target.files[0]); e.target.value = ''; }} />
                </label>
                <button className="accent-btn" onClick={goCreate}><span className="plus">+</span> New topic</button>
              </div>
            </div>

            {!backendOnline && (
              <div className="offline-banner">
                Cannot reach the backend. Make sure it is running with <code>pnpm dev</code> and refresh.
              </div>
            )}

            {importError && <div className="error-box" style={{ marginTop: '12px' }}>{importError}</div>}

            {/* Due reminder banner */}
            {(() => {
              const totalDue = topics.reduce((s, t) => s + (t.due_count || 0), 0);
              const topicsWithDue = topics.filter(t => t.due_count > 0).length;
              return totalDue > 0 && !bannerDismissed ? (
                <div className="due-banner">
                  <span>You have <strong>{totalDue} card{totalDue !== 1 ? 's' : ''}</strong> due across {topicsWithDue} topic{topicsWithDue !== 1 ? 's' : ''} today. Time to review.</span>
                  <button className="banner-dismiss" onClick={() => setBannerDismissed(true)}>x</button>
                </div>
              ) : null;
            })()}

            {/* Search bar */}
            <div className="search-wrap">
              <input
                className="search-input"
                placeholder="Search topics and cards..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
              />
              {searchQuery && <button className="search-clear" onClick={() => { setSearchQuery(''); setSearchResults(null); }}>x</button>}
            </div>

            {/* Search results */}
            {searchResults && (
              <div className="search-results">
                {searchResults.topics.length === 0 && searchResults.cards.length === 0 && (
                  <p className="muted">No results for "{searchQuery}"</p>
                )}
                {searchResults.topics.length > 0 && (
                  <>
                    <div className="search-group-label">Topics</div>
                    {searchResults.topics.map(t => (
                      <button key={t.id} className="search-result-row" onClick={() => { setSearchQuery(''); setSearchResults(null); openTopic(t.id); }}>
                        <span className="sr-title">{t.name}</span>
                      </button>
                    ))}
                  </>
                )}
                {searchResults.cards.length > 0 && (
                  <>
                    <div className="search-group-label">Cards</div>
                    {searchResults.cards.map(c => (
                      <button key={c.id} className="search-result-row" onClick={() => { setSearchQuery(''); setSearchResults(null); openTopic(c.topic_id); }}>
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
                      return (
                        <div key={t.id} className="topic-card">
                          <div className="topic-card-header">
                            {editingId === t.id ? (
                              <input className="rename-input" value={editingName} onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') renameTopic(t.id); if (e.key === 'Escape') setEditingId(null); }} autoFocus />
                            ) : (
                              <h3 className="topic-title">{t.name}</h3>
                            )}
                            <div className="topic-card-right">
                              <span className="topic-count">{t.card_count} cards</span>
                              <div className="topic-menu-wrap">
                                <button className="topic-menu-btn" onClick={() => { setMenuOpenId(menuOpenId === t.id ? null : t.id); setConfirmDeleteId(null); setEditingId(null); }}>&#8943;</button>
                                {menuOpenId === t.id && (
                                  <div className="topic-menu">
                                    <button className="menu-item" onClick={() => { setEditingId(t.id); setEditingName(t.name); setMenuOpenId(null); }}>Rename</button>
                                    <button className="menu-item" onClick={() => { exportTopic(t.id, t.name); setMenuOpenId(null); }}>Export</button>
                                    <button className="menu-item menu-item-danger" onClick={() => softDeleteTopic(t.id, t.name)}>Delete</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {(
                            <>
                              {/* Mastery bar */}
                              <div className="mastery-row">
                                <div className="mastery-bar-wrap">
                                  <div className="mastery-bar-fill" style={{ width: mastery !== null ? `${mastery}%` : '0%' }} />
                                </div>
                                <span className="mastery-label">
                                  {mastery === null ? 'Not started' : `${mastery}% mastery`}
                                </span>
                              </div>
                              <div className="topic-card-footer">
                                <span className="topic-meta">{timeAgo(t.created_at)}</span>
                                {t.due_count > 0 && <span className="due-badge">{t.due_count} due</span>}
                              </div>
                              <div className="topic-actions">
                                <button className="study-btn" onClick={() => openTopic(t.id)}>Study</button>
                                {t.due_count > 0 && <button className="review-btn" onClick={() => openReview(t.id)}>Review</button>}
                                <button className="quiz-outline-btn" onClick={async () => {
                                  const res = await fetch(`/api/topics/${t.id}`); const data = await res.json();
                                  setActiveTopic(data); launchQuiz(data);
                                }}>Quiz</button>
                              </div>
                              {editingId === t.id && (
                                <div className="rename-actions">
                                  <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                                  <button className="accent-btn" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={() => renameTopic(t.id)}>Save</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {stats.weakCards.length > 0 && (
                  <>
                    <div className="section-title" style={{ marginTop: '32px' }}>Cards to focus on</div>
                    <div className="weak-cards-list">
                      {stats.weakCards.map(card => (
                        <div key={card.id} className="weak-card-row">
                          <div className="weak-card-info">
                            <span className="weak-card-topic">{card.topic_name}</span>
                            <span className="weak-card-question">{card.question}</span>
                          </div>
                          <div className="weak-card-bar-wrap">
                            <div className="weak-card-bar-fill" style={{ width: `${Math.min(100, ((card.easiness_factor - 1.3) / (2.5 - 1.3)) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Create */}
        {screen === 'create' && (
          <div className="screen-pad screen-narrow">
            <button className="back-link" onClick={() => setScreen('dashboard')}>&larr; Back to dashboard</button>
            <h1 className="screen-title">Create a new topic</h1>
            <p className="screen-sub">Paste your notes or upload a PDF and we'll turn them into flashcards.</p>
            <label className="field-label">Topic name</label>
            <input className="field-input" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="e.g. Cell Biology, Chapter 3" />
            <div className="input-mode-toggle">
              <button className={`mode-btn ${inputMode === 'text' ? 'mode-active' : ''}`} onClick={() => { setInputMode('text'); setDraftText(''); setPdfStatus('idle'); }}>Paste text</button>
              <button className={`mode-btn ${inputMode === 'pdf' ? 'mode-active' : ''}`} onClick={() => { setInputMode('pdf'); setDraftText(''); }}>Upload PDF</button>
            </div>
            {inputMode === 'text' && (
              <textarea className="field-textarea" value={draftText} onChange={e => setDraftText(e.target.value)} placeholder="Paste your notes, a paragraph, or any text about the topic..." rows={10} />
            )}
            {inputMode === 'pdf' && (
              <div className={`pdf-upload-area ${isDragging ? 'pdf-dragging' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
                onDrop={handleDrop}>
                <input type="file" accept=".pdf" id="pdf-input" style={{ display: 'none' }} onChange={e => handlePdfFile(e.target.files[0])} />
                <label htmlFor="pdf-input" className="pdf-upload-label">
                  {pdfStatus === 'loading' ? 'Reading PDF...' : draftText ? 'PDF loaded, text extracted. Click or drop to replace.' : isDragging ? 'Drop your PDF here' : 'Drag a PDF here, or click to browse'}
                </label>
                {pdfStatus === 'error' && <div className="error-box" style={{ marginTop: '10px' }}>{pdfError}</div>}
                {draftText && pdfStatus !== 'error' && <p className="pdf-preview">{draftText.slice(0, 200)}...</p>}
              </div>
            )}
            <div className="create-footer">
              <span className="muted" style={{ fontSize: '13px' }}>{draftText.trim() ? 'Ready to generate' : 'Add content to get started'}</span>
              <button className={`accent-btn ${(!draftTitle.trim() || !draftText.trim() || cooldown > 0 || genStatus === 'loading' || pdfStatus === 'loading') ? 'btn-disabled' : ''}`}
                onClick={handleGenerate} disabled={!draftTitle.trim() || !draftText.trim() || cooldown > 0 || genStatus === 'loading' || pdfStatus === 'loading'}>
                {cooldown > 0 ? `Wait ${cooldown}s...` : genStatus === 'loading' ? 'Generating...' : 'Generate cards'}
              </button>
            </div>
            {genStatus === 'error' && <div className="error-box">{genError}</div>}
          </div>
        )}

        {/* Flashcards */}
        {screen === 'flashcards' && activeTopic && (
          <div className="screen-pad screen-narrow">
            <div className="top-bar">
              <button className="back-link" onClick={() => setScreen('dashboard')}>&larr; Dashboard</button>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button className={`shuffle-btn ${isShuffled ? 'shuffle-on' : ''}`} onClick={toggleShuffle}>
                  Shuffle {isShuffled ? 'on' : 'off'}
                </button>
                <button className="edit-cards-btn" onClick={() => launchOpenPractice(activeTopic)}>Open practice</button>
                <button className="edit-cards-btn" onClick={() => openEdit(activeTopic)}>Edit cards</button>
                <span className="index-label">{cardIndex + 1} / {displayCards.length}</span>
              </div>
            </div>
            <h1 className="screen-title" style={{ marginTop: '14px' }}>{activeTopic.topic.name}</h1>
            <p className="screen-sub">Click the card to flip it.</p>
            <div className="flip-scene" onClick={() => setFlipped(f => !f)}>
              <div className={`flip-card ${flipped ? 'is-flipped' : ''}`}>
                <div className="flip-face flip-front">
                  <span className="face-label">Question</span>
                  <span className="face-text">{currentCard.question}</span>
                </div>
                <div className="flip-face flip-back">
                  <span className="face-label">Answer</span>
                  <span className="face-text">{currentCard.answer}</span>
                </div>
              </div>
            </div>
            <div className="flash-controls">
              <button className={`ctrl-btn ${cardIndex === 0 ? 'ctrl-disabled' : ''}`} onClick={() => { setCardIndex(i => Math.max(0, i - 1)); setFlipped(false); }} disabled={cardIndex === 0}>&larr; Previous</button>
              <button className="ctrl-btn" onClick={() => setFlipped(f => !f)}>Flip</button>
              <button className={`ctrl-btn ${cardIndex >= displayCards.length - 1 ? 'ctrl-disabled' : ''}`} onClick={() => { setCardIndex(i => Math.min(displayCards.length - 1, i + 1)); setFlipped(false); }} disabled={cardIndex >= displayCards.length - 1}>Next &rarr;</button>
            </div>
            <div style={{ textAlign: 'center', marginTop: '22px' }}>
              <button className="quiz-link" onClick={() => launchQuiz(activeTopic)}>Take the quiz on this topic &rarr;</button>
            </div>
          </div>
        )}

        {/* Edit cards */}
        {screen === 'edit' && activeTopic && (
          <div className="screen-pad screen-narrow">
            <div className="top-bar">
              <button className="back-link" onClick={() => { setScreen('flashcards'); openTopic(activeTopic.topic.id); }}>&larr; Back to flashcards</button>
              <span className="index-label">{editCards.length} cards</span>
            </div>
            <h1 className="screen-title" style={{ marginTop: '14px' }}>{activeTopic.topic.name}</h1>
            <p className="screen-sub">Edit or delete cards, or add new ones manually.</p>

            <div className="edit-cards-list">
              {editCards.map((card, i) => (
                <div key={card.id} className="edit-card-row">
                  {editingCardId === card.id ? (
                    <div className="edit-card-form">
                      <label className="field-label" style={{ marginTop: 0 }}>Question</label>
                      <textarea className="field-textarea" style={{ minHeight: '80px' }} value={editDraft.question} onChange={e => setEditDraft(d => ({ ...d, question: e.target.value }))} />
                      <label className="field-label" style={{ marginTop: '12px' }}>Answer</label>
                      <textarea className="field-textarea" style={{ minHeight: '80px' }} value={editDraft.answer} onChange={e => setEditDraft(d => ({ ...d, answer: e.target.value }))} />
                      <div className="edit-card-actions">
                        <button className="cancel-btn" onClick={() => setEditingCardId(null)}>Cancel</button>
                        <button className="accent-btn" style={{ padding: '7px 16px', fontSize: '13px' }} onClick={() => saveCardEdit(card.id)}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="edit-card-preview">
                      <span className="edit-card-num">{i + 1}</span>
                      <div className="edit-card-text">
                        <p className="edit-card-q">{card.question}</p>
                        <p className="edit-card-a">{card.answer}</p>
                      </div>
                      <div className="edit-card-btns">
                        <button className="icon-btn" onClick={() => { setEditingCardId(card.id); setEditDraft({ question: card.question, answer: card.answer }); }}>Edit</button>
                        <button className="icon-btn danger-icon" onClick={() => deleteCard(card.id)}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new card */}
            {addingCard ? (
              <div className="edit-card-form" style={{ marginTop: '16px', padding: '16px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <label className="field-label" style={{ marginTop: 0 }}>Question</label>
                <textarea className="field-textarea" style={{ minHeight: '80px' }} value={newCardQ} onChange={e => setNewCardQ(e.target.value)} placeholder="Enter the question..." />
                <label className="field-label" style={{ marginTop: '12px' }}>Answer</label>
                <textarea className="field-textarea" style={{ minHeight: '80px' }} value={newCardA} onChange={e => setNewCardA(e.target.value)} placeholder="Enter the answer..." />
                <div className="edit-card-actions">
                  <button className="cancel-btn" onClick={() => { setAddingCard(false); setNewCardQ(''); setNewCardA(''); }}>Cancel</button>
                  <button className="accent-btn" style={{ padding: '7px 16px', fontSize: '13px' }} onClick={addCard} disabled={!newCardQ.trim() || !newCardA.trim()}>Add card</button>
                </div>
              </div>
            ) : (
              <button className="add-card-btn" onClick={() => setAddingCard(true)}>+ Add a card manually</button>
            )}
          </div>
        )}

        {/* Review */}
        {screen === 'review' && activeTopic && (
          <div className="screen-pad screen-narrow">
            {reviewDone ? (
              <div className="results-screen">
                <div className="results-topic">{activeTopic.topic.name}</div>
                <h1 className="results-headline">Review complete</h1>
                <div className="review-summary">
                  <div className="review-stat correct-stat"><span className="stat-num">{reviewResults.correct}</span><span className="stat-label">Got it</span></div>
                  <div className="review-stat incorrect-stat"><span className="stat-num">{reviewResults.incorrect}</span><span className="stat-label">Missed</span></div>
                </div>
                <p className="review-done-note">Cards you got right won't appear again for several days. Missed cards come back tomorrow.</p>
                <div className="results-actions"><button className="accent-btn" onClick={() => setScreen('dashboard')}>Back to dashboard</button></div>
              </div>
            ) : (
              <>
                <div className="top-bar">
                  <button className="back-link" onClick={() => setScreen('dashboard')}>&larr; Dashboard</button>
                  <span className="index-label">{reviewIndex + 1} / {reviewQueue.length}</span>
                </div>
                <div className="quiz-bar-wrap" style={{ marginTop: '16px' }}>
                  <div className="quiz-bar-fill" style={{ width: `${(reviewIndex / reviewQueue.length) * 100}%` }} />
                </div>
                <h1 className="screen-title" style={{ marginTop: '14px' }}>{activeTopic.topic.name}</h1>
                <p className="screen-sub">{reviewFlipped ? 'How did you do?' : 'Click the card to reveal the answer.'}</p>
                <div className="flip-scene" onClick={() => setReviewFlipped(true)}>
                  <div className={`flip-card ${reviewFlipped ? 'is-flipped' : ''}`}>
                    <div className="flip-face flip-front"><span className="face-label">Question</span><span className="face-text">{reviewCard.question}</span></div>
                    <div className="flip-face flip-back"><span className="face-label">Answer</span><span className="face-text">{reviewCard.answer}</span></div>
                  </div>
                </div>
                {reviewFlipped && (
                  <div className="review-actions">
                    <button className="missed-btn" onClick={() => submitReview(false)}>Missed it</button>
                    <button className="gotit-btn" onClick={() => submitReview(true)}>Got it</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Open Practice */}
        {screen === 'practice' && activeTopic && (
          <div className="screen-pad screen-narrow">
            {practiceDone ? (
              <div className="results-screen">
                <div className="results-topic">{activeTopic.topic.name}</div>
                <h1 className="results-headline">Practice complete</h1>
                <div className="review-summary">
                  <div className="review-stat correct-stat"><span className="stat-num">{practiceResults.correct}</span><span className="stat-label">Got it</span></div>
                  <div className="review-stat incorrect-stat"><span className="stat-num">{practiceResults.incorrect}</span><span className="stat-label">Missed</span></div>
                </div>
                <div className="results-actions">
                  <button className="accent-btn" onClick={() => launchOpenPractice(activeTopic)}>Practice again</button>
                  <button className="outline-btn" onClick={() => setScreen('dashboard')}>Back to dashboard</button>
                </div>
              </div>
            ) : (
              <>
                <div className="top-bar">
                  <button className="back-link" onClick={() => setScreen('flashcards')}>&larr; Back to cards</button>
                  <span className="index-label">{practiceIndex + 1} / {practiceQueue.length}</span>
                </div>
                <div className="quiz-bar-wrap" style={{ marginTop: '16px' }}>
                  <div className="quiz-bar-fill" style={{ width: `${(practiceIndex / practiceQueue.length) * 100}%` }} />
                </div>
                <h1 className="screen-title" style={{ marginTop: '14px' }}>{activeTopic.topic.name}</h1>
                <p className="screen-sub">Write your answer, then check it against the correct one.</p>

                <div className="practice-question">{practiceQueue[practiceIndex]?.question}</div>

                <textarea
                  className="field-textarea practice-input"
                  placeholder="Type your answer here..."
                  value={practiceInput}
                  onChange={e => setPracticeInput(e.target.value)}
                  disabled={practiceChecked}
                  rows={4}
                />

                {!practiceChecked ? (
                  <button
                    className={`accent-btn ${!practiceInput.trim() ? 'btn-disabled' : ''}`}
                    onClick={() => setPracticeChecked(true)}
                    disabled={!practiceInput.trim()}
                    style={{ marginTop: '12px' }}
                  >
                    Check answer
                  </button>
                ) : (
                  <>
                    <div className="practice-compare">
                      <div className="practice-col">
                        <div className="practice-col-label">Your answer</div>
                        <div className="practice-col-text your-answer">{practiceInput}</div>
                      </div>
                      <div className="practice-col">
                        <div className="practice-col-label">Correct answer</div>
                        <div className="practice-col-text correct-answer">{practiceQueue[practiceIndex]?.answer}</div>
                      </div>
                    </div>
                    <p className="practice-prompt">How did you do?</p>
                    <div className="review-actions">
                      <button className="missed-btn" onClick={() => submitPractice(false)}>Missed it</button>
                      <button className="gotit-btn" onClick={() => submitPractice(true)}>Got it</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Quiz */}
        {screen === 'quiz' && activeTopic && (
          <div className="screen-pad screen-narrow">
            {quizFinished ? (
              <div className="results-screen">
                <div className="results-topic">{activeTopic.topic.name}</div>
                <h1 className="results-headline">{quizScore === quiz.length ? 'Perfect score!' : quizScore / quiz.length >= 0.6 ? 'Nicely done.' : 'Keep practicing.'}</h1>
                <div className="score-circle"><span className="score-num">{quizScore}</span><span className="score-of">of {quiz.length}</span></div>
                <div className="results-actions">
                  <button className="accent-btn" onClick={() => { setQuizIndex(0); setQuizSelected(null); setQuizAnswered(false); setQuizScore(0); setQuizFinished(false); }}>Try again</button>
                  <button className="outline-btn" onClick={() => setScreen('dashboard')}>Back to dashboard</button>
                </div>
              </div>
            ) : currentQ ? (
              <>
                <div className="top-bar">
                  <button className="back-link" onClick={() => setScreen('dashboard')}>&larr; Dashboard</button>
                  <span className="index-label">Score {quizScore} / {quiz.length}</span>
                </div>
                <div className="quiz-bar-wrap">
                  <div className="quiz-bar-fill" style={{ width: `${((quizIndex + (quizAnswered ? 1 : 0)) / quiz.length) * 100}%` }} />
                </div>
                <p className="quiz-progress-label">Question {quizIndex + 1} of {quiz.length}</p>

                {/* Fill in the blank badge */}
                {currentQ.type === 'fillblank' && (
                  <div className="question-type-badge">Fill in the blank</div>
                )}

                <h1 className="quiz-question">{currentQ.question}</h1>

                {/* Multiple choice */}
                {currentQ.type === 'mc' && (
                  <div className="options-list">
                    {currentQ.options.map((opt, i) => {
                      const isCorrect = i === currentQ.correctIndex;
                      const isPicked = i === quizSelected;
                      let cls = 'option-btn';
                      if (quizAnswered) { if (isCorrect) cls += ' opt-correct'; else if (isPicked) cls += ' opt-wrong'; else cls += ' opt-dim'; }
                      return (
                        <button key={i} className={cls} onClick={() => { if (quizAnswered) return; setQuizSelected(i); setQuizAnswered(true); if (i === currentQ.correctIndex) setQuizScore(s => s + 1); }}>
                          <span className={`opt-letter ${quizAnswered && isCorrect ? 'letter-correct' : quizAnswered && isPicked && !isCorrect ? 'letter-wrong' : ''}`}>{'ABCD'[i]}</span>
                          <span className="opt-text">{opt}</span>
                          {quizAnswered && isCorrect && <span className="opt-mark correct-mark">&#10003;</span>}
                          {quizAnswered && isPicked && !isCorrect && <span className="opt-mark wrong-mark">&#10005;</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Fill in the blank */}
                {currentQ.type === 'fillblank' && (
                  <div className="fillblank-wrap">
                    <p className="fillblank-sentence">{currentQ.blanked}</p>
                    <input
                      className={`fillblank-input ${quizAnswered ? (fillBlankCorrect ? 'fb-correct' : 'fb-wrong') : ''}`}
                      placeholder="Type the missing word..."
                      value={fillBlankInput}
                      onChange={e => setFillBlankInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !quizAnswered && fillBlankInput.trim()) {
                        const correct = fillBlankInput.trim().toLowerCase() === currentQ.target.toLowerCase();
                        setFillBlankCorrect(correct);
                        setQuizAnswered(true);
                        if (correct) setQuizScore(s => s + 1);
                      }}}
                      disabled={quizAnswered}
                      autoFocus
                    />
                    {!quizAnswered && (
                      <button className={`accent-btn ${!fillBlankInput.trim() ? 'btn-disabled' : ''}`}
                        style={{ marginTop: '10px' }}
                        onClick={() => {
                          if (!fillBlankInput.trim()) return;
                          const correct = fillBlankInput.trim().toLowerCase() === currentQ.target.toLowerCase();
                          setFillBlankCorrect(correct);
                          setQuizAnswered(true);
                          if (correct) setQuizScore(s => s + 1);
                        }}
                        disabled={!fillBlankInput.trim()}>
                        Check
                      </button>
                    )}
                    {quizAnswered && (
                      <p className="fillblank-answer">
                        {fillBlankCorrect ? 'Correct!' : `The answer was: ${currentQ.target}`}
                      </p>
                    )}
                    {quizAnswered && <p className="fillblank-full">Full answer: {currentQ.fullAnswer}</p>}
                  </div>
                )}

                {quizAnswered && (
                  <>
                    {/* Explanation — only when wrong */}
                    {(currentQ.type === 'mc' ? quizSelected !== currentQ.correctIndex : !fillBlankCorrect) && (
                      <div className="explanation-wrap">
                        {!explanation && !explanationLoading && (
                          <button className="why-btn" onClick={() => fetchExplanation(currentQ.question, currentQ.type === 'mc' ? currentQ.options[currentQ.correctIndex] : currentQ.fullAnswer)}>
                            Why is this the answer?
                          </button>
                        )}
                        {explanationLoading && <p className="explanation-loading">Thinking...</p>}
                        {explanation && <div className="explanation-box">{explanation}</div>}
                      </div>
                    )}

                    <div className="quiz-feedback">
                      <span className={(currentQ.type === 'mc' ? quizSelected === currentQ.correctIndex : fillBlankCorrect) ? 'feedback-correct' : 'feedback-wrong'}>
                        {(currentQ.type === 'mc' ? quizSelected === currentQ.correctIndex : fillBlankCorrect) ? 'Correct' : 'Not quite'}
                      </span>
                      <button className="accent-btn" onClick={() => {
                        setExplanation(null); setExplanationLoading(false);
                        setFillBlankInput(''); setFillBlankCorrect(null);
                        if (quizIndex >= quiz.length - 1) { setQuizFinished(true); }
                        else { setQuizIndex(i => i + 1); setQuizSelected(null); setQuizAnswered(false); }
                      }}>
                        {quizIndex >= quiz.length - 1 ? 'See results' : 'Next question'}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : <p className="muted">Not enough cards for a quiz (need at least 2).</p>}
          </div>
        )}

      </main>

      {/* Undo delete toast */}
      {pendingDelete && (
        <div className="undo-toast">
          <span>"{pendingDelete.name}" will be deleted.</span>
          <button className="undo-btn" onClick={undoDelete}>Undo</button>
        </div>
      )}

    </div>
  );
}
