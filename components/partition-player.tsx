"use client";

import { Minus, Pause, Play, Plus, Stop } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePartitionPlayer } from "@/hooks/use-partition-player";
import type { PartitionResponse } from "@/lib/types/partition";

interface PartitionPlayerProps {
  partition: PartitionResponse;
}

export function PartitionPlayer({ partition }: PartitionPlayerProps) {
  const {
    isPlaying,
    progress,
    play,
    pause,
    stop,
    isInstrumentLoading,
    effectiveBpm,
    adjustBpm,
    setBpm,
  } = usePartitionPlayer(partition);

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
      return;
    }
    void play();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lecteur</CardTitle>
        <CardDescription>
          Écoutez la partition générée. Tempo : {effectiveBpm} BPM
          {effectiveBpm !== partition.bpm
            ? ` (original ${partition.bpm})`
            : ""}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={progress * 100} className="h-2" />

        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-sm">Tempo</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => adjustBpm(-5)}
              disabled={isInstrumentLoading || effectiveBpm <= 40}
              aria-label="Diminuer le tempo de 5 BPM"
            >
              <Minus className="size-4" />
            </Button>
            <input
              type="range"
              min={40}
              max={240}
              step={1}
              value={effectiveBpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              disabled={isInstrumentLoading}
              className="w-32 accent-primary"
              aria-label="Tempo en BPM"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => adjustBpm(5)}
              disabled={isInstrumentLoading || effectiveBpm >= 240}
              aria-label="Augmenter le tempo de 5 BPM"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {isInstrumentLoading ? (
          <p className="text-muted-foreground text-sm">
            Chargement du piano…
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            className="min-h-12 flex-1"
            onClick={handlePlayPause}
            disabled={isInstrumentLoading}
          >
            {isPlaying ? (
              <>
                <Pause className="size-4" weight="fill" />
                Pause
              </>
            ) : (
              <>
                <Play className="size-4" weight="fill" />
                Lecture
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="min-h-12 min-w-12"
            onClick={stop}
            disabled={isInstrumentLoading}
            aria-label="Arrêter"
          >
            <Stop className="size-4" weight="fill" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
