import * as Tone from "tone";
import {
  getPartitionDurationBeats,
  type PartitionResponse,
} from "@/lib/types/partition";

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

export function schedulePartitionOnTransport(
  partition: PartitionResponse,
  synth: Tone.PolySynth,
): number[] {
  const eventIds: number[] = [];
  const { bpm } = partition;

  Tone.Transport.bpm.value = bpm;

  for (const note of partition.notes) {
    const startSeconds = beatsToSeconds(note.start, bpm);
    const durationSeconds = beatsToSeconds(note.duration, bpm);

    const id = Tone.Transport.schedule((time) => {
      synth.triggerAttackRelease(note.pitch, durationSeconds, time);
    }, startSeconds);

    eventIds.push(id);
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
): number {
  return beatsToSeconds(getPartitionDurationBeats(partition), partition.bpm);
}

export function createPartitionSynth(): Tone.PolySynth {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.4 },
  }).toDestination();
}
