import { melodicIntervalSemitones } from "@/lib/music/pitch";
import type { PartitionNote } from "@/lib/types/partition";

const ADJACENCY_EPSILON = 1e-6;
const MAX_SLUR_MELODIC_INTERVAL = 2;

export interface TieGroup {
  startIndex: number;
  endIndex: number;
}

export interface SlurPair {
  fromIndex: number;
  toIndex: number;
}

export type SlurChain = number[];

export type PlaybackEventKind = "single" | "tied" | "slurChain";

export interface PlaybackEvent {
  pitch: string;
  start: number;
  duration: number;
  kind: PlaybackEventKind;
  sourceIndices: number[];
  /** Per-note durations within a slur chain (beats). */
  chainDurations?: number[];
  velocities?: number[];
}

export function areAdjacentNotes(a: PartitionNote, b: PartitionNote): boolean {
  return Math.abs(a.start + a.duration - b.start) < ADJACENCY_EPSILON;
}

export function findTieGroups(notes: PartitionNote[]): TieGroup[] {
  const groups: TieGroup[] = [];
  let i = 0;

  while (i < notes.length) {
    let end = i;
    while (
      end + 1 < notes.length &&
      areAdjacentNotes(notes[end], notes[end + 1]) &&
      notes[end].pitch === notes[end + 1].pitch
    ) {
      end++;
    }

    if (end > i) {
      groups.push({ startIndex: i, endIndex: end });
    }
    i = end + 1;
  }

  return groups;
}

function isIndexInTieGroup(
  index: number,
  tieGroups: TieGroup[],
): TieGroup | undefined {
  return tieGroups.find(
    (group) => index >= group.startIndex && index <= group.endIndex,
  );
}

function areInSameTieGroup(
  a: number,
  b: number,
  tieGroups: TieGroup[],
): boolean {
  return tieGroups.some(
    (group) =>
      a >= group.startIndex &&
      a <= group.endIndex &&
      b >= group.startIndex &&
      b <= group.endIndex,
  );
}

function isBetweenTieGroups(i: number, tieGroups: TieGroup[]): boolean {
  const left = tieGroups.find((group) => group.endIndex === i);
  const right = tieGroups.find((group) => group.startIndex === i + 1);
  return !!(left && right && left !== right);
}

function isMelodicSlurStep(notes: PartitionNote[], i: number): boolean {
  const interval = melodicIntervalSemitones(notes[i].pitch, notes[i + 1].pitch);
  if (interval === null) return false;
  return interval <= MAX_SLUR_MELODIC_INTERVAL;
}

export function findSlurPairs(notes: PartitionNote[]): SlurPair[] {
  const tieGroups = findTieGroups(notes);
  const pairs: SlurPair[] = [];

  for (let i = 0; i < notes.length - 1; i++) {
    if (!areAdjacentNotes(notes[i], notes[i + 1])) continue;
    if (notes[i].pitch === notes[i + 1].pitch) continue;
    if (areInSameTieGroup(i, i + 1, tieGroups)) continue;
    if (isBetweenTieGroups(i, tieGroups)) continue;
    if (!isMelodicSlurStep(notes, i)) continue;
    pairs.push({ fromIndex: i, toIndex: i + 1 });
  }

  return pairs;
}

export function findSlurChains(pairs: SlurPair[]): SlurChain[] {
  if (pairs.length === 0) return [];

  const sorted = [...pairs].sort((a, b) => a.fromIndex - b.fromIndex);
  const chains: SlurChain[] = [];
  let chain: SlurChain = [sorted[0].fromIndex, sorted[0].toIndex];

  for (let i = 1; i < sorted.length; i++) {
    const pair = sorted[i];
    if (pair.fromIndex === chain[chain.length - 1]) {
      chain.push(pair.toIndex);
    } else {
      chains.push(chain);
      chain = [pair.fromIndex, pair.toIndex];
    }
  }
  chains.push(chain);

  return chains;
}

export function buildPlaybackEvents(notes: PartitionNote[]): PlaybackEvent[] {
  if (notes.length === 0) return [];

  const tieGroups = findTieGroups(notes);
  const slurPairs = findSlurPairs(notes);
  const slurChains = findSlurChains(slurPairs);
  const events: PlaybackEvent[] = [];
  const consumed = new Set<number>();

  for (const chain of slurChains) {
    for (const index of chain) {
      consumed.add(index);
    }
    const chainNotes = chain.map((i) => notes[i]);
    events.push({
      pitch: chainNotes[0].pitch,
      start: chainNotes[0].start,
      duration: chainNotes.reduce((sum, n) => sum + n.duration, 0),
      kind: "slurChain",
      sourceIndices: chain,
      chainDurations: chainNotes.map((n) => n.duration),
      velocities: chainNotes.map((n) => n.velocity).filter((v) => v !== undefined) as
        | number[]
        | undefined,
    });
  }

  for (let i = 0; i < notes.length; i++) {
    if (consumed.has(i)) continue;

    const tieGroup = isIndexInTieGroup(i, tieGroups);
    if (tieGroup && i !== tieGroup.startIndex) continue;

    if (tieGroup) {
      const groupNotes = notes.slice(tieGroup.startIndex, tieGroup.endIndex + 1);
      const totalDuration = groupNotes.reduce((sum, n) => sum + n.duration, 0);
      events.push({
        pitch: notes[tieGroup.startIndex].pitch,
        start: notes[tieGroup.startIndex].start,
        duration: totalDuration,
        kind: "tied",
        sourceIndices: Array.from(
          { length: tieGroup.endIndex - tieGroup.startIndex + 1 },
          (_, j) => tieGroup.startIndex + j,
        ),
        velocities: groupNotes
          .map((n) => n.velocity)
          .filter((v): v is number => v !== undefined),
      });
      continue;
    }

    const note = notes[i];
    events.push({
      pitch: note.pitch,
      start: note.start,
      duration: note.duration,
      kind: "single",
      sourceIndices: [i],
      velocities: note.velocity !== undefined ? [note.velocity] : undefined,
    });
  }

  events.sort((a, b) => a.start - b.start);
  return events;
}
