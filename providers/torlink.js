var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/torlink/net.js
var require_net = __commonJS({
  "src/torlink/net.js"(exports2, module2) {
    var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    var HttpError = class extends Error {
      constructor(status, message) {
        super(message || `HTTP ${status}`);
        this.name = "HttpError";
        this.status = status;
      }
    };
    var RETRY_STATUS = [408, 425, 429, 500, 502, 503, 504];
    var FETCH_TIMEOUT_MS = 15e3;
    function withTimeout(promise, ms, url) {
      return Promise.race([
        promise,
        new Promise(
          (_, reject) => setTimeout(() => reject(new HttpError(0, `Timeout after ${ms}ms: ${url}`)), ms)
        )
      ]);
    }
    function fetchResilient(_0) {
      return __async(this, arguments, function* (url, init = {}) {
        const { retries = 1, ...rest } = init;
        let lastError;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const res = yield withTimeout(fetch(url, rest), FETCH_TIMEOUT_MS, url);
            if (!RETRY_STATUS.includes(res.status)) return res;
            lastError = new HttpError(res.status, `${url} returned ${res.status}`);
          } catch (e) {
            lastError = e;
          }
          if (attempt < retries) {
            yield new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
          }
        }
        throw lastError;
      });
    }
    function qs(params) {
      return Object.keys(params).map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
    }
    module2.exports = { USER_AGENT, HttpError, fetchResilient, qs };
  }
});

// src/torlink/meta.js
var require_meta = __commonJS({
  "src/torlink/meta.js"(exports2, module2) {
    var { fetchResilient } = require_net();
    var TMDB_API_KEY = "1865f43a0549ca50d341dd9ab8b29f49";
    var ANIMATION_GENRE_ID = 16;
    function fetchMeta2(tmdbId, mediaType) {
      return __async(this, null, function* () {
        try {
          const kind = mediaType === "tv" ? "tv" : "movie";
          const url = `https://api.themoviedb.org/3/${kind}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`;
          const res = yield fetchResilient(url, { retries: 1 });
          if (!res.ok) return null;
          const d = yield res.json();
          const name = d.title || d.name;
          if (!name) return null;
          const date = d.release_date || d.first_air_date || "";
          const year = date ? Number(date.slice(0, 4)) : void 0;
          const imdbId = d.external_ids && d.external_ids.imdb_id || d.imdb_id || null;
          const isAnime = d.original_language === "ja" && (d.genres || []).some((g) => g.id === ANIMATION_GENRE_ID);
          return { name, year, imdbId, isAnime };
        } catch (e) {
          return null;
        }
      });
    }
    module2.exports = { fetchMeta: fetchMeta2 };
  }
});

// src/torlink/format.js
var require_format = __commonJS({
  "src/torlink/format.js"(exports2, module2) {
    var SIZE_UNITS = {
      B: 1,
      KIB: 1024,
      MIB: 1024 ** 2,
      GIB: 1024 ** 3,
      TIB: 1024 ** 4,
      KB: 1e3,
      MB: 1e6,
      GB: 1e9,
      TB: 1e12
    };
    function parseSize(s) {
      const m = s.match(/([\d.]+)\s*([KMGT]?I?B)/i);
      if (!m) return 0;
      return Math.round(parseFloat(m[1]) * (SIZE_UNITS[m[2].toUpperCase()] || 1));
    }
    function formatBytes2(bytes) {
      if (!bytes || !Number.isFinite(bytes)) return "0 B";
      const units = ["B", "KiB", "MiB", "GiB", "TiB"];
      let n = bytes;
      let i = 0;
      while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
      }
      return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    }
    module2.exports = { parseSize, formatBytes: formatBytes2 };
  }
});

// src/torlink/magnet.js
var require_magnet = __commonJS({
  "src/torlink/magnet.js"(exports2, module2) {
    var TRACKERS = [
      "udp://tracker.opentrackr.org:1337/announce",
      "udp://open.demonii.com:1337/announce",
      "udp://tracker.openbittorrent.com:6969/announce",
      "udp://tracker.torrent.eu.org:451/announce",
      "udp://exodus.desync.com:6969/announce",
      "udp://open.stealth.si:80/announce"
    ];
    function buildMagnet(infoHash, name) {
      const dn = encodeURIComponent(name);
      const tr = TRACKERS.map((t) => `&tr=${encodeURIComponent(t)}`).join("");
      return `magnet:?xt=urn:btih:${infoHash}&dn=${dn}${tr}`;
    }
    function unescapeEntities(s) {
      return s.replace(/&#0?38;|&amp;/g, "&").replace(/&#8211;|&#8212;/g, "-").replace(/&#8217;|&#0?39;|&apos;/g, "'").replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#160;|&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10))).replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
    }
    module2.exports = { TRACKERS, buildMagnet, unescapeEntities };
  }
});

// src/torlink/yts.js
var require_yts = __commonJS({
  "src/torlink/yts.js"(exports2, module2) {
    var { fetchResilient, HttpError, USER_AGENT, qs } = require_net();
    var { buildMagnet } = require_magnet();
    var HOSTS = ["yts.mx", "yts.am", "yts.rs"];
    function fetchMovies(query) {
      return __async(this, null, function* () {
        const params = qs({ limit: "50", query_term: query.trim() });
        let lastError;
        for (const host of HOSTS) {
          try {
            const res = yield fetchResilient(`https://${host}/api/v2/list_movies.json?${params}`, {
              headers: { "User-Agent": USER_AGENT },
              retries: 1
            });
            if (res.ok) return yield res.json();
            lastError = new HttpError(res.status, `YTS ${host} returned ${res.status}`);
          } catch (e) {
            lastError = e;
          }
        }
        throw lastError;
      });
    }
    function searchYts2(query) {
      return __async(this, null, function* () {
        const json = yield fetchMovies(query);
        const out = [];
        const movies = json.data && json.data.movies || [];
        for (const movie of movies) {
          const base = movie.title_long || movie.title || "Unknown";
          for (const t of movie.torrents || []) {
            if (!t.hash) continue;
            const infoHash = t.hash.toLowerCase();
            const tag = [t.quality, t.type].filter(Boolean).join(" ");
            const name = tag ? `${base} [${tag}]` : base;
            out.push({
              infoHash,
              name,
              sizeBytes: t.size_bytes || 0,
              seeders: t.seeds || 0,
              leechers: t.peers || 0,
              source: "yts",
              magnet: buildMagnet(infoHash, name)
            });
          }
        }
        return out;
      });
    }
    module2.exports = { searchYts: searchYts2 };
  }
});

// src/torlink/eztv.js
var require_eztv = __commonJS({
  "src/torlink/eztv.js"(exports2, module2) {
    var { fetchResilient, HttpError, USER_AGENT } = require_net();
    var { buildMagnet } = require_magnet();
    var API = "https://eztv.wf/api/get-torrents";
    function matchesEpisode(title, season, episode) {
      const s = String(season).padStart(2, "0");
      const e = String(episode).padStart(2, "0");
      return new RegExp(`S${s}E${e}|${season}x${e}`, "i").test(title);
    }
    function searchEztv2(imdbId, season, episode) {
      return __async(this, null, function* () {
        const id = imdbId.replace(/^tt/, "");
        const res = yield fetchResilient(`${API}?imdb_id=${id}&limit=100`, {
          headers: { "User-Agent": USER_AGENT },
          retries: 1
        });
        if (!res.ok) throw new HttpError(res.status, `EZTV returned ${res.status}`);
        const json = yield res.json();
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
            magnet
          });
        }
        return out;
      });
    }
    module2.exports = { searchEztv: searchEztv2 };
  }
});

// src/torlink/piratebay.js
var require_piratebay = __commonJS({
  "src/torlink/piratebay.js"(exports2, module2) {
    var { fetchResilient, HttpError, USER_AGENT } = require_net();
    var { buildMagnet } = require_magnet();
    var API = "https://apibay.org";
    var MOVIE_CATS = [201, 202, 207, 209];
    var TV_CATS = [205, 208];
    var ZERO_HASH = "0000000000000000000000000000000000000000";
    function toResult(it, source) {
      const infoHash = (it.info_hash || "").toLowerCase();
      if (!infoHash || infoHash === ZERO_HASH || it.id === "0") return null;
      const name = it.name || "Unknown";
      return {
        infoHash,
        name,
        sizeBytes: Number(it.size) || 0,
        seeders: Number(it.seeders) || 0,
        leechers: Number(it.leechers) || 0,
        source,
        magnet: buildMagnet(infoHash, name)
      };
    }
    function fetchItems(query) {
      return __async(this, null, function* () {
        const res = yield fetchResilient(`${API}/q.php?q=${encodeURIComponent(query)}`, {
          headers: { "User-Agent": USER_AGENT },
          retries: 1
        });
        if (!res.ok) throw new HttpError(res.status, `TPB returned ${res.status}`);
        const json = yield res.json();
        return Array.isArray(json) ? json : [];
      });
    }
    function searchTpb(query, cats, source) {
      return __async(this, null, function* () {
        const items = yield fetchItems(query);
        return items.filter((it) => cats.includes(Number(it.category))).map((it) => toResult(it, source)).filter(Boolean);
      });
    }
    var searchTpbMovies2 = (query) => searchTpb(query, MOVIE_CATS, "tpb-movies");
    var searchTpbTv2 = (query) => searchTpb(query, TV_CATS, "tpb-tv");
    module2.exports = { searchTpbMovies: searchTpbMovies2, searchTpbTv: searchTpbTv2 };
  }
});

// src/torlink/x1337.js
var require_x1337 = __commonJS({
  "src/torlink/x1337.js"(exports2, module2) {
    var { fetchResilient, HttpError, USER_AGENT } = require_net();
    var { parseSize } = require_format();
    var { unescapeEntities } = require_magnet();
    var HOSTS = ["1337x.to", "1337x.st", "x1337x.ws", "1337xx.to"];
    var MAX_DETAILS = 6;
    function parseRows(html) {
      const start = html.indexOf("table-list");
      if (start < 0) return [];
      const out = [];
      for (const tr of html.slice(start).split(/<tr[\s>]/i).slice(1)) {
        const link = tr.match(/href="(\/torrent\/[^"]+)"[^>]*>([^<]+)<\/a>/i);
        if (!link) continue;
        const sizeMatch = tr.match(/class="coll-4 size[^"]*">\s*([\d.]+\s*[KMGT]i?B)/i);
        const seedMatch = tr.match(/class="coll-2 seeds[^"]*">\s*(\d+)/i);
        const leechMatch = tr.match(/class="coll-3 leeches[^"]*">\s*(\d+)/i);
        out.push({
          name: unescapeEntities(link[2].trim()),
          path: link[1],
          seeders: Number(seedMatch ? seedMatch[1] : 0),
          leechers: Number(leechMatch ? leechMatch[1] : 0),
          sizeBytes: parseSize(sizeMatch ? sizeMatch[1] : "")
        });
      }
      return out;
    }
    function fetchText(url, retries) {
      return __async(this, null, function* () {
        const res = yield fetchResilient(url, {
          headers: { "User-Agent": USER_AGENT },
          retries
        });
        if (!res.ok) throw new HttpError(res.status, `1337x returned ${res.status}`);
        return res.text();
      });
    }
    function detailMagnet(base, path) {
      return __async(this, null, function* () {
        try {
          const html = yield fetchText(`${base}${path}`, 1);
          const raw = html.match(/magnet:\?xt=urn:btih:[^"'<>\s]+/i);
          return raw ? unescapeEntities(raw[0]) : null;
        } catch (e) {
          return null;
        }
      });
    }
    var STOP = ["the", "a", "an", "of", "and", "or", "to"];
    function search(query, cat, source) {
      return __async(this, null, function* () {
        const q = query.trim();
        const path = q ? `/category-search/${encodeURIComponent(q).replace(/%20/g, "+")}/${cat}/1/` : `/popular-${cat === "Movies" ? "movies" : "tv"}`;
        let base = "";
        let html = "";
        let lastError;
        for (const host of HOSTS) {
          try {
            const candidate = `https://${host}`;
            html = yield fetchText(`${candidate}${path}`, 1);
            base = candidate;
            break;
          } catch (e) {
            lastError = e;
          }
        }
        if (!base) throw lastError || new Error("1337x unreachable");
        const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
        const need = tokens.filter((t) => !STOP.includes(t));
        const rows = parseRows(html).filter((r) => {
          if (!need.length) return true;
          const n = r.name.toLowerCase();
          return need.every((t) => {
            if (n.includes(t)) return true;
            const ep = t.match(/^s(\d+)e(\d+)$/);
            if (ep) return new RegExp(`${parseInt(ep[1], 10)}x${ep[2]}`, "i").test(n);
            return false;
          });
        }).sort((a, b) => b.seeders - a.seeders).slice(0, MAX_DETAILS);
        const settled = yield Promise.all(
          rows.map((row) => __async(this, null, function* () {
            const magnet = yield detailMagnet(base, row.path);
            const hashMatch = magnet && magnet.match(/urn:btih:([a-zA-Z0-9]+)/i);
            if (!magnet || !hashMatch) return null;
            return {
              infoHash: hashMatch[1].toLowerCase(),
              name: row.name,
              sizeBytes: row.sizeBytes,
              seeders: row.seeders,
              leechers: row.leechers,
              source,
              magnet
            };
          }))
        );
        return settled.filter(Boolean);
      });
    }
    var searchX1337Movies2 = (query) => search(query, "Movies", "x1337-movies");
    var searchX1337Tv2 = (query) => search(query, "TV", "x1337-tv");
    module2.exports = { searchX1337Movies: searchX1337Movies2, searchX1337Tv: searchX1337Tv2 };
  }
});

// src/torlink/bitsearch.js
var require_bitsearch = __commonJS({
  "src/torlink/bitsearch.js"(exports2, module2) {
    var { fetchResilient, HttpError, USER_AGENT, qs } = require_net();
    var { buildMagnet } = require_magnet();
    var API = "https://bitsearch.eu/api/v1/search";
    var MOVIE_CAT = 2;
    var TV_CAT = 1;
    function toResult(item, source) {
      const infoHash = (item.infohash || "").toLowerCase();
      if (!infoHash) return null;
      const name = item.title || "Unknown";
      return {
        infoHash,
        name,
        sizeBytes: item.size || 0,
        seeders: item.seeders || 0,
        leechers: item.leechers || 0,
        source,
        magnet: buildMagnet(infoHash, name)
      };
    }
    function fetchItems(query) {
      return __async(this, null, function* () {
        const res = yield fetchResilient(`${API}?${qs({ q: query.trim(), fuv: "true" })}`, {
          headers: { "User-Agent": USER_AGENT },
          retries: 1
        });
        if (!res.ok) throw new HttpError(res.status, `Bitsearch returned ${res.status}`);
        const json = yield res.json();
        return Array.isArray(json.results) ? json.results : [];
      });
    }
    function searchBitsearch(query, cat, source) {
      return __async(this, null, function* () {
        const items = yield fetchItems(query);
        return items.filter((r) => r.category === cat).map((r) => toResult(r, source)).filter(Boolean);
      });
    }
    var searchBitsearchMovies2 = (query) => searchBitsearch(query, MOVIE_CAT, "bitsearch-movies");
    var searchBitsearchTv2 = (query) => searchBitsearch(query, TV_CAT, "bitsearch-tv");
    module2.exports = { searchBitsearchMovies: searchBitsearchMovies2, searchBitsearchTv: searchBitsearchTv2 };
  }
});

// src/torlink/nyaa.js
var require_nyaa = __commonJS({
  "src/torlink/nyaa.js"(exports2, module2) {
    var { fetchResilient, HttpError, USER_AGENT, qs } = require_net();
    var { parseSize } = require_format();
    var { buildMagnet, unescapeEntities } = require_magnet();
    function tag(item, name) {
      const m = item.match(
        new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, "s")
      );
      return m ? m[1].trim() : "";
    }
    function searchNyaa2(query) {
      return __async(this, null, function* () {
        const params = qs({ page: "rss", q: query.trim(), c: "0_0", f: "0" });
        const res = yield fetchResilient(`https://nyaa.si/?${params}`, {
          headers: { "User-Agent": USER_AGENT },
          retries: 1
        });
        if (!res.ok) throw new HttpError(res.status, `Nyaa returned ${res.status}`);
        const xml = yield res.text();
        const out = [];
        for (const item of xml.split("<item>").slice(1)) {
          const infoHash = tag(item, "nyaa:infoHash").toLowerCase();
          const name = unescapeEntities(tag(item, "title"));
          if (!infoHash || !name) continue;
          out.push({
            infoHash,
            name,
            sizeBytes: parseSize(tag(item, "nyaa:size")),
            seeders: Number(tag(item, "nyaa:seeders")) || 0,
            leechers: Number(tag(item, "nyaa:leechers")) || 0,
            source: "nyaa",
            magnet: buildMagnet(infoHash, name)
          });
        }
        return out;
      });
    }
    module2.exports = { searchNyaa: searchNyaa2 };
  }
});

// src/torlink/index.js
var { fetchMeta } = require_meta();
var { formatBytes } = require_format();
var { searchYts } = require_yts();
var { searchEztv } = require_eztv();
var { searchTpbMovies, searchTpbTv } = require_piratebay();
var { searchX1337Movies, searchX1337Tv } = require_x1337();
var { searchBitsearchMovies, searchBitsearchTv } = require_bitsearch();
var { searchNyaa } = require_nyaa();
var PROVIDER_NAME = "TorLink";
var MAX_STREAMS = 40;
var SOURCE_LABELS = {
  yts: "YTS",
  eztv: "EZTV",
  "tpb-movies": "TPB",
  "tpb-tv": "TPB",
  "x1337-movies": "1337x",
  "x1337-tv": "1337x",
  "bitsearch-movies": "Bitsearch",
  "bitsearch-tv": "Bitsearch",
  nyaa: "Nyaa"
};
function dedup(results) {
  const seen = {};
  return results.filter((r) => {
    if (!r.infoHash || seen[r.infoHash]) return false;
    seen[r.infoHash] = true;
    return true;
  });
}
function detectQuality(name) {
  const n = name.toUpperCase();
  if (/\b(2160P|4K|UHD)\b/.test(n)) return "2160p";
  if (n.indexOf("1080P") >= 0) return "1080p";
  if (n.indexOf("720P") >= 0) return "720p";
  if (n.indexOf("480P") >= 0) return "480p";
  return "Unknown";
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const meta = yield fetchMeta(tmdbId, mediaType);
      if (!meta) {
        console.log(`[${PROVIDER_NAME}] No TMDB meta for ${mediaType}/${tmdbId}`);
        return [];
      }
      const baseQuery = meta.year ? `${meta.name} ${meta.year}` : meta.name;
      const episodeQuery = season != null && episode != null ? `${meta.name} S${pad2(season)}E${pad2(episode)}` : baseQuery;
      const searches = [];
      if (mediaType === "tv") {
        if (meta.imdbId) searches.push(searchEztv(meta.imdbId, season, episode));
        searches.push(
          searchTpbTv(episodeQuery),
          searchX1337Tv(episodeQuery),
          searchBitsearchTv(episodeQuery)
        );
        if (meta.isAnime) searches.push(searchNyaa(episodeQuery));
      } else {
        if (meta.imdbId) searches.push(searchYts(meta.imdbId));
        searches.push(
          searchTpbMovies(baseQuery),
          searchX1337Movies(baseQuery),
          searchBitsearchMovies(baseQuery)
        );
        if (meta.isAnime) searches.push(searchNyaa(baseQuery));
      }
      const settled = yield Promise.all(
        searches.map(
          (p) => p.catch((e) => {
            console.log(`[${PROVIDER_NAME}] source failed: ${e && e.message}`);
            return [];
          })
        )
      );
      const all = dedup([].concat.apply([], settled)).filter((r) => r.seeders > 0).sort((a, b) => b.seeders - a.seeders).slice(0, MAX_STREAMS);
      console.log(`[${PROVIDER_NAME}] ${all.length} streams for "${baseQuery}"`);
      return all.map((r) => ({
        name: PROVIDER_NAME,
        title: [
          r.name,
          `\u{1F465} ${r.seeders} seeds \xB7 ${formatBytes(r.sizeBytes)} \xB7 ${SOURCE_LABELS[r.source] || r.source}`
        ].join("\n"),
        url: r.magnet,
        quality: detectQuality(r.name),
        size: r.sizeBytes || void 0
      }));
    } catch (e) {
      console.error(`[${PROVIDER_NAME}] Error: ${e && e.message}`);
      return [];
    }
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
