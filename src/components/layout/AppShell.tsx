'use client';

import { useState, type ReactNode } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { TransportBar } from '@/components/layout/TransportBar';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
  infoPanel: ReactNode;
  transport: {
    isPlaying: boolean;
    disabled?: boolean;
    onTogglePlayPause: () => void;
    onSkipBack: () => void;
    onSkipForward: () => void;
    currentTime?: number;
    statusLabel?: string;
    statusClass?: string;
  };
}

export function AppShell({ children, infoPanel, transport }: AppShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* fixed App Header */}
      <AppHeader
        showMobileMenu={true}
        onOpenDrawer={() => setIsDrawerOpen(true)}
      />

      {/* Main Content Area */}
      <div className="daw-content">
        {/* Left config/meta panel (hidden on mobile via CSS) */}
        <aside className="daw-left" aria-label="Panneau de configuration">
          {infoPanel}
        </aside>

        {/* Main Work Panel */}
        <main className="daw-main">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="daw-drawer-overlay block"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Menu */}
      <aside
        className={cn('daw-drawer', isDrawerOpen && 'open')}
        role="dialog"
        aria-modal="true"
        aria-label="Configuration mobile"
      >
        <div className="daw-drawer-close">
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-muted-foreground hover:text-foreground text-sm"
            aria-label="Fermer"
          >
            Fermer ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {infoPanel}
        </div>
      </aside>

      {/* fixed Transport Footer */}
      <TransportBar
        isPlaying={transport.isPlaying}
        disabled={transport.disabled}
        onTogglePlayPause={transport.onTogglePlayPause}
        onSkipBack={transport.onSkipBack}
        onSkipForward={transport.onSkipForward}
        currentTime={transport.currentTime}
        statusLabel={transport.statusLabel}
        statusClass={transport.statusClass}
      />
    </div>
  );
}
