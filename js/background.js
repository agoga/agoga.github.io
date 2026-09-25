// The portfolio never depends on this optional effect.
const SETTINGS = Object.freeze({
  feed: 0.029,
  kill: 0.057,
  diffusionA: 1,
  diffusionB: 0.5,
  timestep: 1,
  stepsPerSecond: 120,
  maxStepsPerFrame: 8,
  simulationLongEdge: 384,
  displayLongEdge: 1600,
  opacity: 0.16,
  centerOpacity: 0.35,
  color: [0.38, 0.53, 0.43],
});

const vertex = `#version 300 es
precision highp float;
out vec2 uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentHeader = `#version 300 es
precision highp float;
uniform sampler2D state;
in vec2 uv;
out vec4 result;
`;

const evolution = fragmentHeader + `
uniform vec2 diffusion;
uniform float feed, kill, timestep;
vec2 sampleAt(ivec2 offset) {
  ivec2 size = textureSize(state, 0);
  ivec2 p = clamp(ivec2(gl_FragCoord.xy) + offset, ivec2(0), size - 1);
  return texelFetch(state, p, 0).rg;
}
void main() {
  vec2 c = sampleAt(ivec2(0));
  // Nine-point Laplacian: center -1, axial 0.2, diagonal 0.05.
  vec2 lap = -c;
  lap += 0.2 * (sampleAt(ivec2(1,0)) + sampleAt(ivec2(-1,0))
              + sampleAt(ivec2(0,1)) + sampleAt(ivec2(0,-1)));
  lap += 0.05 * (sampleAt(ivec2(1,1)) + sampleAt(ivec2(-1,1))
               + sampleAt(ivec2(1,-1)) + sampleAt(ivec2(-1,-1)));
  float reaction = c.x * c.y * c.y;
  vec2 change = diffusion * lap + vec2(-reaction + feed * (1.0-c.x),
                                       reaction - (feed+kill) * c.y);
  result = vec4(clamp(c + timestep * change, 0.0, 1.0), 0.0, 1.0);
}`;

const display = fragmentHeader + `
uniform vec3 ink;
uniform float opacity, centerOpacity;
void main() {
  float b = texture(state, uv).g;
  float alpha = smoothstep(0.03, 0.32, b) * opacity;
  alpha *= mix(centerOpacity, 1.0, smoothstep(0.15, 0.48, abs(uv.x - 0.5)));
  result = vec4(ink * alpha, alpha);
}`;

const copy = fragmentHeader + `
void main() { result = vec4(texture(state, uv).rg, 0.0, 1.0); }
`;

class Simulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: 'low-power',
    });
    this.programs = [];
    this.targets = new Set();
    const gl = this.gl;
    try {
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('Floating-point WebGL2 rendering unavailable');
      }
      this.updateProgram = this.program(evolution);
      this.displayProgram = this.program(display);
      this.copyProgram = this.program(copy);
      gl.useProgram(this.updateProgram);
      gl.uniform2f(gl.getUniformLocation(this.updateProgram, 'diffusion'), SETTINGS.diffusionA, SETTINGS.diffusionB);
      for (const name of ['feed', 'kill', 'timestep']) {
        gl.uniform1f(gl.getUniformLocation(this.updateProgram, name), SETTINGS[name]);
      }
      gl.useProgram(this.displayProgram);
      gl.uniform3fv(gl.getUniformLocation(this.displayProgram, 'ink'), SETTINGS.color);
      gl.uniform1f(gl.getUniformLocation(this.displayProgram, 'opacity'), SETTINGS.opacity);
      gl.uniform1f(gl.getUniformLocation(this.displayProgram, 'centerOpacity'), SETTINGS.centerOpacity);
      this.resize();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  program(source) {
    const gl = this.gl;
    const shaders = [];
    const program = gl.createProgram();
    this.programs.push(program);
    try {
      for (const [type, text] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, source]]) {
        const shader = gl.createShader(type);
        shaders.push(shader);
        gl.shaderSource(shader, text);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader));
        }
        gl.attachShader(program, shader);
      }
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
      return program;
    } finally {
      for (const shader of shaders) gl.deleteShader(shader);
    }
  }

  target(width, height, data = null) {
    const gl = this.gl;
    const target = { texture: gl.createTexture(), framebuffer: gl.createFramebuffer(), width, height };
    this.targets.add(target);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, width, height, 0, gl.RG, gl.FLOAT, data);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Incomplete simulation framebuffer');
    }
    return target;
  }

  release(target) {
    this.gl.deleteTexture(target.texture);
    this.gl.deleteFramebuffer(target.framebuffer);
    this.targets.delete(target);
  }

  resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const scale = SETTINGS.simulationLongEdge / Math.max(width, height);
    const w = Math.max(2, Math.round(width * scale));
    const h = Math.max(2, Math.round(height * scale));
    if (!this.front || this.front.width !== w || this.front.height !== h) {
      const oldFront = this.front;
      const oldBack = this.back;
      this.front = this.target(w, h, oldFront ? null : this.seeds(w, h));
      this.back = this.target(w, h);
      if (oldFront) {
        // Resample existing chemistry on resize; scrolling never touches state.
        this.draw(this.copyProgram, oldFront, this.front);
        this.draw(this.copyProgram, oldFront, this.back);
        this.release(oldFront);
        this.release(oldBack);
      }
    }
    const displayScale = Math.min(window.devicePixelRatio || 1, SETTINGS.displayLongEdge / Math.max(width, height));
    const displayWidth = Math.max(1, Math.round(width * displayScale));
    const displayHeight = Math.max(1, Math.round(height * displayScale));
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
  }

  seeds(width, height) {
    const data = new Float32Array(width * height * 2);
    for (let i = 0; i < data.length; i += 2) data[i] = 1;
    // Deterministic, scattered nuclei keep startup repeatable during tuning.
    for (let n = 0; n < 36; n++) {
      const x = Math.floor(((n * 0.61803398875 + 0.12) % 1) * width);
      const y = Math.floor(((n * 0.41421356237 + 0.23) % 1) * height);
      const radius = 3 + n % 4;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const px = x + dx, py = y + dy;
          if (px < 0 || py < 0 || px >= width || py >= height) continue;
          const i = 2 * (py * width + px);
          data[i] = 0.5;
          data[i + 1] = 0.25;
        }
      }
    }
    return data;
  }

  draw(program, source, target = null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target?.width ?? this.canvas.width, target?.height ?? this.canvas.height);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  step() {
    this.draw(this.updateProgram, this.front, this.back);
    [this.front, this.back] = [this.back, this.front];
  }

  render() { this.draw(this.displayProgram, this.front); }

  dispose() {
    if (!this.gl) return;
    for (const target of this.targets) this.release(target);
    for (const program of this.programs) this.gl.deleteProgram(program);
    this.programs = [];
  }
}

const canvas = document.querySelector('#reaction-background');
const button = document.querySelector('#animation-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let simulation;
let frame = 0;
let previousTime = null;
let accumulator = 0;
let paused = false;
let failed = false;
let needsResize = true;

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  previousTime = null;
  accumulator = 0;
}

function fail(error) {
  failed = true;
  stop();
  canvas.hidden = true;
  button.hidden = true;
  simulation?.dispose();
  simulation = null;
  console.warn('Background animation disabled:', error);
}

function tick(now) {
  frame = 0;
  try {
    if (needsResize) {
      simulation.resize();
      needsResize = false;
    }
    const elapsed = previousTime === null ? 0 : (now - previousTime) / 1000;
    previousTime = now;
    // Fixed solver steps, capped backlog: no resume burst or refresh-rate speedup.
    accumulator = Math.min(accumulator + elapsed * SETTINGS.stepsPerSecond, SETTINGS.maxStepsPerFrame);
    const steps = Math.floor(accumulator);
    for (let i = 0; i < steps; i++) simulation.step();
    accumulator -= steps;
    simulation.render();
    frame = requestAnimationFrame(tick);
  } catch (error) { fail(error); }
}

function sync() {
  stop();
  canvas.hidden = failed || reducedMotion.matches;
  button.hidden = failed || reducedMotion.matches;
  if (failed || reducedMotion.matches || document.hidden) return;
  try {
    if (!simulation) simulation = new Simulation(canvas);
    button.textContent = paused ? 'Resume background' : 'Pause background';
    if (needsResize) {
      simulation.resize();
      needsResize = false;
    }
    simulation.render();
    if (!paused) frame = requestAnimationFrame(tick);
  } catch (error) { fail(error); }
}

button.addEventListener('click', () => { paused = !paused; sync(); });
document.addEventListener('visibilitychange', sync);
reducedMotion.addEventListener('change', sync);
window.addEventListener('resize', () => { needsResize = true; if (paused) sync(); }, { passive: true });
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', sync);
canvas.addEventListener('webglcontextlost', () => fail('WebGL context lost'));
sync();
