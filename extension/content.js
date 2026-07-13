// VinylTube content script
// Detecteert Discogs release-, master- en shoppagina's en toont een paneel
// met de tracklist, afspeelbaar in een ingebedde YouTube-speler in het
// paneel zelf. Met ingelogde YouTube-cookies (derden toegestaan voor
// youtube.com) geldt Premium ook in de embed: geen reclame.

(() => {
  let currentKey = null;
  let lastDebug = [];
  let lastCandidates = [];
  let lastPool = {};

  function parsePage() {
    let m = location.pathname.match(/\/(release|master)\/(\d+)/);
    if (m) return { kind: m[1], id: m[2] };
    m = location.pathname.match(/\/(?:shop|sell)\/item\/(\d+)/);
    if (m) return { kind: "listing", id: m[1] };
    return null;
  }

  function ytIdFromUri(uri) {
    const m = uri.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function normalize(s) {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f]+/g, " ")
      .trim();
  }

  function toSeconds(dur) {
    // "6:24" of "1:02:30" naar seconden; leeg blijft null.
    if (!dur) return null;
    const parts = String(dur).split(":").map((p) => parseInt(p, 10));
    if (parts.some(isNaN)) return null;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }

  // Koppel elke track aan de best passende video. Mixnamen (Club Mix,
  // Radio Edit) wegen mee via woordoverlap; bij twijfel beslist de
  // tijdsduur. Toewijzing verloopt van hoogste naar laagste score,
  // elke video maximaal één keer.
  function matchVideos(tracks, videos) {
    const pool = videos
      .map((v, i) => {
        const norm = normalize(v.title);
        return {
          index: i,
          title: v.title,
          ytId: ytIdFromUri(v.uri),
          norm,
          words: new Set(norm.split(" ").filter(Boolean)),
          seconds: v.duration || null
        };
      })
      .filter((v) => v.ytId);

    const MIX_WORDS = new Set([
      "mix", "remix", "edit", "radio", "club", "dub", "version", "original",
      "vocal", "instrumental", "extended", "album", "single", "12", "7",
      "long", "short", "acapella", "acappella", "rework", "refix", "vip",
      "dj", "demo", "live", "cover", "karaoke", "reprise", "medley",
      "megamix", "mashup", "slowed", "reverb"
    ]);

    const scored = [];
    tracks.forEach((t, ti) => {
      const norm = normalize(t.title);
      const tokens = norm.split(" ").filter(Boolean);
      const tokenSet = new Set(tokens);
      const coreTokens = tokens.filter((w) => !MIX_WORDS.has(w));
      const trackSeconds = toSeconds(t.duration);
      pool.forEach((v) => {
        if (!tokens.length) return;
        // Woordvergelijking op hele woorden, geen substrings.
        const hits = tokens.filter((w) => v.words.has(w)).length;
        let score = hits / tokens.length;
        if (score < 0.5) {
          // Videotitel zonder mixnaam: als de kern van de tracktitel er
          // volledig in zit, mag de tijdsduur het verschil maken.
          const coreOk =
            coreTokens.length > 0 && coreTokens.every((w) => v.words.has(w));
          if (!coreOk) return;
          score = 0.5;
        }
        if ((" " + v.norm + " ").includes(" " + norm + " ")) score += 1; // volledige titel incl. mixnaam
        if (trackSeconds != null && v.seconds) {
          const diff = Math.abs(trackSeconds - v.seconds);
          if (diff <= 8) score += 0.6;
          else if (diff <= 25) score += 0.3;
          else if (diff > 90) score -= 0.5; // duidelijk een andere versie
        }
        // Mixconflict: de video draagt versiewoorden die de track niet
        // heeft (Long Version tegenover Radio Edit) — stevige aftrek.
        let conflict = false;
        for (const w of v.words) {
          if (MIX_WORDS.has(w) && !tokenSet.has(w)) { conflict = true; break; }
        }
        if (conflict) score -= 0.8;
        // Ondergrens: liever eerlijk geen match dan zeker een verkeerde.
        if (score < 0.7) return;
        scored.push({ ti, v, score });
      });
    });

    scored.sort((a, b) => b.score - a.score);

    const trackMatch = new Array(tracks.length).fill(null);
    const usedVideos = new Set();
    for (const s of scored) {
      if (trackMatch[s.ti] || usedVideos.has(s.v.ytId)) continue;
      trackMatch[s.ti] = { ytId: s.v.ytId, videoTitle: s.v.title };
      usedVideos.add(s.v.ytId);
    }

    // Diagnose: per track de beste kandidaten, voor het inspectiepaneel.
    lastDebug = tracks.map((t, ti) => {
      const candidates = scored
        .filter((s) => s.ti === ti)
        .slice(0, 3)
        .map((s) => ({
          title: s.v.title,
          score: Math.round(s.score * 100) / 100,
          seconds: s.v.seconds,
          chosen: trackMatch[ti] && trackMatch[ti].ytId === s.v.ytId
        }));
      return { track: t.title, duration: t.duration, candidates };
    });

    // Terugvalopties: per track alle kandidaten op scorevolgorde, en een
    // index van videotitels, voor als de beste video niet inbedbaar blijkt.
    lastCandidates = tracks.map((t, ti) =>
      scored.filter((s) => s.ti === ti).map((s) => s.v.ytId)
    );
    lastPool = {};
    pool.forEach((v) => {
      lastPool[v.ytId] = { title: v.title, seconds: v.seconds };
    });

    return tracks.map((t, ti) => ({
      ...t,
      ytId: trackMatch[ti] ? trackMatch[ti].ytId : null,
      videoTitle: trackMatch[ti] ? trackMatch[ti].videoTitle : null
    }));
  }

  function searchUrl(artist, title) {
    const q = encodeURIComponent(`${artist} ${title}`.trim());
    return `https://www.youtube.com/results?search_query=${q}`;
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function removePanel() {
    const old = document.getElementById("vinyltube-panel");
    if (old) old.remove();
  }

  function embedUrl(id, autoplay) {
    const params = new URLSearchParams();
    params.set("enablejsapi", "1");
    params.set("origin", location.origin);
    if (autoplay) params.set("autoplay", "1");
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  }

  function buildPanel(data) {
    removePanel();

    const artist = data.artists.join(", ");
    const tracks = matchVideos(data.tracklist, data.videos);
    const matched = tracks.filter((t) => t.ytId).length;

    const panel = el("aside", "", null);
    panel.id = "vinyltube-panel";

    // Kop
    const head = el("header", "vt-head");
    const disc = el("div", "vt-disc");
    disc.appendChild(el("div", "vt-disc-label"));
    head.appendChild(disc);
    const headText = el("div", "vt-head-text");
    const titleRow = el("div", "vt-title", data.title);
    const version = el("span", "vt-version", "v" + chrome.runtime.getManifest().version);
    titleRow.appendChild(version);
    headText.appendChild(titleRow);
    headText.appendChild(el("div", "vt-artist", artist));
    head.appendChild(headText);
    const collapse = el("button", "vt-collapse", "–");
    collapse.title = "Inklappen";
    head.appendChild(collapse);
    panel.appendChild(head);

    const body = el("div", "vt-body");

    // Speler
    const playerWrap = el("div", "vt-player");
    body.appendChild(playerWrap);
    const nowPlaying = el("div", "vt-nowplaying");
    body.appendChild(nowPlaying);

    const byYtId = {};
    const cands = lastCandidates;
    const poolInfo = lastPool;
    const badIds = new Set();
    let iframeEl = null;
    let requestedId = null;
    let endedGuard = null;
    let queue = [];

    function setCaption(title) {
      nowPlaying.textContent = title ? "▶ " + title : "";
    }

    function setCaptionLink(text, ytId) {
      nowPlaying.textContent = "";
      const a = document.createElement("a");
      a.href = "https://www.youtube.com/watch?v=" + ytId;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "vt-nowplaying-link";
      a.textContent = text;
      nowPlaying.appendChild(a);
    }

    function ensureIframe(firstId, autoplay) {
      playerWrap.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.src = embedUrl(firstId, autoplay);
      iframe.allow = "autoplay; encrypted-media";
      iframe.allowFullscreen = true;
      playerWrap.appendChild(iframe);
      // De embed vertelt pas wat er speelt nadat we ons hebben aangemeld.
      iframe.addEventListener("load", () => {
        try {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: "listening", id: "vinyltube", channel: "widget" }),
            "https://www.youtube.com"
          );
        } catch (_) {}
      });
      iframeEl = iframe;
    }

    // Eén video tegelijk; volgende tracks laden we zelf via het
    // berichtenkanaal in dezelfde speler. Geen playlist-parameter,
    // dus geen stille overslagen.
    function play(id, autoplay) {
      requestedId = id;
      endedGuard = null;
      panel.classList.add("vt-active");
      const t = byYtId[id];
      setCaption(t ? t.videoTitle : (poolInfo[id] ? poolInfo[id].title : ""));
      if (rowByYtId[id]) markPlaying(rowByYtId[id]);
      // Commando als laatste: de speler kan direct terugpraten (fout of
      // videoData) en die afhandeling moet onze UI-updates kunnen winnen.
      if (!iframeEl) {
        ensureIframe(id, autoplay);
      } else {
        try {
          iframeEl.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "loadVideoById", args: [id] }),
            "https://www.youtube.com"
          );
        } catch (_) {
          ensureIframe(id, autoplay);
        }
      }
    }

    function playableFrom(ti) {
      return tracks
        .slice(ti)
        .filter((t) => t.ytId && !badIds.has(t.ytId))
        .map((t) => t.ytId);
    }

    function playFrom(ti) {
      queue = playableFrom(ti);
      if (!queue.length) return;
      play(queue[0], true);
    }

    function advance() {
      const idx = queue.indexOf(requestedId);
      for (let i = idx + 1; i < queue.length; i++) {
        if (!badIds.has(queue[i])) {
          play(queue[i], true);
          return;
        }
      }
      panel.classList.remove("vt-active"); // plaat is afgelopen
    }

    // Een video die de speler weigert (inbedden uitgezet, verwijderd,
    // regioblokkade): probeer de volgende kandidaat voor die track, of
    // toon anders een link naar YouTube en speel door met de rest.
    function handleUnplayable(badId) {
      if (!badId || badIds.has(badId)) return;
      badIds.add(badId);
      const ti = tracks.findIndex((t) => t.ytId === badId);
      if (ti < 0) return;
      const inUse = new Set(tracks.map((t) => t.ytId));
      const sub = (cands[ti] || []).find(
        (id) => !badIds.has(id) && !inUse.has(id)
      );
      const row = rowByYtId[badId];
      if (sub) {
        tracks[ti].ytId = sub;
        tracks[ti].videoTitle = poolInfo[sub] ? poolInfo[sub].title : "";
        byYtId[sub] = tracks[ti];
        if (row) {
          delete rowByYtId[badId];
          rowByYtId[sub] = row;
          row.title = "Video: " + tracks[ti].videoTitle;
        }
        queue = queue.map((id) => (id === badId ? sub : id));
        play(sub, true);
      } else {
        tracks[ti].ytId = null;
        if (row) {
          row.classList.remove("vt-playable");
          row.classList.add("vt-broken");
        }
        setCaptionLink(
          "Deze video staat geen inbedden toe · open op YouTube",
          badId
        );
        advance();
      }
    }

    // Actiebalk
    const actions = el("div", "vt-actions");
    if (matched > 0) {
      const playAll = el("button", "vt-playall", "▶ Hele plaat");
      playAll.title = "Speel alle gekoppelde tracks achter elkaar";
      actions.appendChild(playAll);
    }
    const status = el(
      "span",
      "vt-status",
      matched
        ? `${matched} van ${tracks.length} tracks gekoppeld`
        : "Geen gekoppelde video's, gebruik de zoeklinks"
    );
    status.title = "Klik voor de matchdiagnose";
    actions.appendChild(status);
    body.appendChild(actions);

    // Diagnosepaneel: per track de kandidaten met scores.
    const debugBox = el("div", "vt-debug");
    lastDebug.forEach((d) => {
      const line = el("div", "vt-debug-track", `${d.track} (${d.duration || "?"})`);
      debugBox.appendChild(line);
      if (!d.candidates.length) {
        debugBox.appendChild(el("div", "vt-debug-cand", "geen kandidaten"));
      }
      d.candidates.forEach((c) => {
        const mm = c.seconds
          ? ` · ${Math.floor(c.seconds / 60)}:${String(c.seconds % 60).padStart(2, "0")}`
          : "";
        debugBox.appendChild(
          el(
            "div",
            "vt-debug-cand" + (c.chosen ? " vt-debug-chosen" : ""),
            `${c.chosen ? "✔ " : "   "}${c.score} · ${c.title}${mm}`
          )
        );
      });
    });
    debugBox.style.display = "none";
    body.appendChild(debugBox);
    status.addEventListener("click", () => {
      debugBox.style.display = debugBox.style.display === "none" ? "block" : "none";
    });

    // Tracklijst
    const list = el("ol", "vt-list");
    let playingRow = null;

    function markPlaying(row) {
      if (playingRow) playingRow.classList.remove("vt-playing");
      if (row) row.classList.add("vt-playing");
      playingRow = row;
    }

    const playAllBtn = actions.querySelector(".vt-playall");
    if (playAllBtn) {
      playAllBtn.addEventListener("click", () => playFrom(0));
    }

    const rowByYtId = {};

    tracks.forEach((t, ti) => {
      const row = el("li", "vt-row");
      row.appendChild(el("span", "vt-pos", t.position));
      row.appendChild(el("span", "vt-name", t.title));
      if (t.duration) row.appendChild(el("span", "vt-dur", t.duration));

      if (t.ytId) {
        byYtId[t.ytId] = t;
        rowByYtId[t.ytId] = row;
        row.classList.add("vt-playable");
        row.title = "Video: " + (t.videoTitle || "");
        row.addEventListener("click", () => {
          if (!t.ytId) return; // inmiddels als niet-inbedbaar gemarkeerd
          playFrom(ti);
        });
      } else {
        row.classList.add("vt-searchable");
        row.title = "Geen gekoppelde video; klik om op YouTube te zoeken";
        const link = el("a", "vt-search", "zoek");
        link.href = searchUrl(artist, t.title);
        link.target = "_blank";
        link.rel = "noopener";
        link.title = "Open YouTube-zoekresultaten in een nieuw tabblad";
        link.addEventListener("click", (e) => e.stopPropagation());
        row.appendChild(link);
        row.addEventListener("click", () => {
          if (t.ytId) { playFrom(ti); return; }
          searchAndPlay(ti, row);
        });
      }
      list.appendChild(row);
    });

    // Track zonder gekoppelde video: zelf op YouTube zoeken, de resultaten
    // door dezelfde strenge matcher halen, en de beste treffer spelen.
    function searchAndPlay(ti, row) {
      const t = tracks[ti];
      if (row.classList.contains("vt-searching")) return;
      row.classList.add("vt-searching");
      setCaption("Zoeken op YouTube: " + t.title + "…");
      chrome.runtime.sendMessage(
        { type: "ytSearch", q: (artist + " " + t.title).trim() },
        (res) => {
          row.classList.remove("vt-searching");
          if (chrome.runtime.lastError || !res || !res.ok) {
            toast("Zoeken op YouTube lukte niet; gebruik de zoeklink.");
            setCaption("");
            return;
          }
          const candVideos = (res.data.candidates || []).map((c) => ({
            uri: "https://www.youtube.com/watch?v=" + c.id,
            title: c.title,
            duration: c.seconds
          }));
          // Matcher hergebruiken voor deze ene track; globale
          // diagnosevelden even opzijzetten en terugzetten.
          const saveD = lastDebug, saveC = lastCandidates, saveP = lastPool;
          const matched = matchVideos([t], candVideos)[0];
          const searchCands = (lastCandidates[0] || []).slice();
          const searchPool = lastPool;
          lastDebug = saveD; lastCandidates = saveC; lastPool = saveP;

          if (!matched.ytId) {
            toast("Ook via zoeken geen overtuigende versie gevonden.");
            setCaption("");
            return;
          }
          t.ytId = matched.ytId;
          t.videoTitle = matched.videoTitle;
          byYtId[t.ytId] = t;
          rowByYtId[t.ytId] = row;
          Object.assign(poolInfo, searchPool);
          cands[ti] = searchCands;
          row.classList.remove("vt-searchable");
          row.classList.add("vt-playable");
          row.title = "Video: " + t.videoTitle;
          playFrom(ti);
        }
      );
    }

    // De embed rapporteert tijdens het spelen welke video aan de beurt is;
    // daarmee blijven titelregel en tracklijst kloppen als de plaat
    // vanzelf doorspeelt.
    window.addEventListener("message", (e) => {
      if (!panel.isConnected) return; // paneel van een vorige pagina
      if (e.origin !== "https://www.youtube.com") return;
      if (!iframeEl || e.source !== iframeEl.contentWindow) return;
      let data;
      try {
        data = JSON.parse(e.data);
      } catch (_) {
        return;
      }
      // Expliciete fout van de speler (o.a. 101/150: inbedden uitgezet)
      if (data && data.event === "onError") {
        const code = parseInt(data.info, 10);
        if ([2, 5, 100, 101, 150].includes(code)) handleUnplayable(requestedId);
        return;
      }
      if (!data || !data.info) return;
      // Video afgelopen: zelf de volgende track laden.
      if (data.info.playerState === 0 && endedGuard !== requestedId) {
        endedGuard = requestedId;
        advance();
        return;
      }
      const vd = data.info.videoData;
      if (!vd || !vd.video_id) return;
      const known = byYtId[vd.video_id];
      if (known) setCaption(known.videoTitle);
      if (rowByYtId[vd.video_id]) markPlaying(rowByYtId[vd.video_id]);
    });

    body.appendChild(list);
    panel.appendChild(body);

    // Eerste afspeelbare track alvast klaarzetten (zonder autoplay)
    const initialIds = playableFrom(0);
    if (initialIds.length) {
      queue = initialIds;
      requestedId = initialIds[0];
      ensureIframe(initialIds[0], false);
      const t0 = byYtId[initialIds[0]];
      setCaption(t0 ? t0.videoTitle : "");
      markPlaying(rowByYtId[initialIds[0]] || null);
    }

    collapse.addEventListener("click", () => {
      panel.classList.toggle("vt-collapsed");
      collapse.textContent = panel.classList.contains("vt-collapsed") ? "+" : "–";
      collapse.title = panel.classList.contains("vt-collapsed") ? "Uitklappen" : "Inklappen";
    });

    document.body.appendChild(panel);
  }

  function showError(message) {
    removePanel();
    const panel = el("aside", "vt-error", message);
    panel.id = "vinyltube-panel";
    document.body.appendChild(panel);
    setTimeout(removePanel, 6000);
  }

  function fetchAndBuild(kind, id, forKey) {
    chrome.runtime.sendMessage({ type: "fetchDiscogs", kind, id }, (res) => {
      if (currentKey !== forKey) return;
      if (chrome.runtime.lastError || !res || !res.ok) {
        showError("VinylTube kon deze release niet ophalen bij Discogs.");
        return;
      }
      buildPanel(res.data);
    });
  }

  // Shop- en sell-itempagina's: de release-ID staat in de pagina zelf,
  // maar de inhoud wordt vertraagd opgebouwd. Zoek in links én in de
  // ruwe HTML (datablobs), en blijf even geduldig proberen.
  function findReleaseIdInPage() {
    const links = document.querySelectorAll('a[href*="/release/"]');
    for (const a of links) {
      const m = (a.getAttribute("href") || "").match(/\/release\/(\d+)/);
      if (m) return m[1];
    }
    const html = document.documentElement.innerHTML;
    let m = html.match(/"release(?:Id|_id)"\s*:\s*"?(\d+)/i);
    if (m) return m[1];
    m = html.match(/\/release\/(\d+)/);
    if (m) return m[1];
    return null;
  }

  function pollForReleaseId(forKey, attemptsLeft, interval) {
    if (currentKey !== forKey) return; // gebruiker is alweer verder genavigeerd
    const releaseId = findReleaseIdInPage();
    if (releaseId) {
      fetchAndBuild("release", releaseId, forKey);
      return;
    }
    if (attemptsLeft <= 0) {
      showError("VinylTube kon op deze pagina geen release vinden.");
      return;
    }
    setTimeout(() => pollForReleaseId(forKey, attemptsLeft - 1, interval), interval);
  }

  function run() {
    const page = parsePage();
    if (!page) {
      currentKey = null;
      removePanel();
      return;
    }
    const key = `${page.kind}/${page.id}`;
    if (key === currentKey) return;
    currentKey = key;

    if (page.kind === "listing") {
      pollForReleaseId(key, 30, 500);
    } else {
      fetchAndBuild(page.kind, page.id, key);
    }
  }

  // Discogs navigeert deels client-side, dus houd URL-wijzigingen in de gaten.
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      run();
    }
  }).observe(document.body, { childList: true, subtree: true });

  run();
})();
