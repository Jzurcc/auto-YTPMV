// Note utilities for mapping between Frequency (Hz), MIDI Note numbers, and Note Names

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface NoteInfo {
  note: string;       // e.g. "C4"
  noteName: string;   // e.g. "C"
  octave: number;     // e.g. 4
  midi: number;       // e.g. 60
  targetFrequency: number; // e.g. 261.63
  isSharp: boolean;
  color: string;
}

// Harmonious color palette for 12 chromatic semitones
export const CHROMATIC_COLORS: Record<string, string> = {
  'C':  '#ef4444', // Red
  'C#': '#f97316', // Orange-red
  'D':  '#f59e0b', // Amber
  'D#': '#eab308', // Yellow
  'E':  '#84cc16', // Lime
  'F':  '#10b981', // Emerald
  'F#': '#06b6d4', // Cyan
  'G':  '#3b82f6', // Blue
  'G#': '#6366f1', // Indigo
  'A':  '#8b5cf6', // Violet
  'A#': '#d946ef', // Fuchsia
  'B':  '#ec4899', // Pink
};

/**
 * Calculate frequency in Hz from standard MIDI note number (A4 = 69 = 440Hz)
 */
export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Convert exact frequency in Hz to closest MIDI note and cents offset
 */
export function frequencyToMidi(frequency: number): { midi: number; cents: number; exactMidi: number } {
  if (frequency <= 0) return { midi: 0, cents: 0, exactMidi: 0 };
  const exactMidi = 12 * (Math.log(frequency / 440) / Math.LN2) + 69;
  const midi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - midi) * 100);
  return { midi, cents, exactMidi };
}

/**
 * Format MIDI note number to string like "C4", "F#3"
 */
export function midiToNoteName(midi: number): { note: string; noteName: string; octave: number; isSharp: boolean } {
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[noteIndex];
  const isSharp = noteName.includes('#');
  return {
    note: `${noteName}${octave}`,
    noteName,
    octave,
    isSharp,
  };
}

/**
 * Full analysis from frequency to Note details
 */
export function analyzeFrequency(frequency: number): NoteInfo & { cents: number } {
  const { midi, cents } = frequencyToMidi(frequency);
  const { note, noteName, octave, isSharp } = midiToNoteName(midi);
  const targetFrequency = midiToFrequency(midi);
  const color = CHROMATIC_COLORS[noteName] || '#38bdf8';

  return {
    note,
    noteName,
    octave,
    midi,
    targetFrequency,
    cents,
    isSharp,
    color,
  };
}

/**
 * Convert note name string (e.g. "C4", "A#3") to MIDI number
 */
export function noteNameToMidi(noteString: string): number | null {
  const match = noteString.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return null;
  let name = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);

  // Normalize flats to sharps
  const flatToSharp: Record<string, string> = {
    'DB': 'C#',
    'EB': 'D#',
    'GB': 'F#',
    'AB': 'G#',
    'BB': 'A#',
  };
  if (flatToSharp[name]) {
    name = flatToSharp[name];
  }

  const noteIndex = NOTE_NAMES.indexOf(name as any);
  if (noteIndex === -1) return null;

  return (octave + 1) * 12 + noteIndex;
}

/**
 * Generate a range of piano keys between startMidi and endMidi
 * Default: C3 (48) to C6 (84) = 3 full octaves
 */
export function generatePianoKeys(startMidi = 48, endMidi = 84): NoteInfo[] {
  const keys: NoteInfo[] = [];
  for (let m = startMidi; m <= endMidi; m++) {
    const { note, noteName, octave, isSharp } = midiToNoteName(m);
    keys.push({
      note,
      noteName,
      octave,
      midi: m,
      targetFrequency: midiToFrequency(m),
      isSharp,
      color: CHROMATIC_COLORS[noteName],
    });
  }
  return keys;
}

/**
 * Format duration in seconds to "00:03.45"
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const hundredths = Math.floor((secs - wholeSecs) * 100);
  return `${mins.toString().padStart(2, '0')}:${wholeSecs.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}
