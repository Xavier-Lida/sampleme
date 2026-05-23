export interface PartitionResponse {
  id: string;
  title?: string;
  bpm: number;
  timeSignature: { beats: number; beatType: number };
  key?: string;
  notes: PartitionNote[];
  /** When true, applies subtle timing jitter during playback (demo/mock). */
  playbackHumanize?: boolean;
}

export interface PartitionNote {
  pitch: string;
  start: number;
  duration: number;
  velocity?: number;
}

export function getBeatsPerMeasure(partition: PartitionResponse): number {
  const { beats, beatType } = partition.timeSignature;
  return beats * (4 / beatType);
}

export function getPartitionDurationBeats(partition: PartitionResponse): number {
  if (partition.notes.length === 0) return 0;
  return Math.max(
    ...partition.notes.map((note) => note.start + note.duration),
  );
}
