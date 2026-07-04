# Recall

A personal study assistant that turns your notes and PDFs into flashcards, quizzes, and spaced-repetition review sessions, powered by Google Gemini AI.

## Features

- Generate flashcards from pasted text or uploaded PDF files
- Three study modes: flashcard view, open practice (type your full answer), and quiz
- Quiz mixes multiple choice and fill-in-the-blank questions automatically
- Spaced repetition (SM-2) with three-level grading: missed, almost, got it
- Review all due cards across every topic in one session
- Exam mode: set a test date per topic and cards are never scheduled past it
- AI explanation when you get a quiz answer wrong
- Mastery percentage and study streak tracked per topic
- Keyboard shortcuts for every study mode
- Dark mode
- Search across all topics and card content
- Edit, rename, and delete topics and individual cards, with undo on delete
- Export topics as JSON files to share with classmates, import theirs back
- Full data backup with a single click

## Keyboard shortcuts

| Screen | Keys |
| --- | --- |
| Flashcards | Space to flip, arrow keys to navigate |
| Review | Space to flip, then 1 missed, 2 almost, 3 got it |
| Practice | Ctrl+Enter to check, then 1 missed, 2 almost, 3 got it |
| Quiz | 1-4 to pick an answer, Enter for the next question |

## Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite via better-sqlite3
- **AI**: Google Gemini API (free tier)

## Prerequisites

- Node.js 18 or higher
- pnpm (`npm install -g pnpm`)
- A free Gemini API key from [aistudio.google.com](https://aistudio.google.com/app/apikey)

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/xandermeyen/Student-Assistant.git
   cd Student-Assistant
   ```

2. Install all dependencies:
   ```bash
   pnpm install
   pnpm --dir backend install
   pnpm --dir frontend install
   ```

3. Create the environment file:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Open `backend/.env` and replace `your_gemini_api_key_here` with your actual key.

4. Start the app:
   ```bash
   pnpm dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage notes

- The free Gemini tier allows roughly 20 generations per day and 5 per minute. Use it wisely during a study session.
- PDFs must be text-based. Scanned image PDFs cannot be parsed.
- Your study data is stored locally in `backend/study.db`. Use the "Export all" button on the dashboard to keep a backup.

## Project structure

```
recall/
  backend/
    server.js             Express API, Gemini routes, SM-2 scheduling
    db.js                 SQLite setup, schema, and migrations
    .env                  Your API key (not committed)
  frontend/
    src/
      App.jsx             Screen routing and shared state
      App.css             Styles and light/dark themes
      api.js              Fetch wrapper shared by all screens
      utils/
        quiz.js           Quiz building and shuffle helpers
        format.js         Dates, mastery, download helpers
      components/
        Sidebar.jsx       Navigation, streak widget, theme toggle
        Dashboard.jsx     Topic grid, search, import/export
        CreateTopic.jsx   Text/PDF input and card generation
        Flashcards.jsx    Flip-card study view
        EditCards.jsx     Card editor
        Review.jsx        Spaced-repetition review session
        Practice.jsx      Open practice mode
        Quiz.jsx          Mixed quiz mode
```
