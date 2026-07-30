// VinylTube search panel: shows for the currently playing track whether
// it is for sale on vinyl at Discogs, with prices and direct links.
// Shared by the YouTube, Spotify and Beatport content scripts; those
// scripts detect what is playing and call VinylPanel.lookup().

window.VinylPanel = (() => {
  let collapsed = false;
  let lookupSeq = 0;
  let lastRequest = null; // replayed after the user saves a token

  // With the video in fullscreen the panel should be out of sight.
  document.addEventListener("fullscreenchange", () => {
    const panel = document.getElementById("vinyltube-yt-panel");
    if (panel) panel.classList.toggle("vt-fs-hidden", !!document.fullscreenElement);
  });

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
    headText.appendChild(el("div", "vt-title", "On vinyl?"));
    headText.appendChild(el("div", "vt-artist", "Discogs"));
    head.appendChild(headText);
    const collapse = el("button", "vt-collapse", "–");
    collapse.title = "Collapse";
    head.appendChild(collapse);
    panel.appendChild(head);
    const body = el("div", "vt-body");
    panel.appendChild(body);
    const applyCollapsed = () => {
      panel.classList.toggle("vt-collapsed", collapsed);
      panel.title = collapsed ? "Expand VinylTube" : "";
    };
    collapse.addEventListener("click", (e) => {
      e.stopPropagation();
      collapsed = true;
      applyCollapsed();
    });
    // Collapsed, the panel is just the disc; click to expand.
    panel.addEventListener("click", () => {
      if (!collapsed) return;
      collapsed = false;
      applyCollapsed();
    });
    applyCollapsed();
    if (document.fullscreenElement) panel.classList.add("vt-fs-hidden");
    document.body.appendChild(panel);
    return body;
  }

  // Search field: prefilled with the detected track, ready to correct.
  function addSearchBar(body, initialQuery) {
    const bar = el("div", "vty-searchbar");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "vty-tokeninput";
    input.value = initialQuery || "";
    input.placeholder = "Artist and track";
    input.setAttribute("aria-label", "Search Discogs");
    const go = el("button", "vt-playall", "Search");
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
      e.stopPropagation(); // keep the host site's shortcuts from listening in
    });
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("keypress", (e) => e.stopPropagation());
    return bar;
  }

  function euro(v) {
    return "€ " + Number(v).toFixed(2);
  }

  function handleResult(parsed, res, usedQuery) {
    if (chrome.runtime.lastError || !res) return removePanel();
    if (!res.ok) {
      if (res.error === "no_token") return showTokenSetup();
      if (res.error === "auth")
        return showTokenSetup("Token invalid or expired; paste a new one.");
      return removePanel();
    }
    showResults(parsed, res.data, usedQuery);
  }

  function manualSearch(q) {
    lastRequest = { q, userQuery: true };
    const seq = ++lookupSeq;
    showLoading({ artist: "", track: q });
    chrome.runtime.sendMessage(
      { type: "discogsSearch", q, userQuery: true },
      (res) => {
        if (seq !== lookupSeq) return; // a newer search is underway
        handleResult({ artist: "", track: "", q }, res, q);
      }
    );
  }

  function lookup(artist, track, q) {
    lastRequest = { artist, track, q };
    const seq = ++lookupSeq;
    showLoading({ artist, track });
    chrome.runtime.sendMessage(
      { type: "discogsSearch", artist, track, q },
      (res) => {
        if (seq !== lookupSeq) return; // a newer track is already playing
        handleResult({ artist, track, q }, res);
      }
    );
  }

  function retryLast() {
    if (!lastRequest) return;
    if (lastRequest.userQuery) manualSearch(lastRequest.q);
    else lookup(lastRequest.artist, lastRequest.track, lastRequest.q);
  }

  function showResults(parsed, data, usedQuery) {
    const body = basePanel();
    const shownQuery =
      usedQuery || [parsed.artist, parsed.track].filter(Boolean).join(" ");
    addSearchBar(body, shownQuery);
    const results = data.results || [];

    if (!results.length) {
      body.appendChild(
        el("div", "vty-summary", "Nothing found on vinyl. Adjust the search above, track titles can be stubborn.")
      );
      const link = el("a", "vty-alllink", "Search Discogs yourself");
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
          ? `For sale on vinyl from ${euro(cheapest.lowest)}`
          : "Released on vinyl, but no listings found right now"
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
            ? `${r.numForSale} for sale` +
              (r.lowest != null ? ` from ${euro(r.lowest)}` : "")
            : "no listings"
        )
      );
      row.appendChild(info);
      list.appendChild(row);
    });
    body.appendChild(list);

    if (data.total > results.length) {
      const link = el("a", "vty-alllink", `All ${data.total} results on Discogs`);
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
          "Vinyl search needs a free Discogs token (one-time setup)."
      )
    );
    const help = el("a", "vty-alllink", "Create a token on discogs.com");
    help.href = "https://www.discogs.com/settings/developers";
    help.target = "_blank";
    help.rel = "noopener";
    body.appendChild(help);
    const form = el("div", "vty-tokenform");
    const input = document.createElement("input");
    input.type = "password";
    input.placeholder = "Paste your token here";
    input.className = "vty-tokeninput";
    const save = el("button", "vt-playall", "Save");
    form.appendChild(input);
    form.appendChild(save);
    body.appendChild(form);
    save.addEventListener("click", () => {
      const token = input.value.trim();
      if (!token) return;
      chrome.storage.sync.set({ discogsToken: token }, retryLast);
    });
  }

  function showLoading(parsed) {
    const body = basePanel();
    body.appendChild(
      el("div", "vty-summary", `Searching Discogs: ${parsed.artist ? parsed.artist + " · " : ""}${parsed.track}`)
    );
  }

  return { lookup, remove: removePanel };
})();
