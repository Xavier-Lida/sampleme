import type { PartitionNote, PartitionResponse } from "@/lib/types/partition";

const GRID_BEATS = [0.25, 0.5, 1, 2, 4] as const;

function snapBeat(value: number, strength: number): number {
  let best = value;
  let bestDist = Infinity;

  for (const grid of GRID_BEATS) {
    const snapped = Math.round(value / grid) * grid;
    const dist = Math.abs(snapped - value);
    if (dist < bestDist) {
      bestDist = dist;
      best = snapped;
    }
  }

  return value + (best - value) * strength;
}

function snapDuration(duration: number, strength: number): number {
  let best = duration;
  let bestDist = Infinity;

  for (const grid of GRID_BEATS) {
    if (grid > duration + 0.01) continue;
    const snapped = Math.max(grid, Math.round(duration / grid) * grid);
    const dist = Math.abs(snapped - duration);
    if (dist < bestDist) {
      bestDist = dist;
      best = snapped;
    }
  }

  return duration + (best - duration) * strength;
}

export function partitionHasExplicitTiming(notes: PartitionNote[]): boolean {
  if (notes.length < 2) return false;
  for (let i = 1; i < notes.length; i++) {
    const expected = notes[i - 1].start + notes[i - 1].duration;
    if (Math.abs(notes[i].start - expected) > 1e-4) {
      return true;
    }
  }
  return false;
}

/**
 * Snap note starts and durations toward standard rhythmic values.
 * @param strength 0 = no change, 1 = full snap
 */
export function quantizePartition(
  partition: PartitionResponse,
  strength: number,
): PartitionResponse {
  const clamped = Math.min(1, Math.max(0, strength));
  if (clamped === 0) return partition;

  const notes = partition.notes.map((note) => ({
    ...note,
    start: snapBeat(note.start, clamped),
    duration: snapDuration(note.duration, clamped),
  }));

  notes.sort((a, b) => a.start - b.start);

  return { ...partition, notes };
}
