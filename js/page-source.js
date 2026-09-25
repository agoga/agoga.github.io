let rasterizer;

function loadRasterizer() {
  if (!rasterizer) {
    rasterizer = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vendor/html2canvas-1.4.1.min.js', import.meta.url).href;
      script.onload = () => typeof window.html2canvas === 'function'
        ? resolve(window.html2canvas) : reject(new Error('Rasterizer unavailable'));
      script.onerror = () => reject(new Error('Rasterizer failed to load'));
      document.head.append(script);
    });
  }
  return rasterizer;
}

// Capture is event-driven, bounded to one in flight, and independent of animation frames.
export class PageSource {
  constructor({ longEdge, interval, onImage, onInvalidate, onError }) {
    Object.assign(this, { longEdge, interval, onImage, onInvalidate, onError });
    this.active = false;
    this.disposed = false;
    this.pending = false;
    this.dirty = true;
    this.generation = 0;
    this.lastStart = -Infinity;
    this.timer = 0;
    this.events = new AbortController();
    const options = { passive: true, signal: this.events.signal };
    this.invalidate = this.invalidate.bind(this);
    window.addEventListener('scroll', this.invalidate, options);
    window.addEventListener('resize', this.invalidate, options);
    window.addEventListener('orientationchange', this.invalidate, options);
    const content = document.querySelector('main');
    content.addEventListener('load', this.invalidate, { capture: true, signal: this.events.signal });
    this.resizeObserver = new ResizeObserver(this.invalidate);
    this.resizeObserver.observe(content);
    this.mutationObserver = new MutationObserver(this.invalidate);
    this.mutationObserver.observe(content, { subtree: true, childList: true, characterData: true, attributes: true });
    document.fonts.ready.then(() => this.invalidate());
    document.fonts.addEventListener('loadingdone', this.invalidate, options);
  }

  setActive(active) {
    if (this.disposed || active === this.active) return;
    this.active = active;
    this.invalidate();
    if (!active) {
      clearTimeout(this.timer);
      this.timer = 0;
    }
  }

  invalidate() {
    if (this.disposed) return;
    this.generation++;
    this.dirty = true;
    this.onInvalidate();
    this.schedule();
  }

  schedule() {
    if (!this.active || this.disposed || this.pending || this.timer || !this.dirty) return;
    const delay = Math.max(0, this.interval - (performance.now() - this.lastStart));
    this.timer = setTimeout(() => { this.timer = 0; this.capture(); }, delay);
  }

  async capture() {
    if (!this.active || this.disposed) return;
    this.pending = true;
    this.dirty = false;
    this.lastStart = performance.now();
    const generation = this.generation;
    const viewport = { x: window.scrollX, y: window.scrollY, width: window.innerWidth, height: window.innerHeight };
    try {
      const render = await loadRasterizer();
      if (!this.active || this.disposed || generation !== this.generation) return;
      const image = await render(document.body, {
        ...viewport,
        scrollX: viewport.x,
        scrollY: viewport.y,
        windowWidth: viewport.width,
        windowHeight: viewport.height,
        scale: this.longEdge / Math.max(viewport.width, viewport.height),
        backgroundColor: '#ffffff',
        allowTaint: false,
        useCORS: false,
        logging: false,
        imageTimeout: 3000,
        ignoreElements: element => element.tagName === 'CANVAS'
          || element.id === 'animation-toggle' || element.classList.contains('skip-link'),
        onclone: doc => {
          // White space contributes zero source. Never capture the WebGL canvas.
          doc.documentElement.style.background = '#ffffff';
          doc.body.style.background = '#ffffff';
        },
      });
      const current = viewport.x === window.scrollX && viewport.y === window.scrollY
        && viewport.width === window.innerWidth && viewport.height === window.innerHeight;
      if (this.active && !this.disposed && generation === this.generation && current) {
        this.onImage(image);
      } else if (this.active && !this.disposed) {
        this.dirty = true;
      }
    } catch (error) {
      if (!this.disposed) {
        this.dispose();
        this.onError(error);
      }
    } finally {
      this.pending = false;
      this.schedule();
    }
  }

  dispose() {
    this.active = false;
    this.disposed = true;
    this.generation++;
    clearTimeout(this.timer);
    this.timer = 0;
    this.events.abort();
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
  }
}
