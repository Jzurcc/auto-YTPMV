import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Uploader } from './components/Uploader';
import { PianoKeyboard } from './components/PianoKeyboard';
import { VideoMonitor } from './components/VideoMonitor';
import { ClipLibrary } from './components/ClipLibrary';
import { SequencerView } from './components/SequencerView';
import type { NoteSegment, VideoSource, PitchAnalysisProgress } from './types';
import { AudioAnalyzer } from './core/audio/audioAnalyzer';
import { generateDemoVideoPack } from './core/demo/demoGenerator';
import { playbackManager } from './core/video/videoPlaybackManager';

const COLOR_PALETTE = ['#06b6d4', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#3b82f6', '#f43f5e'];

export const App: React.FC = () => {
  const [videos, setVideos] = useState<VideoSource[]>([]);
  const [segments, setSegments] = useState<NoteSegment[]>([]);
  const [activeSegment, setActiveSegment] = useState<NoteSegment | null>(null);
  const [activeVideo, setActiveVideo] = useState<VideoSource | null>(null);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [selectedFilterNote, setSelectedFilterNote] = useState<string | null>(null);
  const [overlapMode, setOverlapMode] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<'studio' | 'sequencer'>('studio');
  const [analysisProgress, setAnalysisProgress] = useState<PitchAnalysisProgress | null>(null);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoProgressText, setDemoProgressText] = useState('');

  const analyzerRef = useRef<AudioAnalyzer>(new AudioAnalyzer());

  useEffect(() => {
    const unsubscribe = playbackManager.subscribe({
      onSegmentStart: (seg, source) => {
        setActiveSegment(seg);
        setActiveVideo(source);
        setActiveNote(seg.note);
      },
      onSegmentEnd: () => {
        setActiveSegment(null);
        setActiveNote(null);
      },
    });

    return unsubscribe;
  }, []);

  const handleToggleOverlap = () => {
    setOverlapMode((prev) => {
      const next = !prev;
      playbackManager.setOverlapMode(next);
      return next;
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const videoId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const url = URL.createObjectURL(file);
      const color = COLOR_PALETTE[(videos.length + i) % COLOR_PALETTE.length];

      const duration = await getVideoDuration(url);

      const newVideo: VideoSource = {
        id: videoId,
        name: file.name,
        url,
        file,
        duration,
        color,
      };

      setVideos((prev) => [...prev, newVideo]);

      try {
        setAnalysisProgress({
          videoId,
          videoName: file.name,
          stage: 'decoding',
          progress: 5,
          message: 'Extracting audio stream...',
        });

        const audioBuffer = await analyzerRef.current.decodeAudioFromVideo(
          newVideo,
          (p) => setAnalysisProgress(p)
        );

        // Register audio buffer for zero-latency polyphonic playback
        playbackManager.registerAudioBuffer(videoId, audioBuffer);

        const detectedSegments = await analyzerRef.current.analyzeAudioBuffer(
          newVideo,
          audioBuffer,
          (p) => setAnalysisProgress(p)
        );

        setSegments((prev) => [...prev, ...detectedSegments]);
      } catch (err) {
        console.error('Error analyzing video audio:', err);
        setAnalysisProgress({
          videoId,
          videoName: file.name,
          stage: 'error',
          progress: 100,
          message: 'Failed to extract or analyze audio track from video.',
        });
      }
    }

    setTimeout(() => setAnalysisProgress(null), 1200);
  };

  const getVideoDuration = (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        resolve(tempVideo.duration || 5);
      };
      tempVideo.onerror = () => resolve(5);
    });
  };

  const handleLoadDemo = async () => {
    if (isGeneratingDemo) return;
    setIsGeneratingDemo(true);
    setDemoProgressText('Synthesizing demo clips...');

    try {
      const demoVideos = await generateDemoVideoPack((msg, pct) => {
        setDemoProgressText(`${msg} (${pct}%)`);
      });

      setVideos((prev) => [...prev, ...demoVideos]);

      for (const demoVid of demoVideos) {
        setAnalysisProgress({
          videoId: demoVid.id,
          videoName: demoVid.name,
          stage: 'decoding',
          progress: 20,
          message: `Analyzing pitch for ${demoVid.name}...`,
        });

        const audioBuffer = await analyzerRef.current.decodeAudioFromVideo(
          demoVid,
          (p) => setAnalysisProgress(p)
        );

        playbackManager.registerAudioBuffer(demoVid.id, audioBuffer);

        const detectedSegments = await analyzerRef.current.analyzeAudioBuffer(
          demoVid,
          audioBuffer,
          (p) => setAnalysisProgress(p)
        );

        setSegments((prev) => [...prev, ...detectedSegments]);
      }
    } catch (err) {
      console.error('Demo generation error:', err);
      alert('Could not synthesize demo pack: ' + err);
    } finally {
      setIsGeneratingDemo(false);
      setDemoProgressText('');
      setAnalysisProgress(null);
    }
  };

  const handleClearAll = () => {
    playbackManager.stopCurrent();
    videos.forEach((v) => {
      playbackManager.unregisterAudioBuffer(v.id);
      try {
        URL.revokeObjectURL(v.url);
      } catch {}
    });
    setVideos([]);
    setSegments([]);
    setActiveSegment(null);
    setActiveVideo(null);
    setActiveNote(null);
    setSelectedFilterNote(null);
  };

  const handleKeyClick = (note: string) => {
    const matching = segments.filter((s) => s.note === note);
    if (matching.length > 0) {
      const sorted = [...matching].sort((a, b) => {
        const scoreA = a.confidence * 2 + Math.min(a.duration, 1.5);
        const scoreB = b.confidence * 2 + Math.min(b.duration, 1.5);
        return scoreB - scoreA;
      });
      playbackManager.playSegment(sorted[0], videos);
    }
  };

  const handlePlaySegment = (seg: NoteSegment) => {
    playbackManager.playSegment(seg, videos);
  };

  const handleAddToSequencer = (_seg: NoteSegment) => {
    setActiveTab('sequencer');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        videos={videos}
        segments={segments}
        isGeneratingDemo={isGeneratingDemo}
        demoProgressText={demoProgressText}
        onLoadDemo={handleLoadDemo}
        onClearAll={handleClearAll}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main style={{ maxWidth: 1400, width: '100%', margin: '0 auto', padding: '24px 28px', flex: 1 }}>
        {videos.length === 0 && (
          <Uploader
            onFilesSelected={handleFilesSelected}
            analysisProgress={analysisProgress}
            onLoadDemo={handleLoadDemo}
            isGeneratingDemo={isGeneratingDemo}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: videos.length > 0 ? '1fr 1fr' : '1fr', gap: 24, marginBottom: 24 }}>
          {videos.length > 0 && (
            <div>
              <VideoMonitor
                videos={videos}
                activeSegment={activeSegment}
                activeVideo={activeVideo}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <PianoKeyboard
              segments={segments}
              activeNote={activeNote}
              onKeyClick={handleKeyClick}
              selectedFilterNote={selectedFilterNote}
              onSelectFilterNote={setSelectedFilterNote}
              overlapMode={overlapMode}
              onToggleOverlap={handleToggleOverlap}
            />

            {videos.length > 0 && (
              <div style={{ marginTop: 'auto' }}>
                <Uploader
                  onFilesSelected={handleFilesSelected}
                  analysisProgress={analysisProgress}
                  onLoadDemo={handleLoadDemo}
                  isGeneratingDemo={isGeneratingDemo}
                />
              </div>
            )}
          </div>
        </div>

        {activeTab === 'studio' && (
          <ClipLibrary
            segments={segments}
            videos={videos}
            activeSegment={activeSegment}
            selectedFilterNote={selectedFilterNote}
            onSelectFilterNote={setSelectedFilterNote}
            onPlaySegment={handlePlaySegment}
            onAddToSequencer={handleAddToSequencer}
          />
        )}

        {activeTab === 'sequencer' && (
          <SequencerView
            segments={segments}
            videos={videos}
            onPlayStepNote={(n) => setActiveNote(n)}
          />
        )}
      </main>

      <footer style={{
        borderTop: '1px solid var(--border-color)',
        padding: '16px 28px',
        textAlign: 'center',
        fontSize: 12,
        color: 'var(--text-muted)',
        background: 'rgba(15, 23, 42, 0.5)',
      }}>
        PitchClip Studio • In-Browser Audio Pitch Detection (YIN Algorithm) & Video Melodic Sampler • 100% Client-Side Privacy
      </footer>
    </div>
  );
};

export default App;
