// VinylTube op YouTube: toont bij het afspelen van een nummer of het op
// vinyl te koop is bij Discogs, met prijzen en directe links.

(() => {
  let currentVideoId = null;

  function getVideoId() {
    const m = location.search.match(/[?&]v=([\w-]{11})/);
    return m ? m[1] : null;
  }

  // Ruis uit videotitels: (Official Video), [HD], (Lyric Video), enz.
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

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function removePanel() {
    const old = document.getElementById("vinyltube-yt-panel");
    if (old) old.remove();
  }

  function basePanel() {
    removePanel();
    const panel = el("aside", "", null);
    panel.id = "vinyltube-yt-panel";
    const head = el("header", "vt-head");
    const disc = el("div", "vt-disc");
    disc.appendChild(el("div", "vt-disc-label"));
    head.appendChild(disc);
    const headText = el("div", "vt-head-text");
    headText.appendChild(el("div", "vt-title", "Op vinyl?"));
    headText.appendChild(el("div", "vt-artist", "Discogs"));
    head.appendChild(headText);
    const collapse = el("button", "vt-collapse", "–");
    head.appendChild(collapse);
    panel.appendChild(head);
    const body = el("div", "vt-body");
    panel.appendChild(body);
    collapse.addEventListener("click", () => {
      panel.classList.toggle("vt-collapsed");
      collapse.textContent = panel.classList.contains("vt-collapsed") ? "+" : "–";
    });
    document.body.appendChild(panel);
    return body;
  }

  // Zoekveld: vooringevuld met de ontlede titel, direct te corrigeren.
  function addSearchBar(body, initialQuery) {
    const bar = el("div", "vty-searchbar");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "vty-tokeninput";
    input.value = initialQuery || "";
    input.placeholder = "Artiest en nummer";
    input.setAttribute("aria-label", "Zoek op Discogs");
    const go = el("button", "vt-playall", "Zoek");
    bar.appendChild(input);
    bar.appendChild(go);
    body.appendChild(bar);
    const fire = () => {
      const q = input.value.trim();
      if (q) manualSearch(q);
    };
    go.addEventListener("click", fire);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fire();
      e.stopPropagation(); // YouTube-sneltoetsen niet laten meeluisteren
    });
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("keypress", (e) => e.stopPropagation());
    return bar;
  }

  function manualSearch(q) {
    const parsed = { artist: "", track: "", q };
    showLoading({ artist: "", track: q });
    chrome.runtime.sendMessage(
      { type: "discogsSearch", q, userQuery: true },
      (res) => {
        if (chrome.runtime.lastError || !res) return removePanel();
        if (!res.ok) {
          if (res.error === "no_token") return showTokenSetup();
          if (res.error === "auth")
            return showTokenSetup("Token ongeldig of verlopen; plak een nieuwe.");
          return removePanel();
        }
        showResults(parsed, res.data, q);
      }
    );
  }

  function euro(v) {
    return "€ " + Number(v).toFixed(2).replace(".", ",");
  }

  function showResults(parsed, data, usedQuery) {
    const body = basePanel();
    const shownQuery =
      usedQuery || [parsed.artist, parsed.track].filter(Boolean).join(" ");
    addSearchBar(body, shownQuery);
    const results = data.results || [];

    if (!results.length) {
      body.appendChild(
        el("div", "vty-summary", "Niets op vinyl gevonden. Pas de zoekterm hierboven aan, videotitels zijn soms eigenwijs.")
      );
      const link = el("a", "vty-alllink", "Zelf zoeken op Discogs");
      link.href =
        "https://www.discogs.com/search/?type=release&format=Vinyl&q=" +
        encodeURIComponent(shownQuery);
      link.target = "_blank";
      link.rel = "noopener";
      body.appendChild(link);
      return;
    }

    const forSale = results.filter((r) => r.numForSale > 0 && r.lowest != null);
    const cheapest = forSale.length
      ? forSale.reduce((a, b) => (a.lowest <= b.lowest ? a : b))
      : null;
    body.appendChild(
      el(
        "div",
        "vty-summary",
        cheapest
          ? `Op vinyl te koop vanaf ${euro(cheapest.lowest)}`
          : "Wel op vinyl verschenen, nu geen aanbiedingen gevonden"
      )
    );

    const list = el("div", "vty-list");
    results.forEach((r) => {
      const row = document.createElement("a");
      row.className = "vty-row";
      row.href = "https://www.discogs.com/release/" + r.id;
      row.target = "_blank";
      row.rel = "noopener";
      if (r.thumb) {
        const img = document.createElement("img");
        img.className = "vty-thumb";
        img.src = r.thumb;
        img.addEventListener("error", () => img.remove());
        row.appendChild(img);
      }
      const info = el("div", "vty-info");
      info.appendChild(el("div", "vty-reltitle", r.title));
      info.appendChild(
        el(
          "div",
          "vty-meta",
          [r.year, r.country, r.formats].filter(Boolean).join(" · ")
        )
      );
      info.appendChild(
        el(
          "div",
          "vty-sale",
          r.numForSale == null
            ? ""
            : r.numForSale > 0
            ? `${r.numForSale} te koop` +
              (r.lowest != null ? ` vanaf ${euro(r.lowest)}` : "")
            : "geen aanbiedingen"
        )
      );
      row.appendChild(info);
      list.appendChild(row);
    });
    body.appendChild(list);

    if (data.total > results.length) {
      const link = el("a", "vty-alllink", `Alle ${data.total} resultaten op Discogs`);
      link.href =
        "https://www.discogs.com/search/?type=release&format=Vinyl&q=" +
        encodeURIComponent(shownQuery);
      link.target = "_blank";
      link.rel = "noopener";
      body.appendChild(link);
    }
  }

  function showTokenSetup(message) {
    const body = basePanel();
    body.appendChild(
      el(
        "div",
        "vty-summary",
        message ||
          "Voor vinyl zoeken is een gratis Discogs-token nodig (eenmalig)."
      )
    );
    const help = el("a", "vty-alllink", "Token aanmaken op discogs.com");
    help.href = "https://www.discogs.com/settings/developers";
    help.target = "_blank";
    help.rel = "noopener";
    body.appendChild(help);
    const form = el("div", "vty-tokenform");
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = "Plak je token hier";
    input.className = "vty-tokeninput";
    const save = el("button", "vt-playall", "Opslaan");
    form.appendChild(input);
    form.appendChild(save);
    body.appendChild(form);
    save.addEventListener("click", () => {
      const token = input.value.trim();
      if (!token) return;
      chrome.storage.sync.set({ discogsToken: token }, () => {
        currentVideoId = null;
        run();
      });
    });
  }

  function showLoading(parsed) {
    const body = basePanel();
    body.appendChild(
      el("div", "vty-summary", `Zoeken op Discogs: ${parsed.artist ? parsed.artist + " · " : ""}${parsed.track}`)
    );
  }

  function run() {
    if (location.pathname !== "/watch") {
      currentVideoId = null;
      removePanel();
      return;
    }
    const vid = getVideoId();
    if (!vid || vid === currentVideoId) return;
    currentVideoId = vid;

    // Titel kan bij navigatie even achterlopen; kort wachten.
    setTimeout(() => {
      if (currentVideoId !== vid) return;
      const parsed = parseTitle();
      if (!parsed.track) return;
      showLoading(parsed);
      chrome.runtime.sendMessage(
        { type: "discogsSearch", artist: parsed.artist, track: parsed.track, q: parsed.q },
        (res) => {
          if (currentVideoId !== vid) return;
          if (chrome.runtime.lastError || !res) return removePanel();
          if (!res.ok) {
            if (res.error === "no_token") return showTokenSetup();
            if (res.error === "auth")
              return showTokenSetup("Token ongeldig of verlopen; plak een nieuwe.");
            return removePanel();
          }
          showResults(parsed, res.data);
        }
      );
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
