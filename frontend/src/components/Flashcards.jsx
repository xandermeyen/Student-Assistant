import { useState, useEffect } from 'react';
import { shuffle } from '../utils/quiz';

const EMPTY_CARD = { question: '', answer: '' };

export default function Flashcards({ topicData, onBack, onStartQuiz, onStartPractice, onEdit }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(null); // null = natural order

  const cards = shuffled ?? topicData.flashcards;
  const card = cards[index] ?? EMPTY_CARD;

  function goTo(next) {
    setIndex(Math.max(0, Math.min(cards.length - 1, next)));
    setFlipped(false);
  }

  function toggleShuffle() {
    setShuffled(prev => (prev ? null : shuffle(topicData.flashcards)));
    setIndex(0);
    setFlipped(false);
  }

  // Space flips, arrow keys navigate
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.ctrlKey || e.metaKey) return;
      if (e.key === ' ') { e.preventDefault(); setFlipped(f => !f); }
      else if (e.key === 'ArrowLeft') goTo(index - 1);
      else if (e.key === 'ArrowRight') goTo(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="screen-pad screen-narrow">
      <div className="top-bar">
        <button className="back-link" onClick={onBack}>&larr; Dashboard</button>
        <div className="top-bar-actions">
          <button className={`shuffle-btn ${shuffled ? 'shuffle-on' : ''}`} onClick={toggleShuffle}>
            Shuffle {shuffled ? 'on' : 'off'}
          </button>
          <button className="edit-cards-btn" onClick={onStartPractice}>Open practice</button>
          <button className="edit-cards-btn" onClick={onEdit}>Edit cards</button>
          <span className="index-label">{index + 1} / {cards.length}</span>
        </div>
      </div>

      <h1 className="screen-title title-gap">{topicData.topic.name}</h1>
      <p className="screen-sub">Click the card to flip it.</p>

      <div className="flip-scene" onClick={() => setFlipped(f => !f)}>
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

      <div className="flash-controls">
        <button className={`ctrl-btn ${index === 0 ? 'ctrl-disabled' : ''}`} onClick={() => goTo(index - 1)} disabled={index === 0}>
          &larr; Previous
        </button>
        <button className="ctrl-btn" onClick={() => setFlipped(f => !f)}>Flip</button>
        <button
          className={`ctrl-btn ${index >= cards.length - 1 ? 'ctrl-disabled' : ''}`}
          onClick={() => goTo(index + 1)} disabled={index >= cards.length - 1}
        >
          Next &rarr;
        </button>
      </div>

      <p className="kbd-hint">Space to flip, arrow keys to navigate</p>

      <div className="quiz-link-wrap">
        <button className="quiz-link" onClick={onStartQuiz}>Take the quiz on this topic &rarr;</button>
      </div>
    </div>
  );
}
