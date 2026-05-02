import type { GameObject, Script } from "@shared/schema";
import { TweenManager, type Easing } from "./runtime/tween";

export type Vec3 = { x: number; y: number; z: number };

/** Containers organize objects + scripts by purpose, exactly like Roblox services.
 *  - Workspace            : the live, rendered 3D world
 *  - Lighting             : lights and atmosphere
 *  - Players              : player avatars + per-player non-physical data
 *  - ServerScriptService  : server-authoritative scripts (run on the host)
 *  - StarterPlayer        : LocalScripts cloned into each player on join
 *  - ReplicatedStorage    : shared templates + ModuleScripts (spawn() reads here)
 */
export type ContainerName =
  | "Workspace"
  | "Lighting"
  | "Players"
  | "ServerScriptService"
  | "StarterPlayer"
  | "ReplicatedStorage";

/** Per-object physics & rendering properties — editable in the Properties panel
 *  AND scriptable at runtime (e.g. `game.workspace.Wall.canCollide = false`). */
export type ObjectProperties = {
  /** When true, the object never moves and external forces (incl. gravity) are ignored. */
  anchored: boolean;
  /** When true, blocks players & objects. When false, things pass straight through (a "ghost" part). */
  canCollide: boolean;
  /** 0 = fully opaque, 1 = invisible. Affects both renderers. */
  transparency: number;
  /** Mass in kg-ish units. Affects how strongly attractors pull this object. */
  mass: number;
  /** Surface friction (0 = ice, 1 = sandpaper). Currently affects slide along ground. */
  friction: number;
  /** When true, this object becomes a gravity source. Pulls nearby objects/players to its center. */
  gravityEnabled: boolean;
  /** Acceleration at the object's surface, in units/sec². Default 9.81 (Earth). */
  gravityStrength: number;
  /** Radius of influence in world units. Outside this, the attractor has no effect. */
  gravityRadius: number;
};

export const DEFAULT_PROPERTIES: ObjectProperties = {
  anchored: true,
  canCollide: true,
  transparency: 0,
  mass: 1,
  friction: 0.4,
  gravityEnabled: false,
  gravityStrength: 9.81,
  gravityRadius: 30,
};

/** Events a script can subscribe to on a single object via `obj.on(...)`.
 *  - "touched"   : the player (or another object) started overlapping it
 *  - "untouched" : the contact just ended
 *  - "clicked"   : the user clicked on it in the 3D viewport
 *  - "destroyed" : the object was just removed from the world
 *  - "changed"   : any property of the object was modified */
export type ObjectEventName = "touched" | "untouched" | "clicked" | "destroyed" | "changed";

export type RuntimeObject = {
  id: string;
  name: string;
  type: string;
  primitiveType: string | null;
  container: ContainerName;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  visible: boolean;
  /** Live, mutable physics/render properties. Scripts can edit any field directly. */
  anchored: boolean;
  canCollide: boolean;
  transparency: number;
  mass: number;
  friction: number;
  gravityEnabled: boolean;
  gravityStrength: number;
  gravityRadius: number;
  /** Per-object linear velocity. Anchored objects ignore this. */
  velocity: Vec3;
  /** Tag as auto-pickup. Walking into it adds to inventory. */
  isPickup?: boolean;
  /** Name used when adding to inventory. Defaults to object name. */
  pickupName?: string;
  /** Free-form data attached to the pickup. */
  pickupData?: Record<string, any>;
  /** Subscribe to a per-object event. Returns an unsubscribe function. */
  on: (event: ObjectEventName, fn: (...args: any[]) => void) => () => void;
  /** Stop listening to a per-object event. */
  off: (event: ObjectEventName, fn: (...args: any[]) => void) => void;
  /** Get a signal that fires only when this specific property changes. */
  GetPropertyChangedSignal: (property: string) => EventsAPI;
};

/** A single slot inside a Player's Inventory. Inventories store *data* about
 *  picked-up things, not the live RuntimeObject — the world object is destroyed
 *  on pickup and (optionally) re-created on drop. This keeps inventories
 *  serialization-friendly for future multiplayer replication. */
export type InventoryItem = {
  /** Unique slot id within this inventory. */
  id: string;
  /** Display / lookup name. Two items with the same name stack via `count`. */
  name: string;
  /** How many of this item are in the slot (1 for non-stackable items). */
  count: number;
  /** Optional template name in ReplicatedStorage — used by drop() to spawn the item back. */
  template?: string;
  /** Free-form data — set anything you want from a script (damage, color, …). */
  data: Record<string, any>;
};

/** Inventory API mounted on every Player — Roblox-style, but fully scriptable.
 *  Backpacks, hotbars, equipment slots can all be built on top of this. */
export type PlayerInventory = {
  /** Current items, in insertion order. Read-only — use add/remove/clear to mutate. */
  readonly items: ReadonlyArray<InventoryItem>;
  /** Hard cap (default 32). add() respects this and returns false when full. */
  maxSlots: number;
  /** The currently equipped item (null = nothing equipped). Set via equip(). */
  readonly equipped: InventoryItem | null;
  /** Add an item by name. Stacks with existing items of the same name when possible. */
  add: (name: string, opts?: { count?: number; template?: string; data?: Record<string, any> }) => InventoryItem | null;
  /** Remove `count` copies of an item by name. Returns the number actually removed. */
  remove: (name: string, count?: number) => number;
  /** True when the player has at least `count` (default 1) of `name`. */
  has: (name: string, count?: number) => boolean;
  /** Get the slot for a given name, or null if missing. */
  get: (name: string) => InventoryItem | null;
  /** Equip an item by name (must already be in the inventory). null = unequip. */
  equip: (name: string | null) => boolean;
  /** Drop an item back into the world. Spawns from `template` if provided
   *  (or from a ReplicatedStorage template matching `name`); otherwise creates
   *  a small generic cube tagged with the item name. */
  drop: (name: string, count?: number) => RuntimeObject | null;
  /** Remove every item. */
  clear: () => void;
};

export type RuntimePlayer = {
  username: string;
  color: string;
  position: Vec3;
  rotation: Vec3;
  velocity: Vec3;
  onGround: boolean;
  /** Current health (0..maxHealth). When it reaches 0 the player auto-respawns. */
  health: number;
  /** Maximum health. Default 100. */
  maxHealth: number;
  /** Walk speed in units/sec. Default 6. */
  speed: number;
  /** Jump velocity. Default 8. */
  jumpPower: number;
  /** Visual size multiplier (1 = default). */
  size: number;
  /** Where to respawn (set from a SpawnLocation object on play start). */
  spawnPoint: Vec3;
  /** Player's current "up" direction. Smoothly aligned with the strongest gravity attractor.
   *  When no attractor is in range this is world-up (0,1,0). Read-only from scripts. */
  up: Vec3;
  /** Per-player inventory. See PlayerInventory above. */
  inventory: PlayerInventory;
  /** Reduce health by n. Auto-respawns at 0. */
  takeDamage: (n: number) => void;
  /** Increase health by n (capped at maxHealth). */
  heal: (n: number) => void;
  /** Move the avatar to (x, y, z) and zero out velocity. */
  teleport: (x: number, y: number, z: number) => void;
  /** Reset to spawn point and full health. */
  respawn: () => void;
};

export type RuntimeInput = {
  /** Raw "is the key currently down right now" map. (e.g. input.keys["w"]) */
  keys: Record<string, boolean>;
  /** Camera-relative move vector. -1..+1 each axis. (W = -moveZ, D = +moveX) */
  moveX: number;
  moveZ: number;
  /** Set to true for one frame when the player presses Space (also raised by mobile JUMP). */
  jump: boolean;
  /** True only on the frame a key was first pressed. (e.g. input.pressed("e")) */
  pressed: (key: string) => boolean;
  /** True only on the frame a key was released. */
  released: (key: string) => boolean;
  /** True for as long as a key is held. (Same as input.keys[key].) */
  held: (key: string) => boolean;
};

export type RuntimePhysics = {
  /** Default world-down gravity in units/sec^2 (Earth ≈ 9.81). Per-object pulls
   *  set via `o.gravityEnabled` override this in their radius. */
  gravity: number;
  /** Air drag applied to horizontal motion (0 = no drag, 1 = stop instantly). */
  airDrag: number;
};

/** Multiplayer-ready global state machine.
 *
 *  Use string values for anything that should eventually replicate to every
 *  player ("Lobby" → "Playing" → "GameOver"). Booleans are fine for purely
 *  local toggles inside one script. The networking layer that comes later will
 *  sync `state.set()` calls automatically. */
export type RuntimeState = {
  /** Get the current value of `key`, or undefined if never set. */
  get: (key: string) => string | undefined;
  /** Set `key` to `value`. Triggers any state.on(key, fn) subscribers. */
  set: (key: string, value: string) => void;
  /** Subscribe to changes of `key`. Returns an unsubscribe function. */
  on: (key: string, fn: (value: string, prev: string | undefined) => void) => () => void;
  /** Get every state key currently set. */
  keys: () => string[];
};

export type GuiAnchor =
  | "tl" | "tc" | "tr"
  | "cl" | "cc" | "cr"
  | "bl" | "bc" | "br";

export type GuiElement = {
  id: string;
  kind: "text" | "button";
  text: string;
  x: number;
  y: number;
  anchor: GuiAnchor;
  color: string;
  size: number;
  bg?: string;
  onClick?: (game: GameAPI) => void;
};

/** Engine-level events — subscribe via `events.on("name", fn)`.
 *  These are the engine's heartbeat. Devs never write a "main loop". */
export type EngineEvents = {
  /** Every animation frame. `(dt, time)` are passed. */
  update: [dt: number, time: number];
  /** Alias for `update` — same payload, fires at the same time. */
  step: [dt: number, time: number];
  /** Fired once when the game finishes loading. */
  start: [];
  /** Fired right before the runtime is destroyed (Stop button, navigation, …). */
  stop: [];
  /** Fired the instant any key transitions from up → down. */
  keyDown: [key: string];
  /** Fired the instant any key transitions from down → up. */
  keyUp: [key: string];
  /** Fired every time a new object is added to the world. */
  objectAdded: [obj: RuntimeObject];
  /** Fired every time an object is removed from the world. */
  objectRemoved: [obj: RuntimeObject];
  /** The local player just (re)spawned at their spawn point. */
  playerSpawned: [player: RuntimePlayer];
  /** The local player's health just hit zero. */
  playerDied: [player: RuntimePlayer];
  /** Before the frame is rendered (client only). Perfect for updating camera or visuals. */
  renderStepped: [dt: number, time: number];
  /** Before physics simulation. Use for modifying parts that interact with physics. */
  stepped: [dt: number, time: number];
  /** After physics simulation. General game logic, cooldowns, movement checks. */
  heartbeat: [dt: number, time: number];
};

/** A tiny, type-safe pub-sub bus used by the engine for both engine events
 *  and per-object events. Never touched directly by user scripts. */
export class EventBus<T extends Record<string, any[]>> {
  private subs = new Map<keyof T, Set<(...args: any[]) => void>>();

  on<K extends keyof T>(event: K, fn: (...args: T[K]) => void): () => void {
    let s = this.subs.get(event);
    if (!s) { s = new Set(); this.subs.set(event, s); }
    s.add(fn as any);
    return () => this.off(event, fn);
  }

  off<K extends keyof T>(event: K, fn: (...args: T[K]) => void) {
    this.subs.get(event)?.delete(fn as any);
  }

  emit<K extends keyof T>(
    event: K,
    args: T[K],
    onError?: (e: any, fn: Function) => void,
  ): void {
    const s = this.subs.get(event);
    if (!s) return;
    s.forEach((fn) => {
      try { (fn as any)(...args); }
      catch (e) { onError?.(e, fn); }
    });
  }

  /** Detach every subscriber. Used on Stop. */
  clear() { this.subs.clear(); }
}

/** Roblox-style RunService for binding code to specific parts of the frame cycle. */
export type RunServiceAPI = {
  /** Subscribe to before-render updates. Perfect for camera/visual updates. */
  renderStepped: EventsAPI;
  /** Subscribe to before-physics updates. Use for physics-interacting changes. */
  stepped: EventsAPI;
  /** Subscribe to after-physics updates. General game logic and timing. */
  heartbeat: EventsAPI;
};

/** The `events` global — engine-wide events (update, keyDown, playerDied, ...). */
export type EventsAPI = {
  /** Subscribe to an engine event. Returns an unsubscribe function. */
  on: <K extends keyof EngineEvents>(
    event: K,
    fn: (...args: EngineEvents[K]) => void,
  ) => () => void;
  /** Stop listening to an engine event. */
  off: <K extends keyof EngineEvents>(
    event: K,
    fn: (...args: EngineEvents[K]) => void,
  ) => void;
};

/** The `keyboard` global — clean, callback-based key API. */
export type KeyboardAPI = {
  /** Fire `fn` every time `key` is pressed (rising edge). */
  onPress: (key: string, fn: () => void) => () => void;
  /** Fire `fn` every time `key` is released (falling edge). */
  onRelease: (key: string, fn: () => void) => () => void;
  /** True for as long as `key` is held. Same as `input.held(key)`. */
  isDown: (key: string) => boolean;
};

/** The `mouse` global — pointer events on the 3D viewport. */
export type MouseAPI = {
  /** Fire `fn` every time the player clicks. `obj` is the object hit (or null). */
  onClick: (fn: (obj: RuntimeObject | null) => void) => () => void;
};

/** The `world` global — high-level world events. */
export type WorldAPI = {
  /** Fire `fn` every time an object is added. */
  onObjectAdded: (fn: (obj: RuntimeObject) => void) => () => void;
  /** Fire `fn` every time an object is removed. */
  onObjectRemoved: (fn: (obj: RuntimeObject) => void) => () => void;
  /** Fire `fn` every time the local player spawns. */
  onPlayerSpawned: (fn: (player: RuntimePlayer) => void) => () => void;
  /** Fire `fn` every time the local player dies. */
  onPlayerDied: (fn: (player: RuntimePlayer) => void) => () => void;
};

export type GameAPI = {
  /** Alias for `workspace` — every object in the Workspace, keyed by name. */
  objects: Record<string, RuntimeObject>;
  /** Workspace — the live, rendered 3D world. */
  workspace: Record<string, RuntimeObject>;
  /** Lighting — lights, sky, atmosphere helpers. */
  lighting: Record<string, RuntimeObject>;
  /** ReplicatedStorage — shared templates you `spawn("Name")` from, plus
   *  ModuleScripts shared between server & all clients. */
  replicatedStorage: Record<string, RuntimeObject>;
  /** ServerScriptService — server-authoritative scripts (run on the host only). */
  serverScriptService: Record<string, RuntimeObject>;
  /** StarterPlayer — scripts/objects that get cloned into each player on join. */
  starterPlayer: Record<string, RuntimeObject>;
  /** Players — per-player, non-physical data. */
  players: Record<string, RuntimeObject>;
  /** The local player's avatar (read & write any field). */
  player: RuntimePlayer;
  /** Live input snapshot (keys, joystick, jump). */
  input: RuntimeInput;
  /** Default world gravity. Set `physics.gravity = 5` to lower it everywhere. */
  physics: RuntimePhysics;
  /** Global, multiplayer-ready string state machine. See RuntimeState. */
  state: RuntimeState;
  /** Engine event bus — subscribe to update / keyDown / playerSpawned / ... */
  events: EventsAPI;
  /** Roblox-style RunService for binding to specific frame phases. */
  runService: RunServiceAPI;
  /** Keyboard helpers — onPress(key, fn), onRelease(key, fn), isDown(key). */
  keyboard: KeyboardAPI;
  /** Mouse helpers — onClick(fn) fires with the clicked object (or null). */
  mouse: MouseAPI;
  /** World helpers — high-level lifecycle events for objects & the player. */
  world: WorldAPI;
  /** Total seconds since play started. NOTE: this is a frame snapshot — for live
   *  reads inside a callback that's stored at startup time, prefer `now()`. */
  time: number;
  /** Delta time for the current frame, in seconds. Same caveat as `time`. */
  dt: number;
  /** Live read of "seconds since play started" — works inside any callback. */
  now: () => number;
  /** Print to the in-game console. */
  log: (...args: any[]) => void;
  /** Find an object by name in any container (Workspace, Lighting, ReplicatedStorage, ...). */
  find: (name: string) => RuntimeObject | null;
  /** Clone a ReplicatedStorage template into Workspace and return the new live object. */
  spawn: (templateName: string, overrides?: Partial<RuntimeObject>) => RuntimeObject | null;
  /** Create a brand-new object from scratch and put it in the world. */
  create: (opts: {
    name?: string;
    primitiveType?: "cube" | "sphere" | "cylinder" | "plane";
    container?: ContainerName;
    position?: Partial<Vec3>;
    rotation?: Partial<Vec3>;
    scale?: Partial<Vec3>;
    color?: string;
    type?: string;
  }) => RuntimeObject;
  /** Remove a runtime object from the world. */
  destroy: (objOrName: RuntimeObject | string) => void;
  /** On-screen UI: text labels, buttons, etc. (rendered as a HUD overlay) */
  gui: {
    /** Show or update a text label. anchor + x/y position it on screen. */
    text: (id: string, text: string, opts?: Partial<Omit<GuiElement, "id" | "kind" | "text">>) => void;
    /** Show or update a clickable button. */
    button: (
      id: string,
      text: string,
      opts: Partial<Omit<GuiElement, "id" | "kind" | "text">> | undefined,
      onClick?: (game: GameAPI) => void
    ) => void;
    /** Remove one element by id, or all if no id given. */
    clear: (id?: string) => void;
  };
  // ─── Easy-mode helpers (still here for convenience) ─────────────────────────
  /** Sugar for `keyboard.onPress(key, fn)` — fires every press. */
  onKey: (key: string, fn: () => void) => () => void;
  /** Sugar for `events.on("update", fn)` — fires every frame with (dt, time). */
  onUpdate: (fn: (dt: number, time: number) => void) => () => void;
  /** Run `fn` repeatedly every `seconds` seconds. */
  every: (seconds: number, fn: () => void) => () => void;
  /** Run `fn` once after `seconds` seconds. */
  after: (seconds: number, fn: () => void) => () => void;
  /** Pause for N seconds. Returns a Promise — usable with `await`. */
  wait: (seconds: number) => Promise<void>;
  /**
   * Animate numeric properties over time — the engine handles every frame
   * for you, so you don't write per-frame interpolation code.
   *
   *   tween(part.position, { x: 10 }, 2);          // 2-second slide
   *   tween(part, { transparency: 1 }, 0.5);       // 0.5s fade-out
   *   tween(ui, { y: 100 }, 1, "easeOutCubic");    // ease the UI bar
   *
   * Returns a cancel function. Pass an `onDone` callback as the 5th arg.
   */
  tween: (
    target: any,
    to: Record<string, any>,
    duration: number,
    easing?: Easing,
    onDone?: () => void
  ) => () => void;
  /** Random float in [min, max). */
  random: (min: number, max: number) => number;
  /** Random integer in [min, max] (both inclusive). */
  randInt: (min: number, max: number) => number;
  /** Pick one element from an array at random. */
  pick: <T>(arr: T[]) => T;
  /** Distance between two points (or two objects with .position). */
  dist: (a: Vec3 | { position: Vec3 }, b: Vec3 | { position: Vec3 }) => number;
  /** Linear interpolation. */
  lerp: (a: number, b: number, t: number) => number;
  /** Clamp `n` to [min, max]. */
  clamp: (n: number, min: number, max: number) => number;
};

export type CompiledScript = {
  name: string;
  /** Top-level body — runs ONCE when Play starts. Should register events
   *  (`events.on(...)`, `onKey(...)`, `obj.on(...)`) instead of looping. */
  run?: (api: GameAPI) => void;
  /** Set if compilation itself failed. The script never runs. */
  error?: string;
};

/** Compile a user script into something the runtime can execute.
 *
 *  The new model (Roblox-style):
 *  - The user's code is the body of an `async function`. It runs **once** at
 *    Play-start. There is no `onStart` / `onUpdate` boilerplate.
 *  - Devs register events instead of writing a frame loop:
 *      `events.on("update", (dt) => { ... })`
 *      `obj.on("touched", (other) => { ... })`
 *      `keyboard.onPress("e", () => { ... })`
 *  - Every API is injected as a bare global. `game` is also passed for users
 *    who prefer the explicit style. There is no requirement to use it.
 *  - `await wait(seconds)` is supported for time-based sequencing.
 *
 *  Compile-time SyntaxErrors are captured and returned as `{ error }`.
 *  Top-level runtime errors are caught at run-time by `runScripts()`.
 */
export function compileScript(code: string, name: string): CompiledScript {
  try {
    // We embed the body inside a template literal. Escape any sequence that
    // would prematurely close the literal or interpolate.
    const safeCode = code
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$\{/g, "\\${");

    // Use AsyncFunction so users can `await wait(...)` and other async helpers
    // without the engine caring. The body throwing rejects the returned promise,
    // which the runtime then logs to the console.
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

    const factory = new AsyncFunction(
      "game",
      `"use strict";
       const objects = game.objects;
       const workspace = game.workspace;
       const lighting = game.lighting;
       const replicatedStorage = game.replicatedStorage;
       const serverScriptService = game.serverScriptService;
       const starterPlayer = game.starterPlayer;
       const players = game.players;
       const player = game.player;
       const input = game.input;
       const physics = game.physics;
       const state = game.state;
       const events = game.events;
       const keyboard = game.keyboard;
       const mouse = game.mouse;
       const world = game.world;
       const gui = game.gui;
       const log = game.log;
       const inventory = game.player ? game.player.inventory : undefined;
       const find = game.find;
       const spawn = game.spawn;
       const create = game.create;
       const destroy = game.destroy;
       const onKey = game.onKey;
       const onUpdate = game.onUpdate;
       const every = game.every;
       const after = game.after;
       const wait = game.wait;
       const now = game.now;
       const random = game.random;
       const randInt = game.randInt;
       const pick = game.pick;
       const dist = game.dist;
       const lerp = game.lerp;
       const clamp = game.clamp;
       const console = {
         log:   (...a) => game.log(...a),
         info:  (...a) => game.log("[info]", ...a),
         warn:  (...a) => game.log("[warn]", ...a),
         error: (...a) => game.log("[error]", ...a),
       };
       ${safeCode}`,
    );

    return { name, run: factory as (api: GameAPI) => void };
  } catch (e: any) {
    // SyntaxError, etc — compilation itself failed.
    const msg = e?.message ?? String(e);
    const stack =
      typeof e?.stack === "string"
        ? `\n${e.stack.split("\n").slice(0, 3).join("\n")}`
        : "";
    return { name, error: `${msg}${stack}` };
  }
}

function newId() {
  return `rt_${Math.random().toString(36).slice(2, 10)}`;
}

/** Pretty-print a thrown value for the in-game console. */
function formatErr(e: any): string {
  const msg = e?.message ?? String(e);
  const stack = typeof e?.stack === "string"
    ? e.stack.split("\\n").slice(1, 4).map((l: string) => "  " + l.trim()).join("\\n")
    : "";
  return stack ? `${msg}\\n${stack}` : msg;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Pull editable physics/render fields out of the GameObject's `properties` JSON,
 *  falling back to defaults. Lights/spawns default to non-colliding ghost parts. */
function readProperties(o: GameObject): ObjectProperties {
  const p = (o.properties ?? {}) as Partial<ObjectProperties>;
  const isLightOrSpawn = o.type === "light" || o.type === "spawn";
  return {
    anchored: p.anchored ?? true,
    canCollide: p.canCollide ?? !isLightOrSpawn,
    transparency: clamp01(p.transparency ?? 0),
    mass: p.mass ?? DEFAULT_PROPERTIES.mass,
    friction: p.friction ?? DEFAULT_PROPERTIES.friction,
    gravityEnabled: p.gravityEnabled ?? false,
    gravityStrength: p.gravityStrength ?? DEFAULT_PROPERTIES.gravityStrength,
    gravityRadius: p.gravityRadius ?? DEFAULT_PROPERTIES.gravityRadius,
  };
}

/** Half-extents of an object's bounding box in world space (per axis). */
function objectHalfExtents(o: RuntimeObject): Vec3 {
  return {
    x: Math.max(0.05, (o.scale.x || 1) * 0.5),
    y: Math.max(0.05, (o.scale.y || 1) * 0.5),
    z: Math.max(0.05, (o.scale.z || 1) * 0.5),
  };
}

/** Distance from a point to the surface of `o`. */
function pointVsObjectSurface(point: Vec3, o: RuntimeObject): {
  surfaceDistance: number;
  dirToCenter: Vec3;
  surfaceRadius: number;
} {
  const half = objectHalfExtents(o);
  const dx = point.x - o.position.x;
  const dy = point.y - o.position.y;
  const dz = point.z - o.position.z;

  if (o.primitiveType === "sphere") {
    const r = Math.max(half.x, half.y, half.z);
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.0001) return { surfaceDistance: -r, dirToCenter: { x: 0, y: -1, z: 0 }, surfaceRadius: r };
    return {
      surfaceDistance: dist - r,
      dirToCenter: { x: -dx / dist, y: -dy / dist, z: -dz / dist },
      surfaceRadius: r,
    };
  }

  const cx = Math.max(-half.x, Math.min(half.x, dx));
  const cy = Math.max(-half.y, Math.min(half.y, dy));
  const cz = Math.max(-half.z, Math.min(half.z, dz));
  const ox = dx - cx;
  const oy = dy - cy;
  const oz = dz - cz;
  const outside = Math.hypot(ox, oy, oz);
  const surfaceRadius = (half.x + half.y + half.z) / 3;
  if (outside < 0.0001) {
    const ax = Math.abs(dx) / Math.max(0.0001, half.x);
    const ay = Math.abs(dy) / Math.max(0.0001, half.y);
    const az = Math.abs(dz) / Math.max(0.0001, half.z);
    let dir: Vec3;
    if (ax > ay && ax > az) dir = { x: -Math.sign(dx) || -1, y: 0, z: 0 };
    else if (ay > az) dir = { x: 0, y: -Math.sign(dy) || -1, z: 0 };
    else dir = { x: 0, y: 0, z: -Math.sign(dz) || -1 };
    return { surfaceDistance: -Math.min(half.x, half.y, half.z), dirToCenter: dir, surfaceRadius };
  }
  return {
    surfaceDistance: outside,
    dirToCenter: { x: -ox / outside, y: -oy / outside, z: -oz / outside },
    surfaceRadius,
  };
}

/** Stub inventory used before runtime mounts the real implementation. */
function createStubInventory(): PlayerInventory {
  const items: InventoryItem[] = [];
  return {
    items,
    maxSlots: 32,
    equipped: null,
    add: () => null,
    remove: () => 0,
    has: () => false,
    get: () => null,
    equip: () => false,
    drop: () => null,
    clear: () => {},
  };
}

export class GameRuntime {
  private _all = new Map<string, RuntimeObject>();
  objectList: RuntimeObject[] = [];
  objects: Record<string, RuntimeObject> = {};
  workspace: Record<string, RuntimeObject> = {};
  lighting: Record<string, RuntimeObject> = {};
  replicatedStorage: Record<string, RuntimeObject> = {};
  serverScriptService: Record<string, RuntimeObject> = {};
  starterPlayer: Record<string, RuntimeObject> = {};
  players: Record<string, RuntimeObject> = {};
  private _stateValues = new Map<string, string>();
  private _stateSubs = new Map<string, Set<(value: string, prev: string | undefined) => void>>();
  private _stateApi: RuntimeState | null = null;
  player: RuntimePlayer;
  private _prevKeys: Record<string, boolean> = {};
  private _timers: { fn: () => void; nextAt: number; interval: number; once: boolean }[] = [];
  /** Tween manager — animates numeric properties over time so devs don't
   *  have to write per-frame interpolation code (use `tween(part, ...)`). */
  private _tweens = new TweenManager();
  private _keyDownHandlers = new Map<string, Set<() => void>>();
  private _keyUpHandlers = new Map<string, Set<() => void>>();
  /** Engine-wide event bus (update, keyDown, playerSpawned, ...). */
  private _events = new EventBus<EngineEvents>();
  /** Per-object event buses, keyed by object id. */
  private _objectEvents = new Map<string, EventBus<Record<ObjectEventName, any[]>>>();
  /** Tracks which objects are currently in contact with the player so we can
   *  emit "touched" on the rising edge and "untouched" on the falling edge. */
  private _playerContacts = new Set<string>();
  /** Frozen API snapshot built once at start — same `events`/`keyboard`/...
   *  references every frame so unsubscribe functions work after long delays. */
  private _api: GameAPI | null = null;
  /** Cached events/keyboard/mouse/world API objects (stable references). */
  private _eventsApi: EventsAPI | null = null;
  private _keyboardApi: KeyboardAPI | null = null;
  private _mouseApi: MouseAPI | null = null;
  private _worldApi: WorldAPI | null = null;
  /** Listeners registered by user scripts via mouse.onClick(...). */
  private _mouseClickHandlers = new Set<(obj: RuntimeObject | null) => void>();
  input: RuntimeInput;
  physics: RuntimePhysics = { gravity: 9.81, airDrag: 0 };
  cameraYaw = 0;
  cameraForward: Vec3 = { x: 0, y: 0, z: -1 };
  time = 0;
  scripts: CompiledScript[] = [];
  logs: string[] = [];
  onLog?: (line: string) => void;
  gui = new Map<string, GuiElement>();
  guiVersion = 0;
  /** Roblox-style RunService for binding to frame phases. */
  runService!: RunServiceAPI;

  constructor(snap: GameObject[], scripts: Script[], username: string, avatarColor: string) {
    const keys: Record<string, boolean> = {};
    this.input = {
      keys,
      moveX: 0,
      moveZ: 0,
      jump: false,
      held: (k: string) => !!keys[k.toLowerCase()],
      pressed: (k: string) => !!keys[k.toLowerCase()] && !this._prevKeys[k.toLowerCase()],
      released: (k: string) => !keys[k.toLowerCase()] && !!this._prevKeys[k.toLowerCase()],
    };

    for (const o of snap) {
      const props = readProperties(o);
      const container = this.normalizeContainer(o.container);
      const ro: RuntimeObject = {
        id: o.id,
        name: o.name,
        type: o.type,
        primitiveType: o.primitiveType,
        container,
        position: { x: o.positionX ?? 0, y: o.positionY ?? 0, z: o.positionZ ?? 0 },
        rotation: { x: o.rotationX ?? 0, y: o.rotationY ?? 0, z: o.rotationZ ?? 0 },
        scale: { x: o.scaleX ?? 1, y: o.scaleY ?? 1, z: o.scaleZ ?? 1 },
        color: o.color ?? "#888888",
        visible: true,
        ...props,
        velocity: { x: 0, y: 0, z: 0 },
        on: () => () => {},
        off: () => {},
        GetPropertyChangedSignal: () => ({ on: () => () => {}, off: () => {} }),
      };
      this.mountObjectEvents(ro);
      this._all.set(ro.id, ro);
    }
    this.rebuildIndexes();

    const spawnObj = [...this._all.values()].find(
      (o) => o.name === "SpawnLocation" || o.type === "spawn"
    );
    const spawnPoint: Vec3 = spawnObj
      ? { x: spawnObj.position.x, y: spawnObj.position.y + 1.2, z: spawnObj.position.z }
      : { x: 0, y: 1, z: 4 };

    this.player = {
      username,
      color: avatarColor,
      position: { ...spawnPoint },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      onGround: false,
      health: 100,
      maxHealth: 100,
      speed: 6,
      jumpPower: 8,
      size: 1,
      spawnPoint,
      up: { x: 0, y: 1, z: 0 },
      inventory: createStubInventory(),
      takeDamage: () => {},
      heal: () => {},
      teleport: () => {},
      respawn: () => {},
    };

    this.mountPlayerInventory();
    this.mountPlayerMethods();
    this.scripts = scripts
      .filter((s) => s.enabled !== false)
      .map((s) => compileScript(s.code, s.name));
  }

  /** Normalize container string to valid ContainerName, defaulting to Workspace. */
  private normalizeContainer(raw: string | undefined | null): ContainerName {
    const valid: ContainerName[] = [
      "Workspace", "Lighting", "Players",
      "ServerScriptService", "StarterPlayer", "ReplicatedStorage"
    ];
    if (raw && valid.includes(raw as ContainerName)) return raw as ContainerName;
    return "Workspace";
  }

  /** Wire up the live PlayerInventory backed by mutable arrays on the runtime. */
  private mountPlayerInventory() {
    const items: InventoryItem[] = [];
    let equippedId: string | null = null;
    const inv = this.player.inventory as any;
    Object.defineProperty(inv, "items", { value: items, writable: false, configurable: true });
    Object.defineProperty(inv, "equipped", {
      get: () => items.find((i) => i.id === equippedId) ?? null,
      configurable: true,
    });

    inv.add = (name: string, opts?: { count?: number; template?: string; data?: Record<string, any> }): InventoryItem | null => {
      const count = Math.max(1, Math.floor(opts?.count ?? 1));
      const existing = items.find((i) => i.name === name);
      if (existing) {
        existing.count += count;
        if (opts?.data) Object.assign(existing.data, opts.data);
        if (opts?.template && !existing.template) existing.template = opts.template;
        return existing;
      }
      if (items.length >= inv.maxSlots) {
        this.pushLog(`inventory.add("${name}"): inventory full (${inv.maxSlots} slots)`);
        return null;
      }
      const slot: InventoryItem = {
        id: newId(),
        name,
        count,
        template: opts?.template,
        data: { ...(opts?.data ?? {}) },
      };
      items.push(slot);
      return slot;
    };

    inv.remove = (name: string, count: number = 1): number => {
      const idx = items.findIndex((i) => i.name === name);
      if (idx < 0) return 0;
      const slot = items[idx];
      const removed = Math.min(slot.count, Math.max(1, Math.floor(count)));
      slot.count -= removed;
      if (slot.count <= 0) {
        if (slot.id === equippedId) equippedId = null;
        items.splice(idx, 1);
      }
      return removed;
    };

    inv.has = (name: string, count: number = 1): boolean => {
      const slot = items.find((i) => i.name === name);
      return !!slot && slot.count >= count;
    };

    inv.get = (name: string): InventoryItem | null =>
      items.find((i) => i.name === name) ?? null;

    inv.equip = (name: string | null): boolean => {
      if (name == null) { equippedId = null; return true; }
      const slot = items.find((i) => i.name === name);
      if (!slot) return false;
      equippedId = slot.id;
      return true;
    };

    inv.drop = (name: string, count: number = 1): RuntimeObject | null => {
      const slot = items.find((i) => i.name === name);
      if (!slot) return null;
      const dropped = inv.remove(name, count);
      if (dropped <= 0) return null;
      const fwd = this.cameraForward;
      const fLen = Math.hypot(fwd.x, 0, fwd.z) || 1;
      const fx = fwd.x / fLen;
      const fz = fwd.z / fLen;
      const dropPos: Vec3 = {
        x: this.player.position.x + fx * 1.5,
        y: this.player.position.y + 0.5,
        z: this.player.position.z + fz * 1.5,
      };
      const template = slot.template ?? name;
      const tpl = this.replicatedStorage[template];
      let ro: RuntimeObject;
      if (tpl) {
        ro = this.cloneTemplateInto(tpl, "Workspace", dropPos);
      } else {
        ro = this.createInternal({
          name,
          primitiveType: "cube",
          container: "Workspace",
          position: dropPos,
          color: "#c084fc",
        });
      }
      ro.isPickup = true;
      ro.pickupName = name;
      ro.pickupData = { ...slot.data };
      return ro;
    };

    inv.clear = () => {
      items.length = 0;
      equippedId = null;
    };
  }

  /** Mount player helper methods once — stable references across frames. */
  private mountPlayerMethods() {
    const p = this.player;
    p.takeDamage = (n: number) => {
      p.health = Math.max(0, p.health - n);
      if (p.health <= 0) p.respawn();
    };
    p.heal = (n: number) => {
      p.health = Math.min(p.maxHealth, p.health + n);
    };
    p.teleport = (x: number, y: number, z: number) => {
      p.position.x = x;
      p.position.y = y;
      p.position.z = z;
      p.velocity.x = 0;
      p.velocity.y = 0;
      p.velocity.z = 0;
    };
    p.respawn = () => {
      const sp = p.spawnPoint;
      p.position.x = sp.x;
      p.position.y = sp.y;
      p.position.z = sp.z;
      p.velocity.x = 0;
      p.velocity.y = 0;
      p.velocity.z = 0;
      p.health = p.maxHealth;
      this.pushLog(`${p.username} respawned.`);
    };

    // Initialize RunService
    this.runService = {
      renderStepped: {
        on: (_event, fn) => this._events.on("renderStepped" as any, fn as any),
        off: (_event, fn) => this._events.off("renderStepped" as any, fn as any),
      },
      stepped: {
        on: (_event, fn) => this._events.on("stepped" as any, fn as any),
        off: (_event, fn) => this._events.off("stepped" as any, fn as any),
      },
      heartbeat: {
        on: (_event, fn) => this._events.on("heartbeat" as any, fn as any),
        off: (_event, fn) => this._events.off("heartbeat" as any, fn as any),
      },
    };
  }

  /** Mount `obj.on(event, fn)` / `obj.off(event, fn)` to a per-object event bus. */
  private mountObjectEvents(ro: RuntimeObject) {
    const id = ro.id;
    ro.on = (event, fn) => {
      let bus = this._objectEvents.get(id);
      if (!bus) { bus = new EventBus(); this._objectEvents.set(id, bus); }
      return bus.on(event as any, fn as any);
    };
    ro.off = (event, fn) => {
      this._objectEvents.get(id)?.off(event as any, fn as any);
    };

    // Property change detection - create per-property event buses
    const propertyEvents = new Map<string, EventBus<Record<"changed", [property: string, newValue: any, oldValue: any]>>>();
    ro.GetPropertyChangedSignal = (property: string) => {
      let bus = propertyEvents.get(property);
      if (!bus) {
        bus = new EventBus();
        propertyEvents.set(property, bus);
      }
      return {
        on: (event, fn) => bus!.on(event as any, fn as any),
        off: (event, fn) => bus!.off(event as any, fn as any),
      };
    };

    // Store original values for change detection
    const originalValues = new Map<string, any>();

    // Create a proxy to watch property changes
    const proxy = new Proxy(ro, {
      set: (target, prop, value) => {
        const propName = prop as string;
        const oldValue = (target as any)[propName];

        // Only trigger if value actually changed
        if (oldValue !== value) {
          // Store original value for first change
          if (!originalValues.has(propName)) {
            originalValues.set(propName, oldValue);
          }

          // Update the property
          (target as any)[propName] = value;

          // Emit property-specific changed event
          const propBus = propertyEvents.get(propName);
          if (propBus) {
            propBus.emit("changed", [propName, value, oldValue]);
          }

          // Emit general changed event
          const generalBus = this._objectEvents.get(id);
          if (generalBus) {
            generalBus.emit("changed", [propName, value, oldValue]);
          }
        }

        return true;
      }
    });

    // Replace the object in our collections with the proxy
    this._all.set(id, proxy);
    return proxy;
  }

  /** Emit an event on a single object — used by the engine itself. */
  private emitObjectEvent(id: string, event: ObjectEventName, args: any[]) {
    const bus = this._objectEvents.get(id);
    if (!bus) return;
    bus.emit(event as any, args, (e, fn) =>
      this.pushLog(`obj.on("${event}") error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );
  }

  private createInternal(opts: {
    name?: string;
    primitiveType?: "cube" | "sphere" | "cylinder" | "plane";
    container?: ContainerName;
    position?: Vec3;
    color?: string;
  }): RuntimeObject {
    const ro: RuntimeObject = {
      id: newId(),
      name: opts.name ?? `Part_${this._all.size + 1}`,
      type: "primitive",
      primitiveType: opts.primitiveType ?? "cube",
      container: opts.container ?? "Workspace",
      position: { x: 0, y: 0.5, z: 0, ...(opts.position ?? {}) },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color: opts.color ?? "#88aaff",
      visible: true,
      ...DEFAULT_PROPERTIES,
      anchored: false,
      velocity: { x: 0, y: 0, z: 0 },
      on: () => () => {},
      off: () => {},
      GetPropertyChangedSignal: () => ({ on: () => () => {}, off: () => {} }),
    };
    const proxiedRo = this.mountObjectEvents(ro);
    this.rebuildIndexes();
    this._events.emit("objectAdded", [proxiedRo]);
    return proxiedRo;
  }

  private cloneTemplateInto(tpl: RuntimeObject, container: ContainerName, position?: Vec3): RuntimeObject {
    const ro: RuntimeObject = {
      id: newId(),
      name: `${tpl.name}_${this._all.size + 1}`,
      type: tpl.type,
      primitiveType: tpl.primitiveType,
      container,
      position: position ? { ...position } : { ...tpl.position },
      rotation: { ...tpl.rotation },
      scale: { ...tpl.scale },
      color: tpl.color,
      visible: true,
      anchored: tpl.anchored,
      canCollide: tpl.canCollide,
      transparency: tpl.transparency,
      mass: tpl.mass,
      friction: tpl.friction,
      gravityEnabled: tpl.gravityEnabled,
      gravityStrength: tpl.gravityStrength,
      gravityRadius: tpl.gravityRadius,
      velocity: { x: 0, y: 0, z: 0 },
      on: () => () => {},
      off: () => {},
      GetPropertyChangedSignal: () => ({ on: () => () => {}, off: () => {} }),
    };
    const proxiedRo = this.mountObjectEvents(ro);
    this.rebuildIndexes();
    this._events.emit("objectAdded", [proxiedRo]);
    return proxiedRo;
  }

  /** Internal: remove an object cleanly, firing destroyed/objectRemoved. */
  private removeObject(id: string) {
    const ro = this._all.get(id);
    if (!ro) return;
    this._all.delete(id);
    this._playerContacts.delete(id);
    this.emitObjectEvent(id, "destroyed", []);
    this._objectEvents.delete(id);
    this._events.emit("objectRemoved", [ro]);
  }

  private runPickupSweep() {
    const p = this.player;
    const radius = 1.0;
    let removed = false;
    for (const o of this.objectList) {
      if (!o.isPickup) continue;
      const dx = p.position.x - o.position.x;
      const dy = p.position.y - o.position.y;
      const dz = p.position.z - o.position.z;
      if (Math.hypot(dx, dy, dz) > radius) continue;
      const name: string = o.pickupName ?? o.name;
      const data: Record<string, any> = o.pickupData ?? {};
      const slot = p.inventory.add(name, { template: o.name, data });
      if (slot) {
        this.pushLog(`Picked up ${name}.`);
        this.removeObject(o.id);
        removed = true;
      }
    }
    if (removed) this.rebuildIndexes();
  }

  private rebuildIndexes() {
    const ws = this.workspace;
    const lt = this.lighting;
    const rs = this.replicatedStorage;
    const sss = this.serverScriptService;
    const sp = this.starterPlayer;
    const pl = this.players;
    for (const k of Object.keys(ws)) delete ws[k];
    for (const k of Object.keys(lt)) delete lt[k];
    for (const k of Object.keys(rs)) delete rs[k];
    for (const k of Object.keys(sss)) delete sss[k];
    for (const k of Object.keys(sp)) delete sp[k];
    for (const k of Object.keys(pl)) delete pl[k];
    const list: RuntimeObject[] = [];
    for (const ro of this._all.values()) {
      switch (ro.container) {
        case "Workspace":
          ws[ro.name] = ro;
          list.push(ro);
          break;
        case "Lighting":
          lt[ro.name] = ro;
          list.push(ro);
          break;
        case "ReplicatedStorage":
          rs[ro.name] = ro;
          break;
        case "ServerScriptService":
          sss[ro.name] = ro;
          break;
        case "StarterPlayer":
          sp[ro.name] = ro;
          break;
        case "Players":
          pl[ro.name] = ro;
          break;
      }
    }
    this.objects = ws;
    this.objectList = list;
  }

  private pushLog(line: string) {
    this.logs.push(line);
    if (this.logs.length > 200) this.logs.shift();
    this.onLog?.(line);
  }

  /** Stable state API — same object reference across all frames. */
  private buildState(): RuntimeState {
    if (this._stateApi) return this._stateApi;
    this._stateApi = {
      get: (key) => this._stateValues.get(key),
      set: (key, value) => {
        const v = String(value);
        const prev = this._stateValues.get(key);
        if (prev === v) return;
        this._stateValues.set(key, v);
        const subs = this._stateSubs.get(key);
        if (!subs) return;
        for (const fn of subs) {
          try { fn(v, prev); }
          catch (e: any) { this.pushLog(`state.on("${key}") error: ${formatErr(e)}`); }
        }
      },
      on: (key, fn) => {
        let subs = this._stateSubs.get(key);
        if (!subs) { subs = new Set(); this._stateSubs.set(key, subs); }
        subs.add(fn);
        return () => { subs?.delete(fn); };
      },
      keys: () => Array.from(this._stateValues.keys()),
    };
    return this._stateApi;
  }

  invokeGuiClick(id: string) {
    const el = this.gui.get(id);
    if (!el?.onClick) return;
    try {
      el.onClick(this.buildApi(0));
    } catch (e: any) {
      this.pushLog(`gui[${id}] onClick error: ${formatErr(e)}`);
    }
  }

  /** Build the live API object once at start() time. The returned object is
   *  reused across frames; only `time` and `dt` mutate. Stable references for
   *  `events`, `keyboard`, etc. mean unsubscribe handles work after long delays. */
  private buildApi(dt: number): GameAPI {
    if (this._api) {
      this._api.time = this.time;
      this._api.dt = dt;
      return this._api;
    }

    const log = (...args: any[]) => {
      const text = args
        .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
        .join(" ");
      this.pushLog(text);
    };

    const find = (name: string): RuntimeObject | null => {
      const containers = [
        this.workspace, this.lighting, this.replicatedStorage,
        this.serverScriptService, this.starterPlayer, this.players
      ];
      for (const c of containers) {
        if (c[name]) return c[name];
      }
      for (const o of this._all.values()) {
        if (o.name === name) return o;
      }
      return null;
    };

    const create = (opts: Parameters<GameAPI["create"]>[0]): RuntimeObject => {
      const ro = this.createInternal({
        name: opts.name,
        primitiveType: opts.primitiveType,
        container: this.normalizeContainer(opts.container),
        position: { x: 0, y: 0.5, z: 0, ...(opts.position ?? {}) } as Vec3,
        color: opts.color,
      });
      if (opts.rotation) Object.assign(ro.rotation, opts.rotation);
      if (opts.scale) Object.assign(ro.scale, opts.scale);
      if (opts.type) ro.type = opts.type;
      return ro;
    };

    const spawn = (templateName: string, overrides?: Partial<RuntimeObject>): RuntimeObject | null => {
      const tpl = this.replicatedStorage[templateName];
      if (!tpl) {
        this.pushLog(`spawn(): no ReplicatedStorage template named "${templateName}"`);
        return null;
      }
      const ro = this.cloneTemplateInto(
        tpl, "Workspace",
        overrides?.position ? { ...tpl.position, ...overrides.position } : undefined,
      );
      if (overrides) {
        if (overrides.name) {
          ro.name = overrides.name;
          this.rebuildIndexes();
        }
        if (overrides.rotation) Object.assign(ro.rotation, overrides.rotation);
        if (overrides.scale) Object.assign(ro.scale, overrides.scale);
        if (overrides.color != null) ro.color = overrides.color;
        if (overrides.visible != null) ro.visible = overrides.visible;
        if (overrides.anchored != null) ro.anchored = overrides.anchored;
        if (overrides.canCollide != null) ro.canCollide = overrides.canCollide;
        if (overrides.transparency != null) ro.transparency = overrides.transparency;
        if (overrides.mass != null) ro.mass = overrides.mass;
        if (overrides.friction != null) ro.friction = overrides.friction;
        if (overrides.gravityEnabled != null) ro.gravityEnabled = overrides.gravityEnabled;
        if (overrides.gravityStrength != null) ro.gravityStrength = overrides.gravityStrength;
        if (overrides.gravityRadius != null) ro.gravityRadius = overrides.gravityRadius;
        if (overrides.velocity) Object.assign(ro.velocity, overrides.velocity);
      }
      return ro;
    };

    const destroy = (target: RuntimeObject | string) => {
      if (typeof target === "string") {
        for (const ro of this._all.values()) {
          if (ro.name === target || ro.id === target) {
            this.removeObject(ro.id);
            this.rebuildIndexes();
            return;
          }
        }
        return;
      }
      this.removeObject(target.id);
      this.rebuildIndexes();
    };

    const guiText = (id: string, text: string, opts?: Partial<Omit<GuiElement, "id" | "kind" | "text">>) => {
      const prev = this.gui.get(id);
      const el: GuiElement = {
        id,
        kind: "text",
        text,
        x: opts?.x ?? prev?.x ?? 0,
        y: opts?.y ?? prev?.y ?? 0,
        anchor: opts?.anchor ?? prev?.anchor ?? "tl",
        color: opts?.color ?? prev?.color ?? "#ffffff",
        size: opts?.size ?? prev?.size ?? 16,
        bg: opts?.bg ?? prev?.bg,
      };
      this.gui.set(id, el);
      this.guiVersion++;
    };

    const guiButton = (
      id: string,
      text: string,
      opts: Partial<Omit<GuiElement, "id" | "kind" | "text">> | undefined,
      onClick?: (game: GameAPI) => void
    ) => {
      const prev = this.gui.get(id);
      const el: GuiElement = {
        id,
        kind: "button",
        text,
        x: opts?.x ?? prev?.x ?? 16,
        y: opts?.y ?? prev?.y ?? 16,
        anchor: opts?.anchor ?? prev?.anchor ?? "tl",
        color: opts?.color ?? prev?.color ?? "#ffffff",
        size: opts?.size ?? prev?.size ?? 14,
        bg: opts?.bg ?? prev?.bg ?? "rgba(30,40,60,0.85)",
        onClick: onClick ?? prev?.onClick,
      };
      this.gui.set(id, el);
      this.guiVersion++;
    };

    const guiClear = (id?: string) => {
      if (id == null) this.gui.clear();
      else this.gui.delete(id);
      this.guiVersion++;
    };

    // ─── Engine event APIs (events / keyboard / mouse / world) ──────────────
    const eventsApi: EventsAPI = {
      on: (event, fn) => this._events.on(event, fn),
      off: (event, fn) => this._events.off(event, fn),
    };
    this._eventsApi = eventsApi;

    const keyboardApi: KeyboardAPI = {
      onPress: (key, fn) => {
        const k = key.toLowerCase();
        let s = this._keyDownHandlers.get(k);
        if (!s) { s = new Set(); this._keyDownHandlers.set(k, s); }
        s.add(fn);
        return () => s!.delete(fn);
      },
      onRelease: (key, fn) => {
        const k = key.toLowerCase();
        let s = this._keyUpHandlers.get(k);
        if (!s) { s = new Set(); this._keyUpHandlers.set(k, s); }
        s.add(fn);
        return () => s!.delete(fn);
      },
      isDown: (key) => !!this.input.keys[key.toLowerCase()],
    };
    this._keyboardApi = keyboardApi;

    const mouseApi: MouseAPI = {
      onClick: (fn) => {
        this._mouseClickHandlers.add(fn);
        return () => this._mouseClickHandlers.delete(fn);
      },
    };
    this._mouseApi = mouseApi;

    const worldApi: WorldAPI = {
      onObjectAdded: (fn) => this._events.on("objectAdded", fn),
      onObjectRemoved: (fn) => this._events.on("objectRemoved", fn),
      onPlayerSpawned: (fn) => this._events.on("playerSpawned", fn),
      onPlayerDied: (fn) => this._events.on("playerDied", fn),
    };
    this._worldApi = worldApi;

    // ─── Sugar / utility helpers ─────────────────────────────────────────────
    const onKey = (key: string, fn: () => void) => keyboardApi.onPress(key, fn);
    const onUpdateFn = (fn: (dt: number, time: number) => void) =>
      this._events.on("update", fn);
    const every = (seconds: number, fn: () => void) => {
      const t = { fn, nextAt: this.time + seconds, interval: seconds, once: false };
      this._timers.push(t);
      return () => { const i = this._timers.indexOf(t); if (i >= 0) this._timers.splice(i, 1); };
    };
    const after = (seconds: number, fn: () => void) => {
      const t = { fn, nextAt: this.time + seconds, interval: seconds, once: true };
      this._timers.push(t);
      return () => { const i = this._timers.indexOf(t); if (i >= 0) this._timers.splice(i, 1); };
    };
    const wait = (seconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, seconds * 1000)));
    const now = () => this.time;
    /**
     * Animate numeric properties on any object/vector over `duration` seconds.
     * The engine advances the tween every frame — script authors don't write
     * per-frame interpolation code.
     *
     *   tween(part.position, { x: 10, y: 5 }, 2, "easeOutQuad");
     *   tween(part, { transparency: 1 }, 0.5, "linear", () => destroy(part));
     *
     * Returns a cancel function. Pass an `onDone` callback as the 5th arg.
     */
    const tweenFn = (
      target: any,
      to: Record<string, any>,
      duration: number,
      easing: Easing = "linear",
      onDone?: () => void
    ) => this._tweens.start(target, to, duration, easing, onDone);
    const random = (min: number, max: number) => min + Math.random() * (max - min);
    const randInt = (min: number, max: number) =>
      Math.floor(min + Math.random() * (max - min + 1));
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const dist = (a: Vec3 | { position: Vec3 }, b: Vec3 | { position: Vec3 }) => {
      const pa = "position" in a ? a.position : a;
      const pb = "position" in b ? b.position : b;
      return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    };
    const lerpFn = (a: number, b: number, t: number) => a + (b - a) * t;
    const clampFn = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    this._api = {
      objects: this.objects,
      workspace: this.workspace,
      lighting: this.lighting,
      replicatedStorage: this.replicatedStorage,
      serverScriptService: this.serverScriptService,
      starterPlayer: this.starterPlayer,
      players: this.players,
      player: this.player,
      input: this.input,
      physics: this.physics,
      state: this.buildState(),
      events: eventsApi,
      keyboard: keyboardApi,
      mouse: mouseApi,
      world: worldApi,
      time: this.time,
      dt,
      now,
      log,
      find,
      spawn,
      create,
      destroy,
      gui: { text: guiText, button: guiButton, clear: guiClear },
      runService: this.runService,
      onKey,
      onUpdate: onUpdateFn,
      every,
      after,
      wait,
      tween: tweenFn,
      random,
      randInt,
      pick,
      dist,
      lerp: lerpFn,
      clamp: clampFn,
    };
    return this._api;
  }

  /** Public hook used by PlayMode to deliver a 3D-viewport click. `objId` is
   *  the object hit by the raycast, or null if the click missed everything. */
  emitClick(objId: string | null) {
    const obj = objId ? (this._all.get(objId) ?? null) : null;
    if (obj) this.emitObjectEvent(obj.id, "clicked", [obj]);
    for (const fn of this._mouseClickHandlers) {
      try { fn(obj); } catch (e: any) { this.pushLog(`mouse.onClick error: ${formatErr(e)}`); }
    }
  }

  /** Public hook used by PlayMode to dispatch a tap/touch on a specific
   *  object — same semantics as `obj.on("touched", ...)`. Used for things
   *  like mobile tap-to-collect even when the player isn't standing on it. */
  emitTap(objId: string) {
    this.emitObjectEvent(objId, "clicked", [this._all.get(objId)]);
  }

  /** Called by PlayMode before rendering to emit RunService.RenderStepped. */
  emitRenderStepped(dt: number) {
    this._events.emit("renderStepped", [dt, this.time], (e, fn) =>
      this.pushLog(`RunService.RenderStepped error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );
  }

  /** Run every script's top-level body once. Compile errors are already
   *  attached as `s.error`; runtime rejections are caught here. */
  private async runScripts() {
    const api = this.buildApi(0);
    for (const s of this.scripts) {
      if (s.error) {
        this.pushLog(`[${s.name}] compile error: ${s.error}`);
        continue;
      }
      if (!s.run) continue;
      try {
        const maybe = (s.run as any)(api);
        if (maybe && typeof maybe.then === "function") {
          maybe.then(undefined, (e: any) => {
            this.pushLog(`[${s.name}] runtime error: ${formatErr(e)}`);
          });
        }
      } catch (e: any) {
        this.pushLog(`[${s.name}] runtime error: ${formatErr(e)}`);
      }
    }
  }

  start() {
    void this.runScripts();
    this._events.emit("start", [], (e, fn) =>
      this.pushLog(`events.on("start") error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );
    // Fire playerSpawned for the initial spawn so scripts can hook respawn logic.
    this._events.emit("playerSpawned", [this.player], (e, fn) =>
      this.pushLog(`events.on("playerSpawned") error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );
  }

  /** Cleanly tear down event subscriptions — called when the PlayMode unmounts. */
  stop() {
    this._events.emit("stop", [], () => {});
    this._events.clear();
    this._objectEvents.clear();
    this._keyDownHandlers.clear();
    this._keyUpHandlers.clear();
    this._mouseClickHandlers.clear();
    this._timers.length = 0;
  }

  step(dt: number) {
    if (dt > 0.1) dt = 0.1;
    this.time += dt;
    const p = this.player;

    // ---------- Gravity ----------
    const gravityVec = this.computeGravity(p.position);
    const gMag = Math.hypot(gravityVec.x, gravityVec.y, gravityVec.z);
    const desiredUp =
      gMag > 0.001
        ? { x: -gravityVec.x / gMag, y: -gravityVec.y / gMag, z: -gravityVec.z / gMag }
        : { x: 0, y: 1, z: 0 };
    const slerpT = Math.min(1, dt * 6);
    p.up.x = p.up.x + (desiredUp.x - p.up.x) * slerpT;
    p.up.y = p.up.y + (desiredUp.y - p.up.y) * slerpT;
    p.up.z = p.up.z + (desiredUp.z - p.up.z) * slerpT;
    const upLen = Math.hypot(p.up.x, p.up.y, p.up.z) || 1;
    p.up.x /= upLen; p.up.y /= upLen; p.up.z /= upLen;

    // ---------- Camera-relative horizontal movement ----------
    const cf = this.cameraForward;
    const cfDot = cf.x * p.up.x + cf.y * p.up.y + cf.z * p.up.z;
    let fx = cf.x - p.up.x * cfDot;
    let fy = cf.y - p.up.y * cfDot;
    let fz = cf.z - p.up.z * cfDot;
    let fLen = Math.hypot(fx, fy, fz);
    if (fLen < 0.0001) {
      const fallback = Math.abs(p.up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const fbDot = fallback.x * p.up.x + fallback.y * p.up.y + fallback.z * p.up.z;
      fx = fallback.x - p.up.x * fbDot;
      fy = fallback.y - p.up.y * fbDot;
      fz = fallback.z - p.up.z * fbDot;
      fLen = Math.hypot(fx, fy, fz) || 1;
    }
    fx /= fLen; fy /= fLen; fz /= fLen;
    const rx = fy * p.up.z - fz * p.up.y;
    const ry = fz * p.up.x - fx * p.up.z;
    const rz = fx * p.up.y - fy * p.up.x;

    const speed = p.speed || 6;
    const wantX = rx * this.input.moveX - fx * this.input.moveZ;
    const wantY = ry * this.input.moveX - fy * this.input.moveZ;
    const wantZ = rz * this.input.moveX - fz * this.input.moveZ;

    const upVelDot = p.velocity.x * p.up.x + p.velocity.y * p.up.y + p.velocity.z * p.up.z;
    p.velocity.x = wantX * speed + p.up.x * upVelDot;
    p.velocity.y = wantY * speed + p.up.y * upVelDot;
    p.velocity.z = wantZ * speed + p.up.z * upVelDot;

    // Face the direction we're actually moving in world space (not local input).
    // The avatar's mesh faces +Z when rotation.y = 0, so the target yaw is
    // `atan2(wantX, wantZ)`. We slerp to the target to avoid teleport-rotations
    // when the player swings the camera mid-stride. When idle, yaw is left
    // untouched so the camera can orbit freely without spinning the avatar.
    const inputMag = Math.hypot(this.input.moveX, this.input.moveZ);
    if (inputMag > 0.01) {
      const moveMag = Math.hypot(wantX, wantZ);
      if (moveMag > 0.0001) {
        const targetYaw = Math.atan2(wantX, wantZ);
        let diff = targetYaw - p.rotation.y;
        // shortest-arc lerp: wrap diff into [-pi, pi]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.rotation.y += diff * Math.min(1, dt * 12);
      }
    }

    // Jump
    if (this.input.jump && p.onGround) {
      const jp = p.jumpPower || 8;
      p.velocity.x += p.up.x * jp;
      p.velocity.y += p.up.y * jp;
      p.velocity.z += p.up.z * jp;
      p.onGround = false;
    }

    // Apply gravity
    p.velocity.x += gravityVec.x * dt;
    p.velocity.y += gravityVec.y * dt;
    p.velocity.z += gravityVec.z * dt;

    // Integrate player
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    p.position.z += p.velocity.z * dt;

    // ---------- Per-object physics ----------
    for (const o of this.objectList) {
      if (o.anchored || o.container !== "Workspace") continue;
      const og = this.computeGravity(o.position, o.id);
      o.velocity.x += og.x * dt;
      o.velocity.y += og.y * dt;
      o.velocity.z += og.z * dt;
      o.position.x += o.velocity.x * dt;
      o.position.y += o.velocity.y * dt;
      o.position.z += o.velocity.z * dt;
    }

    // ---------- Collisions ----------
    for (const o of this.objectList) {
      if (!o.visible || !o.canCollide) continue;
      if (o.type === "light" || o.type === "spawn") continue;
      if (o.container !== "Workspace") continue;
      this.resolvePlayerVsObject(o);
    }

    // ---------- Pickups ----------
    this.runPickupSweep();

    // ---------- Default floor ----------
    if (p.position.y < 1) {
      p.position.y = 1;
      if (p.velocity.y < 0) p.velocity.y = 0;
      p.onGround = true;
      const f = 1 - Math.min(1, 0.4 * 8 * dt);
      p.velocity.x *= f;
      p.velocity.z *= f;
    } else if (p.position.y > 1.001) {
      p.onGround = false;
    }

    // ─── Touch detection (rising / falling edge against player) ──────────────
    this.runTouchSweep();

    // ─── Refresh API time/dt fields (object reuses _api) ─────────────────────
    this.buildApi(dt);

    // ─── Fire RunService.Stepped (before physics) ────────────────────────────
    this._events.emit("stepped", [dt, this.time], (e, fn) =>
      this.pushLog(`RunService.Stepped error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );

    // ─── Fire key edges (engine event bus + keyboard.onPress / onRelease) ────
    for (const k in this.input.keys) {
      const isDown = !!this.input.keys[k];
      const wasDown = !!this._prevKeys[k];
      if (isDown && !wasDown) {
        this._events.emit("keyDown", [k], (e, fn) =>
          this.pushLog(`events.on("keyDown") error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
        );
        const set = this._keyDownHandlers.get(k);
        if (set) for (const fn of set) {
          try { fn(); } catch (e: any) { this.pushLog(`keyboard.onPress("${k}") error: ${formatErr(e)}`); }
        }
      } else if (!isDown && wasDown) {
        this._events.emit("keyUp", [k], (e, fn) =>
          this.pushLog(`events.on("keyUp") error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
        );
        const set = this._keyUpHandlers.get(k);
        if (set) for (const fn of set) {
          try { fn(); } catch (e: any) { this.pushLog(`keyboard.onRelease("${k}") error: ${formatErr(e)}`); }
        }
      }
    }

    // ─── Tick the engine "heartbeat" event (after physics, main game loop) ────
    this._events.emit("heartbeat", [dt, this.time], (e, fn) =>
      this.pushLog(`RunService.Heartbeat error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );
    // Legacy aliases for backward compatibility
    this._events.emit("update", [dt, this.time], (e, fn) =>
      this.pushLog(`events.on("update") error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );
    this._events.emit("step", [dt, this.time], () => {});

    // ─── Fire timers (every / after) ─────────────────────────────────────────
    for (let i = this._timers.length - 1; i >= 0; i--) {
      const t = this._timers[i];
      if (this.time < t.nextAt) continue;
      try { t.fn(); } catch (e: any) { this.pushLog(`timer error: ${formatErr(e)}`); }
      if (t.once) this._timers.splice(i, 1);
      else t.nextAt = this.time + t.interval;
    }

    // ─── Player health → death event (rising edge to zero) ───────────────────
    if (p.health <= 0 && (this as any)._lastHealth > 0) {
      this._events.emit("playerDied", [p], () => {});
      p.respawn();
      this._events.emit("playerSpawned", [p], () => {});
    }
    (this as any)._lastHealth = p.health;

    // ─── Clear jump AFTER scripts have seen it ───────────────────────────────
    this.input.jump = false;

    // ─── Snapshot keys for next-frame edge detection ─────────────────────────
    this._prevKeys = { ...this.input.keys };
  }

  /** Detect player↔object overlap, firing `touched`/`untouched` on the rising
   *  and falling edges. Works for any object with a primitive shape — does NOT
   *  require canCollide=true, so it can also drive trigger volumes. */
  private runTouchSweep() {
    const p = this.player;
    const pr = 0.45; // approx player radius (matches resolvePlayerVsObject)
    const ph = 0.95; // approx player half-height
    const seenThisFrame = new Set<string>();

    for (const o of this.objectList) {
      if (!o.visible) continue;
      if (o.type === "light" || o.type === "spawn") continue;
      if (o.container !== "Workspace") continue;

      let touching = false;
      if (o.primitiveType === "sphere") {
        const r = Math.max(o.scale.x, o.scale.y, o.scale.z) * 0.5;
        const dx = p.position.x - o.position.x;
        const dy = p.position.y - o.position.y;
        const dz = p.position.z - o.position.z;
        touching = Math.hypot(dx, dy, dz) < r + pr + 0.05;
      } else {
        const hx = (o.scale.x || 1) * 0.5 + pr;
        const hy = (o.scale.y || 1) * 0.5 + ph;
        const hz = (o.scale.z || 1) * 0.5 + pr;
        touching =
          Math.abs(p.position.x - o.position.x) < hx &&
          Math.abs(p.position.y - o.position.y) < hy &&
          Math.abs(p.position.z - o.position.z) < hz;
      }

      if (touching) {
        seenThisFrame.add(o.id);
        if (!this._playerContacts.has(o.id)) {
          this._playerContacts.add(o.id);
          // Pass the player as `other` so scripts can write `(other) => other.takeDamage(10)`
          this.emitObjectEvent(o.id, "touched", [p, o]);
        }
      }
    }

    // Fire untouched for anything we left this frame.
    for (const id of this._playerContacts) {
      if (seenThisFrame.has(id)) continue;
      this._playerContacts.delete(id);
      this.emitObjectEvent(id, "untouched", [p, this._all.get(id)]);
    }
  }

  private computeGravity(point: Vec3, excludeId?: string): Vec3 {
    let bestMag = 0;
    let best: Vec3 | null = null;
    for (const o of this.objectList) {
      if (!o.gravityEnabled || o.id === excludeId) continue;
      const { surfaceDistance, dirToCenter, surfaceRadius } = pointVsObjectSurface(point, o);
      if (surfaceDistance > o.gravityRadius) continue;
      const r = Math.max(surfaceRadius, surfaceRadius + Math.max(0, surfaceDistance));
      const accel = (o.gravityStrength * surfaceRadius * surfaceRadius) / (r * r);
      if (accel > bestMag) {
        bestMag = accel;
        best = {
          x: dirToCenter.x * accel,
          y: dirToCenter.y * accel,
          z: dirToCenter.z * accel,
        };
      }
    }
    if (best) return best;
    return { x: 0, y: -(this.physics.gravity || 9.81), z: 0 };
  }

  private resolvePlayerVsObject(o: RuntimeObject) {
    const p = this.player;
    const playerRadius = 0.4;
    const playerHeight = 0.9;

    if (o.primitiveType === "sphere") {
      const r = Math.max(o.scale.x, o.scale.y, o.scale.z) * 0.5;
      const dx = p.position.x - o.position.x;
      const dy = p.position.y - o.position.y;
      const dz = p.position.z - o.position.z;
      const dist = Math.hypot(dx, dy, dz);
      const minDist = r + playerRadius;
      if (dist < minDist && dist > 0.0001) {
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        const push = minDist - dist;
        p.position.x += nx * push;
        p.position.y += ny * push;
        p.position.z += nz * push;
        const vDotN = p.velocity.x * nx + p.velocity.y * ny + p.velocity.z * nz;
        if (vDotN < 0) {
          p.velocity.x -= nx * vDotN;
          p.velocity.y -= ny * vDotN;
          p.velocity.z -= nz * vDotN;
        }
        if (nx * p.up.x + ny * p.up.y + nz * p.up.z > 0.5) p.onGround = true;
      }
      return;
    }

    const halfX = (o.scale.x || 1) * 0.5 + playerRadius;
    const halfY = (o.scale.y || 1) * 0.5 + playerHeight;
    const halfZ = (o.scale.z || 1) * 0.5 + playerRadius;

    const dx = p.position.x - o.position.x;
    const dy = p.position.y - o.position.y;
    const dz = p.position.z - o.position.z;

    if (Math.abs(dx) < halfX && Math.abs(dy) < halfY && Math.abs(dz) < halfZ) {
      const overlapX = halfX - Math.abs(dx);
      const overlapY = halfY - Math.abs(dy);
      const overlapZ = halfZ - Math.abs(dz);

      if (overlapY < overlapX && overlapY < overlapZ) {
        if (dy > 0) {
          p.position.y = o.position.y + halfY;
          if (p.velocity.y < 0) p.velocity.y = 0;
          if (p.up.y > 0.5) p.onGround = true;
        } else {
          p.position.y = o.position.y - halfY;
          if (p.velocity.y > 0) p.velocity.y = 0;
        }
      } else if (overlapX < overlapZ) {
        p.position.x += dx >= 0 ? overlapX : -overlapX;
        p.velocity.x = 0;
        if (Math.abs(p.up.x) > 0.5) p.onGround = true;
      } else {
        p.position.z += dz >= 0 ? overlapZ : -overlapZ;
        p.velocity.z = 0;
        if (Math.abs(p.up.z) > 0.5) p.onGround = true;
      }
    }
  }
}

export const DEFAULT_SCRIPT = `// Welcome! Your script runs ONCE the moment Play starts.
// There's no boilerplate — no onStart, no onUpdate. Just write code.
//
// To do something every frame, listen for the "heartbeat" event.
// \`events.on("update", ...)\` still works as an alias.
// To react to keys / clicks / collisions, register event handlers.
// Every API ('player', 'workspace', 'gui', 'events', 'keyboard', 'mouse',
// 'world', 'state', 'inventory', 'runService', ...) is a bare global — no 'game.' prefix.

let score = 0;

log("Game started! Press E to score, J for super-jump.");
gui.text("score", "Score: 0", { anchor: "tl", x: 16, y: 16, size: 20 });

// React to keys
keyboard.onPress("e", () => {
  score += 1;
  gui.text("score", "Score: " + score);
  if (score >= 10) state.set("phase", "GameOver");
});

keyboard.onPress("j", () => {
  player.jumpPower = 16;
  after(5, () => { player.jumpPower = 8; });
});

// React to objects in the world
const cube = workspace.Cube;
if (cube) {
  cube.on("touched", (other) => log("touched the cube!"));
  cube.on("clicked", () => log("you clicked the cube"));
}

// React to mouse anywhere in the 3D viewport
mouse.onClick((obj) => {
  if (obj) log("clicked", obj.name);
});

// Engine lifecycle events
world.onPlayerSpawned((p) => log(p.username, "spawned"));
world.onPlayerDied((p) => log(p.username, "died"));

// Per-frame work — spin every cube slowly
runService.heartbeat.on((dt) => {
  for (const name in workspace) {
    const o = workspace[name];
    if (o.primitiveType === "cube") o.rotation.y += dt * 0.5;
  }
});

// Periodic / delayed
every(3, () => player.heal(5));

// Sequential time — async/await is supported
state.set("phase", "Lobby");
await wait(2);
state.set("phase", "Playing");
log("game phase is now Playing");
`;

export const SCRIPTING_DOCS = `# Scripting Guide

Your scripts run in **plain JavaScript** — there's no setup, no imports, no npm.
Your code runs **once** when Play starts, top to bottom. There is no
\`onStart\` / \`onUpdate\` boilerplate. To do something every frame, listen for
the \`heartbeat\` event. \`events.on("update", ...)\` still works as an alias:

\`\`\`js
runService.heartbeat.on((dt) => {
  // runs every frame. dt = seconds since last frame
});
\`\`\`

To react to anything else, register an event handler. The most common ones:

\`\`\`js
keyboard.onPress("e", () => log("E pressed"));
keyboard.onRelease("e", () => log("E released"));
mouse.onClick((obj) => log("clicked", obj?.name ?? "the sky"));

const cube = workspace.Cube;
cube.on("touched", (other) => log("touched by", other.username ?? other.name));
cube.on("untouched", () => log("no longer touching"));
cube.on("clicked", () => log("clicked the cube"));
cube.on("destroyed", () => log("the cube is gone"));

world.onPlayerSpawned((p) => log(p.username, "spawned"));
world.onPlayerDied((p) => log(p.username, "died"));
\`\`\`

Async / sequential time works too:

\`\`\`js
log("intro");
await wait(2);   // pauses for 2 real seconds
log("main");
\`\`\`

Everything in this guide is available as a **bare global** — just type
\`player.health\`, not \`game.player.health\`. (You don't need to type \`game.\`
at all; the parameter is there only if you prefer that style.)

## The world

The hierarchy mirrors Roblox's services. Every object and every script lives
inside one of these containers:

| Container               | What it holds                                                  |
| ----------------------- | -------------------------------------------------------------- |
| \`workspace\`           | Live 3D objects you see in the world                           |
| \`lighting\`            | Lights, sky, atmosphere                                        |
| \`replicatedStorage\`   | Shared templates — \`spawn("Name")\` clones them into Workspace |
| \`serverScriptService\` | Server-authoritative scripts (run on the host)                 |
| \`starterPlayer\`       | LocalScripts cloned into each player on join                   |
| \`players\`             | Per-player non-physical data                                   |

\`\`\`js
const cube = workspace.Cube;     // get an object by name
const tree = spawn("Tree");      // clone a ReplicatedStorage template
const found = find("Anything");  // search every container
\`\`\`

## The player

\`\`\`js
player.username      // logged-in user's name (read-only)
player.health        // current HP (auto-respawns at 0)
player.maxHealth     // default 100
player.speed         // walk speed (default 6)
player.jumpPower     // jump strength (default 8)
player.size          // visual scale (1 = default)
player.color         // avatar color, e.g. "#ff4444"
player.position      // { x, y, z } — read & write
player.rotation      // { x, y, z } — read & write
player.velocity      // { x, y, z } — read & write
player.onGround      // true when standing on something (read-only)
player.spawnPoint    // { x, y, z } — set automatically from SpawnLocation
player.up            // current up vector (read-only; rotates with gravity)

player.teleport(x, y, z);
player.respawn();
player.takeDamage(10);
player.heal(20);
\`\`\`

## Inventory

Every player has a live inventory you can fill, query, and drop from:

\`\`\`js
inventory.add("Coin", { count: 5, data: { value: 10 } });
inventory.has("Coin", 3);          // true if you have at least 3
inventory.get("Coin").count;       // current stack size
inventory.equip("Sword");          // mark an item as equipped
inventory.equipped?.name;          // the equipped slot, or null
inventory.remove("Coin", 1);       // remove 1 (returns how many were removed)
inventory.drop("Sword");           // spawn it back into the world in front of you
inventory.items.forEach(i => log(i.name, "x" + i.count));
inventory.clear();                 // empty everything
inventory.maxSlots = 64;           // default is 32
\`\`\`

### Auto-pickup

Tag any object with \`isPickup = true\` and walking into it adds it to the
inventory automatically:

\`\`\`js
const coin = create({
  primitiveType: "sphere",
  position: { x: 2, y: 1, z: 0 },
  color: "#fbbf24",
  scale: { x: 0.4, y: 0.4, z: 0.4 },
});
coin.isPickup = true;
coin.pickupName = "Coin";
// defaults to the object's name
coin.pickupData = { value: 10 };   // free-form per-item data
\`\`\`

## Input — three easy ways

\`\`\`js
// 1) Check every frame (raw)
if (input.held("w")) { /* W is held down */ }
if (input.pressed("space")) { /* the frame Space was pressed */ }
if (input.released("e")) { /* the frame E was let go */ }
if (input.keys["shift"]) { /* same as input.held("shift") */ }

// 2) Register a callback (cleanest for one-off actions)
onKey("f", () => log("F was pressed!"));
onKey("r", () => player.respawn());

// 3) Movement is handled for you — WASD, mouse-look, Space to jump.
//    But you can read the analog axis too (also driven by the mobile joystick):
const x = input.moveX;  // -1 .. +1   (D = +1, A = -1)
const z = input.moveZ;  // -1 .. +1   (W = -1, S = +1)
\`\`\`

## Timers

\`\`\`js
every(2, () => log("ticks every 2 seconds"));
after(5, () => log("fires once, 5 seconds in"));
\`\`\`

## Global state (multiplayer-ready)

Use \`state\` for anything cross-script or cross-player. Values are **strings**
so they replicate cleanly when multiplayer turns on; booleans are fine for
purely local toggles inside one script.

\`\`\`js
state.set("phase", "Lobby");        // anywhere can read this back
state.get("phase");                 // → "Lobby"

state.on("phase", (next, prev) => {
  log("phase changed:", prev, "→", next);
});

state.set("phase", "Playing");      // fires every subscribed handler
\`\`\`

## Physics

\`\`\`js
physics.gravity = 9.81;   // default world gravity (units/sec^2)
physics.airDrag = 0.1;    // 0 = no drag, 1 = stop instantly
\`\`\`

> Want lower or higher gravity in part of the world? Tag any object with
> \`gravityEnabled = true\` (Properties panel or in script) — see below.

Every object has live, scriptable properties — the same ones in the Properties panel:

\`\`\`js
const o = workspace.Wall;
o.anchored = false;          // gravity & forces now affect it
o.canCollide = false;        // ghost: things pass through
o.transparency = 0.5;        // 0 = opaque, 1 = invisible
o.mass = 2;                  // affects how strongly it's pulled
o.friction = 0.4;            // 0 = ice, 1 = sandpaper
o.velocity.y = 10;           // launch it upward
o.gravityEnabled = true;     // make THIS object pull others (planet mode!)
o.gravityStrength = 9.81;    // pull at the surface
o.gravityRadius = 30;        // how far the pull reaches (from the surface)
\`\`\`

> **Walking on planets:** when an object near the player has \`gravityEnabled\`,
> the player rotates so their feet face it. The camera follows along, and your
> WASD controls stay relative to wherever you're standing.

## Build at runtime

\`\`\`js
const enemy = create({
  name: "Goblin",                       // optional
  primitiveType: "sphere",              // "cube" | "sphere" | "cylinder" | "plane"
  container: "Workspace",               // optional
  position: { x: 5, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale:    { x: 1, y: 1, z: 1 },
  color: "#ff4444",
});

const tree = spawn("Tree");             // clone a ReplicatedStorage template
destroy(tree);                          // remove by reference
destroy("Goblin");                      // …or by name
\`\`\`

## On-screen UI (HUD)

\`\`\`js
gui.text("score", "Score: 0", {
  anchor: "tl", x: 16, y: 16, size: 20,
  color: "#ffffff", bg: "rgba(0,0,0,0.45)",
});
gui.button("respawn", "Respawn", { anchor: "br", x: 24, y: 24 }, () => {
  player.respawn();
});
gui.clear("score");   // remove one element
gui.clear();          // remove all
\`\`\`

Anchors: \`tl tc tr  cl cc cr  bl bc br\` (top/center/bottom × left/center/right).

A health bar appears automatically whenever \`player.health < player.maxHealth\`.

## Handy math helpers

\`\`\`js
random(0, 10);          // float in [0, 10)
randInt(1, 6);          // integer 1..6 (inclusive)
pick(["red", "blue"]);  // random element
dist(player, enemy);    // distance between any two things with .position
lerp(0, 100, 0.5);      // 50 — linear interpolation
clamp(150, 0, 100);     // 100
\`\`\`

## Frame info

\`\`\`js
time     // seconds since play started
dt       // seconds since the last frame (also passed to onUpdate)
\`\`\`

## Debugging

\`\`\`js
log("anything you want");                // shows up in the Console (button at top)
log("position is", player.position);
console.log("works too");                // routed into the in-game console
console.warn("yellow [warn] prefix");
console.error("red [error] prefix");
\`\`\`

That's it — happy building!
`;
