// WebGL grain overlay — full-screen quad on a transparent canvas stacked above the game canvas.
// Grain seed shifts each frame so the texture feels alive rather than frozen.

const VERT_SRC = `
  attribute vec2 a_pos;
  varying   vec2 v_uv;
  void main() {
    v_uv        = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`

const FRAG_SRC = `
  precision mediump float;
  uniform float u_time;
  uniform float u_grain;
  uniform float u_brightness;
  varying vec2  v_uv;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    // Cycling grain offset — tricks eye into seeing a moving, painted surface
    vec2  offset = vec2(rand(vec2(u_time, 0.0)), rand(vec2(0.0, u_time)));
    float grain  = rand(v_uv + offset) * 2.0 - 1.0;

    // Vignette — edges darken subtly, draws focus to centre
    vec2  center = v_uv - 0.5;
    float vign   = 1.0 - dot(center, center) * 1.6;
    vign         = clamp(vign, 0.0, 1.0);

    // Final alpha: grain darkens by u_grain amount, vignette dims edges
    float alpha  = grain * u_grain * (1.0 - vign * 0.4);

    gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(-alpha, 0.0, 0.25));
  }
`

export class PostProcessor {
  private gl: WebGLRenderingContext | null = null
  private prog: WebGLProgram | null = null
  private uTime = 0
  private uGrain = 0
  private uBright = 0
  private buf: WebGLBuffer | null = null

  init(canvas: HTMLCanvasElement): boolean {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
    if (!gl) return false
    this.gl = gl

    const vert = this._compile(gl.VERTEX_SHADER, VERT_SRC)
    const frag = this._compile(gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vert || !frag) return false

    this.prog = gl.createProgram()!
    gl.attachShader(this.prog, vert)
    gl.attachShader(this.prog, frag)
    gl.linkProgram(this.prog)
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) return false

    this.uTime   = gl.getUniformLocation(this.prog, 'u_time') as number
    this.uGrain  = gl.getUniformLocation(this.prog, 'u_grain') as number
    this.uBright = gl.getUniformLocation(this.prog, 'u_brightness') as number

    // Full-screen quad
    this.buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    return true
  }

  render(time: number, colorLevel: number) {
    const gl = this.gl
    if (!gl || !this.prog) return

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.prog)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    const loc = gl.getAttribLocation(this.prog, 'a_pos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    // Grain intensity — subtle at all levels, breathes with color
    const grainAmt = 0.08 + colorLevel * 0.012
    gl.uniform1f(this.uTime as WebGLUniformLocation, (time * 0.08) % 1.0)
    gl.uniform1f(this.uGrain as WebGLUniformLocation, grainAmt)
    gl.uniform1f(this.uBright as WebGLUniformLocation, colorLevel / 4)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  resize(w: number, h: number) {
    if (!this.gl) return
    this.gl.canvas.width  = w
    this.gl.canvas.height = h
  }

  private _compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl!
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null }
    return sh
  }
}
