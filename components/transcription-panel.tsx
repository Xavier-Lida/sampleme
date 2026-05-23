"use client";

import { Sparkle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface TranscriptionPanelProps {
  disabled?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onTranscribe: () => void;
}

export function TranscriptionPanel({
  disabled,
  isLoading,
  error,
  onTranscribe,
}: TranscriptionPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcription</CardTitle>
        <CardDescription>
          Générez une partition à partir de votre enregistrement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          className="min-h-12 w-full"
          disabled={disabled || isLoading}
          onClick={onTranscribe}
        >
          <Sparkle className="size-4" weight="fill" />
          {isLoading ? "Génération en cours…" : "Générer la partition"}
        </Button>

        {isLoading && <Progress value={undefined} className="h-1" />}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
