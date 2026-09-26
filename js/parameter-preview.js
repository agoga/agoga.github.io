// Literature-derived starting points; page-shaped seeds affect the outcome.
// Sources and numerical differences are documented in README.md.
const classic = { diffusionA: 1, diffusionB: 0.5, initialSourceStrength: 0.5, sourceStrength: 0.01 };
export const PRESETS = {
  pageTrace: { ...classic, feed: 0.029, kill: 0.057, sourceStrength: 0.01 },
  mitosis: { ...classic, feed: 0.035, kill: 0.0625, initialSourceStrength: 0.9, sourceStrength: 0.005, stepsPerSecond: 4000  },
  foamFill: { ...classic, feed: 0.026, kill: 0.051 },
  softWaves: { ...classic, feed: 0.014, kill: 0.051 },
  //  mitosis: { ...classic, feed: 0.0367, kill: 0.0649 }, //kill
  wanderingLine: { ...classic, feed: 0.0545, kill: 0.062, stepsPerSecond: 5000 },
};
const LABELS = {
  pageTrace: 'Page trace', mitosis: 'Mitosis', foamFill: 'Foam Fill',
  softWaves: 'Wavelets',  wanderingLine: 'Wandering Lines',
};

// Temporary UI: remove the mount call to retain only the code presets.
export function mountParameterPreview(container, form, applyPreset) {
  const group = document.createElement('div');
  group.className = 'palette-preview parameter-preview';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Pattern presets');
  const title = document.createElement('span');
  title.className = 'palette-preview-title';
  title.textContent = 'Presets:';
  group.append(title);
  const select = document.createElement('select');
  select.className = 'pattern-select';
  select.setAttribute('aria-label', 'Choose a pattern');
  const custom = new Option('Custom parameters', '');
  custom.disabled = true;
  select.append(custom);
  select.addEventListener('change', () => { applyPreset(PRESETS[select.value]); refresh(); });
  group.append(select);
  for (const [key, preset] of Object.entries(PRESETS)) {
    select.append(new Option(LABELS[key], key));
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = LABELS[key];
    button.title = `Feed ${preset.feed}, kill ${preset.kill}, input ${preset.sourceStrength}`;
    button.dataset.preset = key;
    button.addEventListener('click', () => { applyPreset(preset); refresh(); });
    group.append(button);
  }
  function refresh() {
    select.value = '';
    for (const button of group.querySelectorAll('button')) {
      const matches = Object.entries(PRESETS[button.dataset.preset]).every(([name, value]) =>
        form.elements.namedItem(name).valueAsNumber === value);
      button.setAttribute('aria-pressed', String(matches));
      if (matches) select.value = button.dataset.preset;
    }
  }
  form.addEventListener('input', refresh);
  container.append(group);
  refresh();
  return refresh;
}
