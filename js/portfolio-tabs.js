// Progressive enhancement: without JS, both sections and all anchors remain usable.
const work = document.querySelector('#work');
const tablist = work.querySelector('.work-tabs');
// Keep linked entries clear of the sticky tabs, including enlarged text.
const toolbarLayout = document.querySelector('#simulation-controls');
function updateTabLayout() {
  work.style.setProperty('--work-tabs-height', `${tablist.getBoundingClientRect().height}px`);
  const toolbarBounds = toolbarLayout?.getBoundingClientRect();
  const buttonsRight = Math.max(...[...tablist.querySelectorAll('a')].map(tab => tab.getBoundingClientRect().right));
  const fits = toolbarLayout && !toolbarLayout.hidden
    && toolbarBounds.width > 0
    && getComputedStyle(toolbarLayout).position === 'sticky'
    && buttonsRight + 12 <= toolbarBounds.left;
  tablist.classList.toggle('tabs-beside-controls', Boolean(fits));
}
const layoutObserver = new ResizeObserver(updateTabLayout);
layoutObserver.observe(tablist);
layoutObserver.observe(work);
if (toolbarLayout) layoutObserver.observe(toolbarLayout);
window.addEventListener('resize', updateTabLayout, { passive: true });
document.fonts.ready.then(updateTabLayout);
window.addEventListener('load', updateTabLayout, { once: true });
const tabs = [...tablist.querySelectorAll('a')];
const panels = tabs.map(tab => document.querySelector(tab.hash));
let pendingNavigation = 0;
tablist.setAttribute('role', 'tablist');
tabs.forEach((tab, index) => {
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panels[index].id);
  panels[index].setAttribute('role', 'tabpanel');
  panels[index].setAttribute('aria-labelledby', tab.id);
  panels[index].tabIndex = 0;
});

function activate(panel) {
  // Reveal first so there is never an empty page that clamps the scroll position.
  panel.hidden = false;
  tabs.forEach((tab, index) => {
    const selected = panels[index] === panel;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[index].hidden = !selected;
  });
}

function destination(hash) {
  let id;
  try { id = decodeURIComponent(hash.slice(1)); } catch { return null; }
  // Preserve links to the former publications section.
  if (id === 'publications') id = 'research';
  const target = document.getElementById(id);
  const panel = target?.closest('.work-panel');
  return panel ? { target, panel } : null;
}

function navigate(hash, { historyEntry = false, scroll = true, focus = false } = {}) {
  cancelAnimationFrame(pendingNavigation);
  const result = destination(hash);
  if (!result) return false;
  activate(result.panel);
  if (historyEntry && location.hash !== hash) {
    history.pushState(null, '', hash);
    handledURL = location.href;
  }
  if (scroll) pendingNavigation = requestAnimationFrame(() => {
    const isEntry = result.target.classList.contains('work-entry');
    const target = isEntry ? result.target : work;
    if (focus) (isEntry ? target : tabs[panels.indexOf(result.panel)]).focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  });
  return true;
}

work.addEventListener('click', event => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const isTab = tabs.includes(anchor);
  if (navigate(anchor.hash, { historyEntry: true, scroll: !isTab, focus: !isTab })) event.preventDefault();
});
tablist.addEventListener('keydown', event => {
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  let next;
  if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') next = (current + tabs.length - 1) % tabs.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = tabs.length - 1;
  else return;
  event.preventDefault();
  tabs[next].focus({ preventScroll: true });
  navigate(tabs[next].hash, { historyEntry: true, scroll: false });
});
// Back/Forward can fire both events. Handle each URL once, and let the browser
// restore scrolling for tab history; individual entry links still jump to entries.
let handledURL = location.href;
function restoreLocation() {
  if (handledURL === location.href) return;
  handledURL = location.href;
  const entry = destination(location.hash)?.target.classList.contains('work-entry');
  if (!navigate(location.hash, { scroll: Boolean(entry) })) activate(panels[0]);
}
window.addEventListener('hashchange', restoreLocation);
window.addEventListener('popstate', restoreLocation);
if (!navigate(location.hash)) activate(panels[0]);
// Images and fonts above a direct link can change its position after parsing.
window.addEventListener('load', () => navigate(location.hash), { once: true });

// The optional simulation toolbar is revealed after modules initialize. Re-align
// an initial deep link once its height is known so the heading is not covered.
const initialHash = location.hash;
const toolbar = document.querySelector('#simulation-controls');
if (initialHash && destination(initialHash) && toolbar) {
  const observer = new ResizeObserver(() => {
    if (!toolbar.getBoundingClientRect().height) return;
    observer.disconnect();
    if (location.hash === initialHash) navigate(initialHash);
  });
  observer.observe(toolbar);
  for (const event of ['pointerdown', 'keydown', 'wheel']) {
    window.addEventListener(event, () => observer.disconnect(), { once: true, passive: true });
  }
}
