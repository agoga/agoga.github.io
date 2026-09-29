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
    }).catch(error => { rasterizer = null; throw error; });
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
    this.retryAfter = 0;
    this.failures = 0;
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
    const delay = Math.max(0, this.interval - (performance.now() - this.lastStart), this.retryAfter - performance.now());
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
      // html2canvas does not reproduce CSS grid/display:contents reliably.
      // Freeze portfolio boxes at their live positions in the capture clone.
      const layoutSelectors = ['#work', '.work-tabs', '.work-panel', '.work-entry',
        '.work-image', '.work-copy', '.work-related'];
      const layout = layoutSelectors.flatMap(selector => [...document.querySelectorAll(selector)].map((element, index) => {
        const parent = element.matches('#work') ? element.offsetParent
          : element.matches('.work-image, .work-copy, .work-related') ? element.closest('.work-entry')
          : element.parentElement;
        const rect = element.getBoundingClientRect();
        const origin = parent.getBoundingClientRect();
        return { selector, index, width: rect.width, height: rect.height,
          left: rect.left - origin.left - parent.clientLeft,
          top: rect.top - origin.top - parent.clientTop };
      }));
      const documentHeight = document.documentElement.scrollHeight;
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
          || element.id === 'animation-toggle' || element.classList.contains('skip-link')
          // Never make a snapshot fetch/decode lazy images outside the viewport
          // or wait for an image still loading. Its load event refreshes the source.
          || (element.tagName === 'IMG' && element.parentElement?.classList.contains('work-image') && (!element.complete || (() => {
            const bounds = element.getBoundingClientRect();
            return !bounds.width || !bounds.height || bounds.bottom <= 0
              || bounds.top >= viewport.height || bounds.right <= 0 || bounds.left >= viewport.width;
          })())),
        onclone: doc => {
          // White space contributes zero source. Never capture the WebGL canvas.
          doc.documentElement.style.background = '#ffffff';
          doc.body.style.background = '#ffffff';
          doc.body.style.minHeight = `${documentHeight}px`;
          // Keep the controls' space, but omit their text/values from the source.
          const controls = doc.querySelector('#simulation-controls');
          if (controls) controls.style.visibility = 'hidden';
          doc.querySelectorAll('.work-media').forEach(media => media.replaceWith(...media.childNodes));
          for (const box of layout) {
            const element = doc.querySelectorAll(box.selector)[box.index];
            if (!element || !box.width || !box.height) continue;
            Object.assign(element.style, {
              position: 'absolute', display: 'block', boxSizing: 'border-box',
              left: `${box.left}px`, top: `${box.top}px`,
              width: `${box.width}px`, height: `${box.height}px`, margin: '0',
            });
            if (element.matches('.work-tabs')) element.style.display = 'flex';
          }
        },
      });
      const current = viewport.x === window.scrollX && viewport.y === window.scrollY
        && viewport.width === window.innerWidth && viewport.height === window.innerHeight;
      if (this.active && !this.disposed && generation === this.generation && current) {
        this.onImage(image);
        this.failures = 0;
        this.retryAfter = 0;
      } else if (this.active && !this.disposed) {
        this.dirty = true;
      }
    } catch (error) {
      if (!this.disposed) {
        this.dirty = true;
        this.retryAfter = performance.now() + Math.min(10000, 1000 * 2 ** Math.min(this.failures++, 4));
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
