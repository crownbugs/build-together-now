/**
 * Public engine entry point.
 *
 * The actual implementation lives under `./runtime/` — this file is a thin
 * re-export so consumers can keep importing from `@/lib/gameRuntime` while the
 * codebase stays organized like a real engine:
 *
 *   client/src/lib/
 *   ├── gameRuntime.ts            # PUBLIC SURFACE (this file)
 *   └── runtime/                  # Engine internals
 *       ├── core.ts               # GameRuntime class + heartbeat / step()
 *       ├── types.ts              # Shared types + EventBus
 *       ├── api.ts                # Emitter/Callable/Tags/Tasks/...
 *       ├── compile.ts            # Sandbox script -> async function factory
 *       ├── docs.ts               # DEFAULT_SCRIPT + SCRIPTING_DOCS
 *       ├── hierarchy.ts          # Parent/child indexing
 *       ├── tween.ts              # Property tweens
 *       ├── raycast.ts            # AABB / sphere ray intersection
 *       ├── collision.ts          # Object-vs-object resolution
 *       └── network.ts            # Local server↔client replication bus
 *
 * Add new engine subsystems as `runtime/<feature>.ts`, wire them into the
 * `GameRuntime` constructor, expose them via `GameAPI` in `types.ts`, and
 * document the new surface in `runtime/docs.ts`.
 */
export { GameRuntime } from "./runtime/core";
export type {
  Vec3,
  ContainerName,
  ObjectProperties,
  ObjectEventName,
  RuntimeObject,
  RuntimePlayer,
  RuntimeInput,
  RuntimePhysics,
  RuntimeState,
  RuntimeCamera,
  CameraMode,
  PlayerInventory,
  InventoryItem,
  GuiAnchor,
  GuiElement,
  EngineEvents,
  EventChannel,
  KeyboardAPI,
  MouseAPI,
  WorldAPI,
  RunServiceAPI,
  GameAPI,
  CompiledScript,
  RaycastResult,
  RaycastParams,
  NetSnapshot,
  NetInput,
} from "./runtime/types";
export { EventBus, DEFAULT_PROPERTIES } from "./runtime/types";
export { Emitter, Callable, WeakTable, Class, weakRef } from "./runtime/api";
export { DEFAULT_SCRIPT, SCRIPTING_DOCS } from "./runtime/docs";
export type { Easing } from "./runtime/tween";
