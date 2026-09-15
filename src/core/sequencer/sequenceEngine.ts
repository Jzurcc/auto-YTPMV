import type { NoteSegment, SequencerStep, VideoSource } from '../../types';
import { noteNameToMidi } from '../audio/noteUtils';
import { calculateTimbreDistance } from '../audio/timbreAnalyzer';
import { playbackManager } from '../video/videoPlaybackManager';

export interface SequenceStepExecution {
  stepIndex: number;
  step: SequencerStep;
  segment: NoteSegment | null;
  pitchShiftSemitones: number;
  durationMs: number;
}

export class SequenceEngine {
  private isPlaying = false;
  private currentStepIndex = -1;
  private stopSignal = false;

  /**
   * Resolve steps into concrete NoteSegments.
   * timbreCoherence: 0.0 (Diverse) to 1.0 (Maximum Timbral Coherence)
   */
  public resolveSteps(
    rawSteps: { note: string; duration: number }[],
    segments: NoteSegment[],
    timbreCoherence = 0.75
  ): SequenceStepExecution[] {
    const noteMap = new Map<string, NoteSegment[]>();
    for (const seg of segments) {
      if (!noteMap.has(seg.note)) noteMap.set(seg.note, []);
      noteMap.get(seg.note)!.push(seg);
    }

    let previousChosenSegment: NoteSegment | null = null;

    return rawSteps.map((raw, idx) => {
      const targetMidi = noteNameToMidi(raw.note) ?? 60;
      let chosenSegment: NoteSegment | null = null;
      let pitchShiftSemitones = 0;

      const exactMatches = noteMap.get(raw.note);

      if (exactMatches && exactMatches.length > 0) {
        if (exactMatches.length === 1 || timbreCoherence === 0) {
          chosenSegment = exactMatches[idx % exactMatches.length];
        } else {
          // Select candidate with the best timbral coherence relative to previous note
          let bestCandidate = exactMatches[0];
          let bestScore = Infinity;

          for (const candidate of exactMatches) {
            let timbreDist = 0.5;
            if (previousChosenSegment?.timbre && candidate.timbre) {
              timbreDist = calculateTimbreDistance(previousChosenSegment.timbre, candidate.timbre);
            }

            // Subtle continuity bonus if from the same video voice
            const sameSourceBonus = (previousChosenSegment && candidate.videoId === previousChosenSegment.videoId)
              ? -0.15
              : 0;

            // Score: lower is better
            const score = (timbreDist + sameSourceBonus) * timbreCoherence +
                          (1 - candidate.confidence) * (1 - timbreCoherence * 0.5);

            if (score < bestScore) {
              bestScore = score;
              bestCandidate = candidate;
            }
          }

          chosenSegment = bestCandidate;
        }
      } else if (segments.length > 0) {
        // Find closest segment by pitch and timbre
        let minDiff = Infinity;
        let bestSeg: NoteSegment | null = null;
        for (const seg of segments) {
          const diff = Math.abs(seg.midi - targetMidi);
          let tDist = 0.5;
          if (previousChosenSegment?.timbre && seg.timbre) {
            tDist = calculateTimbreDistance(previousChosenSegment.timbre, seg.timbre);
          }
          const compositeDiff = diff + tDist * timbreCoherence * 2;
          if (compositeDiff < minDiff) {
            minDiff = compositeDiff;
            bestSeg = seg;
          }
        }
        if (bestSeg) {
          chosenSegment = bestSeg;
          pitchShiftSemitones = targetMidi - bestSeg.midi;
        }
      }

      if (chosenSegment) {
        previousChosenSegment = chosenSegment;
      }

      return {
        stepIndex: idx,
        step: {
          id: `step_${idx}_${raw.note}`,
          note: raw.note,
          durationBeats: raw.duration,
          segment: chosenSegment || undefined,
          isCustomPitched: pitchShiftSemitones !== 0,
          pitchShiftRatio: Math.pow(2, pitchShiftSemitones / 12),
        },
        segment: chosenSegment,
        pitchShiftSemitones,
        durationMs: 0,
      };
    });
  }

  public async playSequence(
    executions: SequenceStepExecution[],
    bpm: number,
    videos: VideoSource[],
    onStep: (stepIndex: number) => void,
    onFinish: () => void
  ): Promise<void> {
    this.stop();
    this.isPlaying = true;
    this.stopSignal = false;

    const beatDurationMs = (60 / bpm) * 1000;

    for (let i = 0; i < executions.length; i++) {
      if (this.stopSignal) break;

      this.currentStepIndex = i;
      onStep(i);

      const item = executions[i];
      const durationMs = item.step.durationBeats * beatDurationMs;

      if (item.segment) {
        playbackManager.playSegment(item.segment, videos, {
          pitchShiftSemitones: item.pitchShiftSemitones,
        });
      }

      await new Promise((r) => setTimeout(r, durationMs));
    }

    this.isPlaying = false;
    this.currentStepIndex = -1;
    onStep(-1);
    onFinish();
  }

  public stop(): void {
    this.stopSignal = true;
    this.isPlaying = false;
    this.currentStepIndex = -1;
    playbackManager.stopCurrent();
  }

  public getStatus(): { isPlaying: boolean; currentStepIndex: number } {
    return { isPlaying: this.isPlaying, currentStepIndex: this.currentStepIndex };
  }
}

export const sequenceEngine = new SequenceEngine();
