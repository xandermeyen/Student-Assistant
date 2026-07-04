import { useState, useEffect } from 'react';
import { api } from '../api';

const EMPTY_CARD = { question: '', answer: '' };

// Spaced-repetition review session. `cards` may span multiple topics
// (global review), in which case each card carries a topic_name.
export default function Review({ title, cards, onExit }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState({ missed: 0, almost: 0, gotIt: 0 });
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const card = cards[index] ?? EMPTY_CARD;

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
    if (index >= cards.length - 1) setDone(true);
    else { setIndex(i => i + 1); setFlipped(false); }
  }

  // Space flips; after flipping, 1 = missed, 2 = almost, 3 = got it
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || done) return;
      if (e.key === ' ') { e.preventDefault(); setFlipped(true); }
      else if (flipped && e.key === '1') grade('missed');
      else if (flipped && e.key === '2') grade('almost');
      else if (flipped && e.key === '3') grade('got_it');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (done) {
    return (
      <div className="screen-pad screen-narrow">
        <div className="results-screen">
          <div className="results-topic">{title}</div>
          <h1 className="results-headline">Review complete</h1>
          <div className="review-summary">
            <div className="review-stat incorrect-stat"><span className="stat-num">{results.missed}</span><span className="stat-label">Missed</span></div>
            <div className="review-stat almost-stat"><span className="stat-num">{results.almost}</span><span className="stat-label">Almost</span></div>
            <div className="review-stat correct-stat"><span className="stat-num">{results.gotIt}</span><span className="stat-label">Got it</span></div>
          </div>
          <p className="review-done-note">
            Got it pushes a card days ahead, almost keeps it close, missed brings it back tomorrow.
          </p>
          <div className="results-actions">
            <button className="accent-btn" onClick={onExit}>Back to dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-pad screen-narrow">
      <div className="top-bar">
        <button className="back-link" onClick={onExit}>&larr; Dashboard</button>
        <span className="index-label">{index + 1} / {cards.length}</span>
      </div>
      <div className="quiz-bar-wrap bar-gap">
        <div className="quiz-bar-fill" style={{ width: `${(index / cards.length) * 100}%` }} />
      </div>
      <h1 className="screen-title title-gap">{title}</h1>
      <p className="screen-sub">{flipped ? 'How did you do?' : 'Click the card to reveal the answer.'}</p>

      {card.topic_name && <div className="review-topic-tag">{card.topic_name}</div>}

      <div className="flip-scene" onClick={() => setFlipped(true)}>
        <div className={`flip-card ${flipped ? 'is-flipped' : ''}`}>
          <div className="flip-face flip-front">
            <span className="face-label">Question</span>
            <span className="face-text">{card.question}</span>
          </div>
          <div className="flip-face flip-back">
            <span className="face-label">Answer</span>
            <span className="face-text">{card.answer}</span>
          </div>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {flipped ? (
        <div className="grade-actions">
          <button className="grade-btn grade-missed" onClick={() => grade('missed')}>Missed <kbd>1</kbd></button>
          <button className="grade-btn grade-almost" onClick={() => grade('almost')}>Almost <kbd>2</kbd></button>
          <button className="grade-btn grade-gotit" onClick={() => grade('got_it')}>Got it <kbd>3</kbd></button>
        </div>
      ) : (
        <p className="kbd-hint">Space to flip</p>
      )}
    </div>
  );
}
