import { PageSource } from './page-source.js';

// The portfolio never depends on this optional effect.
const SETTINGS = {
  feed: 0.029,
  kill: 0.057,
  diffusionA: 1,
  diffusionB: 0.5,
  timestep: 1,
  stepsPerSecond: 500,
  simulationLongEdge: 768,
  sourceLongEdge: 768,
  sourceInterval: 250,
  sourceStrength: 0.01,
  mouseRadius: 30,
  initialSourceStrength: 0.5,
  opacity: 0.5,
  color: [185 / 255, 203 / 255, 194 / 255], // #B9CBC2, including at full opacity.
};

const DEFAULTS = Object.freeze({ ...SETTINGS });

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
uniform sampler2D pageSource;
uniform float sourceStrength;
uniform vec2 mousePosition, viewportSize;
uniform float mouseRadius, mouseStrength;
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
  float source = 1.0 - dot(texture(pageSource, uv).rgb, vec3(0.2126, 0.7152, 0.0722));
  change.y += sourceStrength * clamp(source, 0.0, 1.0);
  if (mouseRadius > 0.0 && mouseStrength > 0.0) {
    float distance = length((uv - mousePosition) * viewportSize);
    float brush = 1.0 - smoothstep(0.0, mouseRadius, distance);
    change.y += mouseStrength * brush;
  }
  result = vec4(clamp(c + timestep * change, 0.0, 1.0), 0.0, 1.0);
}`;

const display = fragmentHeader + `
uniform vec3 ink;
uniform float opacity;
void main() {
  float b = texture(state, uv).g;
  float alpha = clamp(b / 0.32, 0.0, 1.0) * opacity;
  result = vec4(ink * alpha, alpha);
}`;

const copy = fragmentHeader + `
void main() { result = vec4(texture(state, uv).rg, 0.0, 1.0); }
`;

const initialize = fragmentHeader + `
uniform float initialSourceStrength;
void main() {
  float darkness = clamp(1.0 - dot(texture(state, uv).rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
  float b = darkness * initialSourceStrength;
  result = vec4(1.0 - b, b, 0.0, 1.0);
}`;

class Simulation {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, powerPreference: 'low-power',
    });
    this.programs = [];
    this.targets = new Set();
    this.initialized = false;
    const gl = this.gl;
    try {
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('Floating-point WebGL2 rendering unavailable');
      }
      this.updateProgram = this.program(evolution);
      this.displayProgram = this.program(display);
      this.copyProgram = this.program(copy);
      this.initializeProgram = this.program(initialize);
      this.sourceTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      gl.useProgram(this.updateProgram);
      gl.uniform1i(gl.getUniformLocation(this.updateProgram, 'pageSource'), 1);
      this.sourceStrengthLocation = gl.getUniformLocation(this.updateProgram, 'sourceStrength');
      this.mouseUniforms = Object.fromEntries(['mousePosition', 'viewportSize', 'mouseRadius', 'mouseStrength']
        .map(name => [name, gl.getUniformLocation(this.updateProgram, name)]));
      this.sourceReady = false;
      gl.useProgram(this.displayProgram);
      gl.uniform3fv(gl.getUniformLocation(this.displayProgram, 'ink'), SETTINGS.color);
      this.applySettings();
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

  applySettings() {
    const gl = this.gl;
    // Keep explicit Euler nonnegative for normalized concentrations even when
    // diffusion/feed/kill exceed the old UI ranges. Rendering speed is separate.
    SETTINGS.timestep = Math.min(1, 0.9 / Math.max(
      SETTINGS.diffusionA + 1 + SETTINGS.feed,
      SETTINGS.diffusionB + SETTINGS.feed + SETTINGS.kill,
    ));
    gl.useProgram(this.updateProgram);
    gl.uniform2f(gl.getUniformLocation(this.updateProgram, 'diffusion'), SETTINGS.diffusionA, SETTINGS.diffusionB);
    for (const name of ['feed', 'kill', 'timestep']) {
      gl.uniform1f(gl.getUniformLocation(this.updateProgram, name), SETTINGS[name]);
    }
    gl.useProgram(this.initializeProgram);
    gl.uniform1f(gl.getUniformLocation(this.initializeProgram, 'initialSourceStrength'), SETTINGS.initialSourceStrength);
    gl.useProgram(this.displayProgram);
    gl.uniform1f(gl.getUniformLocation(this.displayProgram, 'opacity'), SETTINGS.opacity);
  }

  target(width, height) {
    const gl = this.gl;
    const target = { texture: gl.createTexture(), framebuffer: gl.createFramebuffer(), width, height };
    this.targets.add(target);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, width, height, 0, gl.RG, gl.FLOAT, null);
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
      this.front = this.target(w, h);
      this.back = this.target(w, h);
      if (oldFront) {
        // Resample existing chemistry on resize; scrolling never touches state.
        if (this.initialized) {
          this.draw(this.copyProgram, oldFront, this.front);
          this.draw(this.copyProgram, oldFront, this.back);
        }
        this.release(oldFront);
        this.release(oldBack);
      }
    }
    const displayLimit = Math.min(this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE), ...this.gl.getParameter(this.gl.MAX_VIEWPORT_DIMS));
    const displayScale = Math.min(window.devicePixelRatio || 1, displayLimit / Math.max(width, height));
    const displayWidth = Math.max(1, Math.round(width * displayScale));
    const displayHeight = Math.max(1, Math.round(height * displayScale));
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
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
    if (!this.initialized) return;
    const gl = this.gl;
    gl.useProgram(this.updateProgram);
    gl.uniform1f(this.sourceStrengthLocation, this.sourceReady ? SETTINGS.sourceStrength : 0);
    gl.uniform2f(this.mouseUniforms.mousePosition, pointer.x / innerWidth, 1 - pointer.y / innerHeight);
    gl.uniform2f(this.mouseUniforms.viewportSize, innerWidth, innerHeight);
    gl.uniform1f(this.mouseUniforms.mouseRadius, SETTINGS.mouseRadius);
    gl.uniform1f(this.mouseUniforms.mouseStrength, performance.now() < pointer.expires ? SETTINGS.sourceStrength : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    this.draw(this.updateProgram, this.front, this.back);
    [this.front, this.back] = [this.back, this.front];
  }

  render() {
    if (this.initialized) this.draw(this.displayProgram, this.front);
  }

  setSource(image) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Page-source texture upload failed');
      this.sourceReady = true;
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.activeTexture(gl.TEXTURE0);
    }
    if (!this.initialized) {
      // The first accepted viewport is the entire initial condition, not an overlay.
      this.resize();
      const source = { texture: this.sourceTexture };
      this.draw(this.initializeProgram, source, this.front);
      this.draw(this.initializeProgram, source, this.back);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Page initialization failed');
      this.initialized = true;
    }
  }

  dispose() {
    if (!this.gl) return;
    for (const target of this.targets) this.release(target);
    for (const program of this.programs) this.gl.deleteProgram(program);
    this.gl.deleteTexture(this.sourceTexture);
    this.programs = [];
  }
}

const canvas = document.querySelector('#reaction-background');
const button = document.querySelector('#animation-toggle');
const controls = document.querySelector('#simulation-controls');
const form = document.querySelector('#simulation-parameters');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let simulation;
let pageSource;
let frame = 0;
let previousTime = null;
let accumulator = 0;
let paused = false;
let failed = false;
let needsResize = true;
let restartTimer = 0;
const pointer = { x: 0, y: 0, expires: 0 };

const parameters = [
  ['feed', 'Feed (f)', 0, undefined, 0.05],
  ['kill', 'Kill (k)', 0, undefined, 0.05],
  ['diffusionA', 'Diffusion A', 0],
  ['diffusionB', 'Diffusion B', 0],
  ['stepsPerSecond', 'Speed (steps/sec)', 0, undefined, 100],
  ['opacity', 'Opacity', 0, 1, 0.05],
  ['initialSourceStrength', 'Initial B strength (B\u2080)', 0, undefined],
  ['sourceStrength', 'Input strength (s)', 0,undefined,.01],
  ['mouseRadius', 'Mouse radius (pixels)', 0, undefined, 10],
  ['simulationLongEdge', 'Sim size (pixels)', 2, undefined, 10],
  ['sourceLongEdge', 'Snapshot size (pixels)', 2, undefined, 110],
  ['sourceInterval', 'Capture interval (ms)', 0,undefined,50],
];
const parameterDescriptions = {
  feed: 'Rate of replenishing A.',
  kill: 'Rate of removing B.',
  diffusionA: 'How quickly A spreads.',
  diffusionB: 'How quickly B spreads.',
  stepsPerSecond: 'Solver steps per second.',
  opacity: 'Pattern visibility, 0 to 1.',
  initialSourceStrength: 'How much B the starting snapshot creates.',
  sourceStrength: 'B input from page and mouse movement.',
  mouseRadius: 'Brush radius in screen pixels.',
  simulationLongEdge: 'Grid size along its longest side.',
  sourceLongEdge: 'Snapshot detail along its longest side.',
  sourceInterval: 'Minimum time between captures; lower is faster.',
};
for (const [name, title, min, max, step = 'any'] of parameters) {
  const label = document.createElement('label');
  const titleElement = document.createElement('span');
  titleElement.id = `${name}-label`;
  titleElement.textContent = title;
  if (name === 'diffusionA' || name === 'diffusionB') {
    titleElement.textContent = `Diffusion ${name.at(-1)} (D`;
    const subscript = document.createElement('sub');
    subscript.textContent = name.at(-1);
    titleElement.append(subscript, ')');
  }
  const input = document.createElement('input');
  Object.assign(input, { type: 'number', name, min, step, value: SETTINGS[name], required: true });
  if (max !== undefined) input.max = max;
  const description = document.createElement('small');
  description.id = `${name}-description`;
  description.textContent = parameterDescriptions[name];
  input.setAttribute('aria-labelledby', titleElement.id);
  input.setAttribute('aria-describedby', description.id);
  label.append(titleElement, input, description);
  form.append(label);
}

function validParameters() {
  for (const input of form.elements) {
    input.setCustomValidity(Number.isFinite(Math.fround(input.valueAsNumber)) ? '' : 'Enter a finite number supported by the simulation.');
  }
  return form.checkValidity();
}

function restart() {
  clearTimeout(restartTimer);
  if (failed || reducedMotion.matches) return;
  if (!validParameters()) { form.reportValidity(); return; }
  for (const [name] of parameters) SETTINGS[name] = form.elements.namedItem(name).valueAsNumber;
  stop();
  pageSource?.dispose();
  pageSource = null;
  if (simulation) {
    simulation.initialized = false;
    simulation.sourceReady = false;
    simulation.applySettings();
  }
  needsResize = true;
  sync();
}

form.addEventListener('submit', event => { event.preventDefault(); restart(); });
form.addEventListener('input', () => {
  clearTimeout(restartTimer);
  if (!validParameters()) { sync(); return; }
  stop();
  pageSource?.setActive(false);
  restartTimer = setTimeout(restart, 200);
});
document.querySelector('#simulation-restart').addEventListener('click', restart);
document.querySelector('#simulation-defaults').addEventListener('click', () => {
  for (const [name] of parameters) form.elements.namedItem(name).value = DEFAULTS[name];
  restart();
});
document.querySelector('#simulation-collapse').addEventListener('click', event => {
  const details = document.querySelector('#simulation-details');
  details.hidden = !details.hidden;
  const toggle = event.currentTarget;
  const label = details.hidden ? 'Expand controls' : 'Minimize simulation controls';
  toggle.setAttribute('aria-expanded', String(!details.hidden));
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
  toggle.querySelector('[aria-hidden]').textContent = details.hidden ? '+' : '\u2212';
  toggle.querySelector('.button-label').textContent = label;
  // Collapsing moves the content even though its own dimensions stay the same.
  pageSource?.invalidate();
});

function stop() {
  pointer.expires = 0;
  cancelAnimationFrame(frame);
  frame = 0;
  previousTime = null;
  accumulator = 0;
}

function fail(error) {
  failed = true;
  stop();
  pageSource?.dispose();
  canvas.hidden = true;
  button.hidden = true;
  controls.hidden = true;
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
    // No fixed step-count cap. Yield after a short CPU budget so very high
    // requested speeds cannot lock up the controls. Drop unserved backlog.
    accumulator += elapsed * SETTINGS.stepsPerSecond;
    const steps = Math.floor(accumulator);
    const deadline = performance.now() + 8;
    for (let i = 0; i < steps && performance.now() < deadline; i++) simulation.step();
    accumulator %= 1;
    simulation.render();
    frame = requestAnimationFrame(tick);
  } catch (error) { fail(error); }
}

function sync() {
  stop();
  pageSource?.setActive(false);
  canvas.hidden = failed || reducedMotion.matches || !simulation?.initialized;
  button.hidden = failed || reducedMotion.matches || !simulation?.initialized;
  controls.hidden = failed || reducedMotion.matches;
  if (failed || reducedMotion.matches || document.hidden) return;
  try {
    if (!simulation) {
      simulation = new Simulation(canvas);
      const gl = simulation.gl;
      form.elements.namedItem('simulationLongEdge').max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), ...gl.getParameter(gl.MAX_VIEWPORT_DIMS));
      form.elements.namedItem('sourceLongEdge').max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    }
    if (!pageSource) {
      pageSource = new PageSource({
        longEdge: SETTINGS.sourceLongEdge,
        interval: SETTINGS.sourceInterval,
        onImage: image => {
          simulation.setSource(image);
          canvas.hidden = false;
          button.hidden = false;
          simulation.render();
          if (paused) pageSource.setActive(false);
          else if (!frame) frame = requestAnimationFrame(tick);
        },
        onInvalidate: () => { if (simulation) simulation.sourceReady = false; },
        onError: error => {
          if (!simulation?.initialized) { fail(error); return; }
          if (simulation) simulation.sourceReady = false;
          console.warn('Page influence disabled; background continues:', error);
        },
      });
    }
    button.querySelector('[aria-hidden]').textContent = paused ? '\u25b6' : '\u25a0';
    button.querySelector('.button-label').textContent = paused ? 'Play background' : 'Stop background (Esc)';
    if (needsResize) {
      simulation.resize();
      needsResize = false;
    }
    simulation.render();
    if (!paused || !simulation.initialized) {
      pageSource.setActive(true);
      if (!paused && simulation.initialized) frame = requestAnimationFrame(tick);
    }
  } catch (error) { fail(error); }
}

button.addEventListener('click', () => { paused = !paused; sync(); });
document.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch' || paused || failed || reducedMotion.matches
      || event.target.closest('#simulation-controls')) {
    pointer.expires = 0;
    return;
  }
  if (event.clientX === pointer.x && event.clientY === pointer.y) return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.expires = performance.now() + 100;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { pointer.expires = 0; });
document.addEventListener('pointercancel', () => { pointer.expires = 0; });
window.addEventListener('blur', () => { pointer.expires = 0; });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || paused) return;
  paused = true;
  sync();
});
document.addEventListener('visibilitychange', sync);
reducedMotion.addEventListener('change', sync);
window.addEventListener('resize', () => { needsResize = true; if (paused) sync(); }, { passive: true });
window.addEventListener('pagehide', () => { stop(); pageSource?.setActive(false); });
window.addEventListener('pageshow', sync);
canvas.addEventListener('webglcontextlost', () => fail('WebGL context lost'));
sync();
