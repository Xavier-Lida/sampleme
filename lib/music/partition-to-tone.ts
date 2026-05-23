import * as Tone from "tone";
import { buildPlaybackEvents, type PlaybackEvent } from "@/lib/music/note-connections";
import { normalizePitchForTone } from "@/lib/music/pitch";
import type { PartitionInstrument } from "@/lib/music/piano-instrument";
import {
  getPartitionDurationBeats,
  type PartitionNote,
  type PartitionResponse,
} from "@/lib/types/partition";

export interface SchedulePartitionOptions {
  bpm?: number;
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return hash;
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

export function humanizeNoteTiming(
  startSec: number,
  durationSec: number,
  seed: string,
): { startSec: number; durationSec: number } {
  const hash = hashSeed(seed);
  const startJitter = (pseudoRandom(hash) - 0.5) * 0.05;
  const durationScale = 1 + (pseudoRandom(hash + 1) - 0.5) * 0.08;

  return {
    startSec: Math.max(0, startSec + startJitter),
    durationSec: durationSec * durationScale,
  };
}

export function estimateNoteVelocity(durationBeats: number): number {
  const normalized = Math.min(durationBeats / 2, 1);
  return 0.45 + normalized * 0.3;
}

function resolveVelocity(
  notes: PartitionNote[],
  indices: number[],
  durationBeats: number,
): number {
  const fromNotes = indices
    .map((i) => notes[i]?.velocity)
    .filter((v): v is number => v !== undefined);
  if (fromNotes.length > 0) {
    return fromNotes.reduce((a, b) => a + b, 0) / fromNotes.length;
  }
  return estimateNoteVelocity(durationBeats);
}

function applyTiming(
  startSec: number,
  durationSec: number,
  seed: string,
  humanize: boolean,
): { startSec: number; durationSec: number } {
  if (!humanize) {
    return { startSec, durationSec };
  }
  return humanizeNoteTiming(startSec, durationSec, seed);
}

function scheduleSlurChain(
  event: PlaybackEvent,
  notes: PartitionNote[],
  instrument: PartitionInstrument,
  bpm: number,
  humanize: boolean,
  partitionId: string,
): number[] {
  const ids: number[] = [];
  const indices = event.sourceIndices;
  const chainDurations = event.chainDurations ?? indices.map((i) => notes[i].duration);

  let beatCursor = event.start;
  const pitches = indices.map((i) => normalizePitchForTone(notes[i].pitch));

  for (let step = 0; step < indices.length; step++) {
    const stepStartSec = beatsToSeconds(beatCursor, bpm);
    const seed = `${partitionId}-slur-${indices.join("-")}-${step}`;
    const { startSec } = applyTiming(stepStartSec, chainDurations[step], seed, humanize);
    const velocity = resolveVelocity(notes, [indices[step]], chainDurations[step]);

    const currentPitch = pitches[step];
    const previousPitch = step > 0 ? pitches[step - 1] : null;

    const id = Tone.Transport.schedule((time) => {
      if (previousPitch) {
        instrument.triggerRelease(previousPitch, time);
      }
      instrument.triggerAttack(currentPitch, time, velocity);
    }, startSec);
    ids.push(id);

    beatCursor += chainDurations[step];
  }

  const lastPitch = pitches[pitches.length - 1];
  const releaseBeat = beatCursor;
  const releaseSec = beatsToSeconds(releaseBeat, bpm);
  const releaseId = Tone.Transport.schedule((time) => {
    instrument.triggerRelease(lastPitch, time);
  }, releaseSec);
  ids.push(releaseId);

  return ids;
}

function scheduleSimpleEvent(
  event: PlaybackEvent,
  notes: PartitionNote[],
  instrument: PartitionInstrument,
  bpm: number,
  humanize: boolean,
  partitionId: string,
): number {
  const startSeconds = beatsToSeconds(event.start, bpm);
  const durationSeconds = beatsToSeconds(event.duration, bpm);
  const seed = event.sourceIndices
    .map((index) => `${partitionId}-${index}`)
    .join(",");
  const { startSec, durationSec } = applyTiming(
    startSeconds,
    durationSeconds,
    seed,
    humanize,
  );
  const velocity = resolveVelocity(notes, event.sourceIndices, event.duration);
  const pitch = normalizePitchForTone(event.pitch);

  return Tone.Transport.schedule((time) => {
    instrument.triggerAttackRelease(pitch, durationSec, time, velocity);
  }, startSec);
}

export function schedulePartitionOnTransport(
  partition: PartitionResponse,
  instrument: PartitionInstrument,
  options?: SchedulePartitionOptions,
): number[] {
  const eventIds: number[] = [];
  const bpm = options?.bpm ?? partition.bpm;
  const humanize = partition.playbackHumanize === true;

  Tone.Transport.bpm.value = bpm;

  const playbackEvents = buildPlaybackEvents(partition.notes);

  for (const event of playbackEvents) {
    if (event.kind === "slurChain") {
      eventIds.push(
        ...scheduleSlurChain(
          event,
          partition.notes,
          instrument,
          bpm,
          humanize,
          partition.id,
        ),
      );
      continue;
    }

    eventIds.push(
      scheduleSimpleEvent(
        event,
        partition.notes,
        instrument,
        bpm,
        humanize,
        partition.id,
      ),
    );
  }

  return eventIds;
}

export function clearScheduledEvents(eventIds: number[]): void {
  for (const id of eventIds) {
    Tone.Transport.clear(id);
  }
}

export function getPlaybackDurationSeconds(
  partition: PartitionResponse,
  bpm?: number,
): number {
  return beatsToSeconds(
    getPartitionDurationBeats(partition),
    bpm ?? partition.bpm,
  );
}
