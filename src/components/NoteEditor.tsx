'use client';

import { useState } from 'react';
import type { Note } from '@/types/transcription';
import { SIXTEENTH_SECONDS } from '@/types/transcription';
import { midiToPitch } from '@/lib/music/pitch';
import {
  DURATION_OPTIONS,
  getNextAppendStart,
  secondsToSixteenthSlot,
  sixteenthSlotToSeconds,
} from '@/lib/music/note-editing';

interface Props {
  notes: Note[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: (pitch: number, start: number, duration: number) => void;
}

const PITCH_OPTIONS = Array.from({ length: 37 }, (_, i) => 48 + i);

export default function NoteEditor({
  notes,
  selectedIndex,
  onSelect,
  onRemove,
  onAdd,
}: Props) {
  const [pitch, setPitch] = useState(60);
  const [startSlot, setStartSlot] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(SIXTEENTH_SECONDS);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd(pitch, sixteenthSlotToSeconds(startSlot), durationSeconds);
    setStartSlot(secondsToSixteenthSlot(getNextAppendStart(notes)) + 1);
  }

  function formatDuration(note: Note): string {
    const sixteenths = Math.round((note.end - note.start) / SIXTEENTH_SECONDS);
    if (sixteenths >= 4) return 'quarter';
    if (sixteenths >= 2) return '8th';
    return '16th';
  }

  return (
    <section className="note-editor" aria-label="Note editor">
      <div className="note-editor-header">
        <h2>Notes ({notes.length})</h2>
        <p className="status">Click a note in the list or on the sheet to select it.</p>
      </div>

      {notes.length > 0 ? (
        <div className="note-list-wrap">
          <table className="note-list">
            <thead>
              <tr>
                <th>#</th>
                <th>Pitch</th>
                <th>Start</th>
                <th>Duration</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {notes.map((note, index) => (
                <tr
                  key={`${index}-${note.start}-${note.pitch}`}
                  className={selectedIndex === index ? 'selected' : undefined}
                  onClick={() => onSelect(index)}
                >
                  <td>{index + 1}</td>
                  <td>{midiToPitch(note.pitch)}</td>
                  <td>{secondsToSixteenthSlot(note.start)}</td>
                  <td>{formatDuration(note)}</td>
                  <td>
                    <button
                      type="button"
                      className="note-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(index);
                      }}
                      aria-label={`Remove note ${midiToPitch(note.pitch)}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="status">No notes — add one below or click the staff.</p>
      )}

      <form className="note-add-form" onSubmit={handleSubmit}>
        <h3>Add note</h3>
        <div className="note-add-fields">
          <label>
            Pitch
            <select value={pitch} onChange={(e) => setPitch(Number(e.target.value))}>
              {PITCH_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {midiToPitch(p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start (16th slot)
            <input
              type="number"
              min={0}
              value={startSlot}
              onChange={(e) => setStartSlot(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <label>
            Duration
            <select
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.label} value={d.seconds}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Add</button>
        </div>
      </form>
    </section>
  );
}
