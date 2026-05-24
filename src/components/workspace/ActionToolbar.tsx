'use client';

import { useRef } from 'react';
import {
  DotsThreeOutlineIcon,
  FileArrowUpIcon,
  MicrophoneIcon,
  StopIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { CleanupPreset } from '@/types/transcription';
import { cn } from '@/lib/utils';

const INSTRUMENT_OPTIONS: readonly PlaybackInstrumentId[] = ['piano', 'guitar-acoustic'];

const PRESET_OPTIONS: readonly { id: CleanupPreset; label: string }[] = [
  { id: 'beginner', label: 'Débutant' },
  { id: 'standard', label: 'Standard' },
  { id: 'expert', label: 'Expert' },
];

interface ActionToolbarProps {
  className?: string;
  isRecording: boolean;
  isRequestingMic: boolean;
  busy: boolean;
  playing: boolean;
  instrument: PlaybackInstrumentId;
  activePreset: CleanupPreset;
  presetPickerDisabled: boolean;
  recleanupAvailable: boolean;
  hasResult: boolean;
  hasNotes: boolean;
  hasRecording: boolean;
  hasSelectedNote: boolean;
  notesEdited: boolean;
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

export function ActionToolbar({
  className,
  isRecording,
  isRequestingMic,
  busy,
  playing,
  instrument,
  activePreset,
  presetPickerDisabled,
  recleanupAvailable,
  hasResult,
  hasNotes,
  hasRecording,
  hasSelectedNote,
  notesEdited,
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
}: ActionToolbarProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadAudio(file);
    e.target.value = '';
  }

  const actionsDisabled = busy || playing || isRecording;

  return (
    <div className={cn('daw-track-toolbar', className)}>
      <div className="daw-track-toolbar-label">Pistes</div>

      <div className="flex items-center gap-2">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-border bg-secondary text-muted-foreground hover:text-foreground"
              aria-label="Plus d'actions"
            >
              <DotsThreeOutlineIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 min-w-48 bg-card border-border">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={!hasSelectedNote || playing}
                onClick={onDeleteSelected}
                className="text-xs cursor-pointer"
              >
                Supprimer la note sélectionnée
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!notesEdited || playing}
                onClick={onResetNotes}
                className="text-xs cursor-pointer"
              >
                Réinitialiser les notes
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasResult}
                onClick={onOpenNoteEditor}
                className="text-xs cursor-pointer"
              >
                Éditeur de notes
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem disabled={!hasNotes} onClick={onDownloadMidi} className="text-xs cursor-pointer">
                Télécharger MIDI
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasRecording} onClick={onDownloadRecording} className="text-xs cursor-pointer">
                Télécharger wav
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasResult && !hasRecording}
                onClick={onClearSession}
                className="text-xs text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
              >
                Effacer la session
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={presetPickerDisabled} className="text-xs cursor-pointer">
                Preset de nettoyage
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="bg-card border-border">
                <DropdownMenuRadioGroup
                  value={activePreset}
                  onValueChange={(value) => onPresetChange(value as CleanupPreset)}
                >
                  <DropdownMenuGroup>
                    {PRESET_OPTIONS.map(({ id, label }) => (
                      <DropdownMenuRadioItem
                        key={id}
                        value={id}
                        disabled={presetPickerDisabled || !recleanupAvailable}
                        className="text-xs cursor-pointer"
                      >
                        {label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
