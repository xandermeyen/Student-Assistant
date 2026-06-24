import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// __dirname is not available in ES modules, so we derive it from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'study.db'));

db.pragma('journal_mode = WAL'); // better write performance
db.pragma('foreign_keys = ON');  // enforce ON DELETE CASCADE

db.exec(`
  CREATE TABLE IF NOT EXISTS topics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flashcards (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id          INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question          TEXT NOT NULL,
    answer            TEXT NOT NULL,
    easiness_factor   REAL    DEFAULT 2.5,
    interval_days     INTEGER DEFAULT 1,
    repetitions       INTEGER DEFAULT 0,
    due_date          TEXT    DEFAULT NULL
  );
`);

// Reviews log: one row per review session, used for streak and weak-card tracking
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id     INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    correct     INTEGER NOT NULL,
    reviewed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// Add SRS columns to existing databases that were created before Stage 5
for (const col of [
  'easiness_factor REAL DEFAULT 2.5',
  'interval_days INTEGER DEFAULT 1',
  'repetitions INTEGER DEFAULT 0',
  'due_date TEXT DEFAULT NULL',
]) {
  try { db.exec(`ALTER TABLE flashcards ADD COLUMN ${col}`); } catch (err) {
    if (!err.message.includes('duplicate column')) console.warn('Migration warning:', err.message);
  }
}

// Indexes for columns used in WHERE and ORDER BY clauses
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_flashcards_topic_id ON flashcards(topic_id);
  CREATE INDEX IF NOT EXISTS idx_flashcards_due_date  ON flashcards(due_date);
  CREATE INDEX IF NOT EXISTS idx_reviews_log_date     ON reviews_log(reviewed_at);
`);

export default db;
