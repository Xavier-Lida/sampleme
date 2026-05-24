'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectInfoPanel } from '@/components/project/ProjectInfoPanel';
import { TrackWorkspace } from '@/components/workspace/TrackWorkspace';
import NoteEditor from '@/components/NoteEditor';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useAudioTracks, colorForTrackId } from '@/hooks/useAudioTracks';
import { useMelodyPlayback } from '@/hooks/useMelodyPlayback';
import { useNotesHistory } from '@/hooks/useNotesHistory';
import { useProjectMetadata } from '@/hooks/useProjectMetadata';
import {
  DEFAULT_CLEANUP_OPTIONS,
  exportMidi,
  recleanupNotes,
  transcribeAudio,
} from '@/lib/api';
import { blobToWav } from '@/lib/audio';
import {
  addNote,
  changeNotePitch,
  findNoteAtSlot,
  removeNoteAt,
  sortNotesByStart,
  updateNoteAt,
} from '@/lib/music/note-editing';
import {
  isPlaybackInstrumentId,
  type PlaybackInstrumentId,
} from '@/lib/music/partition-instruments';
import { exportPartitionToPdf } from '@/lib/pdf-export';
import { sessionCache, type CachedTrack } from '@/lib/sessionCache';
import { encodeShareUrl, decodeShareFromHash } from '@/lib/share';
import type {
  CleanupOptions,
  CleanupPreset,
  Note,
} from '@/types/transcription';
import { SIXTEENTH_SECONDS } from '@/types/transcription';
import type { DisplayNote, SelectedNoteRef } from '@/types/display';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileApp } from '@/components/mobile/MobileApp';

function buildDisplayNotes(tracks: CachedTrack[]): DisplayNote[] {
  const all: DisplayNote[] = [];
  for (const t of tracks) {
    if (t.hidden) continue;
    for (let i = 0; i < t.notes.length; i++) {
      all.push({
        note: t.notes[i],
        trackId: t.id,
        indexInTrack: i,
        color: t.muted ? '#666' : t.color,
        instrument: t.instrument ?? 'piano',
      });
    }
  }
  all.sort(
    (a, b) => a.note.start - b.note.start || a.note.pitch - b.note.pitch,
  );
  return all;
}

export default function Page() {
  const isMobile = useIsMobile();
  if (isMobile) return <MobileApp />;
  return <DesktopPage />;
}

function DesktopPage() {
  const { start, stop, status, error, isRecording, analyserRef } = useAudioRecorder({ click: true });
  const { metadata, updateField } = useProjectMetadata();
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    tracks,
    setTracks,
    addTrack,
    deleteTrack,
    toggleMute,
    toggleHidden,
    renameTrack,
    setTrackInstrument,
    setTrackNotes,
    clearTracks,
  } = useAudioTracks();
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [selectedNoteRef, setSelectedNoteRef] = useState<SelectedNoteRef | null>(null);
  const [cleanupOptions, setCleanupOptions] = useState<CleanupOptions>(DEFAULT_CLEANUP_OPTIONS);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const sheetSvgRef = useRef<SVGSVGElement | null>(null);
  const historyTrackIdRef = useRef<string | null>(null);

  const {
    notes: historyNotes,
    setNotes: pushNotesHistory,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useNotesHistory([]);

  const activeTrack = useMemo(
    () => tracks.find((t) => t.id === activeTrackId) ?? null,
    [tracks, activeTrackId],
  );

  useEffect(() => {
    if (tracks.length === 0) {
      if (activeTrackId !== null) setActiveTrackId(null);
      return;
    }
    if (!activeTrackId || !tracks.find((t) => t.id === activeTrackId)) {
      setActiveTrackId(tracks[0].id);
    }
  }, [tracks, activeTrackId]);

  useEffect(() => {
    if (!activeTrackId) {
      historyTrackIdRef.current = null;
      resetHistory([]);
      return;
    }
    if (historyTrackIdRef.current === activeTrackId) return;
    historyTrackIdRef.current = activeTrackId;
    const track = tracks.find((t) => t.id === activeTrackId);
    resetHistory(track?.notes ?? []);
  }, [activeTrackId, tracks, resetHistory]);

  const displayNotes = useMemo(() => buildDisplayNotes(tracks), [tracks]);

  const handleSheetSvgReady = useCallback((svg: SVGSVGElement | null) => {
    sheetSvgRef.current = svg;
  }, []);

  const handleExportPdf = useCallback(async () => {
    const svg = sheetSvgRef.current;
    if (!svg || displayNotes.length === 0) {
      toast.error('Aucune partition à exporter');
      return;
    }
    try {
      await exportPartitionToPdf({ svgElement: svg, metadata });
      toast.success('Partition exportée en PDF');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error("Échec de l'export PDF", { description: message });
    }
  }, [metadata, displayNotes.length]);

  const playback = useMelodyPlayback({ tracks });
  const stopPlaybackRef = useRef(playback.stop);
  stopPlaybackRef.current = playback.stop;
  const pausePlaybackRef = useRef(playback.pause);
  pausePlaybackRef.current = playback.pause;

  const persistTracks = useCallback(async (mutator: (t: CachedTrack[]) => CachedTrack[]) => {
    const cached = await sessionCache.load();
    const base = cached?.tracks ?? [];
    const next = mutator(base);
    await sessionCache.save({
      ...(cached ?? { options: cleanupOptions, createdAt: Date.now() }),
      tracks: next,
      options: cached?.options ?? cleanupOptions,
    });
  }, [cleanupOptions]);

  const persistTrackNotes = useCallback(
    async (trackId: string, notes: Note[]) => {
      await persistTracks((ts) =>
        ts.map((t) => (t.id === trackId ? { ...t, notes } : t)),
      );
    },
    [persistTracks],
  );

  const commitTrackNotes = useCallback(
    (trackId: string, notes: Note[], recordHistory = true) => {
      const sorted = sortNotesByStart(notes);
      setTrackNotes(trackId, sorted);
      persistTrackNotes(trackId, sorted);
      if (trackId === activeTrackId) {
        pushNotesHistory(sorted, { recordHistory });
      }
    },
    [activeTrackId, setTrackNotes, persistTrackNotes, pushNotesHistory],
  );

  useEffect(() => {
    if (!activeTrackId || historyTrackIdRef.current !== activeTrackId) return;
    const track = tracks.find((t) => t.id === activeTrackId);
    if (!track || JSON.stringify(track.notes) === JSON.stringify(historyNotes)) return;
    setTrackNotes(activeTrackId, historyNotes);
    persistTrackNotes(activeTrackId, historyNotes);
  }, [historyNotes, activeTrackId, tracks, setTrackNotes, persistTrackNotes]);

  const handleTrackInstrumentChange = useCallback(
    async (trackId: string, id: PlaybackInstrumentId) => {
      pausePlaybackRef.current();
      setTrackInstrument(trackId, id);
      await persistTracks((ts) =>
        ts.map((t) => (t.id === trackId ? { ...t, instrument: id } : t)),
      );
    },
    [setTrackInstrument, persistTracks],
  );

  const handleRemoveNote = useCallback(
    (trackId: string, indexInTrack: number) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      const { notes: updated } = removeNoteAt(track.notes, indexInTrack);
      commitTrackNotes(trackId, updated);
      setSelectedNoteRef(null);
    },
    [tracks, commitTrackNotes],
  );

  const handleAddNoteToTrack = useCallback(
    (trackId: string, pitch: number, start: number, duration: number) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      const { notes: updated, selectedIndex } = addNote(track.notes, {
        pitch,
        start,
        duration,
      });
      commitTrackNotes(trackId, updated);
      setSelectedNoteRef({ trackId, indexInTrack: selectedIndex });
    },
    [tracks, commitTrackNotes],
  );

  const handleAddNoteToActiveTrack = useCallback(
    (pitch: number, start: number, duration: number) => {
      if (!activeTrackId) return;
      handleAddNoteToTrack(activeTrackId, pitch, start, duration);
    },
    [activeTrackId, handleAddNoteToTrack],
  );

  const handleStaffClick = useCallback(
    (pitch: number, start: number) => {
      if (!activeTrackId) return;
      const track = tracks.find((t) => t.id === activeTrackId);
      if (!track) return;
      const existingIndex = findNoteAtSlot(track.notes, start, pitch);
      if (existingIndex !== null) {
        setSelectedNoteRef({ trackId: activeTrackId, indexInTrack: existingIndex });
        return;
      }
      handleAddNoteToTrack(activeTrackId, pitch, start, SIXTEENTH_SECONDS);
    },
    [activeTrackId, tracks, handleAddNoteToTrack],
  );

  const handleNoteSelect = useCallback((trackId: string, indexInTrack: number) => {
    setSelectedNoteRef({ trackId, indexInTrack });
    setActiveTrackId(trackId);
  }, []);

  const handleNotePitchChange = useCallback(
    (trackId: string, indexInTrack: number, newPitch: number) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      const { notes: updated, selectedIndex } = changeNotePitch(
        track.notes,
        indexInTrack,
        newPitch,
      );
      commitTrackNotes(trackId, updated);
      if (selectedIndex !== null) {
        setSelectedNoteRef({ trackId, indexInTrack: selectedIndex });
      }
    },
    [tracks, commitTrackNotes],
  );

  const handleNoteUpdate = useCallback(
    (
      trackId: string,
      indexInTrack: number,
      patch: { pitch?: number; end?: number },
    ) => {
      const track = tracks.find((t) => t.id === trackId);
      if (!track) return;
      const { notes: updated, selectedIndex } = updateNoteAt(
        track.notes,
        indexInTrack,
        patch,
      );
      commitTrackNotes(trackId, updated);
      if (selectedIndex !== null) {
        setSelectedNoteRef({ trackId, indexInTrack: selectedIndex });
      }
    },
    [tracks, commitTrackNotes],
  );

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  const handleResetNotes = useCallback(() => {
    if (!activeTrack) return;
    const sorted = sortNotesByStart(activeTrack.rawNotes);
    commitTrackNotes(activeTrack.id, sorted, false);
    resetHistory(sorted);
    setSelectedNoteRef(null);
  }, [activeTrack, commitTrackNotes, resetHistory]);

  const processTranscription = useCallback(
    async (wav: Blob, name: string) => {
      setBusy(true);
      setApiError(null);
      stopPlaybackRef.current();

      try {
        const transcription = await transcribeAudio(wav, cleanupOptions);
        const sortedNotes = sortNotesByStart(transcription.notes);
        const rawNotes = transcription.raw_notes ?? transcription.notes;

        const newTrack = await addTrack({
          blob: wav,
          name,
          notes: sortedNotes,
          rawNotes,
          instrument: 'piano',
        });

        setActiveTrackId(newTrack.id);
        historyTrackIdRef.current = newTrack.id;
        resetHistory(sortedNotes);
        setSelectedNoteRef(null);

        const cached = await sessionCache.load();
        const existingTracks = cached?.tracks ?? [];
        const nextTracks = [...existingTracks, newTrack];

        await sessionCache.save({
          tracks: nextTracks,
          options: cleanupOptions,
          createdAt: Date.now(),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setApiError(message);
        toast.error('Erreur de transcription', { description: message });
      } finally {
        setBusy(false);
      }
    },
    [cleanupOptions, addTrack, resetHistory],
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        // Shared link takes precedence over the IndexedDB session — paste-and-go.
        if (typeof window !== 'undefined' && window.location.hash) {
          const shared = decodeShareFromHash(window.location.hash);
          if (shared) {
            const migrated: CachedTrack[] = shared.tracks.map((t) => ({
              ...t,
              instrument: isPlaybackInstrumentId(t.instrument) ? t.instrument : 'piano',
              color: t.color ?? colorForTrackId(t.id),
            }));
            setTracks(migrated);
            setActiveTrackId(migrated[0]?.id ?? null);
            if (migrated[0]) {
              historyTrackIdRef.current = migrated[0].id;
              resetHistory(migrated[0].notes ?? []);
            }
            (Object.keys(shared.metadata) as Array<keyof typeof shared.metadata>).forEach(
              (k) => updateField(k, shared.metadata[k] as never),
            );
            // Clear the hash so reloads don't replay it over fresh edits.
            history.replaceState(null, '', window.location.pathname + window.location.search);
            toast.success('Partition partagée chargée');
            return;
          }
        }

        const cached = await sessionCache.load();
        if (cancelled || !cached) return;

        if (cached.tracks && cached.tracks.length > 0) {
          const migrated: CachedTrack[] = cached.tracks.map((t) => ({
            ...t,
            notes: t.notes ?? cached.cleanedNotes ?? [],
            rawNotes: t.rawNotes ?? cached.rawNotes ?? [],
            instrument:
              t.instrument && isPlaybackInstrumentId(t.instrument)
                ? t.instrument
                : 'piano',
            color: t.color ?? colorForTrackId(t.id),
            muted: !!t.muted,
          }));
          setTracks(migrated);
          setActiveTrackId(migrated[0].id);
          historyTrackIdRef.current = migrated[0].id;
          resetHistory(migrated[0].notes ?? []);
        } else if (cached.audio) {
          await addTrack({
            blob: cached.audio,
            name: 'Piste Audio',
            notes: sortNotesByStart(cached.cleanedNotes ?? []),
            rawNotes: cached.rawNotes ?? cached.cleanedNotes ?? [],
            instrument: 'piano',
          });
        }

        setCleanupOptions(cached.options);
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setApiError(message);
        }
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [setTracks, addTrack, resetHistory, updateField]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (noteEditorOpen) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNoteRef) {
        e.preventDefault();
        handleRemoveNote(selectedNoteRef.trackId, selectedNoteRef.indexInTrack);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNoteRef, handleRemoveNote, noteEditorOpen, handleUndo, handleRedo]);

  useEffect(() => {
    if (error) {
      toast.error('Erreur micro', { description: error });
    }
  }, [error]);

  const handleToggleMute = useCallback(
    async (id: string) => {
      toggleMute(id);
      await persistTracks((ts) =>
        ts.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)),
      );
    },
    [toggleMute, persistTracks],
  );

  const handleToggleHidden = useCallback(
    async (id: string) => {
      toggleHidden(id);
      await persistTracks((ts) =>
        ts.map((t) => (t.id === id ? { ...t, hidden: !t.hidden } : t)),
      );
    },
    [toggleHidden, persistTracks],
  );

  const handleRenameTrack = useCallback(
    async (id: string, name: string) => {
      renameTrack(id, name);
      await persistTracks((ts) =>
        ts.map((t) => (t.id === id ? { ...t, name } : t)),
      );
    },
    [renameTrack, persistTracks],
  );

  const handleDeleteTrack = useCallback(
    async (id: string) => {
      deleteTrack(id);
      if (selectedNoteRef?.trackId === id) setSelectedNoteRef(null);
      if (activeTrackId === id) setActiveTrackId(null);
      await persistTracks((ts) => ts.filter((t) => t.id !== id));
    },
    [deleteTrack, selectedNoteRef, activeTrackId, persistTracks],
  );

  const handleShare = useCallback(async () => {
    if (tracks.length === 0) {
      toast.error('Rien à partager — ajoute au moins une piste');
      return;
    }
    const url = encodeShareUrl(window.location.origin, metadata, tracks);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié dans le presse-papier', {
        description: 'Colle-le où tu veux pour partager ta partition',
      });
    } catch {
      window.prompt('Copie ce lien pour partager :', url);
    }
  }, [tracks, metadata]);

  const handleAddManualTrack = useCallback(async () => {
    const trackName = `Piste ${tracks.length + 1}`;
    const newTrack = await addTrack({ name: trackName, instrument: 'piano' });
    setActiveTrackId(newTrack.id);
    setSelectedNoteRef(null);

    const cached = await sessionCache.load();
    const existingTracks = cached?.tracks ?? [];
    const nextTracks = [...existingTracks, newTrack];
    await sessionCache.save({
      tracks: nextTracks,
      options: cached?.options ?? cleanupOptions,
      createdAt: cached?.createdAt ?? Date.now(),
    });
  }, [addTrack, tracks.length, cleanupOptions]);

  async function handleStopRecording() {
    const blob = await stop();
    if (!blob) return;
    const wav = await blobToWav(blob);
    const trackIndex = tracks.length + 1;
    await processTranscription(wav, `Enregistrement ${trackIndex}`);
  }

  async function handleUploadAudio(file: File) {
    const wav = file.type.includes('wav') ? file : await blobToWav(file);
    await processTranscription(wav, file.name);
  }

  const recleanupAvailable = !!activeTrack && activeTrack.rawNotes.length > 0;
  const activePreset = cleanupOptions.preset ?? 'standard';

  const handlePresetChange = useCallback(
    async (preset: CleanupPreset) => {
      if (preset === activePreset || !activeTrack) return;
      setBusy(true);
      setApiError(null);
      const nextOptions: CleanupOptions = { ...cleanupOptions, preset };

      try {
        const { notes: cleaned } = await recleanupNotes(activeTrack.rawNotes, nextOptions);
        const sortedNotes = sortNotesByStart(cleaned);
        commitTrackNotes(activeTrack.id, sortedNotes, false);
        resetHistory(sortedNotes);
        setCleanupOptions(nextOptions);
        setSelectedNoteRef(null);

        await persistTracks((ts) =>
          ts.map((t) => (t.id === activeTrack.id ? { ...t, notes: sortedNotes } : t)),
        );
        const cached = await sessionCache.load();
        if (cached) await sessionCache.save({ ...cached, options: nextOptions });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setApiError(message);
        toast.error('Erreur de nettoyage', { description: message });
      } finally {
        setBusy(false);
      }
    },
    [activePreset, activeTrack, cleanupOptions, commitTrackNotes, resetHistory, persistTracks],
  );

  const handleClearNotes = useCallback(async () => {
    if (!activeTrack) return;
    playback.stop();
    commitTrackNotes(activeTrack.id, [], false);
    resetHistory([]);
    setSelectedNoteRef(null);
  }, [activeTrack, playback, commitTrackNotes, resetHistory]);

  async function handleClearSession() {
    playback.stop();
    await sessionCache.clear();
    clearTracks();
    resetHistory([]);
    historyTrackIdRef.current = null;
    setCleanupOptions(DEFAULT_CLEANUP_OPTIONS);
    setActiveTrackId(null);
    setSelectedNoteRef(null);
    setApiError(null);
    toast.success('Session réinitialisée');
  }

  async function handleDownloadMidi() {
    const merged = tracks.flatMap((t) => t.notes);
    if (merged.length === 0) return;
    const blob = await exportMidi(sortNotesByStart(merged), 120);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcription.mid';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadRecording() {
    const firstAudioTrack = tracks.find((t) => t.blob);
    if (!firstAudioTrack?.blob) return;
    const url = URL.createObjectURL(firstAudioTrack.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${firstAudioTrack.name || 'enregistrement'}-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const allNotesCount = displayNotes.length;
  const presetPickerDisabled = !recleanupAvailable || busy || isRecording || playback.isPlaying;
  const transportDisabled =
    busy || isRecording || (allNotesCount === 0 && tracks.length === 0);

  let statusLabel = 'Prêt';
  let statusClass = '';
  if (isRecording) {
    statusLabel = 'Enregistrement';
    statusClass = 'recording';
  } else if (playback.isPlaying) {
    statusLabel = 'Lecture';
    statusClass = 'playing';
  } else if (busy) {
    statusLabel = 'Transcription';
    statusClass = 'busy';
  }

  return (
    <AppShell
      metadata={metadata}
      onExportPdf={handleExportPdf}
      exportPdfDisabled={displayNotes.length === 0 || busy || isRecording}
      onShare={handleShare}
      shareDisabled={tracks.length === 0 || busy || isRecording}
      infoPanel={<ProjectInfoPanel metadata={metadata} onFieldChange={updateField} />}
      transport={{
        isPlaying: playback.isPlaying,
        disabled: transportDisabled,
        onTogglePlayPause: () => playback.togglePlayPause(),
        onSkipBack: () => playback.skipBack(),
        onSkipForward: () => playback.skipForward(),
        currentTime: playback.currentTime,
        statusLabel,
        statusClass,
      }}
    >
      {apiError && (
        <Alert variant="destructive">
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
      )}

      <TrackWorkspace
        displayNotes={displayNotes}
        timelineDuration={playback.duration}
        tracks={tracks}
        duration={playback.duration}
        currentTime={playback.currentTime}
        selectedNoteRef={selectedNoteRef}
        activeTrackId={activeTrackId}
        isRecording={isRecording}
        isRequestingMic={status === 'requesting'}
        busy={busy}
        playing={playback.isPlaying}
        activePreset={activePreset}
        presetPickerDisabled={presetPickerDisabled}
        recleanupAvailable={recleanupAvailable}
        hasResult={!!activeTrack}
        hasRecording={tracks.length > 0}
        analyserRef={analyserRef}
        onNoteSelect={handleNoteSelect}
        onNotePitchChange={handleNotePitchChange}
        onNoteUpdate={handleNoteUpdate}
        onNoteRemove={handleRemoveNote}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onStaffClick={handleStaffClick}
        onSeek={playback.seek}
        onStartRecording={start}
        onStopRecording={handleStopRecording}
        onUploadAudio={handleUploadAudio}
        onPresetChange={handlePresetChange}
        onDeleteSelected={() =>
          selectedNoteRef && handleRemoveNote(selectedNoteRef.trackId, selectedNoteRef.indexInTrack)
        }
        onResetNotes={handleResetNotes}
        onDownloadMidi={handleDownloadMidi}
        onDownloadRecording={handleDownloadRecording}
        onClearNotes={handleClearNotes}
        onClearSession={handleClearSession}
        onOpenNoteEditor={() => setNoteEditorOpen(true)}
        onSheetSvgReady={handleSheetSvgReady}
        onToggleMute={handleToggleMute}
        onToggleHidden={handleToggleHidden}
        onRenameTrack={handleRenameTrack}
        onDeleteTrack={handleDeleteTrack}
        onSelectActiveTrack={setActiveTrackId}
        onTrackInstrumentChange={handleTrackInstrumentChange}
        onAddManualTrack={handleAddManualTrack}
      />

      <Sheet open={noteEditorOpen} onOpenChange={setNoteEditorOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              Éditeur de notes — {activeTrack?.name ?? '—'}
            </SheetTitle>
          </SheetHeader>
          {activeTrack && (
            <NoteEditor
              notes={activeTrack.notes}
              selectedIndex={
                selectedNoteRef?.trackId === activeTrack.id
                  ? selectedNoteRef.indexInTrack
                  : null
              }
              onSelect={(idx) =>
                setSelectedNoteRef({ trackId: activeTrack.id, indexInTrack: idx })
              }
              onRemove={(idx) => handleRemoveNote(activeTrack.id, idx)}
              onAdd={handleAddNoteToActiveTrack}
            />
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
