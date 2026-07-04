import { useState, useEffect } from 'react';
import { api } from '../api';

export default function EditCards({ topic, onBack }) {
  const [cards, setCards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ question: '', answer: '' });
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState({ question: '', answer: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/topics/${topic.id}`)
      .then(data => setCards(data.flashcards))
      .catch(err => setError(err.message));
  }, [topic.id]);

  async function saveEdit(cardId) {
    if (!draft.question.trim() || !draft.answer.trim()) return;
    try {
      await api.put(`/api/cards/${cardId}`, draft);
      setCards(prev => prev.map(c => (c.id === cardId ? { ...c, ...draft } : c)));
      setEditingId(null);
    } catch (err) { setError(err.message); }
  }

  async function removeCard(cardId) {
    try {
      await api.del(`/api/cards/${cardId}`);
      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (err) { setError(err.message); }
  }

  async function addCard() {
    if (!newDraft.question.trim() || !newDraft.answer.trim()) return;
    try {
      const created = await api.post(`/api/topics/${topic.id}/cards`, newDraft);
      setCards(prev => [...prev, created]);
      setNewDraft({ question: '', answer: '' });
      setAdding(false);
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="screen-pad screen-narrow">
      <div className="top-bar">
        <button className="back-link" onClick={onBack}>&larr; Back to flashcards</button>
        <span className="index-label">{cards.length} cards</span>
      </div>
      <h1 className="screen-title title-gap">{topic.name}</h1>
      <p className="screen-sub">Edit or delete cards, or add new ones manually.</p>

      {error && <div className="error-box">{error}</div>}

      <div className="edit-cards-list">
        {cards.map((card, i) => (
          <div key={card.id} className="edit-card-row">
            {editingId === card.id ? (
              <div className="edit-card-form">
                <label className="field-label no-gap">Question</label>
                <textarea
                  className="field-textarea small-area" value={draft.question}
                  onChange={e => setDraft(d => ({ ...d, question: e.target.value }))}
                />
                <label className="field-label">Answer</label>
                <textarea
                  className="field-textarea small-area" value={draft.answer}
                  onChange={e => setDraft(d => ({ ...d, answer: e.target.value }))}
                />
                <div className="edit-card-actions">
                  <button className="cancel-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  <button className="accent-btn compact-btn" onClick={() => saveEdit(card.id)}>Save</button>
                </div>
              </div>
            ) : (
              <div className="edit-card-preview">
                <span className="edit-card-num">{i + 1}</span>
                <div className="edit-card-text">
                  <p className="edit-card-q">{card.question}</p>
                  <p className="edit-card-a">{card.answer}</p>
                </div>
                <div className="edit-card-btns">
                  <button className="icon-btn" onClick={() => { setEditingId(card.id); setDraft({ question: card.question, answer: card.answer }); }}>Edit</button>
                  <button className="icon-btn danger-icon" onClick={() => removeCard(card.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="edit-card-form add-card-form">
          <label className="field-label no-gap">Question</label>
          <textarea
            className="field-textarea small-area" value={newDraft.question}
            onChange={e => setNewDraft(d => ({ ...d, question: e.target.value }))}
            placeholder="Enter the question..."
          />
          <label className="field-label">Answer</label>
          <textarea
            className="field-textarea small-area" value={newDraft.answer}
            onChange={e => setNewDraft(d => ({ ...d, answer: e.target.value }))}
            placeholder="Enter the answer..."
          />
          <div className="edit-card-actions">
            <button className="cancel-btn" onClick={() => { setAdding(false); setNewDraft({ question: '', answer: '' }); }}>Cancel</button>
            <button
              className="accent-btn compact-btn" onClick={addCard}
              disabled={!newDraft.question.trim() || !newDraft.answer.trim()}
            >Add card</button>
          </div>
        </div>
      ) : (
        <button className="add-card-btn" onClick={() => setAdding(true)}>+ Add a card manually</button>
      )}
    </div>
  );
}
