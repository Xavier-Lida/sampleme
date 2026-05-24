'use client';

import { useEffect, useRef } from 'react';
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  Formatter,
  Accidental,
} from 'vexflow';
import type { Note } from '@/types/transcription';
import { FIXED_BPM, SIXTEENTH_SECONDS } from '@/types/transcription';

interface Props {
  notes: Note[];
  width?: number;
  height?: number;
}

// MIDI pitch → VexFlow key string (e.g. 60 -> "c/4", 61 -> "c#/4")
const SHARP_PITCH_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

function midiToVexKey(midi: number): { key: string; needsAccidental: boolean } {
  const name = SHARP_PITCH_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { key: `${name}/${octave}`, needsAccidental: name.includes('#') };
}

// Map a duration in seconds to a VexFlow duration string. 120 BPM ⇒ quarter=0.5s.
function durationToVexFlow(seconds: number): string {
  const quarters = seconds / (60 / FIXED_BPM);
  if (quarters >= 4) return 'w';
  if (quarters >= 2) return 'h';
  if (quarters >= 1) return 'q';
  if (quarters >= 0.5) return '8';
  return '16';
}

export default function SheetMusicRenderer({ notes, width = 800, height = 220 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();

    const stave = new Stave(10, 40, width - 20);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(ctx).draw();

    if (notes.length === 0) {
      ctx.setFont('sans-serif', 14).fillText('No notes yet — record something.', 30, 100);
      return;
    }

    const staveNotes = notes.map((n) => {
      const { key, needsAccidental } = midiToVexKey(n.pitch);
      const duration = durationToVexFlow(Math.max(n.end - n.start, SIXTEENTH_SECONDS));
      const sn = new StaveNote({ keys: [key], duration });
      if (needsAccidental) sn.addModifier(new Accidental('#'), 0);
      return sn;
    });

    try {
      const voice = new Voice({ num_beats: staveNotes.length, beat_value: 4 }).setStrict(false);
      voice.addTickables(staveNotes);
      new Formatter().joinVoices([voice]).format([voice], width - 80);
      voice.draw(ctx, stave);
    } catch (err) {
      ctx.setFont('sans-serif', 12).fillText(
        `Render error: ${(err as Error).message}`,
        30,
        100,
      );
    }
  }, [notes, width, height]);

  return <div ref={hostRef} aria-label="Sheet music" />;
}
