"use client";

import { useEffect } from "react";
import { Microphone, Stop, ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRecordingTime } from "@/lib/audio/recorder";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { cn } from "@/lib/utils";

interface AudioRecorderProps {
  onRecordingReady?: (blob: Blob) => void;
  onRecordingCleared?: () => void;
}

export function AudioRecorder({
  onRecordingReady,
  onRecordingCleared,
}: AudioRecorderProps) {
  const {
    status,
    error,
    previewUrl,
    elapsedSeconds,
    audioBlob,
    startRecording,
    stopRecording,
    reset,
    isRecording,
    hasRecording,
  } = useAudioRecorder();

  const handleStop = () => {
    stopRecording();
  };

  const handleReset = () => {
    reset();
    onRecordingCleared?.();
  };

  useEffect(() => {
    if (hasRecording && audioBlob) {
      onRecordingReady?.(audioBlob);
    }
  }, [audioBlob, hasRecording, onRecordingReady]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enregistrement</CardTitle>
        <CardDescription>
          Enregistrez un extrait musical avec le micro de votre téléphone.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          {isRecording && (
            <Badge variant="destructive" className="animate-pulse">
              REC {formatRecordingTime(elapsedSeconds)}
            </Badge>
          )}
          {hasRecording && (
            <Badge variant="secondary">Prêt à transcrire</Badge>
          )}
        </div>

        <div className="flex flex-col items-center gap-4">
          {!isRecording && !hasRecording && (
            <Button
              type="button"
              size="icon-lg"
              className={cn(
                "size-20 rounded-full",
                status === "error" && "opacity-80",
              )}
              onClick={() => void startRecording()}
              aria-label="Démarrer l'enregistrement"
            >
              <Microphone className="size-8" weight="fill" />
            </Button>
          )}

          {isRecording && (
            <Button
              type="button"
              size="icon-lg"
              variant="destructive"
              className="size-20 rounded-full"
              onClick={handleStop}
              aria-label="Arrêter l'enregistrement"
            >
              <Stop className="size-8" weight="fill" />
            </Button>
          )}

          {hasRecording && previewUrl && (
            <audio
              controls
              src={previewUrl}
              className="w-full max-w-sm"
              preload="metadata"
            />
          )}
        </div>

        {hasRecording && (
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full"
            onClick={handleReset}
          >
            <ArrowCounterClockwise className="size-4" />
            Réenregistrer
          </Button>
        )}

        {error && (
          <p className="text-center text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {!hasRecording && !error && status === "idle" && (
          <p className="text-center text-sm text-muted-foreground">
            Appuyez sur le micro pour commencer
          </p>
        )}
      </CardContent>
    </Card>
  );
}
