import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function CreateTopic({ onBack, onCreated }) {
  const [inputMode, setInputMode] = useState('text');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [pdfStatus, setPdfStatus] = useState('idle'); // idle | loading | error
  const [pdfError, setPdfError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [genStatus, setGenStatus] = useState('idle'); // idle | loading | error
  const [genError, setGenError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown]);

  async function handlePdfFile(file) {
    if (!file || file.type !== 'application/pdf') { setPdfError('Please upload a PDF file.'); setPdfStatus('error'); return; }
    setPdfStatus('loading');
    setPdfError('');
    setText('');
    const form = new FormData();
    form.append('pdf', file);
    try {
      const data = await api.upload('/api/parse-pdf', form);
      setText(data.text);
      setPdfStatus('idle');
    } catch (err) {
      setPdfError(err.message);
      setPdfStatus('error');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    handlePdfFile(e.dataTransfer.files[0]);
  }

  const busy = genStatus === 'loading' || pdfStatus === 'loading';
  const canGenerate = title.trim() && text.trim() && cooldown === 0 && !busy;

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenStatus('loading');
    setGenError('');
    try {
      const genData = await api.post('/api/generate', { text });
      const saved = await api.post('/api/topics', { name: title.trim(), flashcards: genData.flashcards });
      onCreated(saved.id);
    } catch (err) {
      if (err.status === 429) setCooldown(60);
      setGenError(err.message);
      setGenStatus('error');
    }
  }

  return (
    <div className="screen-pad screen-narrow">
      <button className="back-link" onClick={onBack}>&larr; Back to dashboard</button>
      <h1 className="screen-title">Create a new topic</h1>
      <p className="screen-sub">Paste your notes or upload a PDF and we'll turn them into flashcards.</p>

      <label className="field-label">Topic name</label>
      <input
        className="field-input" value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Cell Biology, Chapter 3"
      />

      <div className="input-mode-toggle">
        <button
          className={`mode-btn ${inputMode === 'text' ? 'mode-active' : ''}`}
          onClick={() => { setInputMode('text'); setText(''); setPdfStatus('idle'); }}
        >Paste text</button>
        <button
          className={`mode-btn ${inputMode === 'pdf' ? 'mode-active' : ''}`}
          onClick={() => { setInputMode('pdf'); setText(''); }}
        >Upload PDF</button>
      </div>

      {inputMode === 'text' && (
        <textarea
          className="field-textarea" rows={10} value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your notes, a paragraph, or any text about the topic..."
        />
      )}

      {inputMode === 'pdf' && (
        <div
          className={`pdf-upload-area ${isDragging ? 'pdf-dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
          onDrop={handleDrop}
        >
          <input type="file" accept=".pdf" id="pdf-input" style={{ display: 'none' }} onChange={e => handlePdfFile(e.target.files[0])} />
          <label htmlFor="pdf-input" className="pdf-upload-label">
            {pdfStatus === 'loading' ? 'Reading PDF...'
              : text ? 'PDF loaded, text extracted. Click or drop to replace.'
              : isDragging ? 'Drop your PDF here'
              : 'Drag a PDF here, or click to browse'}
          </label>
          {pdfStatus === 'error' && <div className="error-box">{pdfError}</div>}
          {text && pdfStatus !== 'error' && <p className="pdf-preview">{text.slice(0, 200)}...</p>}
        </div>
      )}

      <div className="create-footer">
        <span className="muted">{text.trim() ? 'Ready to generate' : 'Add content to get started'}</span>
        <button
          className={`accent-btn ${!canGenerate ? 'btn-disabled' : ''}`}
          onClick={handleGenerate} disabled={!canGenerate}
        >
          {cooldown > 0 ? `Wait ${cooldown}s...` : genStatus === 'loading' ? 'Generating...' : 'Generate cards'}
        </button>
      </div>
      {genStatus === 'error' && <div className="error-box">{genError}</div>}
    </div>
  );
}
