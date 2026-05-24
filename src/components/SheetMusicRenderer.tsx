'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractiveNote } from '@/components/sheet/InteractiveNote';
import { NoteEditPopover } from '@/components/sheet/NoteEditPopover';
import { StaffLines, TimeSignature } from '@/components/sheet/StaffLines';
import { TabNote } from '@/components/sheet/TabNote';
import { BassClef, GrandStaffBrace, TrebleClef } from '@/components/sheet/clefs';
import { staffClickToStart } from '@/lib/music/note-editing';
import { getInstrumentDefinition, getNotationKind } from '@/lib/music/instrument-registry';
import type { PlaybackInstrumentId } from '@/lib/music/instrument-registry';
import { tabLineYs, yToGuitarMidi } from '@/lib/music/guitar-tab';
import {
  BASS_STAVE_Y,
  NOTE_AREA_LEFT,
  SINGLE_STAVE_Y,
  TAB_TOP,
  TREBLE_STAVE_Y,
  buildSheetLayout,
  clefForNote,
  computeSheetWidth,
  pitchToNoteY,
  timeToX,
  yToNotePitch,
} from '@/lib/music/staff-geometry';
import type { DisplayNote, SelectedNoteRef } from '@/types/display';

interface Props {
  displayNotes: DisplayNote[];
  width?: number;
  timelineDuration: number;
  selectedNoteRef?: SelectedNoteRef | null;
  activeTrackInstrument?: PlaybackInstrumentId | null;
  onNoteSelect?: (trackId: string, indexInTrack: number) => void;
  onNotePitchChange?: (trackId: string, indexInTrack: number, newPitch: number) => void;
  onNoteUpdate?: (
    trackId: string,
    indexInTrack: number,
    patch: { pitch?: number; end?: number },
  ) => void;
  onNoteRemove?: (trackId: string, indexInTrack: number) => void;
  onStaffClick?: (pitch: number, start: number) => void;
  onSvgReady?: (svg: SVGSVGElement | null) => void;
}

function noteKey(d: DisplayNote): string {
  return `${d.trackId}-${d.indexInTrack}`;
}

function clientYToSvgY(svg: SVGSVGElement, clientY: number): number {
  const pt = svg.createSVGPoint();
  pt.x = 0;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return clientY;
  return pt.matrixTransform(ctm.inverse()).y;
}

export default function SheetMusicRenderer({
  displayNotes,
  width = 800,
  timelineDuration,
  selectedNoteRef = null,
  activeTrackInstrument = null,
  onNoteSelect,
  onNotePitchChange,
  onNoteUpdate,
  onNoteRemove,
  onStaffClick,
  onSvgReady,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [editRef, setEditRef] = useState<SelectedNoteRef | null>(null);
  const [anchorPoint, setAnchorPoint] = useState<{ x: number; y: number } | null>(null);
  const [previewPitches, setPreviewPitches] = useState<Record<string, number>>({});

  const sheetWidth = computeSheetWidth(width, timelineDuration);

  const layoutItems = useMemo(
    () =>
      displayNotes.map((d) => ({
        pitch: previewPitches[noteKey(d)] ?? d.note.pitch,
        notationKind: getNotationKind(d.instrument),
      })),
    [displayNotes, previewPitches],
  );

  const sheetLayout = useMemo(
    () => buildSheetLayout(layoutItems),
    [layoutItems],
  );

  const { offsetY, height, mode, hasGrandStaff, hasTab, tabTop } = sheetLayout;

  const activeDef = useMemo(
    () =>
      activeTrackInstrument
        ? getInstrumentDefinition(activeTrackInstrument)
        : null,
    [activeTrackInstrument],
  );

  useEffect(() => {
    onSvgReady?.(svgRef.current);
    return () => onSvgReady?.(null);
  }, [onSvgReady, displayNotes, sheetWidth, height, offsetY, selectedNoteRef, timelineDuration]);

  const closePopover = useCallback(() => {
    setEditRef(null);
    setAnchorPoint(null);
  }, []);

  const yToPitchAtOffset = useCallback(
    (svgY: number) => {
      const localY = svgY - offsetY;
      const pitchMin = activeDef?.pitchMin;
      const pitchMax = activeDef?.pitchMax;
      const activeKind = activeDef?.notationKind;

      if (activeKind === 'tab') {
        return yToGuitarMidi(localY, tabTop);
      }

      return yToNotePitch(
        localY,
        sheetLayout,
        activeKind,
        pitchMin,
        pitchMax,
      );
    },
    [offsetY, activeDef, sheetLayout, tabTop],
  );

  const handleStaffBackgroundClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if ((e.target as Element).closest('.sheet-note')) return;
      if (!onStaffClick || !svgRef.current) return;

      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const scrollParent = svg.closest('.daw-sheet-inner');
      const scrollLeft = scrollParent?.scrollLeft ?? 0;
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top;
      const start = staffClickToStart(x, timelineDuration);
      const pitch = yToPitchAtOffset(y);
      onStaffClick(pitch, start);
    },
    [onStaffClick, timelineDuration, yToPitchAtOffset],
  );

  const makeYToPitch = useCallback(
    (notationKind: ReturnType<typeof getNotationKind>, instrumentId: PlaybackInstrumentId) => {
      const def = getInstrumentDefinition(instrumentId);
      // Resolved at call time — svgRef may not be attached during initial render.
      return (clientY: number) => {
        const svg = svgRef.current;
        if (!svg) return 60;
        const y = clientYToSvgY(svg, clientY) - offsetY;
        if (notationKind === 'tab') {
          return yToGuitarMidi(y, tabTop);
        }
        return yToNotePitch(y, sheetLayout, notationKind, def.pitchMin, def.pitchMax);
      };
    },
    [offsetY, sheetLayout, tabTop],
  );

  function openEditPopover(
    ref: SelectedNoteRef,
    clientX: number,
    clientY: number,
  ) {
    onNoteSelect?.(ref.trackId, ref.indexInTrack);
    setEditRef(ref);
    setAnchorPoint({ x: clientX, y: clientY });
  }

  function renderStaffBackground() {
    const staffWidth = sheetWidth - NOTE_AREA_LEFT;

    if (mode === 'tab') {
      return (
        <>
          {tabLineYs(TAB_TOP).map((y) => (
            <line
              key={`tab-${y}`}
              x1={NOTE_AREA_LEFT}
              y1={y}
              x2={sheetWidth}
              y2={y}
              stroke="#333"
              strokeWidth={1}
            />
          ))}
        </>
      );
    }

    if (mode === 'treble') {
      return (
        <>
          <StaffLines staveTop={SINGLE_STAVE_Y} width={staffWidth} x={NOTE_AREA_LEFT} />
          <TrebleClef y={SINGLE_STAVE_Y + 32} />
          <TimeSignature x={52} staveTop={SINGLE_STAVE_Y} />
        </>
      );
    }

    if (mode === 'bass') {
      return (
        <>
          <StaffLines staveTop={SINGLE_STAVE_Y} width={staffWidth} x={NOTE_AREA_LEFT} />
          <BassClef y={SINGLE_STAVE_Y + 28} />
          <TimeSignature x={52} staveTop={SINGLE_STAVE_Y} />
        </>
      );
    }

    if (hasGrandStaff) {
      return (
        <>
          <GrandStaffBrace
            x={NOTE_AREA_LEFT - 8}
            y={TREBLE_STAVE_Y - 4}
            height={BASS_STAVE_Y - TREBLE_STAVE_Y + 44}
          />
          <StaffLines staveTop={TREBLE_STAVE_Y} width={staffWidth} x={NOTE_AREA_LEFT} />
          <StaffLines staveTop={BASS_STAVE_Y} width={staffWidth} x={NOTE_AREA_LEFT} />
          <TrebleClef y={TREBLE_STAVE_Y + 32} />
          <BassClef y={BASS_STAVE_Y + 28} />
          <TimeSignature x={52} staveTop={TREBLE_STAVE_Y} />
          <TimeSignature x={52} staveTop={BASS_STAVE_Y} />
        </>
      );
    }

    return null;
  }

  function renderTabSection() {
    if (!hasTab || mode === 'tab') return null;

    return (
      <>
        {tabLineYs(tabTop).map((y) => (
          <line
            key={`tab-${y}`}
            x1={NOTE_AREA_LEFT}
            y1={y}
            x2={sheetWidth}
            y2={y}
            stroke="#333"
            strokeWidth={1}
          />
        ))}
      </>
    );
  }

  function renderNotes() {
    return displayNotes.map((d) => {
      const key = noteKey(d);
      const pitch = previewPitches[key] ?? d.note.pitch;
      const notationKind = getNotationKind(d.instrument);
      const x = timeToX(d.note.start);
      const selected =
        selectedNoteRef?.trackId === d.trackId &&
        selectedNoteRef.indexInTrack === d.indexInTrack;

      if (notationKind === 'tab') {
        const noteTabTop = mode === 'tab' ? TAB_TOP : tabTop;
        return (
          <TabNote
            key={`${key}-${d.note.start}-${d.note.pitch}`}
            x={x}
            pitch={pitch}
            tabTop={noteTabTop}
            selected={selected}
            onPitchPreview={(p) =>
              setPreviewPitches((prev) => ({ ...prev, [key]: p }))
            }
            onPitchCommit={(p) => {
              setPreviewPitches((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
              });
              onNotePitchChange?.(d.trackId, d.indexInTrack, p);
            }}
            onEditRequest={(clientX, clientY) =>
              openEditPopover(
                { trackId: d.trackId, indexInTrack: d.indexInTrack },
                clientX,
                clientY,
              )
            }
            yToPitch={makeYToPitch(notationKind, d.instrument)}
          />
        );
      }

      const clef = clefForNote(pitch, notationKind, mode);
      const y = pitchToNoteY(pitch, notationKind, mode);

      return (
        <InteractiveNote
          key={`${key}-${d.note.start}-${d.note.pitch}`}
          x={x}
          y={y}
          pitch={pitch}
          clef={clef}
          selected={selected}
          noteColor={d.color}
          yToPitch={makeYToPitch(notationKind, d.instrument)}
          onPitchPreview={(p) =>
            setPreviewPitches((prev) => ({ ...prev, [key]: p }))
          }
          onPitchCommit={(p) => {
            setPreviewPitches((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            onNotePitchChange?.(d.trackId, d.indexInTrack, p);
          }}
          onEditRequest={(clientX, clientY) =>
            openEditPopover(
              { trackId: d.trackId, indexInTrack: d.indexInTrack },
              clientX,
              clientY,
            )
          }
        />
      );
    });
  }

  const editDisplay =
    editRef !== null
      ? displayNotes.find(
          (d) =>
            d.trackId === editRef.trackId && d.indexInTrack === editRef.indexInTrack,
        )
      : null;

  return (
    <>
      <svg
        ref={svgRef}
        width={sheetWidth}
        height={height}
        className="sheet-renderer-svg"
        aria-label="Partition"
        onClick={handleStaffBackgroundClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: onStaffClick ? 'crosshair' : 'default' }}
      >
        <rect width={sheetWidth} height={height} fill="#fff" />
        <g transform={`translate(0, ${offsetY})`}>
          {renderStaffBackground()}
          {renderTabSection()}
          {renderNotes()}
        </g>
      </svg>

      {editDisplay && editRef && anchorPoint && (
        <NoteEditPopover
          note={editDisplay.note}
          open
          onOpenChange={(open) => {
            if (!open) closePopover();
          }}
          anchorPoint={anchorPoint}
          onApply={(patch) => {
            onNoteUpdate?.(editRef.trackId, editRef.indexInTrack, patch);
            closePopover();
          }}
          onRemove={() => {
            onNoteRemove?.(editRef.trackId, editRef.indexInTrack);
            closePopover();
          }}
        />
      )}
    </>
  );
}
