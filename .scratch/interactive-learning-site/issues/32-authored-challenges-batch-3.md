# 32: Authored Challenges, batch 3: video streaming, ride sharing, search autocomplete

**What to build:** Three more authored Challenges in the same format as ticket 30:
- video streaming (YouTube-like: upload pipeline, transcoding, CDN delivery);
- ride sharing (Uber-like: location updates, geospatial matching);
- search autocomplete (trie/prefix service, ranking, caching).

**Blocked by:** 20

**Status:** resolved

- [x] Three Challenge definitions with source = authored.
- [x] Any new components (e.g. transcoding worker, geospatial index) are added with config schema and simulation defaults.
- [x] Content validation tests pass for all three.
- [x] Any new component type or predicate has Seam A tests.

## Comments

**Done on `main`.**

- **Three new palette components** (`components.ts`), with Glossary Terms "Transcoding", "Geospatial index" and "Trie" for the palette tooltips.
  - **Transcoding worker** (`transcoder`, tag ENC).
    - `renditions` (default 1) is the number of formats each upload is encoded into. Each rendition is sent along each Edge out as its own write.
    - An instance encodes 5 renditions a second, each in about a second (1,000.5 ms), for $300 a month. The primer's table has no line for encoding: it stands as reading a gigabyte sequentially from SSD.
    - Its capacity counts the renditions it encodes, not one per Edge: it serves capacity ÷ renditions uploads.
    - `simulate.ts` now keeps one `MULTI_OUTPUT` map for the fan-out service and the transcoder (the counting field, and whether the cost is per Edge). The spec's Simulation Engine section describes it.
  - **Geospatial index** (`geo-index`, tag GEO).
    - Config: `index` (geohash, quadtree, H3), `shardKey` and `instances`.
    - An instance takes 20,000 requests a second in 0.51 ms, in memory. Like other storage, it answers reads itself and passes only writes on.
  - **Trie** (`trie`, tag TRIE).
    - Config: `topK` (default 5), `shardKey` and `instances`.
    - An instance answers 5,000 lookups a second in 0.505 ms. It is storage that answers reads itself.
    - Beside a cache (cache-aside) it gets only the misses, like a database. The set is renamed `CACHE_ASIDE_STORES`.
  - `index` and `topK` change nothing in the simulation, like the load balancer's `algorithm`.
- **The CDN now answers 90% of reads itself** (`hitRatio: 0.9`) and passes only its misses to the origin.
  - Before, it passed every read on, so a CDN only added latency, and "CDN delivery" could not be modelled. A cold CDN now means something too.
  - The primer Challenges whose object stores were sized for every read are resized, with their comments and the two Hints that said the CDN passes its reads on: AWS 50 → 10, Twitter 200 → 25, sales rank 50 → 5.
  - The Pastebin test that undersized the Object Store now undersizes the Read API, since one Object Store instance passes now.
- **Three Challenges** (`content/authored-challenges/`, after the notification system), each with five Stages, Azerbaijani explanations and no Solution page.
  - `authored-challenges/shared.ts` now also holds `scaledOutNodes` and `queuedWrites`.
  - **Video streaming** (`video-streaming.ts`):
    - 25M uploads and 25B views a month, 50 MB each, a 2× peak: 10 uploads and 10,000 views a second, 1.25 PB of originals a month, 500 GB a second streamed.
    - High-level design:
      - an upload is stored in the object store and recorded in the metadata store, and its transcoding goes through a queue;
      - the transcoder encodes 4 renditions (`renditions: 4`) into the object store;
      - views reach the videos only through a CDN: a pull CDN from the object store, or a push CDN the transcoders write to.
    - Scaling at the peak (20,000 views, 20 uploads, 80 renditions a second):
      - read ≤ 30 ms, which a design without the CDN misses at any origin size; upload ≤ 200 ms, which synchronous encoding misses;
      - a metadata cache and scaled-out transcoders.
      - Chaos task: the transcoders go down, so uploads must still be accepted.
    - Deep dive: pre-signed multipart uploads, adaptive bitrate (HLS/DASH segments), pull vs pre-positioned CDN, parallel chunked transcoding, crash recovery with ack and idempotent outputs, and batched view counters.
  - **Ride sharing** (`ride-sharing.ts`):
    - 50,000 drivers online, each updating every 5 s, plus 2,000 riders' requests a second, a 2× peak: 10,000 updates a second, 2.5 TB of history a month, 30 TB a year.
    - High-level design:
      - updates come over a WebSocket gateway into the geospatial index, and none from the gateway reaches SQL;
      - riders' searches read the index through a ride service, and trips live in SQL;
      - the location history goes through a stream (queue).
    - Scaling at the peak (20,000 updates, 4,000 searches a second):
      - read ≤ 20 ms, and a sharded geo index;
      - Chaos task: the history store goes down, so updates and searches continue.
    - Deep dive: cell search with neighbours, geohash/H3 vs quadtree vs R-tree, sharding by cell for hot spots, atomic driver offers with a TTL lock, a TTL for vanished drivers, and what the history is for.
  - **Search autocomplete** (`search-autocomplete.ts`):
    - 2.5B searches a month, 4 suggestion requests each, a 3× peak: 4,000 suggestion requests and 1,000 searches a second, 250 GB of logged searches a month, 3 TB a year.
    - High-level design:
      - suggestions come from the trie through an autocomplete service, and none from a SQL query;
      - searches are logged through a queue into a frequency store;
      - the trie is written only by a builder (MapReduce), never on a search's way.
    - Scaling at the peak (12,000 suggestion requests, 3,000 searches a second):
      - read ≤ 20 ms, and a suggestion cache;
      - Chaos task: the cache is flushed when a new trie is swapped in, so the trie must take every suggestion (3 instances).
    - Deep dive: top-k kept at each node, debounce and browser caching, sharding by prefix ranges, ranking with decay and by region, filtering, and swapping in a rebuilt trie.
  - In each file's header: a view, a rider's request and a suggestion are reads; uploads, location updates and logged searches are writes. Trips and the trie rebuild are drawn but get no load.
- **Tests.**
  - `simulate.test.ts`:
    - CDN: answers 90% at the edge, and passes everything on when cold;
    - transcoder: default 1 rendition, one write per rendition per Edge, capacity counting renditions and not Edges, and overload;
    - geospatial index: answers searches itself and passes only writes on;
    - trie: answers itself, and gets only the misses beside a cache.
  - `primer-catalog.test.ts`: the nine authored Challenges, each Estimation's numbers, and key mistakes:
    - video: renditions written, 1 rendition refused, push CDN accepted, views around the CDN refused, no CDN too slow, synchronous transcoding failing latency and Chaos;
    - ride sharing: updates to SQL or around the gateway refused, trips on Edges carrying both kinds accepted, an unsharded index overloaded, synchronous history failing only its Chaos task;
    - autocomplete: SQL suggestions refused, searches updating the trie refused, no builder refused, one trie instance passing the peak but failing the flush.
- **Review.** /code-review (Standards + Spec) findings are fixed:
  - the CDN change is carried into the primer Challenges (see above);
  - `locations-in-memory` now starts at the WebSocket gateway, so trips on Edges carrying both kinds pass;
  - the `trip-store` description now matches its check;
  - the peak Hints now give every bottleneck's size (queue, web server, wide-column store, object store, SQL replicas), with "more than N" at ρ = 1;
  - "hücrə" is now "xana";
  - the repeated fan-out and transcoder checks are one map, with clearer names;
  - the duplicated predicates are now shared helpers.
  - Kept as is:
    - `renditions` must be exactly 4, as the prompt asks;
    - `topK` and `index` have no effect in the simulation, as `eviction` has none.
