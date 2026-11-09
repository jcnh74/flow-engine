// Audio analysis and beat detection system
// Uses Web Audio API for local file playback and optional microphone input

export interface AudioState {
  isPlaying: boolean;
  isMicActive: boolean;
  isSystemAudioActive: boolean;
  source: 'none' | 'file' | 'mic' | 'system';
  fileName: string;
  currentTime: number;
  duration: number;
  bpm: number;
  manualBpm: number;
  beatDetected: boolean;
  beatPhase: number;  // 0-1 phase within beat cycle
  bar: number;        // Current bar (0, 1, 2, 3, ...)
  barPhase: number;   // 0-1 phase within bar (4 beats)
  phrase: number;     // Current phrase (0, 1, 2, 3, ...)
  level: number;      // overall amplitude 0-1
  bass: number;       // low freq 0-1
  mid: number;        // mid freq 0-1
  high: number;       // high freq 0-1
  envelope: number;   // smoothed amplitude for modulation
  // Smoothed envelopes (attack/release)
  kickEnv: number;    // smoothed kick envelope
  snareEnv: number;   // smoothed snare envelope
  hatEnv: number;     // smoothed hat envelope
  bassEnv: number;    // smoothed bass envelope
  midEnv: number;     // smoothed mid envelope
  highEnv: number;    // smoothed high envelope
  onset: number;      // decaying impulse on any onset
  // Enhanced drum detection
  kick: number;       // kick drum presence 0-1
  snare: number;      // snare drum presence 0-1
  hat: number;        // hi-hat presence 0-1
  kickDetected: boolean;
  snareDetected: boolean;
  hatDetected: boolean;
  // Beat-division envelopes
  envelope8th: number;  // 8th note envelope
  envelope16th: number; // 16th note envelope
  envelope32nd: number; // 32nd note envelope
  systemAudioSupported: boolean;
  systemAudioError: string;
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private micStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  
  private freqData: Uint8Array = new Uint8Array(1024);
  private timeData: Uint8Array = new Uint8Array(1024);
  
  private beatHistory: number[] = [];
  private lastBeatTime = 0;
  private beatThreshold = 0.6;
  
  // Drum detection tracking
  private lastKickTime = 0;
  private lastSnareTime = 0;
  private lastHatTime = 0;
  private kickThreshold = 0.65;
  private snareThreshold = 0.55;
  private hatThreshold = 0.45;
  
  // Beat-division tracking
  private last8thTime = 0;
  private last16thTime = 0;
  private last32ndTime = 0;
  
  public state: AudioState = {
    isPlaying: false,
    isMicActive: false,
    isSystemAudioActive: false,
    source: 'none',
    fileName: '',
    currentTime: 0,
    duration: 0,
    bpm: 120,
    manualBpm: 120,
    beatDetected: false,
    beatPhase: 0,
    bar: 0,
    barPhase: 0,
    phrase: 0,
    level: 0,
    bass: 0,
    mid: 0,
    high: 0,
    envelope: 0,
    kickEnv: 0,
    snareEnv: 0,
    hatEnv: 0,
    bassEnv: 0,
    midEnv: 0,
    highEnv: 0,
    onset: 0,
    kick: 0,
    snare: 0,
    hat: 0,
    kickDetected: false,
    snareDetected: false,
    hatDetected: false,
    envelope8th: 0,
    envelope16th: 0,
    envelope32nd: 0,
    systemAudioSupported: this.checkSystemAudioSupport(),
    systemAudioError: ''
  };
  
  constructor() {
    // Initialize on user interaction
  }
  
  private checkSystemAudioSupport(): boolean {
    // Check for getDisplayMedia with audio support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      return false;
    }
    // Chrome 141+ on macOS 14.2+ supports windowAudio
    // We'll attempt and handle gracefully if unsupported
    return true;
  }
  
  private ensureContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.7;
      // DO NOT connect analyser to destination here - it causes doubling
      // File playback connects in loadFile, mic/system are analysis-only
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.fftSize);
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
  
  async loadFile(file: File) {
    try {
      this.stop();
      this.ensureContext();
      
      const url = URL.createObjectURL(file);
      this.audioElement = new Audio(url);
      this.audioElement.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        this.audioElement!.addEventListener('loadedmetadata', resolve, { once: true });
        this.audioElement!.addEventListener('error', reject, { once: true });
        this.audioElement!.load();
      });
      
      this.source = this.audioContext!.createMediaElementSource(this.audioElement);
      this.source.connect(this.analyser!);
      // Connect to destination so file playback is audible
      this.analyser!.connect(this.audioContext!.destination);
      
      this.state.source = 'file';
      this.state.fileName = file.name;
      this.state.duration = this.audioElement.duration;
      this.state.currentTime = 0;
      
      return true;
    } catch (err) {
      console.error('Failed to load audio file:', err);
      this.state.source = 'none';
      return false;
    }
  }
  
  async enableMicrophone() {
    try {
      this.stop();
      this.ensureContext();
      
      this.micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      this.source = this.audioContext!.createMediaStreamSource(this.micStream);
      this.source.connect(this.analyser!);
      
      this.state.source = 'mic';
      this.state.isMicActive = true;
      this.state.isPlaying = true;
      
      return true;
    } catch (err) {
      console.error('Microphone access denied:', err);
      this.state.isMicActive = false;
      this.state.source = 'none';
      return false;
    }
  }
  
  async enableSystemAudio() {
    try {
      this.stop();
      this.ensureContext();
      
      // Request display media with system audio
      // Chrome 141+ on macOS 14.2+ supports windowAudio parameter
      const constraints: any = {
        video: true,  // Required by spec even if we only want audio
        audio: true
      };
      
      // Try to request system audio via windowAudio hint (Chrome 141+)
      // This is a hint; browsers that don't support it will ignore it
      (constraints as any).windowAudio = 'system';
      
      this.systemStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      // Check if we actually got an audio track
      const audioTracks = this.systemStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track in system capture. Make sure to check "Share audio" in the picker dialog.');
      }
      
      this.source = this.audioContext!.createMediaStreamSource(this.systemStream);
      this.source.connect(this.analyser!);
      
      // Listen for track ending (user stopped sharing)
      audioTracks[0].addEventListener('ended', () => {
        this.state.systemAudioError = 'System audio sharing stopped';
        this.stop();
      });
      
      this.state.source = 'system';
      this.state.isSystemAudioActive = true;
      this.state.isPlaying = true;
      this.state.systemAudioError = '';
      
      return true;
    } catch (err: any) {
      console.error('System audio capture failed:', err);
      this.state.isSystemAudioActive = false;
      this.state.source = 'none';
      
      if (err.name === 'NotAllowedError') {
        this.state.systemAudioError = 'Permission denied. Please allow screen recording and ensure "Share audio" is checked.';
      } else if (err.name === 'NotSupportedError') {
        this.state.systemAudioError = 'System audio not supported. Requires Chrome 141+ on macOS 14.2+';
      } else {
        this.state.systemAudioError = err.message || 'System audio capture failed';
      }
      
      return false;
    }
  }
  
  play() {
    if (this.state.source === 'file' && this.audioElement) {
      this.ensureContext();
      this.audioElement.play();
      this.state.isPlaying = true;
    }
  }
  
  pause() {
    if (this.state.source === 'file' && this.audioElement) {
      this.audioElement.pause();
      this.state.isPlaying = false;
    }
  }
  
  stop() {
    // Disconnect analyser from destination to prevent audio playback
    if (this.analyser && this.audioContext) {
      try {
        this.analyser.disconnect();
      } catch (e) {
        // Already disconnected, ignore
      }
    }
    
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      if (this.source && this.source instanceof MediaElementAudioSourceNode) {
        this.source.disconnect();
      }
      this.audioElement = null;
    }
    
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      if (this.source && this.source instanceof MediaStreamAudioSourceNode) {
        this.source.disconnect();
      }
      this.micStream = null;
      this.state.isMicActive = false;
    }
    
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(track => track.stop());
      if (this.source && this.source instanceof MediaStreamAudioSourceNode) {
        this.source.disconnect();
      }
      this.systemStream = null;
      this.state.isSystemAudioActive = false;
    }
    
    this.source = null;
    this.state.isPlaying = false;
    this.state.source = 'none';
    this.state.fileName = '';
  }
  
  setManualBpm(bpm: number) {
    this.state.manualBpm = Math.max(40, Math.min(240, bpm));
  }
  
  tapTempo() {
    const now = performance.now();
    if (this.beatHistory.length > 0 && now - this.beatHistory[this.beatHistory.length - 1] > 2000) {
      this.beatHistory = [];
    }
    this.beatHistory.push(now);
    if (this.beatHistory.length > 8) this.beatHistory.shift();
    
    if (this.beatHistory.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < this.beatHistory.length; i++) {
        intervals.push(this.beatHistory[i] - this.beatHistory[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      this.state.manualBpm = Math.round(60000 / avgInterval);
    }
  }
  
  update() {
    if (!this.analyser || this.state.source === 'none') {
      this.state.level = 0;
      this.state.bass = 0;
      this.state.mid = 0;
      this.state.high = 0;
      this.state.beatDetected = false;
      this.state.envelope = Math.max(0, this.state.envelope * 0.95);
      return;
    }
    
    // Update time for file playback
    if (this.audioElement && this.state.source === 'file') {
      this.state.currentTime = this.audioElement.currentTime;
      if (this.audioElement.ended) {
        this.state.isPlaying = false;
      }
    }
    
    this.analyser.getByteFrequencyData(this.freqData as any);
    this.analyser.getByteTimeDomainData(this.timeData as any);
    
    // Calculate frequency bands
    const bins = this.freqData.length;
    const bassEnd = Math.floor(bins * 0.1);
    const midEnd = Math.floor(bins * 0.4);
    
    // Sub-bass for kick (20-80 Hz)
    const kickEnd = Math.floor(bins * 0.04);
    // Snare range (150-300 Hz)
    const snareStart = Math.floor(bins * 0.08);
    const snareEnd = Math.floor(bins * 0.15);
    // Hi-hat range (6-12 kHz)
    const hatStart = Math.floor(bins * 0.6);
    const hatEnd = Math.floor(bins * 0.8);
    
    let bassSum = 0, midSum = 0, highSum = 0;
    let kickSum = 0, snareSum = 0, hatSum = 0;
    
    for (let i = 0; i < bassEnd; i++) bassSum += this.freqData[i];
    for (let i = bassEnd; i < midEnd; i++) midSum += this.freqData[i];
    for (let i = midEnd; i < bins; i++) highSum += this.freqData[i];
    
    for (let i = 0; i < kickEnd; i++) kickSum += this.freqData[i];
    for (let i = snareStart; i < snareEnd; i++) snareSum += this.freqData[i];
    for (let i = hatStart; i < hatEnd; i++) hatSum += this.freqData[i];
    
    this.state.bass = (bassSum / bassEnd) / 255;
    this.state.mid = (midSum / (midEnd - bassEnd)) / 255;
    this.state.high = (highSum / (bins - midEnd)) / 255;
    
    // Smooth drum signals
    const kickRaw = (kickSum / kickEnd) / 255;
    const snareRaw = (snareSum / (snareEnd - snareStart)) / 255;
    const hatRaw = (hatSum / (hatEnd - hatStart)) / 255;
    
    this.state.kick = this.state.kick * 0.7 + kickRaw * 0.3;
    this.state.snare = this.state.snare * 0.7 + snareRaw * 0.3;
    this.state.hat = this.state.hat * 0.7 + hatRaw * 0.3;
    
    // Overall level
    let sum = 0;
    for (let i = 0; i < bins; i++) sum += this.freqData[i];
    this.state.level = (sum / bins) / 255;
    
    // Smooth envelope
    this.state.envelope = this.state.envelope * 0.9 + this.state.level * 0.1;
    
    // Smoothed envelopes with attack/release
    const attackRate = 0.3;  // Fast attack
    const releaseRate = 0.92; // Slower release
    
    this.state.kickEnv = this.state.kick > this.state.kickEnv 
      ? this.state.kickEnv + (this.state.kick - this.state.kickEnv) * attackRate
      : this.state.kickEnv * releaseRate;
    
    this.state.snareEnv = this.state.snare > this.state.snareEnv
      ? this.state.snareEnv + (this.state.snare - this.state.snareEnv) * attackRate
      : this.state.snareEnv * releaseRate;
    
    this.state.hatEnv = this.state.hat > this.state.hatEnv
      ? this.state.hatEnv + (this.state.hat - this.state.hatEnv) * attackRate
      : this.state.hatEnv * releaseRate;
    
    this.state.bassEnv = this.state.bass > this.state.bassEnv
      ? this.state.bassEnv + (this.state.bass - this.state.bassEnv) * attackRate
      : this.state.bassEnv * releaseRate;
    
    this.state.midEnv = this.state.mid > this.state.midEnv
      ? this.state.midEnv + (this.state.mid - this.state.midEnv) * attackRate
      : this.state.midEnv * releaseRate;
    
    this.state.highEnv = this.state.high > this.state.highEnv
      ? this.state.highEnv + (this.state.high - this.state.highEnv) * attackRate
      : this.state.highEnv * releaseRate;
    
    // Onset detection (decaying impulse)
    this.state.onset *= 0.85; // Decay
    
    // Beat detection (simple energy-based)
    const energy = this.state.bass * 2 + this.state.mid;
    const now = performance.now();
    
    if (energy > this.beatThreshold && now - this.lastBeatTime > 200) {
      this.state.beatDetected = true;
      this.lastBeatTime = now;
      this.state.onset = 1.0; // Trigger onset impulse
      
      // Update estimated BPM from detected beats
      if (this.beatHistory.length > 0 && now - this.beatHistory[this.beatHistory.length - 1] < 2000) {
        const interval = now - this.beatHistory[this.beatHistory.length - 1];
        const detectedBpm = 60000 / interval;
        if (detectedBpm > 40 && detectedBpm < 240) {
          this.state.bpm = Math.round(this.state.bpm * 0.8 + detectedBpm * 0.2);
        }
      }
    } else {
      this.state.beatDetected = false;
    }
    
    // Kick detection (sub-bass spike)
    if (this.state.kick > this.kickThreshold && now - this.lastKickTime > 150) {
      this.state.kickDetected = true;
      this.lastKickTime = now;
      this.state.onset = Math.max(this.state.onset, 1.0); // Trigger onset impulse
    } else {
      this.state.kickDetected = false;
    }
    
    // Snare detection (mid-range transient)
    if (this.state.snare > this.snareThreshold && now - this.lastSnareTime > 180) {
      this.state.snareDetected = true;
      this.lastSnareTime = now;
    } else {
      this.state.snareDetected = false;
    }
    
    // Hi-hat detection (high-freq presence)
    if (this.state.hat > this.hatThreshold && now - this.lastHatTime > 80) {
      this.state.hatDetected = true;
      this.lastHatTime = now;
    } else {
      this.state.hatDetected = false;
    }
    
    // Beat-division envelopes based on manual BPM
    const beatInterval = 60000 / this.state.manualBpm;
    const eighth = beatInterval / 2;  // 8th note
    const sixteenth = beatInterval / 4;  // 16th note
    const thirtysecond = beatInterval / 8;  // 32nd note
    
    // 8th note envelope
    if (now - this.last8thTime > eighth) {
      this.last8thTime = now;
      this.state.envelope8th = 1.0;
    } else {
      // Exponential decay
      const elapsed = now - this.last8thTime;
      this.state.envelope8th = Math.max(0, 1.0 - (elapsed / eighth));
    }
    
    // 16th note envelope
    if (now - this.last16thTime > sixteenth) {
      this.last16thTime = now;
      this.state.envelope16th = 1.0;
    } else {
      const elapsed = now - this.last16thTime;
      this.state.envelope16th = Math.max(0, 1.0 - (elapsed / sixteenth));
    }
    
    // 32nd note envelope
    if (now - this.last32ndTime > thirtysecond) {
      this.last32ndTime = now;
      this.state.envelope32nd = 1.0;
    } else {
      const elapsed = now - this.last32ndTime;
      this.state.envelope32nd = Math.max(0, 1.0 - (elapsed / thirtysecond));
    }
    
    // Update beatPhase and calculate bar/phrase
    this.state.beatPhase = (now % beatInterval) / beatInterval;
    const totalBeats = Math.floor(now / beatInterval);
    this.state.bar = Math.floor(totalBeats / 4);
    this.state.barPhase = ((totalBeats % 4) + this.state.beatPhase) / 4.0;
    this.state.phrase = Math.floor(totalBeats / 16);
  }
  
  getBeatPhase(): number {
    // Returns 0-1 based on manual BPM timing
    const beatInterval = 60000 / this.state.manualBpm;
    return (performance.now() % beatInterval) / beatInterval;
  }
  
  cleanup() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}

export default AudioAnalyzer;
