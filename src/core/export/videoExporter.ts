import type { SequenceStepExecution } from '../sequencer/sequenceEngine';
import type { VideoSource } from '../../types';
import { playbackManager } from '../video/videoPlaybackManager';

export interface ExportProgress {
  progress: number; // 0 to 100
  status: string;
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

  const canvasStream = canvas.captureStream(30);
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();

  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
    ? 'video/webm;codecs=vp8,opus'
    : 'video/webm';

  const recorder = new MediaRecorder(combinedStream, { mimeType });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  return new Promise(async (resolve, reject) => {
    recorder.onstop = () => {
      audioCtx.close();
      const blob = new Blob(chunks, { type: mimeType });
      onProgress({ progress: 100, status: 'Export complete!' });
      resolve(blob);
    };

    recorder.onerror = (e) => {
      reject(e);
    };

    recorder.start();
    onProgress({ progress: 5, status: 'Recording video sequence...' });

    let elapsedTotalMs = 0;

    for (let i = 0; i < executions.length; i++) {
      const item = executions[i];
      const stepDurationMs = item.step.durationBeats * beatDurationMs;

      if (item.segment) {
        playbackManager.playSegment(item.segment, videos, {
          pitchShiftSemitones: item.pitchShiftSemitones,
        });
      }

      const stepStart = performance.now();
      while (performance.now() - stepStart < stepDurationMs) {
        const currentVideoEl = playbackManager.getActiveVideoElement();
        if (currentVideoEl && currentVideoEl.readyState >= 2) {
          ctx.drawImage(currentVideoEl, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        drawExportHud(ctx, canvas.width, canvas.height, item, title, i, executions.length);
        await new Promise((r) => requestAnimationFrame(r));
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
    }, 200);
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
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
