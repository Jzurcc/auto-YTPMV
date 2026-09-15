import type { VideoSource } from '../../types';

interface DemoTrackConfig {
  name: string;
  color: string;
  theme: 'cat' | 'synth' | 'horn' | 'robot';
  notes: { freq: number; start: number; duration: number; type?: OscillatorType }[];
  totalDuration: number;
}

const DEMO_CONFIGS: DemoTrackConfig[] = [
  {
    name: 'Whiskers the Singing Cat.webm',
    color: '#f59e0b',
    theme: 'cat',
    totalDuration: 3.5,
    notes: [
      { freq: 261.63, start: 0.2, duration: 0.6, type: 'triangle' }, // C4
      { freq: 329.63, start: 1.0, duration: 0.6, type: 'triangle' }, // E4
      { freq: 392.00, start: 1.8, duration: 0.7, type: 'triangle' }, // G4
      { freq: 440.00, start: 2.7, duration: 0.6, type: 'triangle' }, // A4
    ],
  },
  {
    name: 'Neon Arcade Synth.webm',
    color: '#06b6d4',
    theme: 'synth',
    totalDuration: 3.2,
    notes: [
      { freq: 293.66, start: 0.2, duration: 0.5, type: 'sawtooth' }, // D4
      { freq: 369.99, start: 0.9, duration: 0.5, type: 'sawtooth' }, // F#4
      { freq: 440.00, start: 1.6, duration: 0.5, type: 'sawtooth' }, // A4
      { freq: 587.33, start: 2.3, duration: 0.7, type: 'sawtooth' }, // D5
    ],
  },
  {
    name: 'Silly Honk & Squeak.webm',
    color: '#ec4899',
    theme: 'horn',
    totalDuration: 3.0,
    notes: [
      { freq: 349.23, start: 0.3, duration: 0.6, type: 'square' },   // F4
      { freq: 392.00, start: 1.2, duration: 0.6, type: 'square' },   // G4
      { freq: 523.25, start: 2.0, duration: 0.7, type: 'square' },   // C5
    ],
  },
  {
    name: 'Cybernetic Robot Beep.webm',
    color: '#10b981',
    theme: 'robot',
    totalDuration: 3.0,
    notes: [
      { freq: 164.81, start: 0.2, duration: 0.5, type: 'sine' },     // E3
      { freq: 196.00, start: 0.9, duration: 0.5, type: 'sine' },     // G3
      { freq: 246.94, start: 1.6, duration: 0.5, type: 'sine' },     // B3
      { freq: 261.63, start: 2.3, duration: 0.5, type: 'sine' },     // C4
    ],
  },
];

export async function generateDemoVideoPack(
  onProgress?: (msg: string, progress: number) => void
): Promise<VideoSource[]> {
  const results: VideoSource[] = [];

  for (let i = 0; i < DEMO_CONFIGS.length; i++) {
    const config = DEMO_CONFIGS[i];
    onProgress?.(`Synthesizing demo clip ${i + 1}/${DEMO_CONFIGS.length}: ${config.name}...`, Math.round(((i) / DEMO_CONFIGS.length) * 100));
    const videoSource = await recordDemoClip(config);
    results.push(videoSource);
  }

  onProgress?.('Demo pack ready!', 100);
  return results;
}

function recordDemoClip(config: DemoTrackConfig): Promise<VideoSource> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d')!;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();

    for (const n of config.notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = n.type || 'sine';
      osc.frequency.setValueAtTime(n.freq, audioCtx.currentTime + n.start);

      if (config.theme === 'cat') {
        osc.frequency.exponentialRampToValueAtTime(n.freq * 1.05, audioCtx.currentTime + n.start + n.duration * 0.4);
        osc.frequency.exponentialRampToValueAtTime(n.freq, audioCtx.currentTime + n.start + n.duration);
      }

      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + n.start);
      gain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + n.start + 0.05);
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime + n.start + n.duration - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + n.start + n.duration);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(audioCtx.currentTime + n.start);
      osc.stop(audioCtx.currentTime + n.start + n.duration + 0.1);
    }

    const canvasStream = canvas.captureStream(30);
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

    let startTime = performance.now();
    let animationFrameId: number;

    const render = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      drawFrame(ctx, canvas.width, canvas.height, config, elapsed);

      if (elapsed < config.totalDuration) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animationFrameId);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }
    };

    recorder.onstop = () => {
      audioCtx.close();
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      resolve({
        id: `demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: config.name,
        url,
        duration: config.totalDuration,
        width: canvas.width,
        height: canvas.height,
        color: config.color,
        isDemo: true,
      });
    };

    recorder.start();
    startTime = performance.now();
    render();
  });
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: DemoTrackConfig,
  time: number
) {
  const activeNote = config.notes.find((n) => time >= n.start && time <= n.start + n.duration);
  const isPlaying = !!activeNote;

  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isPlaying) {
    bgGrad.addColorStop(0, '#1e1b4b');
    bgGrad.addColorStop(1, '#0f172a');
  } else {
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#030712');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const centerX = width / 2;
  const centerY = height / 2 - 10;

  if (config.theme === 'cat') {
    drawCat(ctx, centerX, centerY, time, isPlaying, config.color);
  } else if (config.theme === 'synth') {
    drawSynth(ctx, centerX, centerY, time, isPlaying, config.color);
  } else if (config.theme === 'horn') {
    drawHorn(ctx, centerX, centerY, time, isPlaying, config.color);
  } else {
    drawRobot(ctx, centerX, centerY, time, isPlaying, config.color);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(config.name.replace('.webm', ''), 20, 32);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '13px monospace';
  ctx.fillText(`TIME: ${time.toFixed(2)}s / ${config.totalDuration.toFixed(1)}s`, 20, 52);

  if (isPlaying && activeNote) {
    const badgeX = width - 110;
    const badgeY = 20;
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, 90, 34, 8);
    ctx.fill();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(activeNote.freq)} Hz`, badgeX + 45, badgeY + 22);
  }
}

function drawCat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  time: number,
  singing: boolean,
  color: string
) {
  const bob = singing ? Math.sin(time * 12) * 8 : Math.sin(time * 3) * 3;
  const mouthOpen = singing ? 16 + Math.sin(time * 15) * 8 : 4;

  ctx.save();
  ctx.translate(cx, cy + bob);

  ctx.fillStyle = '#ea580c';
  ctx.beginPath();
  ctx.moveTo(-50, -40);
  ctx.lineTo(-20, -90);
  ctx.lineTo(0, -40);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(50, -40);
  ctx.lineTo(20, -90);
  ctx.lineTo(0, -40);
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(-22, -10, singing ? 8 : 6, 0, Math.PI * 2);
  ctx.arc(22, -10, singing ? 8 : 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-35, 10);
  ctx.lineTo(-70, 5);
  ctx.moveTo(-35, 18);
  ctx.lineTo(-70, 22);
  ctx.moveTo(35, 10);
  ctx.lineTo(70, 5);
  ctx.moveTo(35, 18);
  ctx.lineTo(70, 22);
  ctx.stroke();

  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.lineTo(-7, -2);
  ctx.lineTo(7, -2);
  ctx.fill();

  ctx.fillStyle = '#881337';
  ctx.beginPath();
  ctx.ellipse(0, 22, 14, mouthOpen, 0, 0, Math.PI * 2);
  ctx.fill();

  if (singing) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    for (let r = 1; r <= 3; r++) {
      const radius = 70 + r * 15 + ((time * 80) % 25);
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI * 0.3, Math.PI * 0.3);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawSynth(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  time: number,
  playing: boolean,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = playing ? color : 'transparent';
  ctx.shadowBlur = playing ? 25 : 0;
  ctx.beginPath();
  ctx.roundRect(-100, -50, 200, 110, 12);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#020617';
  ctx.fillRect(-80, -35, 160, 45);

  ctx.strokeStyle = playing ? '#38bdf8' : '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -75; x <= 75; x += 3) {
    const wave = playing ? Math.sin((x + time * 120) * 0.15) * 16 : 0;
    if (x === -75) ctx.moveTo(x, -12 + wave);
    else ctx.lineTo(x, -12 + wave);
  }
  ctx.stroke();

  const keyWidth = 14;
  for (let i = 0; i < 9; i++) {
    const kx = -70 + i * 16;
    const isPressed = playing && ((Math.floor(time * 6) + i) % 3 === 0);
    ctx.fillStyle = isPressed ? color : '#f8fafc';
    ctx.fillRect(kx, 20, keyWidth, 30);
  }

  ctx.restore();
}

function drawHorn(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  time: number,
  playing: boolean,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);

  const squeeze = playing ? 1 + Math.sin(time * 25) * 0.25 : 1;
  ctx.scale(squeeze, 1 / squeeze);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-45, 0, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(-15, -12);
  ctx.lineTo(35, -28);
  ctx.lineTo(60, -45);
  ctx.lineTo(60, 45);
  ctx.lineTo(35, 28);
  ctx.lineTo(-15, 12);
  ctx.closePath();
  ctx.fill();

  if (playing) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('♫', 75, -20);
    ctx.fillText('♪', 95, 10);
  }

  ctx.restore();
}

function drawRobot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  time: number,
  playing: boolean,
  color: string
) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.lineTo(0, -80);
  ctx.stroke();

  ctx.fillStyle = playing ? color : '#dc2626';
  ctx.beginPath();
  ctx.arc(0, -84, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(-55, -50, 110, 90, 14);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-42, -35, 84, 25);

  ctx.fillStyle = playing ? color : '#38bdf8';
  const eyeShift = playing ? Math.sin(time * 10) * 8 : 0;
  ctx.fillRect(-30 + eyeShift, -30, 20, 15);
  ctx.fillRect(10 + eyeShift, -30, 20, 15);

  const bars = 7;
  for (let b = 0; b < bars; b++) {
    const bx = -35 + b * 10;
    const h = playing ? 4 + Math.abs(Math.sin(time * 15 + b)) * 18 : 3;
    ctx.fillStyle = color;
    ctx.fillRect(bx, 15 - h / 2, 6, h);
  }

  ctx.restore();
}
