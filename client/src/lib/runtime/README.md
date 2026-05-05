# Game Runtime — Architecture

Roblox-style mini engine. Engine-managed concerns (clock, physics, rendering,
input, replication, camera, player rig) live here so user scripts only have to
write game logic.

```
client/src/lib/
├── gameRuntime.ts              # Public re-export shim. Consumers import from here.
└── runtime/
    ├── core.ts                 # GameRuntime class (heartbeat, step(), buildApi)
    ├── types.ts                # Shared types + EventBus + DEFAULT_PROPERTIES
    ├── api.ts                  # Emitter, Callable, WeakTable, Class, TagManager,
    │                           # TaskScheduler, weakRef
    ├── compile.ts              # Sandbox: source -> AsyncFunction factory
    ├── docs.ts                 # DEFAULT_SCRIPT + SCRIPTING_DOCS
    ├── hierarchy.ts            # Parent/child indexing + cascade ops
    ├── tween.ts                # Property tweens
    ├── raycast.ts              # AABB / sphere ray intersection
    ├── collision.ts            # Object-vs-object resolution (canCollide)
    └── network.ts              # Local server↔client replication bus
```

## Heartbeat phases

`GameRuntime.step(dt)` runs phases in this fixed order each frame:

1. **Input** — drains key events, fires `runService.input`.
2. **Animation** — ticks tweens + auto properties, fires `runService.animation`.
3. **Replication** — pushes snapshots / pulls input via `network`,
   fires `runService.replication`.
4. **Physics** — gravity, movement, object collisions, motor pinning,
   ragdoll integration, kill-Y check, fires `runService.physics`.
5. **Render** — React re-renders from runtime state.
6. **Update** — generic per-frame fan-out.

## What the engine guarantees out of the box

- **Baseplate + SpawnLocation** auto-spawn if the world has no ground/spawn.
- **Sprint** with Shift (`player.runSpeed`).
- **Camera-relative movement** with smoothed `cameraForward` so input never jitters.
- **Ragdoll death** when `player.health <= 0` or `player.position.y < player.killY`.
- **Motors** to hold/attach objects to the avatar rig (`player.motors.attach(slot, obj)`).
- **Scriptable camera** (third / first / free / scripted modes).
- **ModuleScript** loading via `require("Name")`.

## Adding a new engine subsystem

1. Create `runtime/<feature>.ts` with a focused class/API.
2. Wire it in the `GameRuntime` constructor, expose via `GameAPI` in `types.ts`.
3. Hook into the appropriate `step()` phase.
4. Document in `runtime/docs.ts` (`SCRIPTING_DOCS`).

## Component layout (consumer side)

```
client/src/components/play/
├── PlayCanvasErrorBoundary.tsx # WebGL/canvas error fallback
├── Primitive.tsx               # One RuntimeObject -> one Three mesh
├── Avatar.tsx                  # Player rig with walk/run/ragdoll states
├── ChaseCameraRig.tsx          # Reads runtime.camera, drives Three camera
├── GuiOverlay.tsx              # Mirrors runtime.gui (text + buttons)
└── VirtualJoystick.tsx         # Mobile analog stick (event-isolated)
```

`PlayMode.tsx` is a thin shell that owns the keyboard listener, builds the
`GameRuntime`, and composes the components above.
