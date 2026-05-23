import { TranscribeError } from "@/lib/api/errors";
import type {
  MusicalNoteDuration,
  TranscriptionResponse,
} from "@/lib/types/api";
import type { PartitionNote, PartitionResponse } from "@/lib/types/partition";

const BACKEND_BPM = 120;

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

  const notes: PartitionNote[] = [];
  let start = 0;

  for (const note of response.data) {
    const duration = vexDurationToBeats(note.duration);

    if (isRestNote(note)) {
      start += duration;
      continue;
    }

    notes.push({
      pitch: note.pitch,
      start,
      duration,
    });
    start += duration;
  }

  if (notes.length === 0) {
    throw new TranscribeError(
      "Aucune note jouée détectée (seulement des silences).",
    );
  }

  return {
    id: crypto.randomUUID(),
    title: "Transcription",
    bpm: BACKEND_BPM,
    timeSignature: { beats: 4, beatType: 4 },
    notes,
  };
}
