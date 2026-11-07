// Basic tests for audio analyzer
import AudioAnalyzer from '../src/audio';

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
  });

  afterEach(() => {
    analyzer.cleanup();
  });

  test('should initialize with default state', () => {
    expect(analyzer.state.source).toBe('none');
    expect(analyzer.state.isPlaying).toBe(false);
    expect(analyzer.state.level).toBe(0);
    expect(analyzer.state.bass).toBe(0);
    expect(analyzer.state.mid).toBe(0);
    expect(analyzer.state.high).toBe(0);
  });

  test('should handle manual BPM setting', () => {
    analyzer.setManualBpm(130);
    expect(analyzer.state.manualBpm).toBe(130);
    
    // Should clamp to valid range
    analyzer.setManualBpm(300);
    expect(analyzer.state.manualBpm).toBeLessThanOrEqual(240);
    
    analyzer.setManualBpm(20);
    expect(analyzer.state.manualBpm).toBeGreaterThanOrEqual(40);
  });

  test('should calculate beat phase', () => {
    analyzer.setManualBpm(120);
    const phase = analyzer.getBeatPhase();
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });

  test('should update audio state gracefully with no source', () => {
    // Should not crash when no audio source is active
    analyzer.update();
    expect(analyzer.state.level).toBe(0);
    expect(analyzer.state.envelope).toBeLessThanOrEqual(0);
  });

  test('should stop all sources', () => {
    analyzer.stop();
    expect(analyzer.state.source).toBe('none');
    expect(analyzer.state.isPlaying).toBe(false);
    expect(analyzer.state.isMicActive).toBe(false);
    expect(analyzer.state.isSystemAudioActive).toBe(false);
  });

  test('should accumulate tap tempo', () => {
    const initialBpm = analyzer.state.manualBpm;
    
    // Single tap shouldn't change BPM yet
    analyzer.tapTempo();
    expect(analyzer.state.manualBpm).toBe(initialBpm);
    
    // Need multiple taps to establish tempo
    // (actual timing-based test would be flaky, so just verify it doesn't crash)
  });

  test('should handle envelope smoothing', () => {
    // Envelope should decrease towards zero when no signal
    analyzer.state.envelope = 1.0;
    analyzer.update();
    analyzer.update();
    analyzer.update();
    
    expect(analyzer.state.envelope).toBeLessThan(1.0);
    expect(analyzer.state.envelope).toBeGreaterThanOrEqual(0);
  });
});

export {};
