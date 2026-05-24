'use client';

import { useRef } from 'react';
import {
  DotsThreeOutlineIcon,
  FileArrowUpIcon,
  MicrophoneIcon,
  MusicNotesIcon,
  StopIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

  function handlePartitionUploadClick() {
    toast.info('Bientôt disponible', {
      description: 'Le téléversement de partition sera ajouté prochainement.',
    });
  }

  function handleAudioFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadAudio(file);
    e.target.value = '';
  }

  const actionsDisabled = busy || playing || isRecording;
  const canClearTrack = hasResult || hasRecording;

  function handleClearTrackClick() {
    if (
      !window.confirm(
        'Effacer l\u2019audio et toutes les notes ? Cette action est irréversible.',
      )
    ) {
      return;
    }
    onClearSession();
  }

  return (
    <TooltipProvider>
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {!isRecording ? (
          <Button
            onClick={onStartRecording}
            disabled={actionsDisabled || isRequestingMic}
          >
            {isRequestingMic ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <MicrophoneIcon data-icon="inline-start" />
            )}
            {isRequestingMic ? 'Accès micro…' : 'Enregistrer voix'}
          </Button>
        ) : (
          <Button variant="destructive" onClick={onStopRecording}>
            <StopIcon data-icon="inline-start" />
            Arrêter
          </Button>
        )}

        <Button
          variant="outline"
          disabled={actionsDisabled}
          onClick={() => audioInputRef.current?.click()}
        >
          <FileArrowUpIcon data-icon="inline-start" />
          Téléverser fichier son
        </Button>
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="sr-only"
          onChange={handleAudioFileChange}
        />

        <Button variant="outline" disabled onClick={handlePartitionUploadClick}>
          <MusicNotesIcon data-icon="inline-start" />
          Téléverser partition
        </Button>

        <Select
          value={instrument}
          onValueChange={(value) => onInstrumentChange(value as PlaybackInstrumentId)}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
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
          variant="outline"
          disabled={!canClearTrack || actionsDisabled}
          onClick={handleClearTrackClick}
        >
          <TrashIcon data-icon="inline-start" />
          Clear track
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Plus d'actions">
              <DotsThreeOutlineIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-56 min-w-48">
            <DropdownMenuGroup>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuItem
                    disabled={!hasSelectedNote || playing}
                    onClick={onDeleteSelected}
                  >
                    Supprimer la note sélectionnée
                  </DropdownMenuItem>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Ou sélectionnez une note sur la portée, puis Suppr
                </TooltipContent>
              </Tooltip>
              <DropdownMenuItem
                disabled={!notesEdited || playing}
                onClick={onResetNotes}
              >
                Réinitialiser les notes
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasResult} onClick={onOpenNoteEditor}>
                Éditeur de notes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!hasNotes} onClick={onDownloadMidi}>
                Télécharger MIDI
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!hasRecording} onClick={onDownloadRecording}>
                Télécharger l&apos;enregistrement (.wav)
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasResult && !hasRecording}
                onClick={onClearSession}
              >
                Effacer la session
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={presetPickerDisabled}>
                Preset de nettoyage
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
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

      {busy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Spinner />
          Transcription en cours…
        </p>
      )}
      {isRecording && (
        <p className="text-xs text-muted-foreground">Enregistrement avec métronome…</p>
      )}
    </div>
    </TooltipProvider>
  );
}
