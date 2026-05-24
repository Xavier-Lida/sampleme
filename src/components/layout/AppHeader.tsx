'use client';

import { useState, useRef, useEffect } from 'react';
import { PencilSimpleIcon } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProjectInfoPanel } from '@/components/project/ProjectInfoPanel';
import type { ProjectMetadata } from '@/hooks/useProjectMetadata';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  className?: string;
  metadata: ProjectMetadata;
  onFieldChange: <K extends keyof ProjectMetadata>(
    key: K,
    value: ProjectMetadata[K],
  ) => void;
  showMobileMenu?: boolean;
  onOpenDrawer?: () => void;
}

export function AppHeader({
  className,
  metadata,
  onFieldChange,
  showMobileMenu,
  onOpenDrawer,
}: AppHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [editingTitle]);

  const displayName = metadata.name?.trim() || 'Nouvelle partition';
  const subtitleParts: string[] = [];
  if (metadata.author?.trim()) subtitleParts.push(`par ${metadata.author.trim()}`);
  if (metadata.instruments?.length) subtitleParts.push(metadata.instruments.join(', '));
  const subtitle = subtitleParts.join(' · ');

  return (
    <header className={cn('daw-header', className)}>
      {showMobileMenu && (
        <button
          type="button"
          className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          onClick={onOpenDrawer}
          aria-label="Menu"
        >
          ☰
        </button>
      )}

      <div className="daw-logo" aria-hidden="true">M</div>

      {/* Partition info — title is editable inline, subtitle gives author + instruments */}
      <div className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 shrink-0">
            Partition
          </span>
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={metadata.name}
              placeholder="Nouvelle partition"
              onChange={(e) => onFieldChange('name', e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false);
              }}
              className="daw-title-input"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="daw-title-button truncate"
              title="Cliquer pour renommer la partition"
            >
              {displayName}
            </button>
          )}
          <Popover>
            <Tooltip>
              <PopoverTrigger asChild>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Modifier les infos de la partition"
                    className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <PencilSimpleIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
              </PopoverTrigger>
              <TooltipContent>Modifier titre, auteur, instruments</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-72 p-0">
              <ProjectInfoPanel metadata={metadata} onFieldChange={onFieldChange} />
            </PopoverContent>
          </Popover>
        </div>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground truncate">
            {subtitle}
          </span>
        )}
      </div>

    </header>
  );
}
