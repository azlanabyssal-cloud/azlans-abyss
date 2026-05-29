// A minor pentatonic — 3 octaves, feels musical at any tempo
const PENTA: number[] = [
  220.00, 261.63, 329.63, 392.00, 523.25,   // A3 C4 E4 G4 C5
  659.25, 784.00, 1046.5, 1318.5, 1568.0,   // E5 G5 C6 E6 G6
  2093.0, 2637.0,                             // C7 E7
]

export class AudioEngine {
  private ctx:          AudioContext | null = null
  private master:       GainNode     | null = null
  private bus:          GainNode     | null = null   // pre-master mix bus
  private droneOsc:     OscillatorNode | null = null
  private droneGain:    GainNode       | null = null
  private ambOsc1:      OscillatorNode | null = null
  private ambOsc2:      OscillatorNode | null = null
  private ambGain:      GainNode       | null = null
  private initialized = false

  init() {
    if (this.initialized) return
    this.initialized = true
    this.ctx    = new AudioContext()

    // Signal chain: bus → compressor → master → out
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value      = 10
    comp.ratio.value     = 3.5
    comp.attack.value    = 0.002
    comp.release.value   = 0.12

    this.master = this.ctx.createGain()
    this.master.gain.value = 0.52
    this.bus    = this.ctx.createGain()
    this.bus.gain.value = 1.0

    this.bus.connect(comp)
    comp.connect(this.master)
    this.master.connect(this.ctx.destination)

    this._startDrone()
    this._startAmbient()
  }

  // ─── helpers ────────────────────────────────────────────────────────────

  private _out(): AudioNode { return this.bus! }

  // One-shot note: type, freq, vol, attack, sustain, release
  private _note(
    type: OscillatorType,
    freq: number,
    vol: number,
    atk: number,
    hold: number,
    rel: number,
    freqEnd?: number,
    offset = 0,
  ) {
    if (!this.ctx || !this.bus) return
    const t   = this.ctx.currentTime + offset
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + atk + hold)
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(vol, t + atk)
    gain.gain.setValueAtTime(vol, t + atk + hold)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + atk + hold + rel)
    osc.connect(gain)
    gain.connect(this._out())
    osc.start(t)
    osc.stop(t + atk + hold + rel + 0.05)
  }

  // Noise burst — for impact texture
  private _noise(vol: number, dur: number, lpFreq: number, offset = 0) {
    if (!this.ctx || !this.bus) return
    const t       = this.ctx.currentTime + offset
    const bufSize = Math.ceil(this.ctx.sampleRate * dur)
    const buf     = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const data    = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

    const src  = this.ctx.createBufferSource()
    const filt = this.ctx.createBiquadFilter()
    const gain = this.ctx.createGain()

    src.buffer = buf
    filt.type  = 'lowpass'
    filt.frequency.value = lpFreq

    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    src.connect(filt)
    filt.connect(gain)
    gain.connect(this._out())
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  // Echo tail — repeated decaying copies give cheap but effective reverb
  private _echo(
    type: OscillatorType,
    freq: number,
    vol: number,
    atk: number,
    rel: number,
    delay: number,
    times: number,
    decay: number,
    offset = 0,
  ) {
    for (let i = 0; i < times; i++) {
      this._note(type, freq, vol * Math.pow(decay, i), atk, 0, rel, undefined, offset + i * delay)
    }
  }

  // ─── drone / ambient ────────────────────────────────────────────────────

  private _startDrone() {
    if (!this.ctx || !this.bus) return
    this.droneOsc  = this.ctx.createOscillator()
    this.droneGain = this.ctx.createGain()
    this.droneOsc.type = 'sine'
    this.droneOsc.frequency.value = 55   // A1 sub bass
    this.droneGain.gain.value = 0.05
    this.droneOsc.connect(this.droneGain)
    this.droneGain.connect(this._out())
    this.droneOsc.start()
  }

  private _startAmbient() {
    if (!this.ctx || !this.bus) return

    // Two detuned oscillators for a shimmering pad
    this.ambOsc1  = this.ctx.createOscillator()
    this.ambOsc2  = this.ctx.createOscillator()
    this.ambGain  = this.ctx.createGain()

    this.ambOsc1.type = 'triangle'
    this.ambOsc2.type = 'sine'
    this.ambOsc1.frequency.value = 110      // A2
    this.ambOsc2.frequency.value = 110.6   // slightly detuned → slow chorus beat
    this.ambGain.gain.value = 0.0

    this.ambOsc1.connect(this.ambGain)
    this.ambOsc2.connect(this.ambGain)
    this.ambGain.connect(this._out())
    this.ambOsc1.start()
    this.ambOsc2.start()
  }

  // ─── gameplay sounds ────────────────────────────────────────────────────

  // Jump — quick ascending whoosh, the whole satisfying feel of the tap
  playJump() {
    if (!this.ctx) return
    // Fast ascending sine: low to mid
    this._note('sine',     180, 0.16, 0.015, 0.0, 0.14, 400)
    // Upper harmonic air texture
    this._note('triangle', 360, 0.05, 0.01,  0.0, 0.10, 800)
  }

  // Landing — soft thud
  playLand() {
    if (!this.ctx) return
    this._note('triangle', 120, 0.10, 0.005, 0.0, 0.10, 55)
    this._noise(0.04, 0.08, 300)
  }

  // Flip chime — pentatonic, with echo tail for spatial depth
  playChime(comboLevel: number) {
    if (!this.ctx) return
    const freq = PENTA[comboLevel % PENTA.length]
    const vol  = Math.min(0.30, 0.13 + comboLevel * 0.012)
    const type: OscillatorType = comboLevel < 6 ? 'sine' : 'triangle'

    // Primary note
    this._note(type, freq, vol, 0.008, 0.0, 0.55)
    // Echo tail — two quieter repeats create a natural reverb feel
    this._echo(type, freq, vol * 0.28, 0.002, 0.4, 0.11, 2, 0.5)
    // Octave shimmer above — subtle sparkle
    this._note('sine', freq * 2, vol * 0.08, 0.008, 0.0, 0.30)
  }

  // Perfect landing — bell-like A minor chord, arpeggiated upward
  playPerfectLanding() {
    if (!this.ctx) return
    const chord = [220, 329.63, 440, 659.25, 880]
    chord.forEach((f, i) => {
      this._note('sine', f, 0.16 - i * 0.02, 0.01, 0.0, 0.9, undefined, i * 0.032)
      // Echo on each note
      this._note('sine', f, 0.04,  0.01, 0.0, 0.6, undefined, i * 0.032 + 0.14)
    })
    this._noise(0.03, 0.12, 600)
  }

  // Flow Burst — sweeping chord cascade, full spectrum
  playFlowBurst() {
    if (!this.ctx) return
    const freqs = [220, 329.63, 440, 659.25, 880, 1318.5]
    freqs.forEach((f, i) => {
      const off = i * 0.055
      this._note('sine',     f,     0.18, 0.02, 0.04, 1.2, f * 1.01, off)
      this._note('triangle', f * 2, 0.06, 0.02, 0.0,  0.8, undefined, off + 0.08)
    })
  }

  // Crash — falling pitch + white noise crunch
  playCrash() {
    if (!this.ctx) return
    // Sawtooth tumble
    this._note('sawtooth', 220, 0.22, 0.005, 0.0, 0.6, 28)
    // Heavy low hit
    this._note('triangle', 80,  0.15, 0.002, 0.0, 0.4, 30)
    // Crunch noise
    this._noise(0.25, 0.25, 800)
    this._noise(0.10, 0.45, 200)
  }

  // ambient volume + pitch track color level
  updateAmbient(colorLevel: number) {
    if (!this.ambGain || !this.ctx) return
    const t   = this.ctx.currentTime
    const vol = colorLevel * 0.038
    this.ambGain.gain.linearRampToValueAtTime(vol, t + 0.6)

    const base = 110 * (1 + colorLevel * 0.14)
    this.ambOsc1?.frequency.linearRampToValueAtTime(base,       t + 0.6)
    this.ambOsc2?.frequency.linearRampToValueAtTime(base + 0.7, t + 0.6)

    // Drone deepens slightly at higher levels
    this.droneOsc?.frequency.linearRampToValueAtTime(55 * (1 + colorLevel * 0.04), t + 0.6)
  }

  // Coin pickup — bright, short, satisfying
  playCoin() {
    if (!this.ctx) return
    this._note('sine', 987.77, 0.09, 0.004, 0.0, 0.14)    // B5
    this._note('sine', 1975.5, 0.03, 0.004, 0.0, 0.09, undefined, 0.02) // B6 shimmer
  }

  resume() { this.ctx?.resume() }
  resetCombo() {}  // no-op — chime pitch is auto-derived from comboLevel
}
