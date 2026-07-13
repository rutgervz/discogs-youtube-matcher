// Regressietest van de matcher op vier echte platen.
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "extension", "content.js"), "utf8");
const start = src.indexOf("function ytIdFromUri");
const end = src.indexOf("function searchUrl");
eval(src.slice(start, end));

const V = (id, title, mmss) => {
  const [m, s] = String(mmss).split(":").map(Number);
  return { uri: "https://youtu.be/" + id, title, duration: s != null ? m * 60 + s : 0 };
};
let failures = 0;
function show(name, tracks, videos, expect) {
  const res = matchVideos(tracks, videos);
  let allOk = true;
  res.forEach((r, i) => {
    const got = r.ytId || null;
    const ok = got === expect[i];
    if (!ok) allOk = false;
    const v = videos.find((x) => got && x.uri.endsWith(got));
    console.log(` ${ok ? "✔" : "✘"} ${r.position || i} ${r.title} → ${v ? v.title : "geen match"}`);
  });
  if (!allOk) failures++;
  console.log(allOk ? `${name}: ALLES GOED\n` : `${name}: FOUT\n`);
}

console.log("== Rhythm Controll – My House (1284613) ==");
show("Rhythm Controll",
  [
    { position: "A1", title: "My House (Radio Edit)", duration: "4:20" },
    { position: "A2", title: "My House (Long Version)", duration: "7:40" },
    { position: "B1", title: "My House (Dub Mix)", duration: "6:06" },
    { position: "B2", title: "My House (Acapella)", duration: "3:08" }
  ],
  [
    V("USabwKyI260", "Rhythm Controll - My House (Long Version) 1987", "7:42"),
    V("Ns0yAf2ro_w", 'RHYTHM CONTROLL "MY HOUSE" ((DUB MIX))', "6:12"),
    V("14HV-n3nrFA", "Rhythm Control - My House (Long Version)", "7:31"),
    V("yJPYPu4fjZs", "Rhythm Controll My House (Long Version)", "8:37"),
    V("qXsdh7g1ffc", "Rhythm Controll - My House (Acapella)", "3:07"),
    V("tBApojB9SQs", "Rhythm Controll - My House (Original Mix)", "2:30"),
    V("OvP5XvrxB9U", "My House (DJ Island Remix)", "5:59")
  ],
  [null, "USabwKyI260", "Ns0yAf2ro_w", "qXsdh7g1ffc"]
);

console.log("== The Ones – Flawless (22245) ==");
show("Flawless",
  [
    { position: "A1", title: "Flawless (Phunk Investigation Vocal Mix)", duration: "7:39" },
    { position: "AA1", title: "Flawless (Sharp Hammerhead Remix)", duration: "5:45" },
    { position: "AA2", title: "Flawless (Different Gear Remix)", duration: "6:23" }
  ],
  [
    V("So6oK--uP7M", "The Ones - Flawless [HQ] (2001 Music Video)", "3:07"),
    V("K0KTCWFyy4Y", "The Ones - Flawless (Phunk Investigation Extended Club Mix) HQ", "7:38"),
    V("_zyBiH0T8es", "THE ONES - FLAWLESS (Phunk Investigation Dub Mix) HQwav", "7:43"),
    V("qa44k4-ryCA", "The Ones - Flawless (Italo Disco Mix)", "8:04"),
    V("8FO729eq-Xs", "The Ones - Flawless", "5:51"),
    V("j3GDY6BbdrM", "Flawless (Dub Mix)", "4:40"),
    V("VMouiXImMhk", "The Ones - Flawless (Different Gear Remix)", "7:57"),
    V("KNroop_sqSI", "The Ones - Flawless (Phunk Investigation Vocal Mix)", "7:45"),
    V("8EGJBFr4br0", "The Ones Flawless Sharp Hammerhead Remix", "5:47")
  ],
  ["KNroop_sqSI", "8EGJBFr4br0", "VMouiXImMhk"]
);

console.log("== Cherrymoon Trax – master 1606794 ==");
show("Cherrymoon",
  [
    { position: "A", title: "The House Of House", duration: "7:39" },
    { position: "B", title: "Let There Be House", duration: "8:09" }
  ],
  [
    V("JZXve_jk1gs", "Cherrymoon Trax - The House Of House (Original Mix)", "7:39"),
    V("ggmRh719v9s", "Cherrymoon Trax - Let There Be House (Original Mix)", "8:09"),
    V("Z8CZaDiVKOY", "Cherrymoon Trax - The House Of House (Radio Edit) [Bonzai Classics]", "3:26"),
    V("g3DSnAeZDPY", "Cherrymoon Trax - Let There Be House (Radio Edit) [Bonzai Classics]", "3:25")
  ],
  ["JZXve_jk1gs", "ggmRh719v9s"]
);

console.log("== Madonna – Confessions II (zonder trackduren) ==");
show("Madonna",
  [
    { position: "A1", title: "I Feel So Free", duration: "" },
    { position: "A4", title: "Bring Your Love", duration: "" },
    { position: "B3", title: "Bizarre", duration: "" }
  ],
  [
    V("Zx83eVfP64A", "Madonna - I Feel So Free (Official Visualizer)", "4:59"),
    V("EHrt-gFgvXo", "Madonna & Sabrina Carpenter - Bring Your Love (Official Video)", "4:07"),
    V("pny6ILbAyWc", "Madonna & Martin Garrix - Bizarre (Official Audio)", "4:06"),
    V("88fD-UtG_yo", "Madonna - Love Sensation (Official Visualizer)", "3:53")
  ],
  ["Zx83eVfP64A", "EHrt-gFgvXo", "pny6ILbAyWc"]
);

process.exitCode = failures ? 1 : 0;
