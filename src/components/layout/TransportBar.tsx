'use client';

import {
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  PauseIcon,
  PlayIcon,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TransportBarProps {
  className?: string;
  isPlaying: boolean;
  disabled?: boolean;
  onTogglePlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  /** mm:ss display */
  currentTime?: number;
  statusLabel?: string;
  statusClass?: string;
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TransportBar({
  className,
  isPlaying,
  disabled = false,
  onTogglePlayPause,
  onSkipBack,
  onSkipForward,
  currentTime = 0,
  statusLabel = 'Prêt',
  statusClass = '',
}: TransportBarProps) {
  return (
    <footer className={cn('daw-footer', className)}>
      <Button
        variant="outline"
        size="icon"
        aria-label="Reculer"
        disabled={disabled}
        onClick={onSkipBack}
        className="size-9 rounded-full border-border/60 bg-secondary text-muted-foreground hover:text-foreground"
      >
        <CaretDoubleLeftIcon />
      </Button>

      <Button
        size="icon"
        aria-label={isPlaying ? 'Pause' : 'Lecture'}
        disabled={disabled}
        onClick={onTogglePlayPause}
        className="size-11 rounded-full shadow-lg shadow-primary/30"
      >
        {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
      </Button>

      <Button
        variant="outline"
        size="icon"
        aria-label="Avancer"
        disabled={disabled}
        onClick={onSkipForward}
        className="size-9 rounded-full border-border/60 bg-secondary text-muted-foreground hover:text-foreground"
      >
        <CaretDoubleRightIcon />
      </Button>

      <span className="transport-time" aria-live="polite">
        {fmt(currentTime)}
      </span>

      {/* Status */}
      <div className="daw-footer-status" aria-live="polite">
        <span className={cn('status-pip', statusClass)} aria-hidden="true" />
        {statusLabel}
      </div>
    </footer>
  );
}
