'use client';

import type { ProjectMetadata } from '@/hooks/useProjectMetadata';
import { cn } from '@/lib/utils';

interface ProjectInfoPanelProps {
  metadata: ProjectMetadata;
  onFieldChange: <K extends keyof ProjectMetadata>(
    key: K,
    value: ProjectMetadata[K],
  ) => void;
  className?: string;
}

const INSTRUMENT_OPTIONS = [
  'Piano',
  'Guitare',
  'Basse',
  'Flûte',
];

export function ProjectInfoPanel({
  metadata,
  onFieldChange,
  className,
}: ProjectInfoPanelProps) {
  const selected = metadata.instruments ?? [];

  function toggleInstrument(option: string) {
    const next = selected.includes(option)
      ? selected.filter((i) => i !== option)
      : [...selected, option];
    onFieldChange('instruments', next);
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="daw-panel-section">
        <h2 className="text-base font-bold text-foreground mb-1.5">
          Informations de la partition
        </h2>
        <p className="text-xs text-muted-foreground mb-4 leading-snug">
          Ces champs apparaissent en en-tête de votre partition lors de l&apos;export PDF.
        </p>

        <div className="daw-field">
          <label htmlFor="project-name" className="daw-field-label-strong">Nom</label>
          <input
            id="project-name"
            type="text"
            className="daw-input"
            placeholder="Sans titre"
            value={metadata.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
          />
        </div>

        <div className="daw-field">
          <label htmlFor="project-author" className="daw-field-label-strong">Auteur</label>
          <input
            id="project-author"
            type="text"
            className="daw-input"
            placeholder="Nom de l'auteur"
            value={metadata.author}
            onChange={(e) => onFieldChange('author', e.target.value)}
          />
        </div>

        <div className="daw-field">
          <span className="daw-field-label-strong">Instruments</span>
          {selected.length > 0 && (
            <p className="text-[10px] text-muted-foreground mb-1.5">
              {selected.join(', ')}
            </p>
          )}
          <div className="flex flex-col gap-1">
            {INSTRUMENT_OPTIONS.map((option) => {
              const checked = selected.includes(option);
              return (
                <label
                  key={option}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs select-none transition-colors',
                    checked
                      ? 'bg-primary/15 text-primary'
                      : 'hover:bg-muted/50 text-muted-foreground',
                  )}
                >
                  <input
                    type="checkbox"
                    className="accent-primary size-3 cursor-pointer"
                    checked={checked}
                    onChange={() => toggleInstrument(option)}
                  />
                  {option}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
