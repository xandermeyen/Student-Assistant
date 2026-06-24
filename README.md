# Recall

A personal study assistant that turns your notes and PDFs into flashcards, quizzes, and spaced-repetition review sessions — powered by Google Gemini AI.

## Features

- Generate flashcards from pasted text or uploaded PDF files
- Three study modes: flashcard view, open practice (type your full answer), and quiz
- Quiz mixes multiple choice and fill-in-the-blank questions automatically
- Spaced repetition (SM-2) schedules cards based on how well you know them
- AI explanation when you get a quiz answer wrong
- Mastery percentage and study streak tracked per topic
- Search across all topics and card content
- Edit, rename, and delete topics and individual cards
- Export topics as JSON files to share with classmates, import theirs back
- Full data backup with a single click

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
- Your study data is stored locally in `backend/study.db`. Use the "Export all data" button on the dashboard to keep a backup.

## Project structure

```
recall/
  backend/
    server.js     Express API and AI routes
    db.js         SQLite setup and schema
    .env          Your API key (not committed)
  frontend/
    src/
      App.jsx     All React screens and logic
      App.css     Styles
```
