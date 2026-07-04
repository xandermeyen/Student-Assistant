import { useState, useEffect } from 'react';
import { api } from '../api';
import { shuffle } from '../utils/quiz';

// Open practice: type your full answer, compare against the correct one,
// then grade yourself. Grades feed the same spaced-repetition schedule.
export default function Practice({ topicData, onBack, onExit }) {
  const [queue, setQueue] = useState(() => shuffle(topicData.flashcards));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState({ missed: 0, almost: 0, gotIt: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const card = queue[index];

  function restart() {
    setQueue(shuffle(topicData.flashcards));
    setIndex(0);
    setInput('');
    setChecked(false);
    setResults({ missed: 0, almost: 0, gotIt: 0 });
    setDone(false);
  }

  async function grade(quality) {
    try {
      await api.post(`/api/cards/${card.id}/review`, { quality });
    } catch (err) {
      setError(err.message);
      return;
    }
    setError('');
    setResults(prev => ({
      missed: prev.missed + (quality === 'missed' ? 1 : 0),
      almost: prev.almost + (quality === 'almost' ? 1 : 0),
      gotIt: prev.gotIt + (quality === 'got_it' ? 1 : 0),
    }));
    if (index >= queue.length - 1) setDone(true);
    else { setIndex(i => i + 1); setInput(''); setChecked(false); }
  }

  // After checking: 1 = missed, 2 = almost, 3 = got it
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || done || !checked) return;
      if (e.key === '1') grade('missed');
      else if (e.key === '2') grade('almost');
      else if (e.key === '3') grade('got_it');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (done) {
    return (
      <div className="screen-pad screen-narrow">
        <div className="results-screen">
          <div className="results-topic">{topicData.topic.name}</div>
          <h1 className="results-headline">Practice complete</h1>
          <div className="review-summary">
            <div className="review-stat incorrect-stat"><span className="stat-num">{results.missed}</span><span className="stat-label">Missed</span></div>
            <div className="review-stat almost-stat"><span className="stat-num">{results.almost}</span><span className="stat-label">Almost</span></div>
            <div className="review-stat correct-stat"><span className="stat-num">{results.gotIt}</span><span className="stat-label">Got it</span></div>
          </div>
          <div className="results-actions">
            <button className="accent-btn" onClick={restart}>Practice again</button>
            <button className="outline-btn" onClick={onExit}>Back to dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-pad screen-narrow">
      <div className="top-bar">
        <button className="back-link" onClick={onBack}>&larr; Back to cards</button>
        <span className="index-label">{index + 1} / {queue.length}</span>
      </div>
      <div className="quiz-bar-wrap bar-gap">
        <div className="quiz-bar-fill" style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      <h1 className="screen-title title-gap">{topicData.topic.name}</h1>
      <p className="screen-sub">Write your answer, then check it against the correct one.</p>

      <div className="practice-question">{card?.question}</div>

      <textarea
        className="field-textarea practice-input" rows={4}
        placeholder="Type your answer here... (Ctrl+Enter to check)"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && input.trim()) setChecked(true); }}
        disabled={checked}
      />

      {error && <div className="error-box">{error}</div>}

      {!checked ? (
        <button
          className={`accent-btn check-btn ${!input.trim() ? 'btn-disabled' : ''}`}
          onClick={() => setChecked(true)} disabled={!input.trim()}
        >
          Check answer
        </button>
      ) : (
        <>
          <div className="practice-compare">
            <div className="practice-col">
              <div className="practice-col-label">Your answer</div>
              <div className="practice-col-text your-answer">{input}</div>
            </div>
            <div className="practice-col">
              <div className="practice-col-label">Correct answer</div>
              <div className="practice-col-text correct-answer">{card?.answer}</div>
            </div>
          </div>
          <p className="practice-prompt">How did you do?</p>
          <div className="grade-actions">
            <button className="grade-btn grade-missed" onClick={() => grade('missed')}>Missed <kbd>1</kbd></button>
            <button className="grade-btn grade-almost" onClick={() => grade('almost')}>Almost <kbd>2</kbd></button>
            <button className="grade-btn grade-gotit" onClick={() => grade('got_it')}>Got it <kbd>3</kbd></button>
          </div>
        </>
      )}
    </div>
  );
}
