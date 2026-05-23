"use client";

import { Pause, Play, Stop } from "@phosphor-icons/react";
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
  const { isPlaying, progress, play, pause, stop } =
    usePartitionPlayer(partition);

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
          Écoutez la partition générée ({partition.bpm} BPM).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Progress value={progress * 100} className="h-2" />

        <div className="flex gap-2">
          <Button
            type="button"
            className="min-h-12 flex-1"
            onClick={handlePlayPause}
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
            aria-label="Arrêter"
          >
            <Stop className="size-4" weight="fill" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
