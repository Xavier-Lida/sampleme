'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { exportMidi, transcribeAudio } from '@/lib/api';
import { blobToWav, playMelody } from '@/lib/audio';
import {
  getInstrumentLabel,
  type PlaybackInstrumentId,
} from '@/lib/music/partition-instruments';
import type { TranscriptionResult } from '@/types/transcription';

const INSTRUMENT_OPTIONS: readonly PlaybackInstrumentId[] = [
  'piano',
  'guitar-acoustic',
];

// VexFlow touches the DOM directly — keep it client-only.
const SheetMusicRenderer = dynamic(() => import('@/components/SheetMusicRenderer'), { ssr: false });

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export default function Page() {
  const { start, stop, status, error, isRecording } = useAudioRecorder({ click: true });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [lastWav, setLastWav] = useState<Blob | null>(null);
  const [instrument, setInstrument] = useState<PlaybackInstrumentId>('piano');

  async function handleStop() {
    const blob = await stop();
    if (!blob) return;
    setBusy(true);
    setApiError(null);
    try {
      const wav = await blobToWav(blob);
      setLastWav(wav);
      setResult(await transcribeAudio(wav));
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
        <SheetMusicRenderer notes={result?.notes ?? []} />
      </div>

      {result && result.notes.length > 0 && (
        <p className="status" style={{ marginTop: 12, fontFamily: 'ui-monospace, monospace' }}>
          Notes ({result.notes.length}):{' '}
          {result.notes.map((n) => midiToName(n.pitch)).join(' ')}
        </p>
      )}
    </main>
  );
}
