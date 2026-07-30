// VinylTube on Spotify: watches the now-playing bar of the web player
// and looks the current track up on Discogs through the shared panel
// (vinyl-panel.js).

(() => {
  let lastKey = null;

  function readNowPlaying() {
    const widget = document.querySelector('[data-testid="now-playing-widget"]');
    if (!widget) return null;
    const titleEl =
      widget.querySelector('[data-testid="context-item-info-title"]') ||
      widget.querySelector('[data-testid="context-item-link"]');
    const track = titleEl ? titleEl.textContent.trim() : "";
    if (!track) return null;
    const artists = Array.from(
      widget.querySelectorAll('a[data-testid="context-item-info-artist"]')
    )
      .map((a) => a.textContent.trim())
      .filter(Boolean);
    return { artist: artists.join(", "), track };
  }

  // Spotify rebuilds its DOM constantly; a calm poll beats a
  // MutationObserver on the whole player bar.
  setInterval(() => {
    const now = readNowPlaying();
    if (!now) return;
    const key = now.artist + " – " + now.track;
    if (key === lastKey) return;
    lastKey = key;
    VinylPanel.lookup(now.artist, now.track, (now.artist + " " + now.track).trim());
  }, 2000);
})();
