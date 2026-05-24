'use client';

import { GearIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  className?: string;
  /** Mobile-only: show hamburger menu */
  onOpenDrawer?: () => void;
  showMobileMenu?: boolean;
}

export function AppHeader({ className, onOpenDrawer, showMobileMenu }: AppHeaderProps) {
  return (
    <header className={cn('daw-header', className)}>
      {showMobileMenu && (
        <button
          className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onClick={onOpenDrawer}
          aria-label="Menu"
        >
          ☰
        </button>
      )}

      <div className="daw-logo" aria-hidden="true">M</div>
      <span className="daw-header-title">MusicMe</span>
      <p className="daw-header-subtitle">
        Fredonnez ou importez un audio — obtenez une partition à 120 BPM
      </p>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Réglages" className="ml-auto shrink-0 text-muted-foreground">
            <GearIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Réglages (bientôt)</TooltipContent>
      </Tooltip>
    </header>
  );
}
