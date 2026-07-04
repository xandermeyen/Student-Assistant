import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import multer from 'multer';
import { createRequire } from 'module';
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from './db.js';

// pdf-parse is CommonJS, import from the lib path directly to skip its test-file side effect
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// JSON model: used for structured generation (flashcards). Forces Gemini to return valid JSON.
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
});

// Text model: used for free-form responses (explanations). No JSON constraint.
const textModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { temperature: 0.3 },
});

// Today's date as YYYY-MM-DD in the server's local timezone
const localToday = () => new Date().toLocaleDateString('en-CA');

// --- SM-2 ---
// quality: 1 = missed, 3 = almost, 5 = got it.
// If the topic has an exam date, cards are never scheduled past it.
function sm2(card, quality, examDate) {
  let { easiness_factor, interval_days, repetitions } = card;

  if (quality < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 6;
    else interval_days = Math.round(interval_days * easiness_factor);
    repetitions += 1;
  }

  easiness_factor += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  easiness_factor = Math.max(1.3, easiness_factor);

  const due = new Date();
  due.setDate(due.getDate() + interval_days);
  let due_date = due.toLocaleDateString('en-CA');

  const today = localToday();
  if (examDate && today < examDate && due_date > examDate) due_date = examDate;

  return { easiness_factor, interval_days, repetitions, due_date };
}

// --- PDF ---

app.post('/api/parse-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const data = await pdfParse(req.file.buffer);
    const text = data.text.trim();
    if (!text) {
      return res.status(422).json({ error: 'Could not extract text. This PDF may be a scanned image.' });
    }
    res.json({ text });
  } catch (err) {
    console.error('PDF parse error:', err.message);
    res.status(500).json({ error: 'Failed to read the PDF. Make sure it is a valid file.' });
  }
});

// --- LLM ---

app.post('/api/generate', async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Please paste some text first.' });
  if (text.length > 20000) return res.status(400).json({ error: 'Text is too long. Keep it under 20,000 characters.' });

  const prompt = `You are an expert study assistant. Read the text below and create 5-10 high-quality flashcards for a student who wants to memorize and understand the material.

Rules:
- Questions should test understanding, not just recall (prefer "why" and "how" over "what")
- Answers should be concise but complete (1-3 sentences)
- Cover the most important concepts, not trivial details
- Use simple, clear language

Return a JSON array in this exact format:
[{"question": "...", "answer": "..."}, ...]

Text:
${text}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    res.json({ flashcards: JSON.parse(match[0]) });
  } catch (err) {
    console.error('Generate error:', err.message);
    if (err.message.includes('429')) {
      return res.status(429).json({ error: 'Rate limit reached. Wait about a minute and try again.' });
    }
    res.status(500).json({ error: 'Failed to generate flashcards. Try again in a moment.' });
  }
});

app.post('/api/explain', async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Question and answer required.' });
  if (question.length > 2000 || answer.length > 2000) return res.status(400).json({ error: 'Input too long.' });

  const prompt = `A student got this flashcard question wrong in a quiz.

Question: ${question}
Correct answer: ${answer}

In 2-3 clear sentences, explain why this is the correct answer and help the student understand the concept. Be direct and educational, no introduction needed.`;

  try {
    const result = await textModel.generateContent(prompt);
    res.json({ explanation: result.response.text().trim() });
  } catch (err) {
    console.error('Explain error:', err.message);
    if (err.message.includes('429')) return res.status(429).json({ error: 'Rate limit reached. Try again in a moment.' });
    res.status(500).json({ error: 'Could not generate an explanation right now.' });
  }
});

// --- Topics ---

app.get('/api/topics', (req, res) => {
  const topics = db.prepare(`
    SELECT t.id, t.name, t.created_at, t.exam_date,
           COUNT(f.id) AS card_count,
           SUM(CASE WHEN f.due_date IS NULL OR f.due_date <= ? THEN 1 ELSE 0 END) AS due_count,
           AVG(CASE WHEN f.due_date IS NOT NULL THEN f.easiness_factor ELSE NULL END) AS avg_ef,
           COUNT(CASE WHEN f.due_date IS NOT NULL THEN 1 ELSE NULL END) AS reviewed_count
    FROM topics t
    LEFT JOIN flashcards f ON f.topic_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `).all(localToday());
  res.json({ topics });
});

app.get('/api/topics/:id', (req, res) => {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found.' });
  const flashcards = db.prepare('SELECT * FROM flashcards WHERE topic_id = ? ORDER BY id').all(req.params.id);
  res.json({ topic, flashcards });
});

app.get('/api/topics/:id/due', (req, res) => {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found.' });
  const flashcards = db.prepare(`
    SELECT * FROM flashcards
    WHERE topic_id = ? AND (due_date IS NULL OR due_date <= ?)
    ORDER BY COALESCE(due_date, '1900-01-01')
  `).all(req.params.id, localToday());
  res.json({ topic, flashcards });
});

// All due cards across every topic, for the global review session
app.get('/api/due', (req, res) => {
  const flashcards = db.prepare(`
    SELECT f.*, t.name AS topic_name
    FROM flashcards f
    JOIN topics t ON t.id = f.topic_id
    WHERE f.due_date IS NULL OR f.due_date <= ?
    ORDER BY COALESCE(f.due_date, '1900-01-01'), t.name, f.id
  `).all(localToday());
  res.json({ flashcards });
});

app.post('/api/topics', (req, res) => {
  const { name, flashcards } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Topic name is required.' });
  if (!flashcards || flashcards.length === 0) return res.status(400).json({ error: 'No flashcards to save.' });
  if (flashcards.some(c => !c.question?.trim() || !c.answer?.trim())) {
    return res.status(400).json({ error: 'Every card must have a question and an answer.' });
  }
  const save = db.transaction(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO topics (name) VALUES (?)').run(name.trim());
    const insertCard = db.prepare('INSERT INTO flashcards (topic_id, question, answer) VALUES (?, ?, ?)');
    for (const card of flashcards) insertCard.run(lastInsertRowid, card.question.trim(), card.answer.trim());
    return lastInsertRowid;
  });
  const id = save();
  res.json({ id, name: name.trim() });
});

// Search across topic names and card content.
// LIKE wildcards in the query are escaped so "50%" matches literally.
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ topics: [], cards: [] });
  const like = `%${q.replace(/[\\%_]/g, m => '\\' + m)}%`;

  const topics = db.prepare(`
    SELECT id, name FROM topics WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 8
  `).all(like);

  const cards = db.prepare(`
    SELECT f.id, f.question, f.answer, t.id AS topic_id, t.name AS topic_name
    FROM flashcards f
    JOIN topics t ON t.id = f.topic_id
    WHERE f.question LIKE ? ESCAPE '\\' OR f.answer LIKE ? ESCAPE '\\'
    ORDER BY t.name, f.id LIMIT 10
  `).all(like, like);

  res.json({ topics, cards });
});

// Update a topic's name and/or exam date
app.patch('/api/topics/:id', (req, res) => {
  const topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found.' });

  const { name, exam_date } = req.body;
  if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'Name cannot be empty.' });
  if (exam_date !== undefined && exam_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(exam_date)) {
    return res.status(400).json({ error: 'Exam date must be YYYY-MM-DD or null.' });
  }

  db.prepare('UPDATE topics SET name = ?, exam_date = ? WHERE id = ?').run(
    name !== undefined ? name.trim() : topic.name,
    exam_date !== undefined ? exam_date : topic.exam_date,
    req.params.id,
  );
  res.json({ ok: true });
});

app.delete('/api/topics/:id', (req, res) => {
  const result = db.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Topic not found.' });
  res.json({ ok: true });
});

// --- Cards ---

app.put('/api/cards/:id', (req, res) => {
  const { question, answer } = req.body;
  if (!question?.trim() || !answer?.trim()) return res.status(400).json({ error: 'Question and answer are required.' });
  const result = db.prepare('UPDATE flashcards SET question = ?, answer = ? WHERE id = ?').run(question.trim(), answer.trim(), req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Card not found.' });
  res.json({ ok: true });
});

app.delete('/api/cards/:id', (req, res) => {
  const result = db.prepare('DELETE FROM flashcards WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Card not found.' });
  res.json({ ok: true });
});

app.post('/api/topics/:id/cards', (req, res) => {
  const { question, answer } = req.body;
  if (!question?.trim() || !answer?.trim()) return res.status(400).json({ error: 'Question and answer are required.' });
  const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(req.params.id);
  if (!topic) return res.status(404).json({ error: 'Topic not found.' });
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO flashcards (topic_id, question, answer) VALUES (?, ?, ?)'
  ).run(req.params.id, question.trim(), answer.trim());
  res.json({ id: lastInsertRowid, question: question.trim(), answer: answer.trim() });
});

// --- SRS ---

const QUALITY = { missed: 1, almost: 3, got_it: 5 };

app.post('/api/cards/:id/review', (req, res) => {
  // New API: { quality: "missed" | "almost" | "got_it" }.
  // Old API: { correct: boolean } still accepted for compatibility.
  let quality = QUALITY[req.body.quality];
  if (!quality && typeof req.body.correct === 'boolean') quality = req.body.correct ? 5 : 1;
  if (!quality) return res.status(400).json({ error: 'quality must be missed, almost, or got_it.' });

  const card = db.prepare(`
    SELECT f.*, t.exam_date FROM flashcards f
    JOIN topics t ON t.id = f.topic_id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found.' });

  const updated = sm2({
    easiness_factor: card.easiness_factor ?? 2.5,
    interval_days:   card.interval_days   ?? 1,
    repetitions:     card.repetitions     ?? 0,
  }, quality, card.exam_date);

  db.transaction(() => {
    db.prepare(`
      UPDATE flashcards SET easiness_factor=?, interval_days=?, repetitions=?, due_date=? WHERE id=?
    `).run(updated.easiness_factor, updated.interval_days, updated.repetitions, updated.due_date, card.id);
    db.prepare('INSERT INTO reviews_log (card_id, correct) VALUES (?, ?)').run(card.id, quality >= 3 ? 1 : 0);
  })();

  res.json(updated);
});

// --- Backup export ---

app.get('/api/export', (req, res) => {
  const topics = db.prepare('SELECT * FROM topics ORDER BY created_at').all();
  const data = topics.map(topic => ({
    name: topic.name,
    created_at: topic.created_at,
    flashcards: db.prepare(
      'SELECT question, answer FROM flashcards WHERE topic_id = ? ORDER BY id'
    ).all(topic.id),
  }));
  res.json({ topics: data, exported_at: new Date().toISOString() });
});

// --- Stats (streak + weak cards) ---

app.get('/api/stats', (req, res) => {
  const reviewDates = db.prepare(`
    SELECT DISTINCT date(reviewed_at) AS day FROM reviews_log ORDER BY day DESC
  `).all().map(r => r.day);

  const todayLocal = localToday();
  let streak = 0;
  let expected = todayLocal;

  for (const day of reviewDates) {
    if (day === expected) {
      streak++;
      const d = new Date(expected + 'T12:00:00'); // noon to avoid DST edge cases
      d.setDate(d.getDate() - 1);
      expected = d.toLocaleDateString('en-CA');
    } else break;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const reviewedDays = db.prepare(`
    SELECT DISTINCT date(reviewed_at) AS day FROM reviews_log WHERE date(reviewed_at) >= ?
  `).all(sevenDaysAgo.toLocaleDateString('en-CA')).map(r => r.day);

  const weakCards = db.prepare(`
    SELECT f.id, f.question, f.easiness_factor, t.name AS topic_name
    FROM flashcards f
    JOIN topics t ON t.id = f.topic_id
    WHERE f.due_date IS NOT NULL
    ORDER BY f.easiness_factor ASC, f.repetitions ASC
    LIMIT 5
  `).all();

  const todayCount = db.prepare(`
    SELECT COUNT(*) AS count FROM reviews_log WHERE date(reviewed_at) = ?
  `).get(todayLocal).count;

  res.json({ streak, reviewedDays, weakCards, todayCount });
});

// ---

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
