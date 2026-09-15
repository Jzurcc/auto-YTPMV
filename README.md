# auto-YTPMV (PitchClip Studio) 🎵🎬

A 100% client-side React web tool that ingests video compilations, performs real-time audio pitch detection across video tracks, indexes every musical note time range, and lets you play your videos like an instrument or sequence them into hilarious music videos!

Zero server uploads. 100% private, client-side Web Audio DSP.

---

## ✨ Features

* **In-Browser Audio Pitch Detection (YIN Algorithm):**
  * Sub-sample fundamental frequency ($) tracking using the de Cheveigné & Kawahara YIN algorithm.
  * Native 16 kHz hardware-accelerated downsampling via OfflineAudioContext for 15x–25x speedup on long videos.
  * Dynamic silence skipping and 3-point median filtering to eliminate acoustic click spikes.
  * Gap-bridging (debouncing) and segment consolidation to preserve natural note sustain without fragmentation.
* **Tactile 3D Virtual Piano:**
  * Multi-octave piano keyboard displaying badge counters for keys with matching video clips.
  * Chromatic color coding with dynamic key glow on playback.
  * **Let Ring (Polyphonic Overlap) Mode:** Toggle between polyphonic sustain (notes ring out fully) and monophonic choke (new notes cut off previous audio).
* **Studio Video Monitor Stage:**
  * Sub-second accurate video segment seeking.
  * Live **Pitch HUD Overlay** displaying active Note, Frequency in Hz, and Cents deviation.
* **Indexed Video Pitch Library:**
  * Filter clips by chromatic note class (All, C, C#, D, etc.) or source video.
  * Search by note name or video title.
  * Sort by Clarity/Confidence, Pitch, Duration, or Timestamp order.
* **Melody Sequencer & Video Song Generator:**
  * Pre-loaded song presets:
    * *Megalovania* (Undertale)
    * *Twinkle Twinkle Little Star*
    * *Astronomia* (Coffin Dance)
    * *Ode to Joy* (Beethoven)
    * *Super Mario Bros Theme*
    * *Seven Nation Army Riff*
  * Step timeline auto-matching video clips to melody notes with proportional pitch-shifting (^{\Delta \text{semitones}/12}$).
  * Adjustable Tempo (60 to 200 BPM) with tempo-synced video cuts.
* **In-Browser Video Exporter:**
  * Compiles sequenced video cuts and audio into a downloadable .webm video file via HTML5 Canvas + MediaRecorder.
* **Built-in Audiovisual Demo Generator:**
  * Instant 1-click test pack synthesized in memory (Singing Cat, Neon 8-Bit Synth, Honk, Cybernetic Robot Beep).

---

## 🏗️ Architecture & Tech Stack

* **Frontend:** React 19, TypeScript, Vite
* **Styling:** Vanilla CSS with custom glassmorphism, responsive grids, and design tokens
* **Audio DSP:** Web Audio API (AudioContext, OfflineAudioContext, AudioBufferSourceNode), YIN Algorithm
* **Video & Canvas:** HTML5 Video, Canvas 2D API, MediaRecorder API
* **Icons & Polish:** Lucide React, Canvas Confetti

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* npm (v9 or higher)

### Installation

1. Clone the repository:
   `ash
   git clone https://github.com/Jzurcc/auto-YTPMV.git
   cd auto-YTPMV
   `

2. Install dependencies:
   `ash
   npm install
   `

3. Start the development server:
   `ash
   npm run dev
   `
   Open your browser to http://localhost:5173.

4. Build for production:
   `ash
   npm run build
   `

---

## 📄 License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
