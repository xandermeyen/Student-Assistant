import { useState, useEffect } from 'react';
import { api } from '../api';
import { buildMixedQuiz } from '../utils/quiz';

// Mixed quiz: multiple choice and fill-in-the-blank questions.
export default function Quiz({ topicData, onExit }) {
  const [quiz, setQuiz] = useState(() => buildMixedQuiz(topicData.flashcards));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [fbInput, setFbInput] = useState('');
  const [fbCorrect, setFbCorrect] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  const q = quiz[index];
  const wasCorrect = q?.type === 'mc' ? selected === q.correctIndex : fbCorrect;

  function restart() {
    // Rebuild so retries get a fresh mix instead of the same questions
    setQuiz(buildMixedQuiz(topicData.flashcards));
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setFbInput('');
    setFbCorrect(null);
    setExplanation(null);
  }

  function selectOption(i) {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
    if (i === q.correctIndex) setScore(s => s + 1);
  }

  function checkFillBlank() {
    if (!fbInput.trim() || answered) return;
    const correct = fbInput.trim().toLowerCase() === q.target.toLowerCase();
    setFbCorrect(correct);
    setAnswered(true);
    if (correct) setScore(s => s + 1);
  }

  function next() {
    setExplanation(null);
    setExplanationLoading(false);
    setFbInput('');
    setFbCorrect(null);
    if (index >= quiz.length - 1) setFinished(true);
    else { setIndex(i => i + 1); setSelected(null); setAnswered(false); }
  }

  async function fetchExplanation() {
    setExplanationLoading(true);
    setExplanation(null);
    try {
      const answer = q.type === 'mc' ? q.options[q.correctIndex] : q.fullAnswer;
      const data = await api.post('/api/explain', { question: q.question, answer });
      setExplanation(data.explanation);
    } catch (err) {
      setExplanation(err.message);
    } finally {
      setExplanationLoading(false);
    }
  }

  // 1-4 answers multiple choice, Enter advances after answering
  useEffect(() => {
    function onKey(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || finished || !q) return;
      if (!answered && q.type === 'mc' && ['1', '2', '3', '4'].includes(e.key)) {
        selectOption(Number(e.key) - 1);
      } else if (answered && e.key === 'Enter') {
        next();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (finished) {
    return (
      <div className="screen-pad screen-narrow">
        <div className="results-screen">
          <div className="results-topic">{topicData.topic.name}</div>
          <h1 className="results-headline">
            {score === quiz.length ? 'Perfect score!' : score / quiz.length >= 0.6 ? 'Nicely done.' : 'Keep practicing.'}
          </h1>
          <div className="score-circle">
            <span className="score-num">{score}</span>
            <span className="score-of">of {quiz.length}</span>
          </div>
          <div className="results-actions">
            <button className="accent-btn" onClick={restart}>Try again</button>
            <button className="outline-btn" onClick={onExit}>Back to dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  if (!q) {
    return (
      <div className="screen-pad screen-narrow">
        <button className="back-link" onClick={onExit}>&larr; Dashboard</button>
        <p className="muted section-gap">Not enough cards for a quiz (need at least 2).</p>
      </div>
    );
  }

  return (
    <div className="screen-pad screen-narrow">
      <div className="top-bar">
        <button className="back-link" onClick={onExit}>&larr; Dashboard</button>
        <span className="index-label">Score {score} / {quiz.length}</span>
      </div>
      <div className="quiz-bar-wrap">
        <div className="quiz-bar-fill" style={{ width: `${((index + (answered ? 1 : 0)) / quiz.length) * 100}%` }} />
      </div>
      <p className="quiz-progress-label">Question {index + 1} of {quiz.length}</p>

      {q.type === 'fillblank' && <div className="question-type-badge">Fill in the blank</div>}

      <h1 className="quiz-question">{q.question}</h1>

      {q.type === 'mc' && (
        <div className="options-list">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
            const isPicked = i === selected;
            let cls = 'option-btn';
            if (answered) {
              if (isCorrect) cls += ' opt-correct';
              else if (isPicked) cls += ' opt-wrong';
              else cls += ' opt-dim';
            }
            return (
              <button key={i} className={cls} onClick={() => selectOption(i)}>
                <span className={`opt-letter ${answered && isCorrect ? 'letter-correct' : answered && isPicked && !isCorrect ? 'letter-wrong' : ''}`}>
                  {'ABCD'[i]}
                </span>
                <span className="opt-text">{opt}</span>
                {answered && isCorrect && <span className="opt-mark correct-mark">&#10003;</span>}
                {answered && isPicked && !isCorrect && <span className="opt-mark wrong-mark">&#10005;</span>}
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'fillblank' && (
        <div className="fillblank-wrap">
          <p className="fillblank-sentence">{q.blanked}</p>
          <input
            className={`fillblank-input ${answered ? (fbCorrect ? 'fb-correct' : 'fb-wrong') : ''}`}
            placeholder="Type the missing word..."
            value={fbInput}
            onChange={e => setFbInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') checkFillBlank(); }}
            disabled={answered}
            autoFocus
          />
          {!answered && (
            <button
              className={`accent-btn check-btn ${!fbInput.trim() ? 'btn-disabled' : ''}`}
              onClick={checkFillBlank} disabled={!fbInput.trim()}
            >
              Check
            </button>
          )}
          {answered && (
            <p className="fillblank-answer">
              {fbCorrect ? 'Correct!' : `The answer was: ${q.target}`}
            </p>
          )}
          {answered && <p className="fillblank-full">Full answer: {q.fullAnswer}</p>}
        </div>
      )}

      {answered && (
        <>
          {!wasCorrect && (
            <div className="explanation-wrap">
              {!explanation && !explanationLoading && (
                <button className="why-btn" onClick={fetchExplanation}>Why is this the answer?</button>
              )}
              {explanationLoading && <p className="explanation-loading">Thinking...</p>}
              {explanation && <div className="explanation-box">{explanation}</div>}
            </div>
          )}

          <div className="quiz-feedback">
            <span className={wasCorrect ? 'feedback-correct' : 'feedback-wrong'}>
              {wasCorrect ? 'Correct' : 'Not quite'}
            </span>
            <button className="accent-btn" onClick={next}>
              {index >= quiz.length - 1 ? 'See results' : 'Next question'}
            </button>
          </div>
          <p className="kbd-hint">Press Enter to continue</p>
        </>
      )}
    </div>
  );
}
