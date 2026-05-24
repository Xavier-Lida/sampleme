'use client';

import { useCallback, useState } from 'react';

export interface ProjectMetadata {
  name: string;
  author: string;
  instruments: string[]; // multi-select — was instrument: string
}

const DEFAULT_METADATA: ProjectMetadata = {
  name: '',
  author: '',
  instruments: [],
};

export function useProjectMetadata(initial: Partial<ProjectMetadata> = {}) {
  const [metadata, setMetadata] = useState<ProjectMetadata>({
    ...DEFAULT_METADATA,
    ...initial,
  });

  // Stable identity — used in effect deps (e.g. share-load restore).
  // Without useCallback it returned a new ref each render, re-firing the
  // restore effect and resurrecting deleted tracks from the cache.
  const updateField = useCallback(
    <K extends keyof ProjectMetadata>(key: K, value: ProjectMetadata[K]) => {
      setMetadata((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return { metadata, updateField, setMetadata };
}
