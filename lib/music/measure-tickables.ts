import { StaveNote } from "vexflow";
import { pitchToVexKey } from "@/lib/music/pitch";
import type { PartitionNote } from "@/lib/types/partition";

const ADJACENCY_EPSILON = 1e-6;

const DURATION_MAP: Record<number, string> = {
  0.25: "16",
  0.5: "8",
  1: "q",
  2: "h",
  4: "w",
};

function beatsToVexDuration(duration: number): string {
  if (DURATION_MAP[duration]) return DURATION_MAP[duration];
  if (duration < 1) return "16";
  if (duration < 2) return "q";
  if (duration < 4) return "h";
  return "w";
}

function decomposeRestBeats(totalBeats: number): number[] {
  const units = [4, 2, 1, 0.5, 0.25];
  const rests: number[] = [];
  let remaining = totalBeats;

  for (const unit of units) {
    while (remaining >= unit - ADJACENCY_EPSILON) {
      rests.push(unit);
      remaining -= unit;
    }
  }

  if (remaining > ADJACENCY_EPSILON) {
    rests.push(remaining);
  }

  return rests;
}

function createRestNote(durationBeats: number): StaveNote {
  return new StaveNote({
    keys: ["b/4"],
    duration: `${beatsToVexDuration(durationBeats)}r`,
    autoStem: true,
  });
}

function createNoteTickable(note: PartitionNote): StaveNote {
  return new StaveNote({
    keys: [pitchToVexKey(note.pitch)],
    duration: beatsToVexDuration(note.duration),
    autoStem: true,
  });
}

export interface MeasureTickableResult {
  tickables: StaveNote[];
  /** Maps each played note to its index in measureNotes (rests omitted). */
  noteIndexByTickable: number[];
}

export function buildMeasureTickables(
  measureNotes: PartitionNote[],
  beatsPerMeasure: number,
): MeasureTickableResult {
  const sorted = [...measureNotes].sort((a, b) => a.start - b.start);
  const tickables: StaveNote[] = [];
  const noteIndexByTickable: number[] = [];
  let cursor = 0;

  sorted.forEach((note, noteIndex) => {
    const gap = note.start - cursor;
    if (gap > ADJACENCY_EPSILON) {
      for (const restBeats of decomposeRestBeats(gap)) {
        tickables.push(createRestNote(restBeats));
      }
    }

    tickables.push(createNoteTickable(note));
    noteIndexByTickable.push(noteIndex);
    cursor = note.start + note.duration;
  });

  const trailing = beatsPerMeasure - cursor;
  if (trailing > ADJACENCY_EPSILON) {
    for (const restBeats of decomposeRestBeats(trailing)) {
      tickables.push(createRestNote(restBeats));
    }
  }

  return { tickables, noteIndexByTickable };
}

/** Map tie/slur indices on measureNotes to tickable indices. */
export function mapNoteIndexToTickable(
  noteIndex: number,
  noteIndexByTickable: number[],
): number {
  const tickableIndex = noteIndexByTickable.indexOf(noteIndex);
  return tickableIndex >= 0 ? tickableIndex : noteIndex;
}
