'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  MicrophoneIcon,
  PauseIcon,
  PlayIcon,
  ShareNetworkIcon,
  StopIcon,
  ArrowClockwiseIcon,
  FilePdfIcon,
  PencilSimpleIcon,
} from '@phosphor-icons/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ProjectInfoPanel } from '@/components/project/ProjectInfoPanel';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioTracks } from '@/hooks/useAudioTracks';
import { useMelodyPlayback } from '@/hooks/useMelodyPlayback';
import { useProjectMetadata } from '@/hooks/useProjectMetadata';
import { DEFAULT_CLEANUP_OPTIONS, transcribeAudio } from '@/lib/api';
import { blobToWav } from '@/lib/audio';
import { sortNotesByStart } from '@/lib/music/note-editing';
import {
  getInstrumentOptions,
  type PlaybackInstrumentId,
} from '@/lib/music/partition-instruments';
import { encodeShareUrl, decodeShareFromHash } from '@/lib/share';
import { sessionCache } from '@/lib/sessionCache';
import { exportPartitionToPdf } from '@/lib/pdf-export';
import { cn } from '@/lib/utils';
import type { DisplayNote } from '@/types/display';

const SheetMusicRenderer = dynamic(
  () => import('@/components/SheetMusicRenderer'),
  { ssr: false },
);

type Stage = 'idle' | 'recording' | 'transcribing' | 'result';

function fmtTimer(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Fullscreen mic visualizer — concentric circles that pulse to the input RMS.
// Pure-DOM transforms so we don't trigger React renders at 60fps.
function FullScreenMicViz({ analyserRef, active }: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  active: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const ringEls = Array.from(container.querySelectorAll<HTMLDivElement>('[data-ring]'));
    const analyser = analyserRef.current;
    if (!analyser) return;

    const buf = new Uint8Array(analyser.fftSize);
    const history: number[] = new Array(ringEls.length).fill(0);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const amp = Math.min(1, rms * 4.5);
      for (let i = history.length - 1; i > 0; i--) history[i] = history[i - 1] * 0.92;
      history[0] = amp;
      ringEls.forEach((el, i) => {
        const scale = 1 + history[i] * (0.5 + i * 0.6);
        const opacity = Math.max(0.04, 0.45 - i * 0.07) * (0.3 + history[i] * 1.4);
        el.style.transform = `scale(${scale})`;
        el.style.opacity = String(opacity);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, analyserRef]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      aria-hidden
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          data-ring
          className="absolute rounded-full will-change-transform"
          style={{
            width: 220,
            height: 220,
            background: 'radial-gradient(circle, rgba(220,70,120,0.45) 0%, rgba(120,60,200,0.15) 60%, transparent 80%)',
            transition: 'transform 80ms linear, opacity 80ms linear',
          }}
        />
      ))}
    </div>
  );
}

export function MobileApp() {
  const [stage, setStage] = useState<Stage>('idle');
  const [apiError, setApiError] = useState<string | null>(null);
  const [recStartTs, setRecStartTs] = useState<number>(0);
  const [recElapsed, setRecElapsed] = useState<number>(0);
  const [infoOpen, setInfoOpen] = useState(false);
  // Gate persistence: don't write to IDB until we've finished reading from it,
  // otherwise the initial empty state would clobber whatever was saved before.
  const [restored, setRestored] = useState(false);

  const { start, stop, status, error, isRecording, analyserRef } = useAudioRecorder({
    click: false,
  });
  const { metadata, updateField } = useProjectMetadata();
  const { tracks, setTracks, addTrack, setTrackInstrument, clearTracks } = useAudioTracks();
  const sheetSvgRef = useRef<SVGSVGElement | null>(null);

  // Mobile flow stays single-track: keep only the most recent recording.
  const activeTrack = tracks[tracks.length - 1] ?? null;
  const [instrument, setInstrument] = useState<PlaybackInstrumentId>('piano');

  // Whenever instrument changes, push it to the active track so playback uses it.
  useEffect(() => {
    if (activeTrack && activeTrack.instrument !== instrument) {
      setTrackInstrument(activeTrack.id, instrument);
    }
  }, [instrument, activeTrack, setTrackInstrument]);

  const playback = useMelodyPlayback({ tracks });

  // Recording timer (UI only, doesn't drive state).
  useEffect(() => {
    if (stage !== 'recording') return;
    const id = window.setInterval(() => {
      setRecElapsed(Date.now() - recStartTs);
    }, 100);
    return () => window.clearInterval(id);
  }, [stage, recStartTs]);

  useEffect(() => {
    if (error) toast.error('Erreur micro', { description: error });
  }, [error]);

  // Restore on mount: shared link wins over the cached session.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (hash && hash.includes('s=')) {
          // eslint-disable-next-line no-console
          console.info('[SampleMe] Restoring from share hash', hash.slice(0, 60) + '…');
          const shared = decodeShareFromHash(hash);
          if (shared && shared.tracks.length > 0) {
            setTracks(shared.tracks);
            (Object.keys(shared.metadata) as Array<keyof typeof shared.metadata>).forEach(
              (k) => updateField(k, shared.metadata[k] as never),
            );
            setInstrument(shared.tracks[shared.tracks.length - 1].instrument);
            setStage('result');
            // Drop the hash so a manual reload restores from cache, not the link.
            history.replaceState(null, '', window.location.pathname + window.location.search);
            return;
          }
          // Decode failed or empty payload — let the user know rather than
          // silently falling through to the idle screen.
          // eslint-disable-next-line no-console
          console.warn('[SampleMe] Share decode produced no tracks', { shared });
          toast.error('Lien de partage invalide ou expiré');
        }
        const cached = await sessionCache.load();
        if (cancelled || !cached?.tracks?.length) return;
        setTracks(cached.tracks);
        setInstrument(cached.tracks[cached.tracks.length - 1].instrument);
        setStage('result');
      } catch (e) {
        console.error('Failed to restore mobile session', e);
        toast.error('Erreur de chargement', {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled) setRestored(true);
      }
    }
    restore();
    return () => { cancelled = true; };
  }, [setTracks, updateField]);

  // Persist tracks whenever they change (after the initial restore completes).
  // Clearing tracks wipes the cache so "Refaire" really resets the session.
  useEffect(() => {
    if (!restored) return;
    if (tracks.length === 0) {
      sessionCache.clear().catch(() => undefined);
      return;
    }
    sessionCache
      .save({
        tracks,
        options: DEFAULT_CLEANUP_OPTIONS,
        createdAt: Date.now(),
      })
      .catch((e) => console.error('Failed to persist mobile session', e));
  }, [tracks, restored]);

  // Wire up tracks → displayNotes for the partition preview.
  const displayNotes: DisplayNote[] = useMemo(() => {
    if (!activeTrack) return [];
    return activeTrack.notes.map((note, indexInTrack) => ({
      note,
      trackId: activeTrack.id,
      indexInTrack,
      color: activeTrack.color,
      instrument: activeTrack.instrument,
    }));
  }, [activeTrack]);

  const handleStartRecord = useCallback(async () => {
    setApiError(null);
    // Wipe any previous take — mobile keeps one melody at a time.
    if (tracks.length > 0) clearTracks();
    playback.stop();
    await start();
    setRecStartTs(Date.now());
    setRecElapsed(0);
    setStage('recording');
  }, [start, tracks.length, clearTracks, playback]);

  const handleStopRecord = useCallback(async () => {
    const blob = await stop();
    if (!blob) {
      setStage('idle');
      return;
    }
    setStage('transcribing');
    try {
      const wav = await blobToWav(blob);
      const transcription = await transcribeAudio(wav, DEFAULT_CLEANUP_OPTIONS);
      const sortedNotes = sortNotesByStart(transcription.notes);
      const rawNotes = transcription.raw_notes ?? transcription.notes;
      await addTrack({
        blob: wav,
        name: metadata.name || 'Ma mélodie',
        notes: sortedNotes,
        rawNotes,
        instrument,
      });
      setStage('result');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setApiError(message);
      toast.error('Transcription échouée', { description: message });
      setStage('idle');
    }
  }, [stop, addTrack, metadata.name, instrument]);

  const handleReset = useCallback(() => {
    playback.stop();
    clearTracks();
    setApiError(null);
    setStage('idle');
  }, [clearTracks, playback]);

  const handleShare = useCallback(async () => {
    if (!activeTrack) return;
    const url = encodeShareUrl(window.location.origin, metadata, [activeTrack]);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API blocked (non-https, permissions) → fall back to prompt.
      window.prompt('Copie le lien :', url);
    }
  }, [activeTrack, metadata]);

  const handleExportPdf = useCallback(async () => {
    if (!sheetSvgRef.current || displayNotes.length === 0) {
      toast.error('Rien à exporter');
      return;
    }
    try {
      await exportPartitionToPdf({ svgElement: sheetSvgRef.current, metadata });
      toast.success('PDF généré');
    } catch (e) {
      toast.error("Échec de l'export", { description: String(e) });
    }
  }, [metadata, displayNotes.length]);

  const instrumentOptions = useMemo(() => getInstrumentOptions(), []);

  // ─────────────────────────────────────────────── render

  return (
    <div className="mobile-app">
      {/* Top bar — read-only title display + edit button (opens info sheet) */}
      <header className="mobile-header">
        <div className="mobile-logo">S</div>
        <div className="mobile-title-display" title={metadata.name || 'Ma mélodie'}>
          {metadata.name?.trim() || 'Ma mélodie'}
        </div>
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="Modifier les infos de la partition"
          className="mobile-header-edit-btn"
        >
          <PencilSimpleIcon size={18} />
        </button>
      </header>

      {/* Edit sheet — same ProjectInfoPanel as desktop sidebar */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Informations de la partition</SheetTitle>
          </SheetHeader>
          <ProjectInfoPanel metadata={metadata} onFieldChange={updateField} />
        </SheetContent>
      </Sheet>

      {/* Body — switches per stage */}
      <main className="mobile-body">
        {apiError && stage === 'idle' && (
          <div className="mobile-error">⚠ {apiError}</div>
        )}

        {stage === 'idle' && (
          <IdleScreen
            onRecord={handleStartRecord}
            requestingMic={status === 'requesting'}
          />
        )}

        {stage === 'recording' && (
          <RecordingScreen
            analyserRef={analyserRef}
            elapsedMs={recElapsed}
            onStop={handleStopRecord}
            isRecording={isRecording}
          />
        )}

        {stage === 'transcribing' && <TranscribingScreen />}

        {stage === 'result' && activeTrack && (
          <ResultScreen
            displayNotes={displayNotes}
            instrument={instrument}
            instrumentOptions={instrumentOptions}
            onInstrumentChange={setInstrument}
            isPlaying={playback.isPlaying}
            currentTime={playback.currentTime}
            duration={playback.duration}
            onTogglePlay={() => playback.togglePlayPause()}
            onSeek={playback.seek}
            onShare={handleShare}
            onPdf={handleExportPdf}
            onReset={handleReset}
            onSvgReady={(svg) => { sheetSvgRef.current = svg; }}
            // Hidden refs to satisfy TS — unused on mobile
            _setTracks={setTracks}
          />
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stage subcomponents — kept inline so the whole mobile flow is one file.

function IdleScreen({ onRecord, requestingMic }: {
  onRecord: () => void;
  requestingMic: boolean;
}) {
  return (
    <div className="mobile-stage mobile-stage--idle">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-3">Hum it.</h1>
        <p className="text-base text-muted-foreground">
          Fredonne ta mélodie, on s&apos;occupe du reste.
        </p>
      </div>

      <button
        type="button"
        onClick={onRecord}
        disabled={requestingMic}
        className="mobile-record-btn"
        aria-label="Démarrer l'enregistrement"
      >
        {requestingMic ? (
          <div className="size-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <MicrophoneIcon size={64} weight="fill" />
        )}
      </button>

      <p className="text-xs text-muted-foreground/70 mt-6 tracking-wider uppercase">
        {requestingMic ? 'Autorise le micro…' : 'Tape pour enregistrer'}
      </p>
    </div>
  );
}

function RecordingScreen({
  analyserRef,
  elapsedMs,
  onStop,
  isRecording,
}: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  elapsedMs: number;
  onStop: () => void;
  isRecording: boolean;
}) {
  return (
    <div className="mobile-stage mobile-stage--recording">
      <FullScreenMicViz analyserRef={analyserRef} active={isRecording} />

      <div className="relative z-10 flex flex-col items-center">
        <p className="text-xs text-white/70 tracking-[0.3em] uppercase mb-2">
          Enregistrement
        </p>
        <p className="font-mono text-4xl font-bold text-white tabular-nums mb-12">
          {fmtTimer(elapsedMs)}
        </p>

        <button
          type="button"
          onClick={onStop}
          className="mobile-stop-btn"
          aria-label="Arrêter l'enregistrement"
        >
          <StopIcon size={48} weight="fill" />
        </button>

        <p className="text-xs text-white/60 mt-6 tracking-wider uppercase">
          Tape pour arrêter
        </p>
      </div>
    </div>
  );
}

function TranscribingScreen() {
  return (
    <div className="mobile-stage mobile-stage--transcribing">
      <div className="mobile-loading-rings">
        <div className="mobile-loading-ring" />
        <div className="mobile-loading-ring" />
        <div className="mobile-loading-ring" />
      </div>
      <p className="text-base font-semibold mt-8">Décodage de ta mélodie…</p>
      <p className="text-xs text-muted-foreground mt-1">Ça peut prendre quelques secondes</p>
    </div>
  );
}

function ResultScreen({
  displayNotes,
  instrument,
  instrumentOptions,
  onInstrumentChange,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
  onShare,
  onPdf,
  onReset,
  onSvgReady,
}: {
  displayNotes: DisplayNote[];
  instrument: PlaybackInstrumentId;
  instrumentOptions: { id: PlaybackInstrumentId; label: string }[];
  onInstrumentChange: (id: PlaybackInstrumentId) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (s: number) => void;
  onShare: () => void;
  onPdf: () => void;
  onReset: () => void;
  onSvgReady: (svg: SVGSVGElement | null) => void;
  _setTracks?: unknown;
}) {
  const sheetWidth = Math.max(280, displayNotes.length * 32 + 140);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mobile-stage mobile-stage--result">
      {/* Partition preview — scrollable horizontally */}
      <div className="mobile-sheet-card daw-sheet-inner">
        <div className="daw-sheet-frame p-3" style={{ width: sheetWidth }}>
          <SheetMusicRenderer
            displayNotes={displayNotes}
            width={sheetWidth - 24}
            timelineDuration={duration}
            selectedNoteRef={null}
            activeTrackInstrument={instrument}
            onSvgReady={onSvgReady}
          />
        </div>
      </div>

      {/* Instrument chips */}
      <div className="mobile-instrument-row">
        {instrumentOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onInstrumentChange(opt.id)}
            className={cn(
              'mobile-instrument-chip',
              instrument === opt.id && 'mobile-instrument-chip--active',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Playback bar */}
      <div className="mobile-playback">
        <button
          type="button"
          onClick={onTogglePlay}
          className="mobile-play-btn"
          aria-label={isPlaying ? 'Pause' : 'Lecture'}
        >
          {isPlaying ? <PauseIcon size={36} weight="fill" /> : <PlayIcon size={36} weight="fill" />}
        </button>
        <div className="flex-1 flex flex-col gap-1.5">
          <div
            className="mobile-progress-track"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              onSeek((x / rect.width) * duration);
            }}
          >
            <div
              className="mobile-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
            <span>{fmtTimer(currentTime * 1000)}</span>
            <span>{fmtTimer(duration * 1000)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mobile-actions">
        <button
          type="button"
          onClick={onShare}
          className="mobile-action-btn mobile-action-btn--primary"
        >
          <ShareNetworkIcon size={20} weight="bold" />
          Partager
        </button>
        <button
          type="button"
          onClick={onPdf}
          className="mobile-action-btn"
        >
          <FilePdfIcon size={20} weight="bold" />
          PDF
        </button>
        <button
          type="button"
          onClick={onReset}
          className="mobile-action-btn"
        >
          <ArrowClockwiseIcon size={20} weight="bold" />
          Refaire
        </button>
      </div>
    </div>
  );
}
