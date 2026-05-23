"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import {
  AudioSourceCard,
  type AudioReadyMeta,
} from "@/components/audio-recorder";
import { PartitionPlayer } from "@/components/partition-player";
import { PartitionViewer } from "@/components/partition-viewer";
import { TranscriptionPanel } from "@/components/transcription-panel";
import { Button } from "@/components/ui/button";
import { transcribeAudio } from "@/lib/api/transcribe";
import { TranscribeError } from "@/lib/api/errors";
import {
  partitionHasExplicitTiming,
  quantizePartition,
} from "@/lib/music/quantize";
import type { PartitionResponse } from "@/lib/types/partition";

export function TranscriptionFlow() {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioFilename, setAudioFilename] = useState<string | undefined>();
  const [partition, setPartition] = useState<PartitionResponse | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [quantizeEnabled, setQuantizeEnabled] = useState(false);
  const [quantizeStrength, setQuantizeStrength] = useState(0.5);

  const displayedPartition = useMemo(() => {
    if (!partition) return null;
    if (!quantizeEnabled) return partition;
    return quantizePartition(partition, quantizeStrength);
  }, [partition, quantizeEnabled, quantizeStrength]);

  const canQuantize =
    partition !== null && partitionHasExplicitTiming(partition.notes);

  const handleAudioReady = useCallback((blob: Blob, meta?: AudioReadyMeta) => {
    setAudioBlob(blob);
    setAudioFilename(meta?.filename);
    setPartition(null);
    setTranscribeError(null);
  }, []);

  const handleAudioCleared = useCallback(() => {
    setAudioBlob(null);
    setAudioFilename(undefined);
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const result = await transcribeAudio(audioBlob, {
        filename: audioFilename,
      });
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
  }, [audioBlob, audioFilename]);

  const handleStartOver = () => {
    setAudioBlob(null);
    setAudioFilename(undefined);
    setPartition(null);
    setTranscribeError(null);
    setIsTranscribing(false);
    setQuantizeEnabled(false);
    setQuantizeStrength(0.5);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      {!partition && (
        <>
          <AudioSourceCard
            onAudioReady={handleAudioReady}
            onAudioCleared={handleAudioCleared}
          />
          <TranscriptionPanel
            audioBlob={audioBlob}
            audioFilename={audioFilename}
            disabled={!audioBlob}
            isLoading={isTranscribing}
            error={transcribeError}
            onTranscribe={() => void handleTranscribe()}
          />
        </>
      )}

      {displayedPartition && (
        <>
          {canQuantize ? (
            <div className="flex flex-col gap-3 rounded-md border bg-card p-4">
              <div className="flex items-center gap-2">
                <input
                  id="quantize-toggle"
                  type="checkbox"
                  checked={quantizeEnabled}
                  onChange={(e) => setQuantizeEnabled(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <label htmlFor="quantize-toggle" className="text-sm">
                  Quantifier le rythme
                </label>
              </div>
              {quantizeEnabled ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor="quantize-strength" className="text-sm">
                    Force ({Math.round(quantizeStrength * 100)} %)
                  </label>
                  <input
                    id="quantize-strength"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={quantizeStrength}
                    onChange={(e) =>
                      setQuantizeStrength(Number(e.target.value))
                    }
                    className="accent-primary"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <PartitionViewer
            key={displayedPartition.id}
            partition={displayedPartition}
          />
          <PartitionPlayer
            key={displayedPartition.id}
            partition={displayedPartition}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full"
            onClick={handleStartOver}
          >
            <ArrowCounterClockwise className="size-4" />
            Nouvelle source
          </Button>
        </>
      )}
    </div>
  );
}
