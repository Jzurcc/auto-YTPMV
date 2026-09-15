import type { TimbreProfile, TimbreCharacter } from '../../types';

/**
 * Timbre Analyzer: Extracts acoustic texture, spectral centroid (brightness),
 * attack envelope, and crest factor to quantify the "nature" of a sound.
 */

export function analyzeTimbre(pcmData: Float32Array, sampleRate: number): TimbreProfile {
  const len = pcmData.length;
  if (len < 64) {
    return {
      spectralCentroid: 1000,
      brightness: 0.5,
      attackTimeMs: 50,
      isPercussive: false,
      character: 'Harmonic Formant',
      vector: [0.5, 0.5, 0.5],
    };
  }

  // 1. Attack Envelope & Peak Analysis
  let peakVal = 0;
  let peakIdx = 0;
  let sumSq = 0;

  for (let i = 0; i < len; i++) {
    const abs = Math.abs(pcmData[i]);
    sumSq += abs * abs;
    if (abs > peakVal) {
      peakVal = abs;
      peakIdx = i;
    }
  }

  const rms = Math.sqrt(sumSq / len);
  const crestFactor = peakVal / Math.max(1e-5, rms);
  const attackTimeMs = (peakIdx / sampleRate) * 1000;

  // Check how fast it decays after peak (transient vs sustained)
  let postPeakSum = 0;
  const postPeakSamples = Math.min(len - peakIdx, Math.floor(sampleRate * 0.06)); // 60ms post-peak
  if (postPeakSamples > 10) {
    for (let i = peakIdx; i < peakIdx + postPeakSamples; i++) {
      postPeakSum += Math.abs(pcmData[i]);
    }
    const postPeakAvg = postPeakSum / postPeakSamples;
    var isPercussive = attackTimeMs < 25 && postPeakAvg < peakVal * 0.45;
  } else {
    var isPercussive = attackTimeMs < 20 && crestFactor > 3.8;
  }

  // 2. Spectral Centroid (Center of Mass of Frequency Spectrum)
  // Use a 512-sample representative slice around the peak / center
  const fftSize = Math.min(512, Math.pow(2, Math.floor(Math.log2(len))));
  const startIdx = Math.max(0, Math.min(peakIdx - Math.floor(fftSize / 4), len - fftSize));
  
  // Compute magnitudes across frequency bins
  const halfFft = Math.floor(fftSize / 2);
  let numSum = 0;
  let denSum = 0;
  const binWidth = sampleRate / fftSize;

  // Discrete Fourier Transform on the 512 slice
  for (let k = 1; k < halfFft; k++) {
    let re = 0;
    let im = 0;
    const freq = k * binWidth;

    for (let n = 0; n < fftSize; n++) {
      // Apply Hann window
      const windowVal = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
      const sample = pcmData[startIdx + n] * windowVal;
      const angle = (2 * Math.PI * k * n) / fftSize;
      re += sample * Math.cos(angle);
      im -= sample * Math.sin(angle);
    }

    const mag = Math.sqrt(re * re + im * im);
    numSum += freq * mag;
    denSum += mag;
  }

  const spectralCentroid = denSum > 1e-4 ? numSum / denSum : 1000;
  
  // Normalize brightness: 300Hz (dark/warm) to 3000Hz (bright/sharp)
  const brightness = Math.min(1.0, Math.max(0.0, (spectralCentroid - 300) / 2700));
  const attackNorm = Math.min(1.0, Math.max(0.0, attackTimeMs / 120));
  const crestNorm = Math.min(1.0, Math.max(0.0, (crestFactor - 1.5) / 4.0));

  // 3. Timbre Character Classification
  let character: TimbreCharacter;
  if (isPercussive || crestFactor > 4.2) {
    character = 'Percussive Attack';
  } else if (brightness < 0.35) {
    character = 'Warm Sustained';
  } else if (brightness > 0.65) {
    character = 'Bright Sustained';
  } else {
    character = 'Harmonic Formant';
  }

  return {
    spectralCentroid: Math.round(spectralCentroid),
    brightness,
    attackTimeMs: Math.round(attackTimeMs),
    isPercussive,
    character,
    vector: [brightness, attackNorm, crestNorm],
  };
}

/**
 * Calculates acoustic distance between two timbre profiles (0.0 = identical texture, 1.0 = highly contrasting)
 */
export function calculateTimbreDistance(a?: TimbreProfile, b?: TimbreProfile): number {
  if (!a || !b) return 0.5;

  const dBrightness = a.vector[0] - b.vector[0];
  const dAttack = a.vector[1] - b.vector[1];
  const dCrest = a.vector[2] - b.vector[2];

  // Weight brightness (tone color) highest, then envelope, then crest
  const distSq = 0.5 * (dBrightness * dBrightness) +
                 0.3 * (dAttack * dAttack) +
                 0.2 * (dCrest * dCrest);

  return Math.min(1.0, Math.sqrt(distSq));
}
