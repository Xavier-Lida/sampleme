'use client';

import type { ProjectMetadata } from '@/hooks/useProjectMetadata';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  className?: string;
  metadata: ProjectMetadata;
  showMobileMenu?: boolean;
  onOpenDrawer?: () => void;
}

export function AppHeader({
  className,
  metadata,
  showMobileMenu,
  onOpenDrawer,
}: AppHeaderProps) {
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
      <span className="daw-header-title shrink-0">MusicMe</span>
      <span className="text-muted-foreground/40 shrink-0">/</span>

      {/* Read-only title display — edit happens in the sidebar's ProjectInfoPanel */}
      <div className="flex-1 min-w-0 flex flex-col justify-center leading-tight">
        <span className="daw-title-display truncate" title={displayName}>
          {displayName}
        </span>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground truncate">
            {subtitle}
          </span>
        )}
      </div>
    </header>
  );
}
