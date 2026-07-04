import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CreateTopic from './components/CreateTopic';
import Flashcards from './components/Flashcards';
import EditCards from './components/EditCards';
import Review from './components/Review';
import Practice from './components/Practice';
import Quiz from './components/Quiz';

const EMPTY_STATS = { streak: 0, reviewedDays: [], weakCards: [], todayCount: 0 };

export default function App() {
  const [screen, setScreen] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('recall-theme') || 'light');
  const [topics, setTopics] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [backendOnline, setBackendOnline] = useState(true);
  const [activeTopic, setActiveTopic] = useState(null);   // { topic, flashcards }
  const [reviewSession, setReviewSession] = useState(null); // { title, cards }
  const [pendingDelete, setPendingDelete] = useState(null); // { id, name, timer }
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('recall-theme', theme);
  }, [theme]);

  const reload = useCallback(async () => {
    try {
      const [topicData, statsData] = await Promise.all([api.get('/api/topics'), api.get('/api/stats')]);
      setTopics(topicData.topics);
      setStats(statsData);
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  useEffect(() => {
    if (screen === 'dashboard') reload();
  }, [screen, reload]);

  function showError(err) {
    setErrorMsg(err.message || 'Something went wrong.');
    setTimeout(() => setErrorMsg(''), 4000);
  }

  async function openTopic(id) {
    try {
      setActiveTopic(await api.get(`/api/topics/${id}`));
      setScreen('flashcards');
    } catch (err) { showError(err); }
  }

  async function openQuiz(id) {
    try {
      setActiveTopic(await api.get(`/api/topics/${id}`));
      setScreen('quiz');
    } catch (err) { showError(err); }
  }

  async function openTopicReview(id) {
    try {
      const data = await api.get(`/api/topics/${id}/due`);
      setReviewSession({ title: data.topic.name, cards: data.flashcards });
      setScreen('review');
    } catch (err) { showError(err); }
  }

  async function openGlobalReview() {
    try {
      const data = await api.get('/api/due');
      setReviewSession({ title: 'All topics', cards: data.flashcards });
      setScreen('review');
    } catch (err) { showError(err); }
  }

  function softDeleteTopic(id, name) {
    // Commit any earlier pending delete right away so its timer can't
    // silently overwrite this toast and strand the previous undo.
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      api.del(`/api/topics/${pendingDelete.id}`).catch(() => {});
    }
    setTopics(prev => prev.filter(t => t.id !== id));
    const timer = setTimeout(() => {
      api.del(`/api/topics/${id}`).catch(() => {});
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ id, name, timer });
  }

  function undoDelete() {
    clearTimeout(pendingDelete.timer);
    setPendingDelete(null);
    reload();
  }

  const goDashboard = () => setScreen('dashboard');

  return (
    <div className="app-shell">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        isDashboard={screen === 'dashboard'}
        onDashboard={goDashboard}
        onNewTopic={() => setScreen('create')}
        stats={stats}
        theme={theme}
        onToggleTheme={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}
      />

      <main className="main-area">
        {screen === 'dashboard' && (
          <Dashboard
            topics={topics}
            stats={stats}
            backendOnline={backendOnline}
            reload={reload}
            onOpenTopic={openTopic}
            onQuiz={openQuiz}
            onReviewTopic={openTopicReview}
            onReviewAll={openGlobalReview}
            onCreate={() => setScreen('create')}
            onDeleteTopic={softDeleteTopic}
          />
        )}

        {screen === 'create' && (
          <CreateTopic onBack={goDashboard} onCreated={openTopic} />
        )}

        {screen === 'flashcards' && activeTopic && (
          <Flashcards
            topicData={activeTopic}
            onBack={goDashboard}
            onStartQuiz={() => setScreen('quiz')}
            onStartPractice={() => setScreen('practice')}
            onEdit={() => setScreen('edit')}
          />
        )}

        {screen === 'edit' && activeTopic && (
          <EditCards topic={activeTopic.topic} onBack={() => openTopic(activeTopic.topic.id)} />
        )}

        {screen === 'review' && reviewSession && (
          <Review title={reviewSession.title} cards={reviewSession.cards} onExit={goDashboard} />
        )}

        {screen === 'practice' && activeTopic && (
          <Practice topicData={activeTopic} onBack={() => setScreen('flashcards')} onExit={goDashboard} />
        )}

        {screen === 'quiz' && activeTopic && (
          <Quiz topicData={activeTopic} onExit={goDashboard} />
        )}
      </main>

      {errorMsg && <div className="error-toast">{errorMsg}</div>}

      {pendingDelete && (
        <div className="undo-toast">
          <span>"{pendingDelete.name}" will be deleted.</span>
          <button className="undo-btn" onClick={undoDelete}>Undo</button>
        </div>
      )}
    </div>
  );
}
