/**
 * YIN Pitch Detection Algorithm implementation in TypeScript
 * Reference: De Cheveigné, A., & Kawahara, H. (2002). 
 * YIN, a fundamental frequency estimator for speech and music.
 */

export interface PitchResult {
  frequency: number; // in Hz, 0 if unpitched / silence
  confidence: number;// 0.0 to 1.0 (1.0 = pure periodic wave, 0 = noise/unvoiced)
  rms: number;       // Root Mean Square amplitude
}

export class YinPitchDetector {
  private sampleRate: number;
  private threshold: number;
  private minFreq: number;
  private maxFreq: number;

  constructor(
    sampleRate = 44100,
    threshold = 0.15,
    minFreq = 50,    // ~G1
    maxFreq = 2000   // ~B6
  ) {
    this.sampleRate = sampleRate;
    this.threshold = threshold;
    this.minFreq = minFreq;
    this.maxFreq = maxFreq;
  }

  /**
   * Detect pitch on a slice of PCM Float32Array audio buffer
   */
  public detect(buffer: Float32Array): PitchResult {
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);

    // 1. Calculate RMS energy to detect silence
    let sumSquares = 0;
    for (let i = 0; i < bufferSize; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / bufferSize);
    if (rms < 0.008) {
      // Silence or near-silence
      return { frequency: 0, confidence: 0, rms };
    }

    // Tau limits based on min/max frequency
    const minTau = Math.max(2, Math.floor(this.sampleRate / this.maxFreq));
    const maxTau = Math.min(halfBufferSize, Math.ceil(this.sampleRate / this.minFreq));

    // 2. Step 1: Difference function d(tau)
    const diff = new Float32Array(halfBufferSize);
    for (let tau = 0; tau < halfBufferSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // 3. Step 2: Cumulative mean normalized difference function d'(tau)
    const cmndf = new Float32Array(halfBufferSize);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
    }

    // 4. Step 3: Absolute thresholding
    let tauEstimate = -1;
    for (let tau = minTau; tau < maxTau; tau++) {
      if (cmndf[tau] < this.threshold) {
        // Find the local minimum in this valley
        while (tau + 1 < maxTau && cmndf[tau + 1] < cmndf[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // If no tau was under threshold, find global minimum in range
    if (tauEstimate === -1) {
      let minVal = Infinity;
      let minTauIndex = -1;
      for (let tau = minTau; tau < maxTau; tau++) {
        if (cmndf[tau] < minVal) {
          minVal = cmndf[tau];
          minTauIndex = tau;
        }
      }
      // If the global minimum is still too high (poor periodicity), reject as noise
      if (minVal > 0.45) {
        return { frequency: 0, confidence: Math.max(0, 1 - minVal), rms };
      }
      tauEstimate = minTauIndex;
    }

    // 5. Step 4: Parabolic interpolation for sub-sample accuracy
    let betterTau = tauEstimate;
    if (tauEstimate > 0 && tauEstimate < halfBufferSize - 1) {
      const s0 = cmndf[tauEstimate - 1];
      const s1 = cmndf[tauEstimate];
      const s2 = cmndf[tauEstimate + 1];
      const denominator = 2 * (2 * s1 - s2 - s0);
      if (Math.abs(denominator) > 1e-6) {
        betterTau = tauEstimate + (s2 - s0) / denominator;
      }
    }

    const frequency = this.sampleRate / betterTau;
    const confidence = Math.min(1.0, Math.max(0.0, 1 - cmndf[tauEstimate]));

    // Discard outside plausible range
    if (frequency < this.minFreq || frequency > this.maxFreq) {
      return { frequency: 0, confidence: 0, rms };
    }

    return { frequency, confidence, rms };
  }
}
