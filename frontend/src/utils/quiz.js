// Quiz-building helpers.

const STOP_WORDS = new Set(['the','a','an','is','are','was','were','of','in','to','for','on','with','and','or','but','not','this','that','it','its','by','at','be','has','have','had','can','will','from','they','their','which','also','when','where','how','what','who']);

// Unbiased Fisher-Yates shuffle. Array.sort with a random comparator is biased.
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Blank out the longest meaningful word in the answer.
// Returns null when the answer has no word worth blanking.
export function generateFillBlank(card) {
  const words = card.answer.split(/\s+/);
  const candidates = words.filter(w => {
    const clean = w.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return clean.length > 4 && !STOP_WORDS.has(clean);
  });
  if (!candidates.length) return null;
  const target = candidates.reduce((best, w) => (w.length > best.length ? w : best), '');
  const cleanTarget = target.replace(/[^a-zA-Z0-9]/g, '');
  return { blanked: card.answer.replace(target, '_____'), target: cleanTarget };
}

// Build up to 6 questions, randomly mixing multiple choice and fill-in-the-blank.
export function buildMixedQuiz(cards) {
  if (cards.length < 2) return [];
  const questions = shuffle(cards).slice(0, Math.min(6, cards.length));
  return questions.map(card => {
    const fb = generateFillBlank(card);
    if (fb && Math.random() > 0.5) {
      return { type: 'fillblank', question: card.question, blanked: fb.blanked, target: fb.target, fullAnswer: card.answer };
    }
    const wrong = shuffle(cards.filter(c => c.id !== card.id).map(c => c.answer)).slice(0, 3);
    const options = shuffle([card.answer, ...wrong]);
    return { type: 'mc', question: card.question, options, correctIndex: options.indexOf(card.answer) };
  });
}
