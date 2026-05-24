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

const INSTRUMENT_OPTIONS = ['Piano', 'Guitare', 'Autre'];

export function ProjectInfoPanel({
  metadata,
  onFieldChange,
  className,
}: ProjectInfoPanelProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="daw-panel-section">
        <h2 className="daw-panel-label">Informations</h2>

        <div className="daw-field">
          <label htmlFor="project-name" className="daw-field-label">Nom</label>
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
          <label htmlFor="project-author" className="daw-field-label">Auteur</label>
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
          <label htmlFor="project-instrument" className="daw-field-label">Instrument</label>
          <select
            id="project-instrument"
            className="daw-select"
            value={
              INSTRUMENT_OPTIONS.includes(metadata.instrument)
                ? metadata.instrument
                : 'Piano'
            }
            onChange={(e) => onFieldChange('instrument', e.target.value)}
          >
            {INSTRUMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
