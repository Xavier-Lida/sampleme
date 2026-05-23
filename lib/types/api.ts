export type MusicalNoteDuration = "w" | "h" | "q" | "8" | "16";

export type TranscriptionStatus = "success" | "error";

export interface MusicalNote {
  pitch: string;
  duration: MusicalNoteDuration;
  isRest: boolean;
  /** Beat offset from start of piece (API v2). */
  startBeat?: number;
  /** Onset in seconds from recording start (API v2). */
  onsetSec?: number;
  /** Release in seconds (API v2). */
  offsetSec?: number;
  /** Normalized velocity 0–1 (API v2). */
  velocity?: number;
}

export interface TranscriptionResponse {
  status: TranscriptionStatus;
  data: MusicalNote[] | null;
  error: string | null;
  /** Estimated tempo (API v2). */
  bpm?: number;
  timeSignature?: { beats: number; beatType: number };
  key?: string;
}

export interface FastAPIValidationError {
  detail?: Array<{ msg?: string; loc?: (string | number)[] }>;
}
