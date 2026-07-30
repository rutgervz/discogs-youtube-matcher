// VinylTube on YouTube: watches which video plays, parses artist and
// track out of the title, and looks it up through the shared panel
// (vinyl-panel.js).

(() => {
  let currentVideoId = null;

  function getVideoId() {
    const m = location.search.match(/[?&]v=([\w-]{11})/);
    return m ? m[1] : null;
  }

  // Noise out of video titles: (Official Video), [HD], (Lyric Video), etc.
  function cleanTitle(raw) {
    return raw
      .replace(/\s*[\(\[][^)\]]*(official|video|audio|visualizer|lyric|lyrics|hd|hq|4k|remaster|music video|clip)[^)\]]*[\)\]]/gi, "")
      .replace(/\s*[\(\[]\s*[\)\]]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function cleanChannel(raw) {
    return (raw || "")
      .replace(/\s*-\s*Topic$/i, "")
      .replace(/VEVO$/i, "")
      .replace(/\s*Official$/i, "")
      .trim();
  }

  function parseTitle() {
    let title = document.title.replace(/\s*-\s*YouTube$/i, "");
    title = cleanTitle(title);
    const channel = cleanChannel(
      (document.querySelector("ytd-video-owner-renderer #channel-name a") || {})
        .textContent || ""
    );
    const dash = title.split(/\s+[-–—]\s+/);
    if (dash.length >= 2) {
      return { artist: dash[0].trim(), track: dash.slice(1).join(" ").trim(), q: title };
    }
    return { artist: channel, track: title, q: (channel + " " + title).trim() };
  }

  function run() {
    if (location.pathname !== "/watch") {
      currentVideoId = null;
      VinylPanel.remove();
      return;
    }
    const vid = getVideoId();
    if (!vid || vid === currentVideoId) return;
    currentVideoId = vid;

    // The title can lag briefly on navigation; wait a moment.
    setTimeout(() => {
      if (currentVideoId !== vid) return;
      const parsed = parseTitle();
      if (!parsed.track) return;
      VinylPanel.lookup(parsed.artist, parsed.track, parsed.q);
    }, 800);
  }

  window.addEventListener("yt-navigate-finish", run);
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      run();
    }
  }).observe(document.body, { childList: true, subtree: true });

  run();
})();
