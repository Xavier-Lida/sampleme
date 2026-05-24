'use client';

import { useRef } from 'react';
import {
  FileArrowUpIcon,
  MicrophoneIcon,
  StopIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  getInstrumentLabel,
  type PlaybackInstrumentId,
} from '@/lib/music/partition-instruments';
import { cn } from '@/lib/utils';

const INSTRUMENT_OPTIONS: readonly PlaybackInstrumentId[] = ['piano', 'guitar-acoustic'];

interface ActionToolbarProps {
  className?: string;
  isRecording: boolean;
  isRequestingMic: boolean;
  busy: boolean;
  playing: boolean;
  instrument: PlaybackInstrumentId;
  hasResult: boolean;
  hasNotes: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onUploadAudio: (file: File) => void;
  onInstrumentChange: (id: PlaybackInstrumentId) => void;
  onClearNotes: () => void;
}

export function ActionToolbar({
  className,
  isRecording,
  isRequestingMic,
  busy,
  playing,
  instrument,
  hasResult,
  hasNotes,
  onStartRecording,
  onStopRecording,
  onUploadAudio,
  onInstrumentChange,
  onClearNotes,
}: ActionToolbarProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadAudio(file);
    e.target.value = '';
  }

  const actionsDisabled = busy || playing || isRecording;

  function handleClearTrackClick() {
    if (
      !window.confirm(
        'Supprimer toutes les notes de la piste ? L\u2019audio sera conserv\u00e9.',
      )
    ) {
      return;
    }
    onClearNotes();
  }

  return (
    <div className={cn('daw-track-toolbar', className)}>
      <div className="daw-track-toolbar-label">Pistes</div>

      {/* Centered actions container */}
      <div className="flex flex-1 items-center justify-center gap-3">
        {!isRecording ? (
          <Button
            size="sm"
            onClick={onStartRecording}
            disabled={actionsDisabled || isRequestingMic}
            className="h-8 gap-1.5 bg-red-600/90 hover:bg-red-600 text-white font-medium"
          >
            {isRequestingMic ? (
              <Spinner className="size-3.5" />
            ) : (
              <MicrophoneIcon className="size-4" />
            )}
            {isRequestingMic ? 'Accès…' : 'Enregistrer'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            onClick={onStopRecording}
            className="h-8 gap-1.5 animate-pulse bg-red-500 hover:bg-red-600 text-white font-medium"
          >
            <StopIcon className="size-4" />
            Arrêter
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={actionsDisabled}
          onClick={() => audioInputRef.current?.click()}
          className="h-8 gap-1.5 border-border bg-secondary hover:bg-secondary/80 text-foreground"
        >
          <FileArrowUpIcon className="size-4" />
          Audio
        </Button>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="sr-only"
          onChange={handleAudioFileChange}
        />

        <Select
          value={instrument}
          onValueChange={(value) => onInstrumentChange(value as PlaybackInstrumentId)}
        >
          <SelectTrigger className="h-8 w-[100px] border-border bg-secondary text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectGroup>
              {INSTRUMENT_OPTIONS.map((id) => (
                <SelectItem key={id} value={id}>
                  {getInstrumentLabel(id)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          disabled={!hasNotes || !hasResult || actionsDisabled}
          onClick={handleClearTrackClick}
          className="h-8 gap-1.5 border-border bg-secondary hover:bg-secondary/80 text-foreground"
        >
          <TrashIcon className="size-4" />
          Clear track
        </Button>
      </div>
    </div>
  );
}
