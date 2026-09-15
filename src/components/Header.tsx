import React from 'react';
import { Music4, Video, Sparkles, Trash2, Activity, PlaySquare } from 'lucide-react';
import type { NoteSegment, VideoSource } from '../types';

interface HeaderProps {
  videos: VideoSource[];
  segments: NoteSegment[];
  isGeneratingDemo: boolean;
  demoProgressText: string;
  onLoadDemo: () => void;
  onClearAll: () => void;
  activeTab: 'studio' | 'sequencer';
  onTabChange: (tab: 'studio' | 'sequencer') => void;
}

export const Header: React.FC<HeaderProps> = ({
  videos,
  segments,
  isGeneratingDemo,
  demoProgressText,
  onLoadDemo,
  onClearAll,
  activeTab,
  onTabChange,
}) => {
  let pitchRange = 'None';
  if (segments.length > 0) {
    let minMidi = Infinity;
    let maxMidi = -Infinity;
    let minNote = '';
    let maxNote = '';
    for (const seg of segments) {
      if (seg.midi < minMidi) {
        minMidi = seg.midi;
        minNote = seg.note;
      }
      if (seg.midi > maxMidi) {
        maxMidi = seg.midi;
        maxNote = seg.note;
      }
    }
    pitchRange = `${minNote} ➔ ${maxNote}`;
  }

  const uniqueNotes = new Set(segments.map((s) => s.note)).size;

  return (
    <header style={{
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 28px',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
          }}>
            <Music4 size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                PitchClip Studio
              </h1>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 20,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Client-Side Audio AI
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Catalog video clips by musical pitch & build funny songs
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          background: 'rgba(2, 6, 23, 0.7)',
          padding: 4,
          borderRadius: 10,
          border: '1px solid var(--border-color)',
        }}>
          <button
            onClick={() => onTabChange('studio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'studio' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              color: activeTab === 'studio' ? '#38bdf8' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Activity size={16} />
            Piano & Soundboard
          </button>
          <button
            onClick={() => onTabChange('sequencer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'sequencer' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
              color: activeTab === 'sequencer' ? '#c084fc' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <PlaySquare size={16} />
            Melody Sequencer & Exporter
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '6px 14px',
            background: 'rgba(30, 41, 59, 0.5)',
            borderRadius: 10,
            border: '1px solid var(--border-color)',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Video size={14} color="#38bdf8" />
              <span><strong>{videos.length}</strong> videos</span>
            </div>
            <div style={{ width: 1, height: 14, background: 'var(--border-color)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Music4 size={14} color="#a855f7" />
              <span><strong>{segments.length}</strong> notes ({uniqueNotes} keys)</span>
            </div>
            {segments.length > 0 && (
              <>
                <div style={{ width: 1, height: 14, background: 'var(--border-color)' }} />
                <div style={{ color: '#10b981', fontFamily: 'JetBrains Mono', fontSize: 11 }}>
                  {pitchRange}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onLoadDemo}
            disabled={isGeneratingDemo}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: isGeneratingDemo ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 15px rgba(14, 165, 233, 0.3)',
              opacity: isGeneratingDemo ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            <Sparkles size={16} />
            {isGeneratingDemo ? (demoProgressText || 'Generating...') : '⚡ Load Demo Pack'}
          </button>

          {videos.length > 0 && (
            <button
              onClick={onClearAll}
              title="Clear all videos and data"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '8px 12px',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
