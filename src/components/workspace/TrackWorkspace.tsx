'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { AudioTimeline } from '@/components/timeline/AudioTimeline';
import { ActionToolbar } from '@/components/workspace/ActionToolbar';
import type { PlaybackInstrumentId } from '@/lib/music/partition-instruments';
import type { CleanupPreset, Note } from '@/types/transcription';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const SheetMusicRenderer = dynamic(() => import('@/components/SheetMusicRenderer'), {
  ssr: false,
});

interface TrackWorkspaceProps {
  className?: string;
  notes: Note[];
  peaks: number[];
  duration: number;
  currentTime: number;
  selectedIndex: number | null;
  isRecording: boolean;
  isRequestingMic: boolean;
  busy: boolean;
  playing: boolean;
  instrument: PlaybackInstrumentId;
  activePreset: CleanupPreset;
  presetPickerDisabled: boolean;
  recleanupAvailable: boolean;
  hasResult: boolean;
  hasRecording: boolean;
  notesEdited: boolean;
  onNoteSelect: (index: number | null) => void;
  timelineDuration: number;
  onStaffClick?: (pitch: number, start: number) => void;
  onSeek: (seconds: number) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onUploadAudio: (file: File) => void;
  onInstrumentChange: (id: PlaybackInstrumentId) => void;
  onPresetChange: (preset: CleanupPreset) => void;
  onDeleteSelected: () => void;
  onResetNotes: () => void;
  onDownloadMidi: () => void;
  onDownloadRecording: () => void;
  onClearNotes: () => void;
  onClearSession: () => void;
  onOpenNoteEditor: () => void;
}

export function TrackWorkspace({
  className,
  notes,
  peaks,
  duration,
  currentTime,
  selectedIndex,
  isRecording,
  isRequestingMic,
  busy,
  playing,
  instrument,
  activePreset,
  presetPickerDisabled,
  recleanupAvailable,
  hasResult,
  hasRecording,
  notesEdited,
  onNoteSelect,
  timelineDuration,
  onStaffClick,
  onSeek,
  onStartRecording,
  onStopRecording,
  onUploadAudio,
  onInstrumentChange,
  onPresetChange,
  onDeleteSelected,
  onResetNotes,
  onDownloadMidi,
  onDownloadRecording,
  onClearNotes,
  onClearSession,
  onOpenNoteEditor,
}: TrackWorkspaceProps) {
  const sheetContainerRef = useRef<HTMLDivElement>(null);
  const [sheetWidth, setSheetWidth] = useState(800);

  useEffect(() => {
    const container = sheetContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSheetWidth(Math.max(320, Math.floor(entry.contentRect.width - 32)));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn('flex flex-col flex-1 h-full overflow-hidden', className)}>
      {/* 1. Sheet Music / Partition Pane at the top */}
      <div ref={sheetContainerRef} className="daw-sheet-section">
        <div className="daw-sheet-inner">
          <div className="daw-sheet-frame p-4">
            <SheetMusicRenderer
              notes={notes}
              width={sheetWidth}
              timelineDuration={timelineDuration}
              selectedIndex={selectedIndex}
              onNoteSelect={onNoteSelect}
              onStaffClick={hasResult ? onStaffClick : undefined}
            />
          </div>
        </div>
      </div>

      {/* 2. Track & Audio Timeline Lanes at the bottom */}
      <div className="daw-track-section">
        <ActionToolbar
          isRecording={isRecording}
          isRequestingMic={isRequestingMic}
          busy={busy}
          playing={playing}
          instrument={instrument}
          hasResult={hasResult}
          hasNotes={notes.length > 0}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          onUploadAudio={onUploadAudio}
          onInstrumentChange={onInstrumentChange}
          onClearNotes={onClearNotes}
        />

        <AudioTimeline
          peaks={peaks}
          duration={duration}
          currentTime={currentTime}
          notes={notes}
          onSeek={onSeek}
        />

        {busy && (
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center z-30">
            <div className="bg-card border border-border p-4 rounded-md shadow-md flex items-center gap-3">
              <Spinner className="size-5" />
              <span className="text-sm font-medium">Transcription en cours…</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
