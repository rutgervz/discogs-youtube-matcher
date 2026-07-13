// VinylTube background service worker
// Haalt release- of masterdata op bij de Discogs API en cachet per sessie.

const cache = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "fetchDiscogs") {
    handleFetch(msg, sendResponse);
    return true; // async sendResponse
  }
  if (msg.type === "discogsSearch") {
    handleSearch(msg, sendResponse);
    return true;
  }
  if (msg.type === "ytSearch") {
    handleYtSearch(msg, sendResponse);
    return true;
  }
});

// Zoeken naar vinylreleases met deze track, plus per release de
// marktplaatsstand (aantal te koop, laagste prijs). Vereist een
// persoonlijke Discogs-token.
async function handleSearch(msg, sendResponse) {
  try {
    const { discogsToken } = await chrome.storage.sync.get("discogsToken");
    if (!discogsToken) {
      sendResponse({ ok: false, error: "no_token" });
      return;
    }
    const cacheKey =
      "search/" + (msg.userQuery ? "u:" + msg.q : (msg.artist || "") + "|" + (msg.track || ""));
    if (cache.has(cacheKey)) {
      sendResponse({ ok: true, data: cache.get(cacheKey) });
      return;
    }
    const headers = {
      Authorization: "Discogs token=" + discogsToken,
      Accept: "application/vnd.discogs.v2.plaintext+json"
    };

    async function search(params) {
      const u = new URL("https://api.discogs.com/database/search");
      Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v));
      u.searchParams.set("format", "Vinyl");
      u.searchParams.set("type", "release");
      u.searchParams.set("per_page", "8");
      const r = await fetch(u, { headers });
      if (r.status === 401) throw new Error("auth");
      if (!r.ok) throw new Error("Discogs API gaf status " + r.status);
      return (await r.json()).results || [];
    }

    const stripParens = (s) => (s || "").replace(/[\(\[][^)\]]*[\)\]]/g, " ").replace(/\s{2,}/g, " ").trim();

    // Van strak naar los: elke volgende poging vergeeft meer ruis in de
    // videotitel. De eerste poging die iets vindt, wint.
    const attempts = [];
    if (msg.q && msg.userQuery) {
      attempts.push({ q: msg.q }); // handmatige zoekopdracht: letterlijk nemen
    } else {
      if (msg.artist && msg.track) {
        attempts.push({ artist: msg.artist, track: msg.track });
        attempts.push({ q: msg.artist + " " + msg.track });
        attempts.push({ q: stripParens(msg.artist) + " " + stripParens(msg.track) });
      } else if (msg.q) {
        attempts.push({ q: msg.q });
        attempts.push({ q: stripParens(msg.q) });
      }
      if (msg.track) attempts.push({ q: stripParens(msg.track) });
      if (msg.artist) attempts.push({ q: stripParens(msg.artist) });
    }

    let results = [];
    for (const a of attempts) {
      results = await search(a);
      if (results.length) break;
    }

    const top = results.slice(0, 4);
    const withStats = await Promise.all(
      top.map(async (r) => {
        let stats = null;
        try {
          const s = await fetch(
            `https://api.discogs.com/marketplace/stats/${r.id}?curr_abbr=EUR`,
            { headers }
          );
          if (s.ok) stats = await s.json();
        } catch (_) {}
        return {
          id: r.id,
          title: r.title || "",
          year: r.year || "",
          formats: (r.format || []).slice(0, 3).join(", "),
          country: r.country || "",
          thumb: r.thumb || "",
          numForSale: stats ? stats.num_for_sale || 0 : null,
          lowest:
            stats && stats.lowest_price && stats.lowest_price.value != null
              ? stats.lowest_price.value
              : null
        };
      })
    );

    const data = { results: withStats, total: results.length };
    cache.set(cacheKey, data);
    sendResponse({ ok: true, data });
  } catch (err) {
    sendResponse({
      ok: false,
      error: String(err && err.message) === "auth" ? "auth" : String(err)
    });
  }
}

function handleFetch(msg, sendResponse) {
  const key = `${msg.kind}/${msg.id}`;
  if (cache.has(key)) {
    sendResponse({ ok: true, data: cache.get(key) });
    return;
  }

  const endpoint =
    msg.kind === "master"
      ? `https://api.discogs.com/masters/${msg.id}`
      : `https://api.discogs.com/releases/${msg.id}`;

  fetch(endpoint, {
    headers: { Accept: "application/vnd.discogs.v2.plaintext+json" }
  })
    .then((r) => {
      if (!r.ok) throw new Error(`Discogs API gaf status ${r.status}`);
      return r.json();
    })
    .then((data) => {
      const slim = {
        title: data.title || "",
        artists: (data.artists || []).map((a) => a.name.replace(/\s*\(\d+\)$/, "")),
        tracklist: (data.tracklist || [])
          .filter((t) => t.type_ !== "heading")
          .map((t) => ({
            position: t.position || "",
            title: t.title || "",
            duration: t.duration || ""
          })),
        videos: (data.videos || []).map((v) => ({
          uri: v.uri || "",
          title: v.title || "",
          duration: v.duration || 0
        }))
      };
      cache.set(key, slim);
      sendResponse({ ok: true, data: slim });
    })
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
}

// YouTube doorzoeken voor tracks zonder gekoppelde Discogs-video.
// Leest de resultatenpagina en licht de videoRenderers uit ytInitialData.
async function handleYtSearch(msg, sendResponse) {
  try {
    const u =
      "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(msg.q || "");
    const r = await fetch(u, {
      headers: { "Accept-Language": "en-US,en;q=0.8" }
    });
    if (!r.ok) throw new Error("YouTube gaf status " + r.status);
    const html = await r.text();
    const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
    if (!m) {
      sendResponse({ ok: true, data: { candidates: [] } });
      return;
    }
    const data = JSON.parse(m[1]);
    const candidates = [];
    (function walk(node) {
      if (!node || typeof node !== "object" || candidates.length >= 12) return;
      if (node.videoRenderer && node.videoRenderer.videoId) {
        const vr = node.videoRenderer;
        const title =
          (vr.title && vr.title.runs && vr.title.runs[0] && vr.title.runs[0].text) || "";
        const len = (vr.lengthText && vr.lengthText.simpleText) || "";
        const parts = len.split(":").map((p) => parseInt(p, 10));
        const seconds =
          len && !parts.some(isNaN)
            ? parts.reduce((a, p) => a * 60 + p, 0)
            : 0;
        candidates.push({ videoId: vr.videoRenderer ? null : vr.videoId, id: vr.videoId, title, seconds });
      }
      for (const k in node) walk(node[k]);
    })(data);
    sendResponse({
      ok: true,
      data: { candidates: candidates.map((c) => ({ id: c.id, title: c.title, seconds: c.seconds })) }
    });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }
}
