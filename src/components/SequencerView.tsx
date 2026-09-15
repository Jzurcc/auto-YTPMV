import React, { useState, useEffect } from 'react';
import { Play, Square, Download, Sliders, Music } from 'lucide-react';
import confetti from 'canvas-confetti';
import type { NoteSegment, VideoSource } from '../types';
import { MELODY_PRESETS } from '../core/sequencer/melodyPresets';
import { sequenceEngine, type SequenceStepExecution } from '../core/sequencer/sequenceEngine';
import { exportSequenceToVideo, type ExportProgress } from '../core/export/videoExporter';

interface SequencerViewProps {
  segments: NoteSegment[];
  videos: VideoSource[];
  onPlayStepNote: (note: string) => void;
}

export const SequencerView: React.FC<SequencerViewProps> = ({
  segments,
  videos,
  onPlayStepNote,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('twinkle');
  const [bpm, setBpm] = useState<number>(110);
  const [customSteps, setCustomSteps] = useState<{ note: string; duration: number }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  useEffect(() => {
    const preset = MELODY_PRESETS.find((p) => p.id === selectedPresetId);
    if (preset) {
      setCustomSteps([...preset.notes]);
      setBpm(preset.bpm);
    }
  }, [selectedPresetId]);

  const resolvedSteps: SequenceStepExecution[] = React.useMemo(() => {
    return sequenceEngine.resolveSteps(customSteps, segments);
  }, [customSteps, segments]);

  const handlePlaySequence = async () => {
    if (isPlaying) {
      sequenceEngine.stop();
      setIsPlaying(false);
      setActiveStepIndex(-1);
      return;
    }

    if (customSteps.length === 0) return;

    setIsPlaying(true);
    await sequenceEngine.playSequence(
      resolvedSteps,
      bpm,
      videos,
      (stepIdx) => {
        setActiveStepIndex(stepIdx);
        if (stepIdx >= 0 && resolvedSteps[stepIdx]) {
          onPlayStepNote(resolvedSteps[stepIdx].step.note);
        }
      },
      () => {
        setIsPlaying(false);
        setActiveStepIndex(-1);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    );
  };

  const handleStop = () => {
    sequenceEngine.stop();
    setIsPlaying(false);
    setActiveStepIndex(-1);
  };

  const handleAddNote = (note: string) => {
    setCustomSteps((prev) => [...prev, { note, duration: 1.0 }]);
  };

  const handleRemoveStep = (index: number) => {
    setCustomSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExportVideo = async () => {
    if (resolvedSteps.length === 0 || videos.length === 0) return;

    setIsExporting(true);
    setExportProgress({ progress: 0, status: 'Initializing video recorder...' });

    const preset = MELODY_PRESETS.find((p) => p.id === selectedPresetId);
    const title = preset ? preset.title : 'My Silly Video Song';

    try {
      const blob = await exportSequenceToVideo(
        resolvedSteps,
        bpm,
        videos,
        title,
        (p) => setExportProgress(p)
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_song.webm`;
      a.click();
      URL.revokeObjectURL(url);

      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 },
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export video sequence: ' + err);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const hasAnyClips = segments.length > 0;

  return (
    <div className="glass-panel" style={{ padding: '24px 28px', marginBottom: 24 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}>
            <Music size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
              Melody Sequencer & Video Song Generator
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              String together matching video notes in tempo to make hilarious music videos!
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            Song Preset:
          </span>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--border-color)',
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {MELODY_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(2, 6, 23, 0.7)',
        padding: '12px 18px',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handlePlaySequence}
            disabled={!hasAnyClips || customSteps.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: isPlaying
                ? '#f43f5e'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 22px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: !hasAnyClips ? 'not-allowed' : 'pointer',
              boxShadow: isPlaying
                ? '0 0 20px rgba(244, 63, 94, 0.5)'
                : '0 0 20px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.15s',
              opacity: !hasAnyClips ? 0.6 : 1,
            }}
          >
            {isPlaying ? <Square size={16} fill="#ffffff" /> : <Play size={16} fill="#ffffff" />}
            {isPlaying ? 'Stop Playback' : 'Play Song Sequence'}
          </button>

          {isPlaying && (
            <button
              onClick={handleStop}
              style={{
                background: 'rgba(51, 65, 85, 0.5)',
                border: '1px solid var(--border-color)',
                color: '#cbd5e1',
                padding: '10px 14px',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
            <Sliders size={16} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Tempo:</span>
          </div>
          <input
            type="range"
            min="60"
            max="200"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value, 10))}
            style={{ width: 120, accentColor: '#38bdf8' }}
          />
          <span style={{
            fontSize: 13,
            fontWeight: 800,
            fontFamily: 'monospace',
            color: '#38bdf8',
            minWidth: 60,
          }}>
            {bpm} BPM
          </span>
        </div>

        <button
          onClick={handleExportVideo}
          disabled={isExporting || !hasAnyClips || customSteps.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'linear-gradient(135deg, #0284c7 0%, #7c3aed 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: isExporting || !hasAnyClips ? 'not-allowed' : 'pointer',
            boxShadow: '0 0 15px rgba(2, 132, 199, 0.3)',
            opacity: isExporting || !hasAnyClips ? 0.6 : 1,
          }}
        >
          <Download size={16} />
          {isExporting ? 'Exporting Video...' : 'Export Video (WebM)'}
        </button>
      </div>

      {isExporting && exportProgress && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #38bdf8',
          padding: 16,
          borderRadius: 8,
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span style={{ color: '#f8fafc', fontWeight: 600 }}>{exportProgress.status}</span>
            <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
              {exportProgress.progress}%
            </span>
          </div>
          <div style={{ width: '100%', height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${exportProgress.progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #38bdf8, #a855f7)',
              borderRadius: 3,
            }} />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
            Note Timeline ({customSteps.length} notes)
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Each block triggers the corresponding video clip at that pitch
          </span>
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 12,
          paddingTop: 4,
        }}>
          {resolvedSteps.map((exec, idx) => {
            const isCurrent = activeStepIndex === idx;
            const seg = exec.segment;
            const isPitched = exec.pitchShiftSemitones !== 0;

            return (
              <div
                key={exec.step.id + idx}
                style={{
                  minWidth: 84,
                  background: isCurrent ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.8)',
                  border: isCurrent ? '2px solid #38bdf8' : '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '10px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  position: 'relative',
                  boxShadow: isCurrent ? '0 0 20px rgba(56, 189, 248, 0.5)' : 'none',
                  transform: isCurrent ? 'scale(1.05)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  #{idx + 1}
                </span>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: isCurrent ? '#38bdf8' : '#ffffff',
                  }}
                >
                  {exec.step.note}
                </div>

                {seg ? (
                  <div style={{
                    fontSize: 10,
                    color: seg.videoColor,
                    maxWidth: 74,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                  }}>
                    {seg.videoName.split('.')[0]}
                  </div>
                ) : (
                  <span style={{ fontSize: 9, color: '#f87171' }}>No Clip</span>
                )}

                {isPitched && (
                  <span style={{
                    fontSize: 9,
                    background: 'rgba(168, 85, 247, 0.2)',
                    color: '#c084fc',
                    padding: '1px 4px',
                    borderRadius: 4,
                  }}>
                    {exec.pitchShiftSemitones > 0 ? `+${exec.pitchShiftSemitones}` : exec.pitchShiftSemitones}st
                  </span>
                )}

                <button
                  onClick={() => handleRemoveStep(idx)}
                  title="Remove this note"
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: 'none',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
          Append custom notes to sequence:
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'].map((n) => (
            <button
              key={n}
              onClick={() => handleAddNote(n)}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid var(--border-color)',
                color: '#f8fafc',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              + {n}
            </button>
          ))}

          <button
            onClick={() => setCustomSteps([])}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            Clear Timeline
          </button>
        </div>
      </div>
    </div>
  );
};
