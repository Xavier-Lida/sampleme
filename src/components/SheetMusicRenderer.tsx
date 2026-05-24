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
import { yToMidiPitch } from '@/lib/music/note-editing';

interface Props {
  notes: Note[];
  width?: number;
  height?: number;
  selectedIndex?: number | null;
  onNoteSelect?: (index: number) => void;
  onStaffClick?: (pitch: number) => void;
}

const STAVE_Y = 40;

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

export default function SheetMusicRenderer({
  notes,
  width = 800,
  height = 220,
  selectedIndex = null,
  onNoteSelect,
  onStaffClick,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onNoteSelectRef = useRef(onNoteSelect);
  const onStaffClickRef = useRef(onStaffClick);

  onNoteSelectRef.current = onNoteSelect;
  onStaffClickRef.current = onStaffClick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const ctx = renderer.getContext();
    const svg = host.querySelector('svg');

    const stave = new Stave(10, STAVE_Y, width - 20);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(ctx).draw();

    const cleanups: Array<() => void> = [];

    if (notes.length === 0) {
      ctx.setFont('sans-serif', 14).fillText('No notes yet — click the staff to add one.', 30, 100);
    } else {
      const staveNotes = notes.map((n, index) => {
        const { key, needsAccidental } = midiToVexKey(n.pitch);
        const duration = durationToVexFlow(Math.max(n.end - n.start, SIXTEENTH_SECONDS));
        const sn = new StaveNote({ keys: [key], duration });
        if (needsAccidental) sn.addModifier(new Accidental('#'), 0);
        if (index === selectedIndex) {
          sn.setStyle({ fillStyle: '#5b8def', strokeStyle: '#3a6ad1' });
        }
        return sn;
      });

      try {
        const voice = new Voice({ num_beats: staveNotes.length, beat_value: 4 }).setStrict(false);
        voice.addTickables(staveNotes);
        new Formatter().joinVoices([voice]).format([voice], width - 80);
        voice.draw(ctx, stave);

        staveNotes.forEach((sn, index) => {
          const el = sn.getSVGElement?.();
          if (!el) return;
          el.style.cursor = 'pointer';
          const handler = (e: Event) => {
            e.stopPropagation();
            onNoteSelectRef.current?.(index);
          };
          el.addEventListener('click', handler);
          cleanups.push(() => el.removeEventListener('click', handler));
        });
      } catch (err) {
        ctx.setFont('sans-serif', 12).fillText(
          `Render error: ${(err as Error).message}`,
          30,
          100,
        );
      }
    }

    if (svg && onStaffClickRef.current) {
      svg.style.cursor = 'crosshair';
      const staffHandler = (e: MouseEvent) => {
        const target = e.target as Element;
        if (target.closest('.vf-stavenote')) return;
        const rect = svg.getBoundingClientRect();
        const y = e.clientY - rect.top;
        onStaffClickRef.current?.(yToMidiPitch(y, STAVE_Y));
      };
      svg.addEventListener('click', staffHandler);
      cleanups.push(() => svg.removeEventListener('click', staffHandler));
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, [notes, width, height, selectedIndex]);

  return <div ref={hostRef} aria-label="Sheet music" className="sheet-renderer" />;
}
