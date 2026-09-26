// Temporary palette UI. Remove its import and mount call in background.js,
// then delete this file and the marked CSS block to remove the experiment.
const PALETTES = [
  ['Cool blue', '#F7F9FC', '#B8CCE2', '#182534', '#244F78'],
  ['Soft lavender', '#FAF8FC', '#CEBFDF', '#292132', '#594071'],
  ['Warm sand', '#FAF7F1', '#D8C4A8', '#302820', '#665037'],
  ['Sage', '#F5F8F4', '#B8CDB9', '#1D2B21', '#345C40'],
  ['Graphite', '#F7F7F7', '#C8CDD2', '#22262B', '#40556B'],
];

export function mountPalettePreview(container, applyPalette) {
  const group = document.createElement('div');
  group.className = 'palette-preview';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Temporary palette preview');
  const title = document.createElement('span');
  title.className = 'palette-preview-title';
  title.textContent = 'Try a palette';
  group.append(title);
  for (const [name, paper, pattern, ink, accent] of PALETTES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = name;
    button.style.setProperty('--swatch', pattern);
    button.setAttribute('aria-pressed', String(name === 'Cool blue'));
    button.addEventListener('click', () => {
      const color = pattern.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
      if (!applyPalette({ paper, color, ink, accent })) return;
      for (const sibling of group.querySelectorAll('button')) {
        sibling.setAttribute('aria-pressed', String(sibling === button));
      }
    });
    group.append(button);
  }
  container.append(group);
}
