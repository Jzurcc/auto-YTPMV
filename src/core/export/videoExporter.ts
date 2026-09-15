import type { SequenceStepExecution } from '../sequencer/sequenceEngine';
import type { VideoSource } from '../../types';
import { playbackManager } from '../video/videoPlaybackManager';
import fixWebmDuration from 'fix-webm-duration';

export interface ExportProgress {
  progress: number; // 0 to 100
  status: string;
}

function getSupportedMimeType(): string {
  const preferred = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  for (const t of preferred) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
}

export async function exportSequenceToVideo(
  executions: SequenceStepExecution[],
  bpm: number,
  videos: VideoSource[],
  title: string,
  onProgress: (p: ExportProgress) => void
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d')!;

  const beatDurationMs = (60 / bpm) * 1000;
  const totalDurationMs = executions.reduce((sum, e) => sum + e.step.durationBeats * beatDurationMs, 0);

  // 1. Setup Canvas Stream at steady 30 FPS
  const canvasStream = canvas.captureStream(30);

  // 2. Setup Audio MediaStreamDestination directly on playbackManager's AudioContext
  // This guarantees all played notes are routed into the recorded stream with 0ms latency
  const audioDest = playbackManager.createMediaStreamDestination();
  playbackManager.setRecordingDestination(audioDest);

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 2500000,
    audioBitsPerSecond: 128000,
  });

  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise(async (resolve, reject) => {
    recorder.onstop = async () => {
      playbackManager.setRecordingDestination(null);

      try {
        const rawBlob = new Blob(chunks, { type: mimeType });
        onProgress({ progress: 99, status: 'Injecting seekable duration metadata...' });

        let finalBlob = rawBlob;
        if (mimeType.includes('webm')) {
          try {
            // Fix missing EBML duration header so players (VLC, Windows Media, QuickTime) can seek and play
            finalBlob = await fixWebmDuration(rawBlob, Math.round(totalDurationMs), { logger: false });
          } catch (err) {
            console.warn('Could not inject WebM duration, fallback to raw blob:', err);
            finalBlob = rawBlob;
          }
        }

        onProgress({ progress: 100, status: 'Export complete!' });
        resolve(finalBlob);
      } catch (err) {
        reject(err);
      }
    };

    recorder.onerror = (e) => {
      playbackManager.setRecordingDestination(null);
      reject(e);
    };

    recorder.start(100); // Collect data chunks every 100ms
    onProgress({ progress: 5, status: 'Recording video sequence...' });

    let elapsedTotalMs = 0;
    const frameIntervalMs = 1000 / 30; // 30 FPS frame stepping

    for (let i = 0; i < executions.length; i++) {
      const item = executions[i];
      const stepDurationMs = item.step.durationBeats * beatDurationMs;

      // Play audio and trigger video seeking via playbackManager
      if (item.segment) {
        playbackManager.playSegment(item.segment, videos, {
          pitchShiftSemitones: item.pitchShiftSemitones,
        });
      }

      const stepStart = performance.now();
      while (performance.now() - stepStart < stepDurationMs) {
        let currentVideoEl = playbackManager.getActiveVideoElement();
        if (!currentVideoEl && item.segment) {
          currentVideoEl = playbackManager.getVideoElement(item.segment.videoId) || null;
        }

        if (currentVideoEl && currentVideoEl.readyState >= 2) {
          ctx.fillStyle = '#020617';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const vw = currentVideoEl.videoWidth || canvas.width;
          const vh = currentVideoEl.videoHeight || canvas.height;
          const scale = Math.min(canvas.width / vw, canvas.height / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          const dx = (canvas.width - dw) / 2;
          const dy = (canvas.height - dh) / 2;

          ctx.drawImage(currentVideoEl, dx, dy, dw, dh);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        drawExportHud(ctx, canvas.width, canvas.height, item, title, i, executions.length);

        // Force frame draw to stream track if supported
        const videoTrack = canvasStream.getVideoTracks()[0];
        (videoTrack as any)?.requestFrame?.();

        await new Promise((r) => setTimeout(r, frameIntervalMs));
      }

      elapsedTotalMs += stepDurationMs;
      const pct = Math.min(95, Math.round((elapsedTotalMs / totalDurationMs) * 90) + 5);
      onProgress({
        progress: pct,
        status: `Rendering note ${i + 1}/${executions.length} (${item.step.note})...`,
      });
    }

    playbackManager.stopCurrent();
    onProgress({ progress: 98, status: 'Finalizing video file...' });

    setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, 250);
  });
}

function drawExportHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  item: SequenceStepExecution,
  title: string,
  stepIdx: number,
  totalSteps: number
) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, w, 40);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`🎵 ${title}`, 16, 26);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Step ${stepIdx + 1}/${totalSteps}`, w - 16, 26);

  const badgeW = 140;
  const badgeH = 50;
  const bx = (w - badgeW) / 2;
  const by = h - 65;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx, by, badgeW, badgeH, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(item.step.note, w / 2, by + 34);
}
