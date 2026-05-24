'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import NoteEditor from '@/components/NoteEditor';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { exportMidi, transcribeAudio } from '@/lib/api';
import { blobToWav, playMelody } from '@/lib/audio';
import {
  addNote,
  getNextAppendStart,
  removeNoteAt,
  sortNotesByStart,
} from '@/lib/music/note-editing';
import {
  getInstrumentLabel,
  type PlaybackInstrumentId,
} from '@/lib/music/partition-instruments';
import type { Note, TranscriptionResult } from '@/types/transcription';
import { SIXTEENTH_SECONDS } from '@/types/transcription';

const INSTRUMENT_OPTIONS: readonly PlaybackInstrumentId[] = [
  'piano',
  'guitar-acoustic',
];

const SheetMusicRenderer = dynamic(() => import('@/components/SheetMusicRenderer'), { ssr: false });

export default function Page() {
  const { start, stop, status, error, isRecording } = useAudioRecorder({ click: true });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [lastWav, setLastWav] = useState<Blob | null>(null);
  const [instrument, setInstrument] = useState<PlaybackInstrumentId>('piano');
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const originalNotesRef = useRef<Note[] | null>(null);

  const updateNotes = useCallback((notes: Note[], selected: number | null) => {
    setResult((prev) => (prev ? { ...prev, notes } : prev));
    setSelectedNoteIndex(selected);
  }, []);

  const handleRemoveNote = useCallback(
    (index: number) => {
      if (!result) return;
      const { notes, selectedIndex } = removeNoteAt(result.notes, index);
      updateNotes(notes, selectedIndex);
    },
    [result, updateNotes],
  );

  const handleAddNote = useCallback(
    (pitch: number, start: number, duration: number) => {
      if (!result) return;
      const { notes, selectedIndex } = addNote(result.notes, { pitch, start, duration });
      updateNotes(notes, selectedIndex);
    },
    [result, updateNotes],
  );

  const handleStaffClick = useCallback(
    (pitch: number) => {
      if (!result) return;
      const startTime = getNextAppendStart(result.notes);
      const { notes, selectedIndex } = addNote(result.notes, {
        pitch,
        start: startTime,
        duration: SIXTEENTH_SECONDS,
      });
      updateNotes(notes, selectedIndex);
    },
    [result, updateNotes],
  );

  const handleResetNotes = useCallback(() => {
    if (!result || !originalNotesRef.current) return;
    updateNotes([...originalNotesRef.current], null);
  }, [result, updateNotes]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteIndex !== null && result) {
        e.preventDefault();
        handleRemoveNote(selectedNoteIndex);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNoteIndex, result, handleRemoveNote]);

  async function handleStop() {
    const blob = await stop();
    if (!blob) return;
    setBusy(true);
    setApiError(null);
    try {
      const wav = await blobToWav(blob);
      setLastWav(wav);
      const transcription = await transcribeAudio(wav);
      const sortedNotes = sortNotesByStart(transcription.notes);
      originalNotesRef.current = sortedNotes;
      setResult({ ...transcription, notes: sortedNotes });
      setSelectedNoteIndex(null);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadMidi() {
    if (!result) return;
    const blob = await exportMidi(result.notes, result.bpm);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.mid';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadRecording() {
    if (!lastWav) return;
    const url = URL.createObjectURL(lastWav);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hum-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePlay() {
    if (!result || result.notes.length === 0) return;
    setPlaying(true);
    try {
      await playMelody(result.notes, instrument);
    } finally {
      setPlaying(false);
    }
  }

  const notesEdited =
    result &&
    originalNotesRef.current &&
    JSON.stringify(result.notes) !== JSON.stringify(originalNotesRef.current);

  return (
    <main>
      <h1>musicMe</h1>
      <p className="subtitle">Hum into the mic — locked at 120 BPM, quantized to 16th notes.</p>

      <div className="controls">
        {!isRecording ? (
          <button onClick={start} disabled={busy || status === 'requesting'}>
            {status === 'requesting' ? 'Requesting mic…' : 'Record'}
          </button>
        ) : (
          <button onClick={handleStop} className="secondary">
            Stop
          </button>
        )}
        <button
          onClick={handlePlay}
          disabled={!result || result.notes.length === 0 || playing}
          className="secondary"
        >
          {playing ? 'Playing…' : `Play (${getInstrumentLabel(instrument)})`}
        </button>
        <div
          className="instrument-picker"
          role="radiogroup"
          aria-label="Instrument"
        >
          {INSTRUMENT_OPTIONS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={instrument === id}
              className={`segment ${instrument === id ? 'active' : ''}`}
              onClick={() => setInstrument(id)}
              disabled={playing}
            >
              {getInstrumentLabel(id)}
            </button>
          ))}
        </div>
        <button
          onClick={() => selectedNoteIndex !== null && handleRemoveNote(selectedNoteIndex)}
          disabled={selectedNoteIndex === null || playing}
          className="secondary"
        >
          Delete selected
        </button>
        <button
          onClick={handleResetNotes}
          disabled={!notesEdited || playing}
          className="secondary"
        >
          Reset notes
        </button>
        <button onClick={handleDownloadMidi} disabled={!result || result.notes.length === 0} className="secondary">
          Download MIDI
        </button>
        <button onClick={handleDownloadRecording} disabled={!lastWav} className="secondary">
          Download recording (.wav)
        </button>
        <span className="status">
          {busy ? 'Transcribing…' : isRecording ? 'Recording with click track…' : 'Idle'}
        </span>
      </div>

      {error && <p className="error">Mic error: {error}</p>}
      {apiError && <p className="error">{apiError}</p>}

      <div className="sheet-frame">
        <SheetMusicRenderer
          notes={result?.notes ?? []}
          selectedIndex={selectedNoteIndex}
          onNoteSelect={setSelectedNoteIndex}
          onStaffClick={result ? handleStaffClick : undefined}
        />
      </div>

      {result && (
        <NoteEditor
          notes={result.notes}
          selectedIndex={selectedNoteIndex}
          onSelect={setSelectedNoteIndex}
          onRemove={handleRemoveNote}
          onAdd={handleAddNote}
        />
      )}
    </main>
  );
}
