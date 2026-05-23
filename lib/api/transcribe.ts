import samplePartition from "@/lib/mocks/sample-partition.json";
import { TranscribeError } from "@/lib/api/errors";
import { transcriptionResponseToPartition } from "@/lib/api/transcription-adapter";
import type { FastAPIValidationError, TranscriptionResponse } from "@/lib/types/api";
import type { PartitionResponse } from "@/lib/types/partition";

const MOCK_DELAY_MS = 1800;

/** Matches backend settings.MAX_UPLOAD_BYTES (25 MB). */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function shouldUseMockApi(): boolean {
  const flag = process.env.NEXT_PUBLIC_USE_MOCK;
  if (flag === "false") return false;
  if (flag === "true") return true;
  return !process.env.NEXT_PUBLIC_API_URL;
}

function shouldUseProxy(): boolean {
  return process.env.NEXT_PUBLIC_USE_API_PROXY === "true";
}

export function normalizeApiUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getAudioFilename(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type.includes("mp4") || type.includes("m4a")) return "recording.m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "recording.mp3";
  if (type.includes("ogg")) return "recording.ogg";
  if (type.includes("wav")) return "recording.wav";
  return "recording.webm";
}

export function validateAudioBlob(audio: Blob): void {
  if (audio.size === 0) {
    throw new TranscribeError("L'enregistrement audio est vide.");
  }
  if (audio.size > MAX_UPLOAD_BYTES) {
    throw new TranscribeError(
      `Fichier trop volumineux (max ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} Mo).`,
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function transcribeWithMock(): Promise<PartitionResponse> {
  await delay(MOCK_DELAY_MS);
  return samplePartition as PartitionResponse;
}

function formatValidationError(payload: FastAPIValidationError): string {
  const first = payload.detail?.[0];
  if (!first?.msg) return "Requête invalide (422).";
  const location = first.loc?.filter((part) => typeof part === "string").join(".");
  return location ? `${location}: ${first.msg}` : first.msg;
}

function getTranscribeUrl(): string {
  if (shouldUseProxy()) {
    return "/api/transcribe";
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new TranscribeError("NEXT_PUBLIC_API_URL is not configured");
  }
  return `${normalizeApiUrl(baseUrl)}/api/transcribe`;
}

async function transcribeWithBackend(audio: Blob): Promise<PartitionResponse> {
  validateAudioBlob(audio);

  // POST multipart/form-data — field name must be exactly "audio" (no Content-Type header).
  const form = new FormData();
  form.append("audio", audio, getAudioFilename(audio));

  let response: Response;
  try {
    response = await fetch(getTranscribeUrl(), {
      method: "POST",
      body: form,
    });
  } catch {
    throw new TranscribeError(
      "Impossible de joindre le serveur. Vérifiez votre connexion ou activez le proxy API.",
    );
  }

  if (!response.ok) {
    if (response.status === 422) {
      const payload = (await response.json()) as FastAPIValidationError;
      throw new TranscribeError(formatValidationError(payload), 422);
    }
    throw new TranscribeError(
      `Transcription échouée (${response.status}).`,
      response.status,
    );
  }

  const payload = (await response.json()) as TranscriptionResponse;
  return transcriptionResponseToPartition(payload);
}

export async function transcribeAudio(
  audio: Blob,
): Promise<PartitionResponse> {
  if (shouldUseMockApi()) {
    return transcribeWithMock();
  }
  return transcribeWithBackend(audio);
}

export { TranscribeError } from "@/lib/api/errors";
