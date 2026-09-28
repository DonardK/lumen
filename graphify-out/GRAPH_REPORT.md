# Graph Report - streaming-player  (2026-09-28)

## Corpus Check
- 34 files · ~2,882,552 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 198 nodes · 287 edges · 16 communities
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc19b902`
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
- [[_COMMUNITY_Community 8|Community 8]]

## God Nodes (most connected - your core abstractions)
1. `TorrentManager` - 14 edges
2. `TranscodeServer` - 10 edges
3. `cn()` - 9 edges
4. `emit()` - 7 edges
5. `boot()` - 7 edges
6. `captureSize()` - 7 edges
7. `analyze()` - 6 edges
8. `assertPngBuffer()` - 6 edges
9. `rasterizeGroups()` - 6 edges
10. `main()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `begin()` --calls--> `addTorrent()`  [INFERRED]
  src/components/streaming/streaming-app.tsx → electron/preload.js
- `onDrop()` --calls--> `getPathForFile()`  [INFERRED]
  src/components/streaming/streaming-app.tsx → electron/preload.js
- `flush()` --calls--> `flushProgress()`  [INFERRED]
  src/components/streaming/streaming-app.tsx → electron/preload.js
- `createWindow()` --calls--> `resolveWindowBounds()`  [INFERRED]
  electron/main.js → electron/windowState.js
- `boot()` --calls--> `createStore()`  [INFERRED]
  electron/main.js → electron/store.js

## Communities (16 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.1
Nodes (13): chooseVideoFiles(), deselectRange(), DirectServer, directStreamUrl(), extensionOf(), isVideoFile(), listVideoFiles(), pieceRange() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (16): allowCrashReload(), blockPackagedShortcuts(), boot(), buildEntry(), cacheDir(), createWindow(), importTmdbKey(), loadEnvFile() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (9): mediaUrl(), formatBytes(), formatRuntime(), formatSpeed(), formatTime(), cn(), AmbientBackdrop(), MobileNav() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (10): appError(), asNodeStream(), binaryPath(), classify(), getFfmpeg(), isLocalAddress(), probeFile(), probeWithFfprobe() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (7): flushProgress(), getPathForFile(), onStats(), onTorrentError(), subscribe(), flush(), onDrop()

### Community 5 - "Community 5"
Cohesion: 0.25
Nodes (18): analyze(), assertIcon(), assertPngBuffer(), assertSamples(), buildIco(), captureSize(), delay(), dist() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (9): addTorrent(), useTorrentApi(), toFilm(), matchesFilter(), SettingsPanel(), begin(), playFile(), playSaved() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (12): attach(), emit(), error(), flush(), info(), line(), mirror(), pushBuffer() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.6
Nodes (4): asRect(), clampSize(), rectsIntersect(), resolveWindowBounds()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `probeFile()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `VideoPlayer()` connect `Community 2` to `Community 6`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 6` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._