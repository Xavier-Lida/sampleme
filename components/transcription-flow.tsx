"use client";

import { useCallback, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { AudioRecorder } from "@/components/audio-recorder";
import { PartitionPlayer } from "@/components/partition-player";
import { PartitionViewer } from "@/components/partition-viewer";
import { TranscriptionPanel } from "@/components/transcription-panel";
import { Button } from "@/components/ui/button";
import { transcribeAudio } from "@/lib/api/transcribe";
import { TranscribeError } from "@/lib/api/errors";
import type { PartitionResponse } from "@/lib/types/partition";

export function TranscriptionFlow() {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [partition, setPartition] = useState<PartitionResponse | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const handleRecordingReady = useCallback((blob: Blob) => {
    setAudioBlob(blob);
    setPartition(null);
    setTranscribeError(null);
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const result = await transcribeAudio(audioBlob);
      setPartition(result);
    } catch (error) {
      const message =
        error instanceof TranscribeError
          ? error.message
          : "Impossible de générer la partition.";
      setTranscribeError(message);
    } finally {
      setIsTranscribing(false);
    }
  }, [audioBlob]);

  const handleStartOver = () => {
    setAudioBlob(null);
    setPartition(null);
    setTranscribeError(null);
    setIsTranscribing(false);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {!partition && (
        <>
          <AudioRecorder
            onRecordingReady={handleRecordingReady}
            onRecordingCleared={() => setAudioBlob(null)}
          />
          <TranscriptionPanel
            disabled={!audioBlob}
            isLoading={isTranscribing}
            error={transcribeError}
            onTranscribe={() => void handleTranscribe()}
          />
        </>
      )}

      {partition && (
        <>
          <PartitionViewer partition={partition} />
          <PartitionPlayer partition={partition} />
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full"
            onClick={handleStartOver}
          >
            <ArrowCounterClockwise className="size-4" />
            Nouvel enregistrement
          </Button>
        </>
      )}
    </div>
  );
}
