import { Renderer, Stave, StaveNote, Voice, Formatter } from "vexflow";
import {
  getBeatsPerMeasure,
  type PartitionNote,
  type PartitionResponse,
} from "@/lib/types/partition";

const DURATION_MAP: Record<number, string> = {
  0.25: "16",
  0.5: "8",
  1: "q",
  2: "h",
  4: "w",
};

function beatsToVexDuration(duration: number): string {
  if (DURATION_MAP[duration]) return DURATION_MAP[duration];
  if (duration < 1) return "16";
  if (duration < 2) return "q";
  if (duration < 4) return "h";
  return "w";
}

function pitchToVexKey(pitch: string): string {
  const match = pitch.match(/^([A-Ga-g])([#b]?)(\d)$/);
  if (!match) return "c/4";
  const [, letter, accidental, octave] = match;
  const note = letter.toLowerCase();
  const acc = accidental === "#" ? "#" : accidental === "b" ? "b" : "";
  return `${note}${acc}/${octave}`;
}

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

    const tickables = measureNotes.map((note) => {
      return new StaveNote({
        keys: [pitchToVexKey(note.pitch)],
        duration: beatsToVexDuration(note.duration),
        autoStem: true,
      });
    });

    if (tickables.length === 0) return;

    const voice = new Voice({
      numBeats: partition.timeSignature.beats,
      beatValue: partition.timeSignature.beatType,
    });
    voice.setStrict(false);
    voice.addTickables(tickables);
    formatter.joinVoices([voice]).formatToStave([voice], stave);
    voice.draw(context, stave);
  });
}
