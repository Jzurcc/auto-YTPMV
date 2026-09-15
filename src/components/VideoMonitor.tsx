import React, { useEffect, useRef } from 'react';
import { Tv, Music, Gauge } from 'lucide-react';
import type { NoteSegment, VideoSource } from '../types';
import { playbackManager } from '../core/video/videoPlaybackManager';
import { formatTime } from '../core/audio/noteUtils';

interface VideoMonitorProps {
  videos: VideoSource[];
  activeSegment: NoteSegment | null;
  activeVideo: VideoSource | null;
}

export const VideoMonitor: React.FC<VideoMonitorProps> = ({
  videos,
  activeSegment,
  activeVideo,
}) => {
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    videoRefs.current.forEach((el, id) => {
      playbackManager.registerVideoElement(id, el);
    });

    return () => {
      videos.forEach((v) => playbackManager.unregisterVideoElement(v.id));
    };
  }, [videos]);

  const currentVideo = activeVideo || (videos.length > 0 ? videos[0] : null);

  return (
    <div className="glass-panel" style={{ padding: 20, marginBottom: 24, overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tv size={18} color="#38bdf8" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>
            Video Monitor Stage
          </span>
          {activeSegment && (
            <span style={{
              fontSize: 11,
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              ● LIVE PREVIEW
            </span>
          )}
        </div>

        {activeSegment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Range: <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>
                {formatTime(activeSegment.startTime)} – {formatTime(activeSegment.endTime)}
              </strong>
            </span>
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Gauge size={13} />
              {Math.round(activeSegment.confidence * 100)}% clarity
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          maxHeight: 440,
          background: '#020617',
          borderRadius: 10,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.9)',
        }}
      >
        {videos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Music size={40} color="#64748b" style={{ marginBottom: 8 }} />
            <p style={{ color: '#94a3b8', fontSize: 14 }}>No video loaded yet.</p>
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
              Upload your videos above or click "⚡ Load Demo Pack"
            </p>
          </div>
        ) : (
          <>
            {videos.map((vid) => {
              const isVisible = currentVideo?.id === vid.id;
              return (
                <video
                  key={vid.id}
                  data-video-id={vid.id}
                  ref={(el) => {
                    if (el) {
                      videoRefs.current.set(vid.id, el);
                      playbackManager.registerVideoElement(vid.id, el);
                    } else {
                      videoRefs.current.delete(vid.id);
                      playbackManager.unregisterVideoElement(vid.id);
                    }
                  }}
                  src={vid.url}
                  playsInline
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    opacity: isVisible ? 1 : 0,
                    pointerEvents: isVisible ? 'auto' : 'none',
                    transition: 'opacity 0.15s ease',
                  }}
                />
              );
            })}

            {activeSegment && (
              <div
                className="animate-note-pop"
                style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 20,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: `2px solid ${activeSegment.videoColor || '#38bdf8'}`,
                  borderRadius: 10,
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  boxShadow: `0 0 25px ${activeSegment.videoColor}66`,
                  zIndex: 30,
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: activeSegment.videoColor || '#38bdf8',
                  }}
                >
                  {activeSegment.note}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                    {Math.round(activeSegment.frequency)} Hz
                  </span>
                  <span style={{ fontSize: 11, color: activeSegment.cents >= 0 ? '#34d399' : '#f87171', fontFamily: 'monospace' }}>
                    {activeSegment.cents >= 0 ? `+${activeSegment.cents}¢` : `${activeSegment.cents}¢`} offset
                  </span>
                </div>
              </div>
            )}

            {currentVideo && (
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  left: 16,
                  background: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(6px)',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  zIndex: 30,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: currentVideo.color,
                  }}
                />
                <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentVideo.name}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
