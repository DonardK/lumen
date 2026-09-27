# Graph Report - streaming-player  (2026-09-27)

## Corpus Check
- 29 files · ~38,716 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 143 nodes · 188 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1f58b0fd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]

## God Nodes (most connected - your core abstractions)
1. `TorrentManager` - 14 edges
2. `TranscodeServer` - 10 edges
3. `cn()` - 9 edges
4. `DirectServer` - 5 edges
5. `getFfmpeg()` - 5 edges
6. `probeFile()` - 5 edges
7. `mediaUrl()` - 5 edges
8. `buildEntry()` - 4 edges
9. `prioritizePlayback()` - 4 edges
10. `appError()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `begin()` --calls--> `addTorrent()`  [INFERRED]
  src/components/streaming/streaming-app.tsx → electron/preload.js
- `onDrop()` --calls--> `getPathForFile()`  [INFERRED]
  src/components/streaming/streaming-app.tsx → electron/preload.js
- `flush()` --calls--> `flushProgress()`  [INFERRED]
  src/components/streaming/streaming-app.tsx → electron/preload.js
- `buildEntry()` --calls--> `parseTitleYear()`  [INFERRED]
  electron/main.js → electron/metadata.js
- `buildEntry()` --calls--> `lookupMovie()`  [INFERRED]
  electron/main.js → electron/metadata.js

## Communities (14 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (7): chooseVideoFiles(), directStreamUrl(), listVideoFiles(), appError(), cacheFolder(), classifyInput(), TorrentManager

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (10): appError(), asNodeStream(), binaryPath(), classify(), getFfmpeg(), isLocalAddress(), probeFile(), probeWithFfprobe() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (7): flushProgress(), getPathForFile(), onStats(), onTorrentError(), subscribe(), flush(), onDrop()

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (9): addTorrent(), useTorrentApi(), toFilm(), matchesFilter(), SettingsPanel(), begin(), playFile(), playSaved() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (5): buildEntry(), tmdbKey(), lookupMovie(), parseTitleYear(), tagsFor()

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (7): mediaUrl(), formatBytes(), formatRuntime(), formatSpeed(), formatTime(), AmbientBackdrop(), VideoPlayer()

### Community 6 - "Community 6"
Cohesion: 0.25
Nodes (6): deselectRange(), DirectServer, extensionOf(), isVideoFile(), pieceRange(), prioritizePlayback()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `probeFile()` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `VideoPlayer()` connect `Community 5` to `Community 3`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 7` to `Community 5`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._