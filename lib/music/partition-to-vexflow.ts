import {
  Beam,
  Curve,
  Formatter,
  Renderer,
  Stave,
  StaveTie,
  Voice,
} from "vexflow";
import {
  buildMeasureTickables,
  mapNoteIndexToTickable,
} from "@/lib/music/measure-tickables";
import {
  findSlurPairs,
  findTieGroups,
} from "@/lib/music/note-connections";
import {
  getBeatsPerMeasure,
  type PartitionNote,
  type PartitionResponse,
} from "@/lib/types/partition";

function groupNotesByMeasure(
  notes: PartitionNote[],
  beatsPerMeasure: number,
): PartitionNote[][] {
  const measures: PartitionNote[][] = [];
  for (const note of notes) {
    const measureIndex = Math.floor(note.start / beatsPerMeasure);
    while (measures.length <= measureIndex) {
      measures.push([]);
    }
    measures[measureIndex].push({
      ...note,
      start: note.start - measureIndex * beatsPerMeasure,
    });
  }
  return measures;
}

function timeSignatureToVex(partition: PartitionResponse): string {
  const { beats, beatType } = partition.timeSignature;
  return `${beats}/${beatType}`;
}

export function renderPartitionToElement(
  container: HTMLDivElement,
  partition: PartitionResponse,
): void {
  container.innerHTML = "";

  const beatsPerMeasure = getBeatsPerMeasure(partition);
  const measureGroups = groupNotesByMeasure(partition.notes, beatsPerMeasure);
  const staveWidth = 320;
  const staveHeight = 120;
  const width = Math.max(360, measureGroups.length * staveWidth + 40);
  const height = staveHeight + 60;

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();

  const formatter = new Formatter();
  const timeSig = timeSignatureToVex(partition);

  measureGroups.forEach((measureNotes, index) => {
    const x = 20 + index * staveWidth;
    const stave = new Stave(x, 30, staveWidth - 20);
    if (index === 0) {
      stave.addClef("treble").addTimeSignature(timeSig);
      if (partition.key) {
        stave.addKeySignature(partition.key.split(" ")[0] ?? "C");
      }
    }
    stave.setContext(context).draw();

    const { tickables, noteIndexByTickable } = buildMeasureTickables(
      measureNotes,
      beatsPerMeasure,
    );

    if (tickables.length === 0) return;

    const voice = new Voice({
      numBeats: partition.timeSignature.beats,
      beatValue: partition.timeSignature.beatType,
    });
    voice.setStrict(false);
    voice.addTickables(tickables);
    formatter.joinVoices([voice]).formatToStave([voice], stave);
    voice.draw(context, stave);

    const beams = Beam.applyAndGetBeams(
      voice,
      undefined,
      Beam.getDefaultBeamGroups(timeSig),
    );
    for (const beam of beams) {
      beam.setContext(context).draw();
    }

    const toTickable = (noteIndex: number) =>
      tickables[mapNoteIndexToTickable(noteIndex, noteIndexByTickable)];

    for (const group of findTieGroups(measureNotes)) {
      new StaveTie({
        firstNote: toTickable(group.startIndex),
        lastNote: toTickable(group.endIndex),
        firstIndexes: [0],
        lastIndexes: [0],
      })
        .setContext(context)
        .draw();
    }

    for (const pair of findSlurPairs(measureNotes)) {
      new Curve(toTickable(pair.fromIndex), toTickable(pair.toIndex), {
        openingDirection: "auto",
      })
        .setContext(context)
        .draw();
    }
  });
}
