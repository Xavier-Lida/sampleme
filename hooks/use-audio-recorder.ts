"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupportedMimeType } from "@/lib/audio/recorder";

export type RecorderStatus = "idle" | "recording" | "recorded" | "error";

export function useAudioRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearPreviewUrl = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const reset = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopStream();
    clearPreviewUrl();
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    setAudioBlob(null);
    setElapsedSeconds(0);
    setError(null);
    setStatus("idle");
  }, [clearPreviewUrl, stopStream]);

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("L'enregistrement audio n'est pas supporté sur cet appareil.");
      setStatus("error");
      return;
    }

    try {
      reset();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopStream();

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        chunksRef.current = [];
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("recorded");
      };

      recorder.onerror = () => {
        setError("Erreur pendant l'enregistrement.");
        setStatus("error");
      };

      recorder.start(250);
      setStatus("recording");
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((value) => value + 1);
      }, 1000);
    } catch {
      stopStream();
      setError(
        "Accès au micro refusé. Autorisez le micro dans les réglages du navigateur.",
      );
      setStatus("error");
    }
  }, [reset, stopStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopStream();
      clearPreviewUrl();
    };
  }, [clearPreviewUrl, stopStream]);

  return {
    status,
    error,
    audioBlob,
    previewUrl,
    elapsedSeconds,
    startRecording,
    stopRecording,
    reset,
    isRecording: status === "recording",
    hasRecording: status === "recorded" && audioBlob !== null,
  };
}
