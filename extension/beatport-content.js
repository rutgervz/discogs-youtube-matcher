// VinylTube on Beatport: watches the player bar and looks the current
// track up on Discogs through the shared panel (vinyl-panel.js).

(() => {
  let lastKey = null;

  function playerContainer() {
    // The persistent player sits in its own container; the exact class
    // names are minified, so match loosely and fall back stepwise.
    return (
      document.querySelector('[data-testid*="player"]') ||
      document.querySelector('[class*="Player"]') ||
      document.querySelector('footer')
    );
  }

  function readNowPlaying() {
    const player = playerContainer();
    if (!player) return null;
    const trackLink = player.querySelector('a[href*="/track/"]');
    if (!trackLink) return null;
    const track = trackLink.textContent.trim();
    if (!track) return null;
    const artists = Array.from(player.querySelectorAll('a[href*="/artist/"]'))
      .map((a) => a.textContent.trim())
      .filter(Boolean);
    return { artist: artists.join(", "), track };
  }

  setInterval(() => {
    const now = readNowPlaying();
    if (!now) return;
    const key = now.artist + " – " + now.track;
    if (key === lastKey) return;
    lastKey = key;
    VinylPanel.lookup(now.artist, now.track, (now.artist + " " + now.track).trim());
  }, 2000);
})();
