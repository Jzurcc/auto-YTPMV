import type { NoteSegment, VideoSource } from '../../types';

export interface PlaybackObserver {
  onSegmentStart?: (segment: NoteSegment, videoSource: VideoSource) => void;
  onSegmentEnd?: (segment: NoteSegment) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export class VideoPlaybackManager {
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private audioCtx: AudioContext | null = null;
  private activeAudioSources: Set<{ source: AudioBufferSourceNode; gain: GainNode }> = new Set();
  
  private currentPlayingTimeout: number | null = null;
  private currentSegment: NoteSegment | null = null;
  private observers: Set<PlaybackObserver> = new Set();
  private activeVideoElement: HTMLVideoElement | null = null;
  private overlapMode: boolean = true; // Default: Polyphonic / Let Ring

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setOverlapMode(enabled: boolean): void {
    this.overlapMode = enabled;
  }

  public getOverlapMode(): boolean {
    return this.overlapMode;
  }

  public registerAudioBuffer(videoId: string, buffer: AudioBuffer): void {
    this.audioBuffers.set(videoId, buffer);
  }

  public unregisterAudioBuffer(videoId: string): void {
    this.audioBuffers.delete(videoId);
  }

  public subscribe(observer: PlaybackObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  public registerVideoElement(videoId: string, element: HTMLVideoElement): void {
    this.videoElements.set(videoId, element);
  }

  public unregisterVideoElement(videoId: string): void {
    this.videoElements.delete(videoId);
  }

  public getVideoElement(videoId: string): HTMLVideoElement | undefined {
    return this.videoElements.get(videoId);
  }

  public getCurrentSegment(): NoteSegment | null {
    return this.currentSegment;
  }

  public getActiveVideoElement(): HTMLVideoElement | null {
    return this.activeVideoElement;
  }

  /**
   * Play a specific note snippet.
   * If overlapMode is ON: previous sounds continue ringing out to their full duration.
   * If overlapMode is OFF: previous sounds are cut off immediately.
   */
  public async playSegment(
    segment: NoteSegment,
    videos: VideoSource[],
    options?: {
      pitchShiftSemitones?: number;
      loop?: boolean;
      onEnd?: () => void;
    }
  ): Promise<void> {
    // If not in overlap mode, stop previous audio
    if (!this.overlapMode) {
      this.stopCurrentAudio();
    }

    const videoSource = videos.find((v) => v.id === segment.videoId);
    if (!videoSource) return;

    let el = this.videoElements.get(segment.videoId);
    if (!el) {
      el = document.querySelector(`video[data-video-id="${segment.videoId}"]`) as HTMLVideoElement;
      if (el) {
        this.videoElements.set(segment.videoId, el);
      }
    }

    this.activeVideoElement = el || null;
    this.currentSegment = segment;

    const pitchRatio = options?.pitchShiftSemitones && options.pitchShiftSemitones !== 0
      ? Math.pow(2, options.pitchShiftSemitones / 12)
      : 1.0;

    const playDuration = Math.max(0.08, segment.duration / pitchRatio);
    const durationMs = playDuration * 1000;

    // 1. Audio Playback via Web Audio API (Zero Latency & Polyphonic Overlapping)
    const cachedBuffer = this.audioBuffers.get(segment.videoId);
    let audioHandledByWebAudio = false;

    if (cachedBuffer) {
      try {
        const ctx = this.getAudioContext();
        const source = ctx.createBufferSource();
        source.buffer = cachedBuffer;
        source.playbackRate.value = pitchRatio;

        const gain = ctx.createGain();
        const now = ctx.currentTime;

        // Smooth attack to prevent speaker click
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(1.0, now + 0.005);

        // Smooth release tail at the end of the duration
        const endTime = now + playDuration;
        gain.gain.setValueAtTime(1.0, Math.max(now + 0.005, endTime - 0.02));
        gain.gain.linearRampToValueAtTime(0.001, endTime);

        source.connect(gain);
        gain.connect(ctx.destination);

        source.start(now, segment.startTime, playDuration);
        audioHandledByWebAudio = true;

        const item = { source, gain };
        this.activeAudioSources.add(item);

        source.onended = () => {
          this.activeAudioSources.delete(item);
        };
      } catch (err) {
        console.warn('Web Audio playback error:', err);
      }
    }

    // 2. Video Track Sync for Video Monitor
    if (el) {
      el.playbackRate = Math.min(4.0, Math.max(0.25, pitchRatio));
      // If Web Audio is playing the sound, mute the video element to prevent duplicate echo
      el.muted = audioHandledByWebAudio;
      el.volume = 1.0;

      try {
        el.currentTime = segment.startTime;
        await el.play();
      } catch (err) {
        console.warn('Video preview play warning:', err);
      }
    }

    this.observers.forEach((obs) => obs.onSegmentStart?.(segment, videoSource));

    if (this.currentPlayingTimeout !== null) {
      window.clearTimeout(this.currentPlayingTimeout);
      this.currentPlayingTimeout = null;
    }

    this.currentPlayingTimeout = window.setTimeout(() => {
      if (options?.loop) {
        this.playSegment(segment, videos, options);
      } else {
        if (!this.overlapMode && el) {
          try { el.pause(); } catch {}
        }
        this.observers.forEach((obs) => obs.onSegmentEnd?.(segment));
        options?.onEnd?.();
        this.currentSegment = null;
      }
    }, durationMs);
  }

  public stopCurrentAudio(): void {
    const ctx = this.audioCtx;
    if (ctx && this.activeAudioSources.size > 0) {
      const now = ctx.currentTime;
      this.activeAudioSources.forEach(({ source, gain }) => {
        try {
          // Fast 12ms fade-out to prevent speaker pop
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.012);
          setTimeout(() => {
            try {
              source.stop();
              source.disconnect();
            } catch {}
          }, 15);
        } catch {}
      });
      this.activeAudioSources.clear();
    }

    if (this.activeVideoElement) {
      try {
        this.activeVideoElement.pause();
      } catch {}
    }
  }

  public stopCurrent(): void {
    if (this.currentPlayingTimeout !== null) {
      window.clearTimeout(this.currentPlayingTimeout);
      this.currentPlayingTimeout = null;
    }

    this.stopCurrentAudio();

    if (this.currentSegment) {
      const seg = this.currentSegment;
      this.currentSegment = null;
      this.observers.forEach((obs) => obs.onSegmentEnd?.(seg));
    }
  }
}

export const playbackManager = new VideoPlaybackManager();
