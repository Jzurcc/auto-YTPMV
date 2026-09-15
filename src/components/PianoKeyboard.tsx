import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Volume2, Layers } from 'lucide-react';
import type { NoteSegment } from '../types';
import { generatePianoKeys, type NoteInfo } from '../core/audio/noteUtils';

interface PianoKeyboardProps {
  segments: NoteSegment[];
  activeNote: string | null;
  onKeyClick: (note: string) => void;
  selectedFilterNote: string | null;
  onSelectFilterNote: (note: string | null) => void;
  overlapMode: boolean;
  onToggleOverlap: () => void;
}

export const PianoKeyboard: React.FC<PianoKeyboardProps> = ({
  segments,
  activeNote,
  onKeyClick,
  selectedFilterNote,
  onSelectFilterNote,
  overlapMode,
  onToggleOverlap,
}) => {
  const [baseOctave, setBaseOctave] = useState<number>(3);
  const startMidi = (baseOctave + 1) * 12;
  const endMidi = startMidi + 24;

  const keys: NoteInfo[] = generatePianoKeys(startMidi, endMidi);

  const noteCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const seg of segments) {
      map.set(seg.note, (map.get(seg.note) || 0) + 1);
    }
    return map;
  }, [segments]);

  const whiteKeys = keys.filter((k) => !k.isSharp);
  const blackKeys = keys.filter((k) => k.isSharp);

  const getBlackKeyOffset = (blackKey: NoteInfo): number => {
    const precedingWhiteIndex = whiteKeys.findIndex((w) => w.midi === blackKey.midi - 1);
    if (precedingWhiteIndex === -1) return 0;
    const whiteKeyPercent = 100 / whiteKeys.length;
    return (precedingWhiteIndex + 1) * whiteKeyPercent - (whiteKeyPercent * 0.32);
  };

  return (
    <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
          }}>
            <Volume2 size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Interactive Video Piano
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Keys with numbers have matching video moments. Click any key to trigger its clip!
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Overlap / Let Ring Toggle */}
          <button
            type="button"
            onClick={onToggleOverlap}
            title={overlapMode ? "Polyphonic: previous notes continue ringing out when new keys are pressed" : "Monophonic: pressing a new key cuts off previous sound"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: overlapMode ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
              background: overlapMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              color: overlapMode ? '#34d399' : 'var(--text-secondary)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={14} />
            <span>Let Ring: <strong>{overlapMode ? 'ON' : 'OFF'}</strong></span>
          </button>

          {selectedFilterNote && (
            <button
              onClick={() => onSelectFilterNote(null)}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: 'pointer',
              }}
            >
              Clear Filter ({selectedFilterNote})
            </button>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            padding: 2,
          }}>
            <button
              onClick={() => setBaseOctave((prev) => Math.max(1, prev - 1))}
              disabled={baseOctave <= 1}
              style={{
                background: 'transparent',
                border: 'none',
                color: baseOctave <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                padding: '6px 8px',
                cursor: baseOctave <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Lower Octave"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, padding: '0 8px', fontFamily: 'monospace' }}>
              Octave C{baseOctave}–C{baseOctave + 2}
            </span>
            <button
              onClick={() => setBaseOctave((prev) => Math.min(5, prev + 1))}
              disabled={baseOctave >= 5}
              style={{
                background: 'transparent',
                border: 'none',
                color: baseOctave >= 5 ? 'var(--text-muted)' : 'var(--text-primary)',
                padding: '6px 8px',
                cursor: baseOctave >= 5 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Higher Octave"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: 180,
          background: '#090d16',
          borderRadius: 10,
          padding: '8px 8px 12px 8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 4px 12px rgba(0, 0, 0, 0.8), 0 10px 25px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            height: 6,
            background: 'linear-gradient(90deg, #991b1b, #dc2626, #991b1b)',
            borderRadius: '4px 4px 0 0',
            zIndex: 10,
          }}
        />

        <div style={{ display: 'flex', height: '100%', width: '100%', position: 'relative' }}>
          {whiteKeys.map((key) => {
            const count = noteCounts.get(key.note) || 0;
            const hasClips = count > 0;
            const isPlaying = activeNote === key.note;
            const isFiltered = selectedFilterNote === key.note;

            return (
              <div
                key={key.note}
                onClick={() => {
                  onKeyClick(key.note);
                  onSelectFilterNote(key.note);
                }}
                style={{
                  flex: 1,
                  height: '100%',
                  background: isPlaying
                    ? key.color
                    : hasClips
                    ? '#f8fafc'
                    : '#cbd5e1',
                  borderRadius: '0 0 6px 6px',
                  border: '1px solid #64748b',
                  marginRight: 2,
                  position: 'relative',
                  cursor: hasClips ? 'pointer' : 'default',
                  transition: 'all 0.1s ease',
                  transform: isPlaying ? 'translateY(4px)' : 'none',
                  boxShadow: isPlaying
                    ? `0 0 20px ${key.color}`
                    : '0 4px 6px rgba(0, 0, 0, 0.3), inset 0 -4px 0 rgba(0, 0, 0, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  paddingBottom: 10,
                  opacity: hasClips ? 1 : 0.65,
                }}
              >
                {hasClips && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 34,
                      background: key.color,
                      color: '#000000',
                      fontWeight: 800,
                      fontSize: 10,
                      borderRadius: 10,
                      padding: '2px 5px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {count}
                  </div>
                )}

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isPlaying ? '#ffffff' : '#0f172a',
                    fontFamily: 'monospace',
                  }}
                >
                  {key.note}
                </span>

                {isFiltered && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 10,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#38bdf8',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {blackKeys.map((key) => {
          const count = noteCounts.get(key.note) || 0;
          const hasClips = count > 0;
          const isPlaying = activeNote === key.note;
          const leftPercent = getBlackKeyOffset(key);
          const whiteKeyPercent = 100 / whiteKeys.length;
          const blackKeyWidth = whiteKeyPercent * 0.65;

          return (
            <div
              key={key.note}
              onClick={(e) => {
                e.stopPropagation();
                onKeyClick(key.note);
                onSelectFilterNote(key.note);
              }}
              style={{
                position: 'absolute',
                top: 8,
                left: `${leftPercent}%`,
                width: `${blackKeyWidth}%`,
                height: '60%',
                background: isPlaying
                  ? key.color
                  : hasClips
                  ? '#1e293b'
                  : '#090d16',
                borderRadius: '0 0 5px 5px',
                border: isPlaying ? `2px solid #ffffff` : hasClips ? `1px solid ${key.color}` : '1px solid #334155',
                cursor: hasClips ? 'pointer' : 'default',
                zIndex: 20,
                transition: 'all 0.1s ease',
                transform: isPlaying ? 'translateY(3px)' : 'none',
                boxShadow: isPlaying
                  ? `0 0 25px ${key.color}`
                  : '0 4px 8px rgba(0, 0, 0, 0.7), inset 0 -4px 0 rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                paddingBottom: 8,
                opacity: hasClips ? 1 : 0.75,
              }}
            >
              {hasClips && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    background: key.color,
                    color: '#000000',
                    fontWeight: 800,
                    fontSize: 9,
                    borderRadius: 8,
                    padding: '1px 4px',
                  }}
                >
                  {count}
                </div>
              )}

              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: isPlaying ? '#ffffff' : '#f8fafc',
                  fontFamily: 'monospace',
                }}
              >
                {key.note}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
