'use client';

import { useRef, useState } from 'react';
import type { ClefKind } from '@/lib/music/staff-geometry';
import {
  needsSharp,
  stemUp,
  TREBLE_STAVE_Y,
  BASS_STAVE_Y,
  LINE_SPACING,
} from '@/lib/music/staff-geometry';

const DRAG_THRESHOLD = 4;
const NOTE_RX = 5.5;
const NOTE_RY = 4;
const STEM_LENGTH = 28;

interface InteractiveNoteProps {
  x: number;
  y: number;
  pitch: number;
  clef: ClefKind;
  selected: boolean;
  noteColor?: string;
  onPitchPreview: (pitch: number) => void;
  onPitchCommit: (pitch: number) => void;
  onEditRequest: (clientX: number, clientY: number) => void;
  yToPitch: (clientY: number) => number;
}

export function InteractiveNote({
  x,
  y,
  pitch,
  clef,
  selected,
  noteColor,
  onPitchPreview,
  onPitchCommit,
  onEditRequest,
  yToPitch,
}: InteractiveNoteProps) {
  const [dragging, setDragging] = useState(false);
  const [previewY, setPreviewY] = useState<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const didDrag = useRef(false);

  const displayY = previewY ?? y;
  const up = stemUp(pitch, clef);
  const sharp = needsSharp(pitch);
  const baseColor = noteColor ?? '#1a1a1a';
  const fill = selected || dragging ? '#5b8def' : baseColor;
  const stroke = selected || dragging ? '#3a6ad1' : baseColor;

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerStart.current = { x: e.clientX, y: e.clientY };
    didDrag.current = false;
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (!didDrag.current && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      didDrag.current = true;
    }
    if (didDrag.current) {
      const newPitch = yToPitch(e.clientY);
      onPitchPreview(newPitch);
      const svg = (e.currentTarget as Element).closest('svg');
      if (svg) {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const svgPt = pt.matrixTransform(ctm.inverse());
          setPreviewY(svgPt.y);
        }
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    if (didDrag.current) {
      const newPitch = yToPitch(e.clientY);
      onPitchCommit(newPitch);
    } else {
      onEditRequest(e.clientX, e.clientY);
    }
    pointerStart.current = null;
    didDrag.current = false;
    setDragging(false);
    setPreviewY(null);
  }

  const stemX = up ? x + NOTE_RX - 0.5 : x - NOTE_RX + 0.5;
  const stemY1 = up ? displayY - 2 : displayY + 2;
  const stemY2 = up ? displayY - STEM_LENGTH : displayY + STEM_LENGTH;

  // Compute ledger lines outside the 5-line staff using proper geometry constants
  const ledgerLines: number[] = [];
  const staveTop = clef === 'treble' ? TREBLE_STAVE_Y : BASS_STAVE_Y;
  const staffBottom = staveTop + 4 * LINE_SPACING; // 5 lines → 4 gaps
  const firstAbove = staveTop - LINE_SPACING;       // one line above top
  const firstBelow = staffBottom + LINE_SPACING;    // one line below bottom

  if (displayY <= firstAbove) {
    for (let ly = firstAbove; ly >= displayY - 1; ly -= LINE_SPACING) {
      ledgerLines.push(ly);
    }
  }
  if (displayY >= firstBelow) {
    for (let ly = firstBelow; ly <= displayY + 1; ly += LINE_SPACING) {
      ledgerLines.push(ly);
    }
  }

  return (
    <g
      className={`sheet-note${selected ? ' sheet-note--selected' : ''}`}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <rect
        x={x - 12}
        y={displayY - 14}
        width={24}
        height={28}
        fill="transparent"
      />
      {ledgerLines.map((ly) => (
        <line
          key={ly}
          x1={x - 10}
          y1={ly}
          x2={x + 10}
          y2={ly}
          stroke={stroke}
          strokeWidth="1.2"
        />
      ))}
      {sharp && (
        <text
          x={x - 14}
          y={displayY + 4}
          fontSize="13"
          fontFamily="serif"
          fill={fill}
        >
          ♯
        </text>
      )}
      <ellipse
        cx={x}
        cy={displayY}
        rx={NOTE_RX}
        ry={NOTE_RY}
        fill={fill}
        stroke={stroke}
        strokeWidth="1"
        transform={`rotate(-12 ${x} ${displayY})`}
      />
      <line
        x1={stemX}
        y1={stemY1}
        x2={stemX}
        y2={stemY2}
        stroke={stroke}
        strokeWidth="1.2"
      />
    </g>
  );
}
