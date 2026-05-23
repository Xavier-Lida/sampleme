"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { renderPartitionToElement } from "@/lib/music/partition-to-vexflow";
import type { PartitionResponse } from "@/lib/types/partition";

interface PartitionViewerProps {
  partition: PartitionResponse;
}

export function PartitionViewer({ partition }: PartitionViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    renderPartitionToElement(container, partition);
  }, [partition]);

  const timeSignature = `${partition.timeSignature.beats}/${partition.timeSignature.beatType}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{partition.title ?? "Partition"}</CardTitle>
        <CardDescription className="flex flex-wrap gap-2">
          <Badge variant="secondary">{partition.bpm} BPM</Badge>
          <Badge variant="outline">{timeSignature}</Badge>
          {partition.key && <Badge variant="outline">{partition.key}</Badge>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border bg-card p-2">
          <div ref={containerRef} className="min-w-max" />
        </div>
      </CardContent>
    </Card>
  );
}
