const { fetchResilient, HttpError, USER_AGENT } = require("./net");
const { buildMagnet } = require("./magnet");

const API = "https://eztv.wf/api/get-torrents";

function matchesEpisode(title, season, episode) {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return new RegExp(`S${s}E${e}|${season}x${e}`, "i").test(title);
}

async function searchEztv(imdbId, season, episode) {
  // EZTV expects numeric IMDB ID without 'tt' prefix
  const id = imdbId.replace(/^tt/, "");
  const res = await fetchResilient(`${API}?imdb_id=${id}&limit=100`, {
    headers: { "User-Agent": USER_AGENT },
    retries: 1,
  });
  if (!res.ok) throw new HttpError(res.status, `EZTV returned ${res.status}`);

  const json = await res.json();
  const out = [];
  for (const t of json.torrents || []) {
    const hash = (t.hash || "").toLowerCase();
    const name = t.title || t.filename || hash;
    const magnet = t.magnet_url || (hash ? buildMagnet(hash, name) : "");
    if (!magnet || !hash) continue;
    if (season != null && episode != null && !matchesEpisode(name, season, episode)) {
      continue;
    }
    out.push({
      infoHash: hash,
      name,
      sizeBytes: Number(t.size_bytes || 0) || 0,
      seeders: t.seeds || 0,
      leechers: t.peers || 0,
      source: "eztv",
      magnet,
    });
  }
  return out;
}

module.exports = { searchEztv };
