'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AudioTimeline } from '@/components/timeline/AudioTimeline';
import { ActionToolbar } from '@/components/workspace/ActionToolbar';
import type { PlaybackInstrumentId } from '@/lib/music/partition-instruments';
import type { CleanupPreset, Note } from '@/types/transcription';
import { cn } from '@/lib/utils';

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
  timelineSpan: number;
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
  timelineSpan,
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
    <div className={cn('flex min-w-0 flex-1 flex-col gap-4', className)}>
      <ActionToolbar
        isRecording={isRecording}
        isRequestingMic={isRequestingMic}
        busy={busy}
        playing={playing}
        instrument={instrument}
        activePreset={activePreset}
        presetPickerDisabled={presetPickerDisabled}
        recleanupAvailable={recleanupAvailable}
        hasResult={hasResult}
        hasNotes={notes.length > 0}
        hasRecording={hasRecording}
        hasSelectedNote={selectedIndex !== null}
        notesEdited={!!notesEdited}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onUploadAudio={onUploadAudio}
        onInstrumentChange={onInstrumentChange}
        onPresetChange={onPresetChange}
        onDeleteSelected={onDeleteSelected}
        onResetNotes={onResetNotes}
        onDownloadMidi={onDownloadMidi}
        onDownloadRecording={onDownloadRecording}
        onClearSession={onClearSession}
        onOpenNoteEditor={onOpenNoteEditor}
      />

      <div ref={sheetContainerRef} className="min-w-0">
        <Card className="overflow-hidden">
          <CardContent className="overflow-x-auto bg-white p-4">
            <SheetMusicRenderer
              notes={notes}
              width={sheetWidth}
              timelineSpan={timelineSpan}
              selectedIndex={selectedIndex}
              onNoteSelect={onNoteSelect}
              onStaffClick={hasResult ? onStaffClick : undefined}
            />
          </CardContent>
        </Card>
      </div>

      <AudioTimeline
        peaks={peaks}
        duration={duration}
        currentTime={currentTime}
        onSeek={onSeek}
      />
    </div>
  );
}
