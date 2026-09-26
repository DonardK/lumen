# Graph Report - streaming-player  (2026-09-26)

## Corpus Check
- 30 files · ~38,319 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 140 nodes · 183 edges · 13 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]

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

## Communities (13 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (8): mediaUrl(), formatBytes(), formatRuntime(), formatTime(), cn(), AmbientBackdrop(), MobileNav(), VideoPlayer()

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (10): appError(), asNodeStream(), binaryPath(), classify(), getFfmpeg(), isLocalAddress(), probeFile(), probeWithFfprobe() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (7): flushProgress(), getPathForFile(), onStats(), onTorrentError(), subscribe(), flush(), onDrop()

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (4): appError(), cacheFolder(), classifyInput(), TorrentManager

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (9): addTorrent(), useTorrentApi(), toFilm(), matchesFilter(), SettingsPanel(), begin(), playFile(), playSaved() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (5): buildEntry(), tmdbKey(), lookupMovie(), parseTitleYear(), tagsFor()

### Community 6 - "Community 6"
Cohesion: 0.2
Nodes (9): chooseVideoFiles(), deselectRange(), DirectServer, directStreamUrl(), extensionOf(), isVideoFile(), listVideoFiles(), pieceRange() (+1 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `probeFile()` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `VideoPlayer()` connect `Community 0` to `Community 4`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._