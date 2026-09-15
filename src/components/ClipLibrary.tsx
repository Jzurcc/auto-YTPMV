import React, { useState, useMemo } from 'react';
import { Play, Plus, Search, ArrowUpDown, Music2 } from 'lucide-react';
import type { NoteSegment, VideoSource } from '../types';
import { NOTE_NAMES, formatTime } from '../core/audio/noteUtils';

interface ClipLibraryProps {
  segments: NoteSegment[];
  videos: VideoSource[];
  activeSegment: NoteSegment | null;
  selectedFilterNote: string | null;
  onSelectFilterNote: (note: string | null) => void;
  onPlaySegment: (segment: NoteSegment) => void;
  onAddToSequencer: (segment: NoteSegment) => void;
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({
  segments,
  videos,
  activeSegment,
  selectedFilterNote,
  onSelectFilterNote,
  onPlaySegment,
  onAddToSequencer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('all');
  const [selectedChroma, setSelectedChroma] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'pitch' | 'confidence' | 'duration' | 'time'>('confidence');

  const filteredSegments = useMemo(() => {
    return segments
      .filter((seg) => {
        if (selectedFilterNote && seg.note !== selectedFilterNote) {
          return false;
        }
        if (selectedChroma !== 'all' && seg.noteName !== selectedChroma) {
          return false;
        }
        if (selectedVideoId !== 'all' && seg.videoId !== selectedVideoId) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            seg.note.toLowerCase().includes(q) ||
            seg.videoName.toLowerCase().includes(q) ||
            seg.frequency.toFixed(1).includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'pitch') return a.midi - b.midi;
        if (sortBy === 'confidence') return b.confidence - a.confidence;
        if (sortBy === 'duration') return b.duration - a.duration;
        if (sortBy === 'time') return a.startTime - b.startTime;
        return 0;
      });
  }, [segments, selectedFilterNote, selectedChroma, selectedVideoId, searchQuery, sortBy]);

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
            background: 'rgba(168, 85, 247, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c084fc',
          }}>
            <Music2 size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Indexed Video Pitch Clips
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Showing {filteredSegments.length} of {segments.length} detected note moments
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: 8,
            padding: '6px 12px',
            border: '1px solid var(--border-color)',
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search note (C4, A3) or video..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: 12,
                outline: 'none',
                width: 170,
              }}
            />
          </div>

          {videos.length > 1 && (
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid var(--border-color)',
                color: '#f8fafc',
                fontSize: 12,
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Videos ({videos.length})</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '4px 8px',
          }}>
            <ArrowUpDown size={13} color="var(--text-muted)" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="confidence" style={{ background: '#0f172a' }}>Best Clarity</option>
              <option value="pitch" style={{ background: '#0f172a' }}>Musical Pitch</option>
              <option value="duration" style={{ background: '#0f172a' }}>Longest Duration</option>
              <option value="time" style={{ background: '#0f172a' }}>Timestamp Order</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 16,
      }}>
        <button
          onClick={() => {
            setSelectedChroma('all');
            onSelectFilterNote(null);
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            background: selectedChroma === 'all' && !selectedFilterNote ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)',
            color: selectedChroma === 'all' && !selectedFilterNote ? '#38bdf8' : 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          All Notes
        </button>

        {NOTE_NAMES.map((name) => {
          const isSelected = selectedChroma === name;
          return (
            <button
              key={name}
              onClick={() => {
                setSelectedChroma(name);
                onSelectFilterNote(null);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                background: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                color: isSelected ? '#38bdf8' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </button>
          );
        })}
      </div>

      {filteredSegments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: 10,
          border: '1px dashed var(--border-color)',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            No matching pitch clips found for the current filter.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
          maxHeight: 480,
          overflowY: 'auto',
          paddingRight: 4,
        }}>
          {filteredSegments.map((seg) => {
            const isPlaying = activeSegment?.id === seg.id;
            return (
              <div
                key={seg.id}
                style={{
                  background: isPlaying ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.7)',
                  border: isPlaying ? `2px solid ${seg.videoColor || '#38bdf8'}` : '1px solid var(--border-color)',
                  borderRadius: 10,
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'all 0.15s ease',
                  boxShadow: isPlaying ? `0 0 15px ${seg.videoColor}44` : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: seg.videoColor || '#38bdf8',
                        background: 'rgba(0, 0, 0, 0.4)',
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {seg.note}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#f8fafc', fontWeight: 600 }}>
                        {Math.round(seg.frequency)} Hz
                      </div>
                      <div style={{ fontSize: 10, color: seg.cents >= 0 ? '#34d399' : '#f87171', fontFamily: 'monospace' }}>
                        {seg.cents >= 0 ? `+${seg.cents}¢` : `${seg.cents}¢`}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    maxWidth: 130,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: seg.videoColor, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.videoName}</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  background: 'rgba(2, 6, 23, 0.5)',
                  padding: '4px 8px',
                  borderRadius: 6,
                }}>
                  <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {formatTime(seg.startTime)} ➔ {formatTime(seg.endTime)} ({seg.duration.toFixed(2)}s)
                  </span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    {Math.round(seg.confidence * 100)}% clarity
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <button
                    onClick={() => onPlaySegment(seg)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: isPlaying ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)',
                      color: isPlaying ? '#000000' : '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      padding: '6px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Play size={13} fill={isPlaying ? '#000000' : '#38bdf8'} />
                    {isPlaying ? 'Playing...' : 'Play Clip'}
                  </button>

                  <button
                    onClick={() => onAddToSequencer(seg)}
                    title="Add this clip note to the Melody Sequencer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#c084fc',
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} />
                    <span>To Melody</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
