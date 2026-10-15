// Live text geometry for the display pass only; never part of the page source.
// CSS pixels: keep the clear core tight, with rounded corners and a soft halo.
const PADDING = 2;
const CORNER_RADIUS = 8;
const FEATHER = 6;

export class TextMask {
  constructor(root) {
    this.root = root;
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    this.dirty = true;
    this.events = new AbortController();
    this.invalidate = () => { this.dirty = true; };
    const options = { passive: true, signal: this.events.signal };
    // Capture nested scrolling too, so sticky text always uses its live position.
    window.addEventListener('scroll', this.invalidate, { ...options, capture: true });
    window.addEventListener('resize', this.invalidate, options);
    window.addEventListener('orientationchange', this.invalidate, options);
    root.addEventListener('load', this.invalidate, { ...options, capture: true });
    this.resizeObserver = new ResizeObserver(this.invalidate);
    this.resizeObserver.observe(root);
    this.mutationObserver = new MutationObserver(this.invalidate);
    this.mutationObserver.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });
    document.fonts.ready.then(this.invalidate);
    document.fonts.addEventListener('loadingdone', this.invalidate, options);
  }

  update(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.dirty = true;
    }
    if (!this.dirty) return null;
    this.dirty = false;
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    const scaleX = width / window.innerWidth;
    const scaleY = height / window.innerHeight;
    context.scale(scaleX, scaleY);
    context.fillStyle = '#ffffff';
    context.shadowColor = '#ffffff';
    // Canvas shadows use backing pixels, independently of the transform.
    context.shadowBlur = FEATHER * Math.max(scaleX, scaleY);
    const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Controls already have an opaque background; images stay unmasked.
          return node.hidden || node.matches('#simulation-controls, script, style, canvas, svg, template')
            ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (getComputedStyle(node.parentElement).visibility !== 'visible') continue;
      range.selectNodeContents(node);
      // Range rectangles follow wrapping and inline links/emphasis without
      // blanking the unused width of a heading, paragraph, or content column.
      for (const rect of range.getClientRects()) {
        const margin = PADDING + FEATHER;
        if (!rect.width || !rect.height || rect.bottom + margin <= 0
            || rect.top - margin >= window.innerHeight || rect.right + margin <= 0
            || rect.left - margin >= window.innerWidth) continue;
        context.beginPath();
        context.roundRect(rect.left - PADDING, rect.top - PADDING,
          rect.width + 2 * PADDING, rect.height + 2 * PADDING, CORNER_RADIUS);
        context.fill();
      }
    }
    return this.canvas;
  }

  dispose() {
    this.events.abort();
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
  }
}
