import { TranscribeError } from "@/lib/api/errors";
import { normalizePitchForTone } from "@/lib/music/pitch";
import type {
  MusicalNote,
  MusicalNoteDuration,
  TranscriptionResponse,
} from "@/lib/types/api";
import type { PartitionNote, PartitionResponse } from "@/lib/types/partition";

const DEFAULT_BPM = 120;

const VEX_DURATION_TO_BEATS: Record<MusicalNoteDuration, number> = {
  w: 4,
  h: 2,
  q: 1,
  "8": 0.5,
  "16": 0.25,
};

export function vexDurationToBeats(duration: MusicalNoteDuration): number {
  return VEX_DURATION_TO_BEATS[duration];
}

function isRestNote(note: { pitch: string; isRest: boolean }): boolean {
  return note.isRest || note.pitch === "rest";
}

function noteStartBeat(
  note: MusicalNote,
  sequentialStart: number,
  bpm: number,
): number {
  if (note.startBeat !== undefined) {
    return note.startBeat;
  }
  if (note.onsetSec !== undefined) {
    return (note.onsetSec * bpm) / 60;
  }
  return sequentialStart;
}

export function transcriptionResponseToPartition(
  response: TranscriptionResponse,
): PartitionResponse {
  if (response.status === "error") {
    throw new TranscribeError(
      response.error ?? "La transcription a échoué côté serveur.",
    );
  }

  if (!response.data?.length) {
    throw new TranscribeError(
      response.error ?? "Aucune note détectée dans l'enregistrement.",
    );
  }

  const bpm = response.bpm ?? DEFAULT_BPM;
  const notes: PartitionNote[] = [];
  let sequentialStart = 0;
  const hasExplicitTiming = response.data.some(
    (note) => note.startBeat !== undefined || note.onsetSec !== undefined,
  );

  for (const note of response.data) {
    const duration = vexDurationToBeats(note.duration);

    if (isRestNote(note)) {
      if (!hasExplicitTiming) {
        sequentialStart += duration;
      }
      continue;
    }

    const start = noteStartBeat(note, sequentialStart, bpm);

    notes.push({
      pitch: normalizePitchForTone(note.pitch),
      start,
      duration,
      velocity: note.velocity,
    });

    if (!hasExplicitTiming) {
      sequentialStart += duration;
    }
  }

  if (notes.length === 0) {
    throw new TranscribeError(
      "Aucune note jouée détectée (seulement des silences).",
    );
  }

  if (hasExplicitTiming) {
    notes.sort((a, b) => a.start - b.start);
  }

  return {
    id: crypto.randomUUID(),
    title: "Transcription",
    bpm,
    timeSignature: response.timeSignature ?? { beats: 4, beatType: 4 },
    key: response.key,
    notes,
    playbackHumanize: false,
  };
}
