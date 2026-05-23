export type MusicalNoteDuration = "w" | "h" | "q" | "8" | "16";

export type TranscriptionStatus = "success" | "error";

export interface MusicalNote {
  pitch: string;
  duration: MusicalNoteDuration;
  isRest: boolean;
}

export interface TranscriptionResponse {
  status: TranscriptionStatus;
  data: MusicalNote[] | null;
  error: string | null;
}

export interface FastAPIValidationError {
  detail?: Array<{ msg?: string; loc?: (string | number)[] }>;
}
