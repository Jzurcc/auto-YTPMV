import type { NoteSegment, VideoSource, PitchAnalysisProgress } from '../../types';
import { YinPitchDetector } from './pitchDetector';
import { analyzeFrequency } from './noteUtils';
import { analyzeTimbre } from './timbreAnalyzer';

export interface FrameResult {
  time: number;
  frequency: number;
  confidence: number;
  rms: number;
  midi: number;
  note: string;
  cents: number;
}

export class AudioAnalyzer {
  private audioCtx: AudioContext | null = null;

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

  /**
   * Fast decode + native browser downsampling to 16,000 Hz mono.
   * By Nyquist theorem, 16kHz accurately covers all musical pitches up to 8,000 Hz
   * while reducing computational data size by 3x and YIN calculations by 12x!
   */
  public async decodeAudioFromVideo(
    video: VideoSource,
    onProgress?: (progress: PitchAnalysisProgress) => void
  ): Promise<AudioBuffer> {
    onProgress?.({
      videoId: video.id,
      videoName: video.name,
      stage: 'decoding',
      progress: 10,
      message: 'Reading video container data...',
    });

    let arrayBuffer: ArrayBuffer;
    if (video.file) {
      arrayBuffer = await video.file.arrayBuffer();
    } else {
      const response = await fetch(video.url);
      arrayBuffer = await response.arrayBuffer();
    }

    onProgress?.({
      videoId: video.id,
      videoName: video.name,
      stage: 'decoding',
      progress: 30,
      message: 'Decompressing PCM audio track...',
    });

    const ctx = this.getAudioContext();
    const rawBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    onProgress?.({
      videoId: video.id,
      videoName: video.name,
      stage: 'decoding',
      progress: 45,
      message: 'Accelerating audio with 16 kHz native downsampler...',
    });

    // Native hardware-accelerated downsample to 16kHz mono via OfflineAudioContext
    const TARGET_SAMPLE_RATE = 16000;
    const targetLength = Math.max(1, Math.ceil(rawBuffer.duration * TARGET_SAMPLE_RATE));
    const offlineCtx = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);

    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = rawBuffer;
    bufferSource.connect(offlineCtx.destination);
    bufferSource.start(0);

    const downsampledBuffer = await offlineCtx.startRendering();
    return downsampledBuffer;
  }

  /**
   * Ultra-fast pitch detection with 16kHz windowing and dynamic silence skipping
   */
  public async analyzeAudioBuffer(
    video: VideoSource,
    audioBuffer: AudioBuffer,
    onProgress?: (progress: PitchAnalysisProgress) => void
  ): Promise<NoteSegment[]> {
    const sampleRate = audioBuffer.sampleRate; // 16000 Hz
    const totalSamples = audioBuffer.length;
    const monoData = audioBuffer.getChannelData(0);

    onProgress?.({
      videoId: video.id,
      videoName: video.name,
      stage: 'analyzing',
      progress: 50,
      message: 'Running high-speed YIN pitch tracker...',
    });

    // 1024 samples @ 16kHz = 64ms window (covers down to 50 Hz with 4x fewer operations)
    // 256 samples @ 16kHz = 16ms hop resolution
    const windowSize = 1024;
    const hopSize = 256;
    const detector = new YinPitchDetector(sampleRate, 0.15, 55, 4200);

    const rawFrames: FrameResult[] = [];
    const windowBuffer = new Float32Array(windowSize);
    const totalHops = Math.floor((totalSamples - windowSize) / hopSize);

    let lastProgressTime = Date.now();
    let hop = 0;

    while (hop < totalHops) {
      const offset = hop * hopSize;
      windowBuffer.set(monoData.subarray(offset, offset + windowSize));

      // Fast O(N) RMS check first to skip silence without running heavy YIN difference
      let sumSquares = 0;
      for (let i = 0; i < windowSize; i += 2) {
        sumSquares += windowBuffer[i] * windowBuffer[i];
      }
      const fastRms = Math.sqrt((sumSquares * 2) / windowSize);

      if (fastRms < 0.010) {
        // Fast skip forward by 3 hops through silent / unvoiced sections
        hop += 3;
        continue;
      }

      // Run YIN pitch detector only on active frames
      const { frequency, confidence, rms } = detector.detect(windowBuffer);
      const time = offset / sampleRate;

      if (frequency >= 55 && frequency <= 4200 && confidence >= 0.70 && rms >= 0.010) {
        const info = analyzeFrequency(frequency);
        if (Math.abs(info.cents) <= 45) {
          rawFrames.push({
            time,
            frequency,
            confidence,
            rms,
            midi: info.midi,
            note: info.note,
            cents: info.cents,
          });
        }
      }

      // Advance by 1 hop
      hop++;

      // Keep UI snappy by yielding periodically
      if (Date.now() - lastProgressTime > 50) {
        const percent = Math.min(90, 50 + Math.floor((hop / totalHops) * 40));
        onProgress?.({
          videoId: video.id,
          videoName: video.name,
          stage: 'analyzing',
          progress: percent,
          message: `Scanning frequencies: ${Math.round((hop / totalHops) * 100)}% (Fast Mode)`,
        });
        await new Promise((r) => setTimeout(r, 0));
        lastProgressTime = Date.now();
      }
    }

    // 3. 3-Point Median Filtering to eliminate single-frame acoustic spikes
    const smoothedFrames: FrameResult[] = [];
    for (let i = 0; i < rawFrames.length; i++) {
      if (i > 0 && i < rawFrames.length - 1) {
        const prev = rawFrames[i - 1];
        const curr = rawFrames[i];
        const next = rawFrames[i + 1];

        if (prev.midi === next.midi && curr.midi !== prev.midi) {
          smoothedFrames.push({
            ...curr,
            midi: prev.midi,
            note: prev.note,
            frequency: (prev.frequency + next.frequency) * 0.5,
          });
          continue;
        }
      }
      smoothedFrames.push(rawFrames[i]);
    }

    onProgress?.({
      videoId: video.id,
      videoName: video.name,
      stage: 'grouping',
      progress: 92,
      message: 'Grouping musical notes into sustained segments...',
    });

    // 4. Cluster contiguous frames of the same note with gap-bridging (de-bouncing)
    const rawSegments: NoteSegment[] = [];
    if (smoothedFrames.length === 0) {
      onProgress?.({
        videoId: video.id,
        videoName: video.name,
        stage: 'complete',
        progress: 100,
        message: 'Analysis complete (no stable musical notes detected).',
      });
      return rawSegments;
    }

    let currentGroup: FrameResult[] = [smoothedFrames[0]];
    const hopDuration = hopSize / sampleRate;
    // Allow up to 80ms gap tolerance (unison beating or vocal vibrato dropouts)
    const maxGapAllowed = Math.max(0.08, hopDuration * 6);

    for (let i = 1; i < smoothedFrames.length; i++) {
      const prev = smoothedFrames[i - 1];
      const curr = smoothedFrames[i];
      const timeDiff = curr.time - prev.time;
      const isSameNote = curr.midi === prev.midi;
      const isWithinGapTolerance = timeDiff <= maxGapAllowed;

      if (isSameNote && isWithinGapTolerance) {
        currentGroup.push(curr);
      } else {
        const seg = this.createSegmentFromGroup(video, currentGroup, hopDuration, monoData, sampleRate);
        if (seg) rawSegments.push(seg);
        currentGroup = [curr];
      }
    }

    if (currentGroup.length > 0) {
      const seg = this.createSegmentFromGroup(video, currentGroup, hopDuration, monoData, sampleRate);
      if (seg) rawSegments.push(seg);
    }

    // 5. Consolidate and de-duplicate adjacent segments of the same note
    const consolidatedSegments = this.consolidateSegments(rawSegments);

    onProgress?.({
      videoId: video.id,
      videoName: video.name,
      stage: 'complete',
      progress: 100,
      message: `Found ${consolidatedSegments.length} musical pitch segments!`,
    });

    return consolidatedSegments;
  }

  private createSegmentFromGroup(
    video: VideoSource,
    group: FrameResult[],
    hopDuration: number,
    monoData: Float32Array,
    sampleRate: number
  ): NoteSegment | null {
    // Require at least 5 frames (~80ms audio at 16ms hops) to filter out transient clicks/pops
    if (group.length < 5) return null;

    const rawStartTime = group[0].time;
    const rawEndTime = group[group.length - 1].time + hopDuration;
    const rawDuration = rawEndTime - rawStartTime;

    if (rawDuration < 0.08) return null;

    const startTime = Math.max(0, rawStartTime - 0.02);
    const endTime = Math.min(video.duration || 9999, rawEndTime + 0.03);
    const duration = endTime - startTime;

    let sumFreq = 0;
    let sumConfidence = 0;
    let peakRms = 0;
    for (const f of group) {
      sumFreq += f.frequency;
      sumConfidence += f.confidence;
      if (f.rms > peakRms) peakRms = f.rms;
    }
    const avgFreq = sumFreq / group.length;
    const avgConfidence = sumConfidence / group.length;
    const info = analyzeFrequency(avgFreq);

    // Extract raw audio slice for timbral analysis
    const startSample = Math.max(0, Math.floor(startTime * sampleRate));
    const endSample = Math.min(monoData.length, Math.ceil(endTime * sampleRate));
    const segmentPcm = monoData.subarray(startSample, endSample);
    const timbre = analyzeTimbre(segmentPcm, sampleRate);

    return {
      id: `seg_${video.id}_${Math.round(startTime * 1000)}_${info.note}`,
      videoId: video.id,
      videoName: video.name,
      videoColor: video.color,
      startTime,
      endTime,
      duration,
      note: info.note,
      noteName: info.noteName,
      octave: info.octave,
      midi: info.midi,
      frequency: avgFreq,
      targetFrequency: info.targetFrequency,
      cents: info.cents,
      confidence: avgConfidence,
      peakRms,
      timbre,
    };
  }

  private consolidateSegments(segments: NoteSegment[]): NoteSegment[] {
    if (segments.length <= 1) return segments;

    const result: NoteSegment[] = [];
    let current = segments[0];

    for (let i = 1; i < segments.length; i++) {
      const next = segments[i];
      const gap = next.startTime - current.endTime;

      if (current.videoId === next.videoId && current.note === next.note && gap >= -0.05 && gap <= 0.15) {
        current = {
          ...current,
          endTime: next.endTime,
          duration: next.endTime - current.startTime,
          confidence: Math.max(current.confidence, next.confidence),
          peakRms: Math.max(current.peakRms, next.peakRms),
          timbre: current.timbre || next.timbre,
        };
      } else {
        result.push(current);
        current = next;
      }
    }
    result.push(current);
    return result;
  }
}
