/* Phone map options: the plume map controls collapse behind one button so
 * they do not cover the map. Desktop CSS keeps the controls always visible
 * and hides the toggle, so this script is inert there. */
(() => {
  function setOpen(card, toggle, open) {
    card.classList.toggle('map-options-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle.querySelector('span');
    if (label) label.textContent = open ? 'Close Options' : 'Map Options';
  }

  function init() {
    const toggle = document.getElementById('plume-map-options-toggle');
    const card = toggle?.closest('.plume-v2-map-card');
    if (!toggle || !card || toggle.dataset.bound) return;
    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => setOpen(card, toggle, !card.classList.contains('map-options-open')));
    // Tapping the map itself or pressing Escape closes the panel.
    document.getElementById('plume-gis-map')?.addEventListener('pointerdown', () => setOpen(card, toggle, false));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && card.classList.contains('map-options-open')) {
        setOpen(card, toggle, false);
        toggle.focus();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.HazScopeMobileUsability = { init };
})();
