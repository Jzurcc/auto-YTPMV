export type TimbreCharacter = 
  | 'Warm Sustained' 
  | 'Bright Sustained' 
  | 'Percussive Attack' 
  | 'Harmonic Formant';

export interface TimbreProfile {
  spectralCentroid: number; // Hz, e.g. 850
  brightness: number;       // 0.0 (dark/warm) to 1.0 (bright/piercing)
  attackTimeMs: number;     // e.g. 12ms (percussive) to 110ms (sustained)
  isPercussive: boolean;
  character: TimbreCharacter;
  vector: [number, number, number]; // [brightness, attackNormalized, crestFactorNormalized]
}

export interface VideoSource {
  id: string;
  name: string;
  url: string;
  file?: File;
  duration: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  color: string;
  isDemo?: boolean;
}

export interface NoteSegment {
  id: string;
  videoId: string;
  videoName: string;
  videoColor: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  duration: number;  // in seconds
  note: string;      // e.g. "C4", "F#3"
  noteName: string;  // e.g. "C", "F#"
  octave: number;    // e.g. 4
  midi: number;      // e.g. 60
  frequency: number; // Hz, e.g. 261.63
  targetFrequency: number; // standard frequency for note
  cents: number;     // deviation from standard pitch (-50 to +50)
  confidence: number;// 0.0 to 1.0 (YIN aperiodicity metric)
  peakRms: number;   // amplitude volume
  timbre?: TimbreProfile; // Acoustic timbre profile
}

export interface PitchAnalysisProgress {
  videoId: string;
  videoName: string;
  stage: 'decoding' | 'analyzing' | 'grouping' | 'complete' | 'error';
  progress: number; // 0 to 100
  message?: string;
}

export interface SequencerStep {
  id: string;
  note: string;       // e.g. "C4"
  durationBeats: number; // e.g. 0.5, 1, 2
  segment?: NoteSegment;
  isCustomPitched?: boolean;
  pitchShiftRatio?: number; // 1.0 = normal, 1.0594 = +1 semitone
}

export interface MelodyPreset {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  notes: { note: string; duration: number }[];
}
