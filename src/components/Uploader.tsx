import React, { useState, useRef } from 'react';
import { UploadCloud, Film, Loader2, Sparkles } from 'lucide-react';
import type { PitchAnalysisProgress } from '../types';

interface UploaderProps {
  onFilesSelected: (files: File[]) => void;
  analysisProgress: PitchAnalysisProgress | null;
  onLoadDemo: () => void;
  isGeneratingDemo: boolean;
}

export const Uploader: React.FC<UploaderProps> = ({
  onFilesSelected,
  analysisProgress,
  onLoadDemo,
  isGeneratingDemo,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const videoFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(f.name)
      );
      if (videoFiles.length > 0) {
        onFilesSelected(videoFiles);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const videoFiles = Array.from(e.target.files);
      onFilesSelected(videoFiles);
      e.target.value = '';
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)'}`,
          borderRadius: 14,
          padding: '32px 24px',
          textAlign: 'center',
          background: isDragging
            ? 'rgba(56, 189, 248, 0.08)'
            : 'linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.6) 100%)',
          cursor: 'pointer',
          transition: 'all 0.2s ease-in-out',
          position: 'relative',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.webm,.mov,.mkv"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <UploadCloud size={28} />
          </div>

          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>
              Drop your videos here, or <span style={{ color: '#38bdf8', textDecoration: 'underline' }}>browse</span>
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Supports MP4, WebM, QuickTime MOV. Runs 100% in your browser — zero files are uploaded anywhere!
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— OR —</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLoadDemo();
              }}
              disabled={isGeneratingDemo}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#c084fc',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={14} />
              {isGeneratingDemo ? 'Generating Demo Clips...' : 'Try Built-in Demo Pack'}
            </button>
          </div>
        </div>
      </div>

      {analysisProgress && analysisProgress.stage !== 'complete' && (
        <div
          style={{
            marginTop: 16,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 12,
            padding: '16px 20px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Film size={18} color="#38bdf8" />
              <span style={{ fontWeight: 600, fontSize: 14, color: '#f8fafc' }}>
                {analysisProgress.videoName}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#38bdf8' }}>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                {analysisProgress.progress}%
              </span>
            </div>
          </div>

          <div
            style={{
              width: '100%',
              height: 6,
              background: 'rgba(51, 65, 85, 0.6)',
              borderRadius: 3,
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: `${analysisProgress.progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #a855f7)',
                borderRadius: 3,
                transition: 'width 0.2s ease-out',
              }}
            />
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {analysisProgress.message || 'Processing audio waveform...'}
          </p>
        </div>
      )}
    </div>
  );
};
