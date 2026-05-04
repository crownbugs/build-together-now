# Game Runtime — Architecture

The runtime is a small Roblox-style game engine. Engine-managed concerns
(clock, physics, rendering, input, replication) live here so user scripts
only have to write game logic.

```
client/src/lib/
├── gameRuntime.ts          # Public engine surface: GameRuntime + GameAPI.
│                           # Owns the heartbeat, exposes create/destroy/
│                           # raycast/network/tween/etc. to scripts.
└── runtime/
    ├── tween.ts            # Engine-managed property animations.
    ├── hierarchy.ts        # Parent/child indexing + cascade operations.
    ├── collision.ts        # Object-vs-object resolution (canCollide).
    ├── raycast.ts          # AABB / sphere ray intersection.
    └── network.ts          # Local server↔client replication bus
                            # (snapshots out, inputs in). Pluggable transport.
```

## Heartbeat phases

`GameRuntime.step(dt)` runs phases in this fixed order each frame:

1. **Input** — drains queued key events, fires `runService.input`.
2. **Animation** — ticks tweens + auto properties, fires `runService.animation`.
3. **Replication** — pushes snapshots / pulls input via `network`,
   fires `runService.replication`.
4. **Physics** — gravity, movement, object collisions, fires `runService.physics`.
5. **Render** — React re-renders from runtime state.

## What devs write vs. what the engine does

| Engine handles                     | Devs handle                       |
|------------------------------------|-----------------------------------|
| Clock (≈60 FPS)                    | Game logic (rules, scoring)       |
| Gravity, velocity, collisions      | Spawning / destroying objects     |
| Rendering (3D + GUI)               | Reactions to events (`on(...)`)   |
| Input capture (keys/mouse/touch)   | Tweens to animate                 |
| Replication ticks                  | What to send/receive on the wire  |

## Adding a new engine subsystem

1. Create `runtime/<feature>.ts` with a focused class/API.
2. Wire it in `gameRuntime.ts` constructor, expose via `GameAPI`.
3. Hook into the appropriate `step()` phase.
4. Document in `SCRIPTING_DOCS`.
