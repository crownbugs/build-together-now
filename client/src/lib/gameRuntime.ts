// client/src/lib/runtime.ts
import type { GameObject, Script } from "@shared/schema";
import { TweenManager, type Easing } from "./runtime/tween";
import { HierarchyIndex } from "./runtime/hierarchy";
import { raycast as raycastWorld, type RaycastResult, type RaycastParams } from "./runtime/raycast";
import { resolveObjectCollisions } from "./runtime/collision";
import { NetworkBus, type NetSnapshot, type NetInput } from "./runtime/network";

export type { RaycastResult, RaycastParams } from "./runtime/raycast";
export type { NetSnapshot, NetInput } from "./runtime/network";

export type Vec3 = { x: number; y: number; z: number };

/** Containers organize objects + scripts by purpose, exactly like Roblox services. */
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
  anchored: boolean;
  canCollide: boolean;
  transparency: number;
  mass: number;
  friction: number;
  /** Gravity source settings: boolean to enable with defaults, or object with strength/radius */
  gravity?: { enabled: boolean; strength: number; radius: number } | boolean;
  /** Auto-rotation speed in radians per second (Y axis). Set this and it rotates automatically! */
  autoRotateY?: number;
  /** Auto-bob amplitude and speed. Set this and it bobs up and down automatically! */
  autoBob?: { amplitude: number; speed: number; startY?: number };
  /** Auto-follow target. Set this and it follows the target automatically! */
  autoFollow?: { target: RuntimeObject | RuntimePlayer; speed: number; offset?: Vec3 };
  /** Auto-spin (full 3D rotation). Set this and it spins automatically! */
  autoSpin?: { x?: number; y?: number; z?: number };
  /** Auto-move in a direction. Set this and it moves automatically! */
  autoMove?: { direction: Vec3; speed: number };
};

export const DEFAULT_PROPERTIES = {
  anchored: true,
  canCollide: true,
  transparency: 0,
  mass: 1,
  friction: 0.4,
  gravity: { enabled: false, strength: 9.81, radius: 30 },
};

/** Events a script can subscribe to on a single object via `obj.on(...)`. */
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
  anchored: boolean;
  canCollide: boolean;
  transparency: number;
  mass: number;
  friction: number;
  velocity: Vec3;
  isPickup?: boolean;
  pickupName?: string;
  pickupData?: Record<string, any>;
  /** Auto-update properties - set these and they update every frame automatically! */
  autoRotateY?: number;
  autoBob?: { amplitude: number; speed: number; startY?: number; _time?: number };
  autoFollow?: { target: RuntimeObject | RuntimePlayer; speed: number; offset?: Vec3 };
  autoSpin?: { x?: number; y?: number; z?: number };
  autoMove?: { direction: Vec3; speed: number };
  /** Parent in the hierarchy (Roblox-style). null = top-level in container. */
  parentId: string | null;
  /** Live array of direct children (computed from the HierarchyIndex). */
  readonly children: RuntimeObject[];
  /** Walk children to find one by name (returns first match). */
  findFirstChild: (name: string) => RuntimeObject | null;
  /** Move this object under a new parent (or null to detach). */
  setParent: (parent: RuntimeObject | null) => void;
  on: (event: ObjectEventName, fn: (...args: any[]) => void) => () => void;
  off: (event: ObjectEventName, fn: (...args: any[]) => void) => void;
  GetPropertyChangedSignal: (property: string) => EventsAPI;

  /** Gravity source settings and per‑source exclusions. 
   *  - obj.gravity = true/false enables/disables this object's own gravity.
   *  - obj.gravity = { strength: x, radius: y } sets its gravity parameters.
   *  - For any other object with name "sourceName", obj.gravity.sourceName = false excludes that source's gravity.
   *  - Example: player.gravity.planet1 = false stops the planet named "planet1" from affecting the player.
   */
  gravity: {
    enabled: boolean;
    strength: number;
    radius: number;
    [sourceName: string]: any; // to allow dynamic exclusion flags
  };

  /** INTERNAL: actual gravity source data (enabled, strength, radius) */
  _gravitySource: { enabled: boolean; strength: number; radius: number };
  /** INTERNAL: exclusions (source name -> excluded) */
  _gravityExclude: Map<string, boolean>;
};

export type InventoryItem = {
  id: string;
  name: string;
  count: number;
  template?: string;
  data: Record<string, any>;
};

export type PlayerInventory = {
  readonly items: ReadonlyArray<InventoryItem>;
  maxSlots: number;
  readonly equipped: InventoryItem | null;
  add: (name: string, opts?: { count?: number; template?: string; data?: Record<string, any> }) => InventoryItem | null;
  remove: (name: string, count?: number) => number;
  has: (name: string, count?: number) => boolean;
  get: (name: string) => InventoryItem | null;
  equip: (name: string | null) => boolean;
  drop: (name: string, count?: number) => RuntimeObject | null;
  clear: () => void;
};

export type RuntimePlayer = {
  id: string;  // internal ID, not exposed to scripts
  username: string;
  color: string;
  position: Vec3;
  rotation: Vec3;
  velocity: Vec3;
  onGround: boolean;
  health: number;
  maxHealth: number;
  speed: number;
  jumpPower: number;
  size: number;
  spawnPoint: Vec3;
  up: Vec3;
  inventory: PlayerInventory;
  /** Auto-update property - automatically rotates the player to face movement direction */
  autoFaceMovement?: boolean;
  takeDamage: (n: number) => void;
  heal: (n: number) => void;
  teleport: (x: number, y: number, z: number) => void;
  respawn: () => void;

  /** Gravity exclusions: player.gravity.sourceName = false excludes that source's gravity. */
  gravity: {
    [sourceName: string]: any;
  };
  /** INTERNAL */
  _gravityExclude: Map<string, boolean>;
};

export type RuntimeInput = {
  keys: Record<string, boolean>;
  moveX: number;
  moveZ: number;
  jump: boolean;
  pressed: (key: string) => boolean;
  released: (key: string) => boolean;
  held: (key: string) => boolean;
};

export type RuntimePhysics = {
  gravity: number;
  airDrag: number;
};

export type RuntimeState = {
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
  on: (key: string, fn: (value: string, prev: string | undefined) => void) => () => void;
  keys: () => string[];
};

export type GuiAnchor = "tl" | "tc" | "tr" | "cl" | "cc" | "cr" | "bl" | "bc" | "br";

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

/** Engine-level events - scripts can subscribe to any phase! */
export type EngineEvents = {
  /** Input phase - keyboard, mouse, input buffering */
  input: [dt: number, time: number];
  /** Animation phase - tweens, auto-properties, IK */
  animation: [dt: number, time: number];
  /** Replication phase - networking (future) */
  replication: [dt: number, time: number];
  /** Physics phase - gravity, movement, collisions */
  physics: [dt: number, time: number];
  /** Render phase - camera, visual smoothing */
  render: [dt: number, time: number];
  /** Update phase - game logic (default for most scripts) */
  update: [dt: number, time: number];
  
  // Lifecycle events (internal use only)
  start: [];
  stop: [];
  keyDown: [key: string];
  keyUp: [key: string];
  objectAdded: [obj: RuntimeObject];
  objectRemoved: [obj: RuntimeObject];
  playerSpawned: [player: RuntimePlayer];
  playerDied: [player: RuntimePlayer];
};

/** Event channel - a simplified version for specific event types */
export type EventChannel<T extends any[]> = {
  /** Subscribe to this channel - automatically uses the channel's event name */
  on: (fn: (...args: T) => void) => () => void;
  /** Unsubscribe from this channel */
  off: (fn: (...args: T) => void) => void;
};

export class EventBus<T extends Record<string, any[]>> {
  private subs = new Map<keyof T, Set<(...args: any[]) => void>>();

  on<K extends keyof T>(event: K, fn: (...args: T[K]) => void): () => void {
    let s = this.subs.get(event);
    if (!s) { 
      s = new Set(); 
      this.subs.set(event, s); 
    }
    s.add(fn as any);
    return () => this.off(event, fn);
  }

  off<K extends keyof T>(event: K, fn: (...args: T[K]) => void) {
    this.subs.get(event)?.delete(fn as any);
  }

  emit<K extends keyof T>(event: K, args: T[K], onError?: (e: any, fn: Function) => void): void {
    const s = this.subs.get(event);
    if (!s) return;
    const handlers = Array.from(s);
    for (const fn of handlers) {
      try { (fn as any)(...args); } catch (e) { onError?.(e, fn); }
    }
  }

  createChannel<K extends keyof T>(event: K): EventChannel<T[K]> {
    return {
      on: (fn) => this.on(event, fn),
      off: (fn) => this.off(event, fn)
    };
  }

  clear() { this.subs.clear(); }
}

// Internal only - not exposed to scripts
type EventsAPI = {
  on: <K extends keyof EngineEvents>(event: K, fn: (...args: EngineEvents[K]) => void) => () => void;
  off: <K extends keyof EngineEvents>(event: K, fn: (...args: EngineEvents[K]) => void) => void;
};

export type KeyboardAPI = {
  onPress: (key: string, fn: () => void) => () => void;
  onRelease: (key: string, fn: () => void) => () => void;
  isDown: (key: string) => boolean;
};

export type MouseAPI = {
  onClick: (fn: (obj: RuntimeObject | null) => void) => () => void;
};

export type WorldAPI = {
  onObjectAdded: (fn: (obj: RuntimeObject) => void) => () => void;
  onObjectRemoved: (fn: (obj: RuntimeObject) => void) => () => void;
  onPlayerSpawned: (fn: (player: RuntimePlayer) => void) => () => void;
  onPlayerDied: (fn: (player: RuntimePlayer) => void) => () => void;
};

/** RunService - clean API with simple .on(fn) for each phase */
export type RunServiceAPI = {
  /** Input phase channel - fires every frame with (dt, time) */
  input: EventChannel<[dt: number, time: number]>;
  /** Animation phase channel - fires every frame with (dt, time) */
  animation: EventChannel<[dt: number, time: number]>;
  /** Replication phase channel - fires every frame with (dt, time) */
  replication: EventChannel<[dt: number, time: number]>;
  /** Physics phase channel - fires every frame with (dt, time) */
  physics: EventChannel<[dt: number, time: number]>;
  /** Render phase channel - fires every frame with (dt, time) */
  render: EventChannel<[dt: number, time: number]>;
  /** Update phase channel - fires every frame with (dt, time) */
  update: EventChannel<[dt: number, time: number]>;
};

export type GameAPI = {
  objects: Record<string, RuntimeObject>;
  workspace: Record<string, RuntimeObject>;
  lighting: Record<string, RuntimeObject>;
  replicatedStorage: Record<string, RuntimeObject>;
  serverScriptService: Record<string, RuntimeObject>;
  starterPlayer: Record<string, RuntimeObject>;
  players: Record<string, RuntimeObject>;
  player: RuntimePlayer;
  input: RuntimeInput;
  physics: RuntimePhysics;
  state: RuntimeState;
  keyboard: KeyboardAPI;
  mouse: MouseAPI;
  world: WorldAPI;
  runService: RunServiceAPI;
  time: number;
  dt: number;
  now: () => number;
  log: (...args: any[]) => void;
  find: (name: string) => RuntimeObject | null;
  spawn: (templateName: string, overrides?: Partial<RuntimeObject>) => RuntimeObject | null;
  create: (opts: {
    name?: string;
    primitiveType?: "cube" | "sphere" | "cylinder" | "plane";
    container?: ContainerName;
    position?: Partial<Vec3>;
    rotation?: Partial<Vec3>;
    scale?: Partial<Vec3>;
    color?: string;
    type?: string;
    /** Optional parent object for hierarchy. */
    parent?: RuntimeObject | null;
    /** Optional collision flag override (defaults to true). */
    canCollide?: boolean;
    /** Optional anchored flag override (defaults to false for created parts). */
    anchored?: boolean;
    /** Initial gravity settings (boolean or object) */
    gravity?: boolean | { enabled?: boolean; strength?: number; radius?: number };
  }) => RuntimeObject;
  destroy: (objOrName: RuntimeObject | string) => void;
  /** Cast a ray through the world. Returns the closest collidable hit (or null). */
  raycast: (origin: Vec3, direction: Vec3, maxDistance?: number, params?: RaycastParams) => RaycastResult;
  /** Server-authoritative replication. `network.server` for authoritative
   *  logic, `network.client` for client-only listeners / input sends. */
  network: {
    server: { broadcast: (channel: string, payload: any) => void; on: (channel: string, fn: (payload: any) => void) => () => void };
    client: { send: (channel: string, payload: any) => void; on: (channel: string, fn: (payload: any) => void) => () => void };
  };
  gui: {
    text: (id: string, text: string, opts?: Partial<Omit<GuiElement, "id" | "kind" | "text">>) => void;
    button: (id: string, text: string, opts: Partial<Omit<GuiElement, "id" | "kind" | "text">> | undefined, onClick?: (game: GameAPI) => void) => void;
    clear: (id?: string) => void;
  };
  onKey: (key: string, fn: () => void) => () => void;
  onUpdate: (fn: (dt: number, time: number) => void) => () => void;
  every: (seconds: number, fn: () => void) => () => void;
  after: (seconds: number, fn: () => void) => () => void;
  wait: (seconds: number) => Promise<void>;
  tween: (target: any, to: Record<string, any>, duration: number, easing?: Easing, onDone?: () => void) => () => void;
  random: (min: number, max: number) => number;
  randInt: (min: number, max: number) => number;
  pick: <T>(arr: T[]) => T;
  dist: (a: Vec3 | { position: Vec3 }, b: Vec3 | { position: Vec3 }) => number;
  lerp: (a: number, b: number, t: number) => number;
  clamp: (n: number, min: number, max: number) => number;
};

export type CompiledScript = {
  name: string;
  run?: (api: GameAPI) => void;
  error?: string;
};

// ----------------------------------------------------------------------
//  IMPROVED SCRIPT EVALUATION (limited sandbox - WARNING: not fully secure)
// ----------------------------------------------------------------------
function safeEval(code: string, context: Record<string, any>): (api: GameAPI) => void {
  const globalProxy = new Proxy({} as any, {
    get(_, prop) {
      if (prop in context) return context[prop];
      const blocked = ["eval", "Function", "setTimeout", "setInterval", "fetch", "XMLHttpRequest", "localStorage", "sessionStorage", "window", "global", "process"];
      if (blocked.includes(String(prop))) return undefined;
      const safeBuiltins = ["Object", "Array", "Math", "Date", "JSON", "String", "Number", "Boolean", "RegExp", "Error", "Map", "Set", "Promise"];
      if (safeBuiltins.includes(String(prop)) && typeof globalThis[prop as keyof typeof globalThis] === "function") {
        return globalThis[prop as keyof typeof globalThis];
      }
      return undefined;
    },
    set() { return true; }
  });
  const fnBody = `"use strict"; with (__ctx__) { return (${code}) }`;
  const factory = new Function("__ctx__", fnBody);
  const scriptFn = factory(globalProxy);
  return (api: GameAPI) => scriptFn(api);
}

export function compileScript(code: string, name: string): CompiledScript {
  try {
    const run = safeEval(code, {});
    return { name, run };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const stack = typeof e?.stack === "string"
      ? `\n${e.stack.split("\n").slice(0, 3).join("\n")}`
      : "";
    return { name, error: `${msg}${stack}` };
  }
}

function newId() { return `rt_${Math.random().toString(36).slice(2, 10)}`; }

function formatErr(e: any): string {
  const msg = e?.message ?? String(e);
  const stack = typeof e?.stack === "string"
    ? e.stack.split("\\n").slice(1, 4).map((l: string) => "  " + l.trim()).join("\\n")
    : "";
  return stack ? `${msg}\\n${stack}` : msg;
}

function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

function readProperties(o: GameObject): ObjectProperties {
  const p = (o.properties ?? {}) as Partial<ObjectProperties>;
  const isLightOrSpawn = o.type === "light" || o.type === "spawn";
  // Convert legacy fields if they exist
  let gravity = p.gravity;
  if (!gravity && (p as any).gravityEnabled !== undefined) {
    gravity = {
      enabled: (p as any).gravityEnabled,
      strength: (p as any).gravityStrength ?? 9.81,
      radius: (p as any).gravityRadius ?? 30,
    };
  }
  if (!gravity) gravity = { enabled: false, strength: 9.81, radius: 30 };
  return {
    anchored: p.anchored ?? true,
    canCollide: p.canCollide ?? !isLightOrSpawn,
    transparency: clamp01(p.transparency ?? 0),
    mass: p.mass ?? 1,
    friction: p.friction ?? 0.4,
    gravity: gravity as any,
    autoRotateY: p.autoRotateY,
    autoBob: p.autoBob,
    autoFollow: p.autoFollow,
    autoSpin: p.autoSpin,
    autoMove: p.autoMove,
  };
}

function objectHalfExtents(o: RuntimeObject): Vec3 {
  return {
    x: Math.max(0.05, (o.scale.x || 1) * 0.5),
    y: Math.max(0.05, (o.scale.y || 1) * 0.5),
    z: Math.max(0.05, (o.scale.z || 1) * 0.5),
  };
}

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

// Helper to create a gravity proxy object for both RuntimeObject and RuntimePlayer
function createGravityProxy(
  sourceData: { enabled: boolean; strength: number; radius: number },
  exclusions: Map<string, boolean>
): any {
  const target = {
    get enabled() { return sourceData.enabled; },
    set enabled(v: boolean) { sourceData.enabled = v; },
    get strength() { return sourceData.strength; },
    set strength(v: number) { sourceData.strength = v; },
    get radius() { return sourceData.radius; },
    set radius(v: number) { sourceData.radius = v; },
  };
  return new Proxy(target, {
    get(_, prop) {
      if (prop === 'enabled' || prop === 'strength' || prop === 'radius') {
        return Reflect.get(target, prop);
      }
      // Exclusion by source name
      return exclusions.get(String(prop)) ?? true; // default true (affected)
    },
    set(_, prop, value) {
      if (prop === 'enabled' || prop === 'strength' || prop === 'radius') {
        Reflect.set(target, prop, value);
        return true;
      }
      // Setting ex: player.gravity.planet1 = false
      exclusions.set(String(prop), Boolean(value));
      return true;
    }
  });
}

export class GameRuntime {
  private _all = new Map<string, RuntimeObject>();
  private _autoPropObjects = new Set<RuntimeObject>();
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
  private _tweens = new TweenManager();
  private _keyDownHandlers = new Map<string, Set<() => void>>();
  private _keyUpHandlers = new Map<string, Set<() => void>>();
  private _events = new EventBus<EngineEvents>();
  private _objectEvents = new Map<string, EventBus<Record<ObjectEventName, any[]>>>();
  private _playerContacts = new Set<string>();
  private _api: GameAPI | null = null;
  private _mouseClickHandlers = new Set<(obj: RuntimeObject | null) => void>();
  /** Parent → children index. Maintained alongside `_all`. */
  hierarchy = new HierarchyIndex();
  /** Local server-authoritative replication stub. */
  network = new NetworkBus();
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
      const gravitySource = typeof props.gravity === 'boolean' ? { enabled: props.gravity, strength: 9.81, radius: 30 } : props.gravity || { enabled: false, strength: 9.81, radius: 30 };
      const rawRo: RuntimeObject = {
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
        anchored: props.anchored,
        canCollide: props.canCollide,
        transparency: props.transparency,
        mass: props.mass,
        friction: props.friction,
        velocity: { x: 0, y: 0, z: 0 },
        autoRotateY: props.autoRotateY,
        autoBob: props.autoBob,
        autoFollow: props.autoFollow,
        autoSpin: props.autoSpin,
        autoMove: props.autoMove,
        on: () => () => {},
        off: () => {},
        parentId: null,
        children: [],
        findFirstChild: () => null,
        setParent: () => {},
        GetPropertyChangedSignal: () => ({ on: () => () => {}, off: () => {} }),
        _gravitySource: { ...gravitySource },
        _gravityExclude: new Map(),
      };
      // Add gravity proxy
      (rawRo as any).gravity = createGravityProxy(rawRo._gravitySource, rawRo._gravityExclude);
      const ro = this.mountObjectEvents(rawRo);
      this._all.set(ro.id, ro);
      if (this.hasAutoProperties(ro)) this._autoPropObjects.add(ro);
    }
    this.rebuildIndexes();

    const spawnObj = [...this._all.values()].find(o => o.name === "SpawnLocation" || o.type === "spawn");
    const spawnPoint: Vec3 = spawnObj
      ? { x: spawnObj.position.x, y: spawnObj.position.y + 1.2, z: spawnObj.position.z }
      : { x: 0, y: 1, z: 4 };

    // Create player with gravity exclusion map
    const playerExclude = new Map<string, boolean>();
    const playerGravityProxy = createGravityProxy({ enabled: false, strength: 0, radius: 0 }, playerExclude);
    this.player = {
      id: newId(),
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
      autoFaceMovement: true,
      takeDamage: () => {},
      heal: () => {},
      teleport: () => {},
      respawn: () => {},
      gravity: playerGravityProxy,
      _gravityExclude: playerExclude,
    };

    this.mountPlayerInventory();
    this.mountPlayerMethods();
    this.initRunService();
    this.scripts = scripts.filter(s => s.enabled !== false).map(s => compileScript(s.code, s.name));
  }

  private normalizeContainer(raw: string | undefined | null): ContainerName {
    const valid: ContainerName[] = ["Workspace", "Lighting", "Players", "ServerScriptService", "StarterPlayer", "ReplicatedStorage"];
    if (raw && valid.includes(raw as ContainerName)) return raw as ContainerName;
    return "Workspace";
  }

  private initRunService() {
    this.runService = {
      input: this._events.createChannel("input"),
      animation: this._events.createChannel("animation"),
      replication: this._events.createChannel("replication"),
      physics: this._events.createChannel("physics"),
      render: this._events.createChannel("render"),
      update: this._events.createChannel("update"),
    };
  }

  private mountPlayerInventory() {
    const items: InventoryItem[] = [];
    let equippedId: string | null = null;
    const inv = this.player.inventory as any;
    Object.defineProperty(inv, "items", { value: items, writable: false, configurable: true });
    Object.defineProperty(inv, "equipped", { get: () => items.find(i => i.id === equippedId) ?? null, configurable: true });

    inv.add = (name: string, opts?: { count?: number; template?: string; data?: Record<string, any> }): InventoryItem | null => {
      const count = Math.max(1, Math.floor(opts?.count ?? 1));
      const existing = items.find(i => i.name === name);
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
      const slot: InventoryItem = { id: newId(), name, count, template: opts?.template, data: { ...(opts?.data ?? {}) } };
      items.push(slot);
      return slot;
    };

    inv.remove = (name: string, count: number = 1): number => {
      const idx = items.findIndex(i => i.name === name);
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

    inv.has = (name: string, count: number = 1): boolean => (items.find(i => i.name === name)?.count ?? 0) >= count;
    inv.get = (name: string): InventoryItem | null => items.find(i => i.name === name) ?? null;
    inv.equip = (name: string | null): boolean => {
      if (name == null) { equippedId = null; return true; }
      const slot = items.find(i => i.name === name);
      if (!slot) return false;
      equippedId = slot.id;
      return true;
    };
    inv.drop = (name: string, count: number = 1): RuntimeObject | null => {
      const slot = items.find(i => i.name === name);
      if (!slot) return null;
      const dropped = inv.remove(name, count);
      if (dropped <= 0) return null;
      const fwd = this.cameraForward;
      const fLen = Math.hypot(fwd.x, 0, fwd.z) || 1;
      const fx = fwd.x / fLen;
      const fz = fwd.z / fLen;
      const dropPos: Vec3 = { x: this.player.position.x + fx * 1.5, y: this.player.position.y + 0.5, z: this.player.position.z + fz * 1.5 };
      const tpl = this.replicatedStorage[slot.template ?? name];
      let ro: RuntimeObject;
      if (tpl) ro = this.cloneTemplateInto(tpl, "Workspace", dropPos);
      else ro = this.createInternal({ name, primitiveType: "cube", container: "Workspace", position: dropPos, color: "#c084fc" });
      ro.isPickup = true;
      ro.pickupName = name;
      ro.pickupData = { ...slot.data };
      return ro;
    };
    inv.clear = () => { items.length = 0; equippedId = null; };
  }

  private mountPlayerMethods() {
    const p = this.player;
    p.takeDamage = (n: number) => { p.health = Math.max(0, p.health - n); if (p.health <= 0) p.respawn(); };
    p.heal = (n: number) => { p.health = Math.min(p.maxHealth, p.health + n); };
    p.teleport = (x: number, y: number, z: number) => { p.position.x = x; p.position.y = y; p.position.z = z; p.velocity.x = 0; p.velocity.y = 0; p.velocity.z = 0; };
    p.respawn = () => { 
      const sp = p.spawnPoint;
      p.position.x = sp.x; p.position.y = sp.y; p.position.z = sp.z;
      p.velocity.x = 0; p.velocity.y = 0; p.velocity.z = 0;
      p.health = p.maxHealth;
      this.pushLog(`${p.username} respawned.`);
    };
  }

  private hasAutoProperties(o: RuntimeObject): boolean {
    return !!(o.autoRotateY || o.autoBob || o.autoFollow || o.autoSpin || o.autoMove);
  }

  private mountObjectEvents(raw: RuntimeObject): RuntimeObject {
    const id = raw.id;
    const propertyEvents = new Map<string, EventBus<Record<"changed", [property: string, newValue: any, oldValue: any]>>>();

    const proxy = new Proxy(raw, {
      set: (target, prop, value) => {
        const propName = prop as string;
        const oldValue = (target as any)[propName];
        if (oldValue !== value) {
          (target as any)[propName] = value;
          const propBus = propertyEvents.get(propName);
          if (propBus) propBus.emit("changed", [propName, value, oldValue]);
          const generalBus = this._objectEvents.get(id);
          if (generalBus) generalBus.emit("changed", [propName, value, oldValue]);
          if (["autoRotateY", "autoBob", "autoFollow", "autoSpin", "autoMove"].includes(propName)) {
            if (value !== undefined) this._autoPropObjects.add(proxy);
            else this._autoPropObjects.delete(proxy);
          }
          // Handle gravity object assignment
          if (propName === "gravity") {
            if (typeof value === "boolean") {
              (target as any)._gravitySource.enabled = value;
            } else if (value && typeof value === "object") {
              if (value.enabled !== undefined) (target as any)._gravitySource.enabled = value.enabled;
              if (value.strength !== undefined) (target as any)._gravitySource.strength = value.strength;
              if (value.radius !== undefined) (target as any)._gravitySource.radius = value.radius;
            }
          }
        }
        return true;
      }
    });

    proxy.on = (event, fn) => {
      let bus = this._objectEvents.get(id);
      if (!bus) { bus = new EventBus(); this._objectEvents.set(id, bus); }
      return bus.on(event as any, fn as any);
    };
    proxy.off = (event, fn) => {
      this._objectEvents.get(id)?.off(event as any, fn as any);
    };
    proxy.GetPropertyChangedSignal = (property: string) => {
      let bus = propertyEvents.get(property);
      if (!bus) { bus = new EventBus(); propertyEvents.set(property, bus); }
      return { on: (event: any, fn: any) => bus!.on(event, fn), off: (event: any, fn: any) => bus!.off(event, fn) };
    };

    const hi = this.hierarchy;
    const all = this._all;
    Object.defineProperty(proxy, "children", {
      get: () => hi.childIds(id).map(cid => all.get(cid)).filter(Boolean) as RuntimeObject[]
    });
    proxy.findFirstChild = (name: string) => {
      for (const cid of hi.childIds(id)) {
        const child = all.get(cid);
        if (child && child.name === name) return child;
      }
      return null;
    };
    proxy.setParent = (parent: RuntimeObject | null) => {
      hi.reparent(proxy, parent ? parent.id : null);
      proxy.parentId = parent ? parent.id : null;
    };
    hi.add(proxy);

    return proxy;
  }

  private emitObjectEvent(id: string, event: ObjectEventName, args: any[]) {
    const bus = this._objectEvents.get(id);
    if (!bus) return;
    bus.emit(event as any, args, (e, fn) => this.pushLog(`obj.on("${event}") error: ${formatErr(e)}`));
  }

  private createInternal(opts: { name?: string; primitiveType?: "cube" | "sphere" | "cylinder" | "plane"; container?: ContainerName; position?: Vec3; color?: string; parentId?: string | null; canCollide?: boolean; anchored?: boolean; gravity?: boolean | { enabled?: boolean; strength?: number; radius?: number } }): RuntimeObject {
    const gravityInput = opts.gravity !== undefined ? opts.gravity : false;
    const gravitySource = typeof gravityInput === 'boolean' ? { enabled: gravityInput, strength: 9.81, radius: 30 } : { enabled: gravityInput?.enabled ?? false, strength: gravityInput?.strength ?? 9.81, radius: gravityInput?.radius ?? 30 };
    const raw: RuntimeObject = {
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
      anchored: opts.anchored ?? false,
      canCollide: opts.canCollide ?? true,
      transparency: 0,
      mass: 1,
      friction: 0.4,
      velocity: { x: 0, y: 0, z: 0 },
      on: () => () => {},
      off: () => {},
      parentId: opts.parentId ?? null,
      children: [],
      findFirstChild: () => null,
      setParent: () => {},
      GetPropertyChangedSignal: () => ({ on: () => () => {}, off: () => {} }),
      _gravitySource: gravitySource,
      _gravityExclude: new Map(),
    };
    (raw as any).gravity = createGravityProxy(raw._gravitySource, raw._gravityExclude);
    const ro = this.mountObjectEvents(raw);
    this._all.set(ro.id, ro);
    if (opts.parentId) {
      const parent = this._all.get(opts.parentId);
      if (parent) ro.setParent(parent);
    }
    this.rebuildIndexes();
    this._events.emit("objectAdded", [ro]);
    if (this.hasAutoProperties(ro)) this._autoPropObjects.add(ro);
    return ro;
  }

  private cloneTemplateInto(tpl: RuntimeObject, container: ContainerName, position?: Vec3): RuntimeObject {
    const raw: RuntimeObject = {
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
      velocity: { x: 0, y: 0, z: 0 },
      on: () => () => {},
      off: () => {},
      parentId: null,
      children: [],
      findFirstChild: () => null,
      setParent: () => {},
      GetPropertyChangedSignal: () => ({ on: () => () => {}, off: () => {} }),
      _gravitySource: { ...(tpl as any)._gravitySource },
      _gravityExclude: new Map(),
    };
    (raw as any).gravity = createGravityProxy(raw._gravitySource, raw._gravityExclude);
    const ro = this.mountObjectEvents(raw);
    this._all.set(ro.id, ro);
    this.rebuildIndexes();
    this._events.emit("objectAdded", [ro]);
    if (this.hasAutoProperties(ro)) this._autoPropObjects.add(ro);
    return ro;
  }

  private removeObject(id: string) {
    const ro = this._all.get(id);
    if (!ro) return;
    for (const cid of this.hierarchy.descendantIds(id)) {
      const child = this._all.get(cid);
      if (!child) continue;
      this._all.delete(cid);
      this._playerContacts.delete(cid);
      this._autoPropObjects.delete(child);
      this.emitObjectEvent(cid, "destroyed", []);
      this._objectEvents.delete(cid);
      this.hierarchy.remove(child);
      this._events.emit("objectRemoved", [child]);
    }
    this._all.delete(id);
    this._playerContacts.delete(id);
    this._autoPropObjects.delete(ro);
    this.emitObjectEvent(id, "destroyed", []);
    this._objectEvents.delete(id);
    this.hierarchy.remove(ro);
    this._events.emit("objectRemoved", [ro]);
  }

  private runPickupSweep() {
    const p = this.player;
    const radius = 1.0;
    let removed = false;
    for (const o of this.objectList) {
      if (!o.isPickup) continue;
      if (Math.hypot(p.position.x - o.position.x, p.position.y - o.position.y, p.position.z - o.position.z) > radius) continue;
      const slot = p.inventory.add(o.pickupName ?? o.name, { template: o.name, data: o.pickupData ?? {} });
      if (slot) { this.pushLog(`Picked up ${o.pickupName ?? o.name}.`); this.removeObject(o.id); removed = true; }
    }
    if (removed) this.rebuildIndexes();
  }

  private rebuildIndexes() {
    const ws = this.workspace, lt = this.lighting, rs = this.replicatedStorage, sss = this.serverScriptService, sp = this.starterPlayer, pl = this.players;
    for (const k of Object.keys(ws)) delete ws[k];
    for (const k of Object.keys(lt)) delete lt[k];
    for (const k of Object.keys(rs)) delete rs[k];
    for (const k of Object.keys(sss)) delete sss[k];
    for (const k of Object.keys(sp)) delete sp[k];
    for (const k of Object.keys(pl)) delete pl[k];
    const list: RuntimeObject[] = [];
    for (const ro of this._all.values()) {
      switch (ro.container) {
        case "Workspace": ws[ro.name] = ro; list.push(ro); break;
        case "Lighting": lt[ro.name] = ro; list.push(ro); break;
        case "ReplicatedStorage": rs[ro.name] = ro; break;
        case "ServerScriptService": sss[ro.name] = ro; break;
        case "StarterPlayer": sp[ro.name] = ro; break;
        case "Players": pl[ro.name] = ro; break;
      }
    }
    this.objects = ws;
    this.objectList = list;
  }

  private pushLog(line: string) { this.logs.push(line); if (this.logs.length > 200) this.logs.shift(); this.onLog?.(line); }

  private buildState(): RuntimeState {
    if (this._stateApi) return this._stateApi;
    this._stateApi = {
      get: (key) => this._stateValues.get(key),
      set: (key, value) => { const v = String(value), prev = this._stateValues.get(key); if (prev === v) return; this._stateValues.set(key, v); const subs = this._stateSubs.get(key); if (!subs) return; for (const fn of subs) { try { fn(v, prev); } catch (e: any) { this.pushLog(`state.on("${key}") error: ${formatErr(e)}`); } } },
      on: (key, fn) => { let subs = this._stateSubs.get(key); if (!subs) { subs = new Set(); this._stateSubs.set(key, subs); } subs.add(fn); return () => { subs?.delete(fn); }; },
      keys: () => Array.from(this._stateValues.keys()),
    };
    return this._stateApi;
  }

  invokeGuiClick(id: string) { const el = this.gui.get(id); if (!el?.onClick) return; try { el.onClick(this.buildApi(0)); } catch (e: any) { this.pushLog(`gui[${id}] onClick error: ${formatErr(e)}`); } }

  private buildApi(dt: number): GameAPI {
    if (this._api) { this._api.time = this.time; this._api.dt = dt; return this._api; }

    const log = (...args: any[]) => { const text = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "); this.pushLog(text); };
    const find = (name: string): RuntimeObject | null => { const containers = [this.workspace, this.lighting, this.replicatedStorage, this.serverScriptService, this.starterPlayer, this.players]; for (const c of containers) if (c[name]) return c[name]; for (const o of this._all.values()) if (o.name === name) return o; return null; };
    const create = (opts: Parameters<GameAPI["create"]>[0]): RuntimeObject => {
      const ro = this.createInternal({
        name: opts.name,
        primitiveType: opts.primitiveType,
        container: this.normalizeContainer(opts.container),
        position: { x: 0, y: 0.5, z: 0, ...(opts.position ?? {}) } as Vec3,
        color: opts.color,
        parentId: opts.parent ? opts.parent.id : null,
        canCollide: opts.canCollide,
        anchored: opts.anchored,
        gravity: opts.gravity
      });
      if (opts.rotation) Object.assign(ro.rotation, opts.rotation);
      if (opts.scale) Object.assign(ro.scale, opts.scale);
      if (opts.type) ro.type = opts.type;
      return ro;
    };
    const raycastFn = (origin: Vec3, direction: Vec3, maxDistance = 100, params?: RaycastParams) => raycastWorld(this._all.values(), origin, direction, maxDistance, params);
    const networkApi = { server: this.network.server, client: this.network.client };
    const spawn = (templateName: string, overrides?: Partial<RuntimeObject>): RuntimeObject | null => { const tpl = this.replicatedStorage[templateName]; if (!tpl) { this.pushLog(`spawn(): no ReplicatedStorage template named "${templateName}"`); return null; } const ro = this.cloneTemplateInto(tpl, "Workspace", overrides?.position ? { ...tpl.position, ...overrides.position } : undefined); if (overrides) { if (overrides.name) { ro.name = overrides.name; this.rebuildIndexes(); } if (overrides.rotation) Object.assign(ro.rotation, overrides.rotation); if (overrides.scale) Object.assign(ro.scale, overrides.scale); if (overrides.color != null) ro.color = overrides.color; if (overrides.visible != null) ro.visible = overrides.visible; if (overrides.anchored != null) ro.anchored = overrides.anchored; if (overrides.canCollide != null) ro.canCollide = overrides.canCollide; if (overrides.transparency != null) ro.transparency = overrides.transparency; if (overrides.mass != null) ro.mass = overrides.mass; if (overrides.friction != null) ro.friction = overrides.friction; if (overrides.velocity) Object.assign(ro.velocity, overrides.velocity); } return ro; };
    const destroy = (target: RuntimeObject | string) => { if (typeof target === "string") { for (const ro of this._all.values()) if (ro.name === target || ro.id === target) { this.removeObject(ro.id); this.rebuildIndexes(); return; } return; } this.removeObject(target.id); this.rebuildIndexes(); };
    const guiText = (id: string, text: string, opts?: Partial<Omit<GuiElement, "id" | "kind" | "text">>) => { const prev = this.gui.get(id); const el: GuiElement = { id, kind: "text", text, x: opts?.x ?? prev?.x ?? 0, y: opts?.y ?? prev?.y ?? 0, anchor: opts?.anchor ?? prev?.anchor ?? "tl", color: opts?.color ?? prev?.color ?? "#ffffff", size: opts?.size ?? prev?.size ?? 16, bg: opts?.bg ?? prev?.bg }; this.gui.set(id, el); this.guiVersion++; };
    const guiButton = (id: string, text: string, opts: Partial<Omit<GuiElement, "id" | "kind" | "text">> | undefined, onClick?: (game: GameAPI) => void) => { const prev = this.gui.get(id); const el: GuiElement = { id, kind: "button", text, x: opts?.x ?? prev?.x ?? 16, y: opts?.y ?? prev?.y ?? 16, anchor: opts?.anchor ?? prev?.anchor ?? "tl", color: opts?.color ?? prev?.color ?? "#ffffff", size: opts?.size ?? prev?.size ?? 14, bg: opts?.bg ?? prev?.bg ?? "rgba(30,40,60,0.85)", onClick: onClick ?? prev?.onClick }; this.gui.set(id, el); this.guiVersion++; };
    const guiClear = (id?: string) => { if (id == null) this.gui.clear(); else this.gui.delete(id); this.guiVersion++; };
    const keyboardApi: KeyboardAPI = { onPress: (key, fn) => { const k = key.toLowerCase(); let s = this._keyDownHandlers.get(k); if (!s) { s = new Set(); this._keyDownHandlers.set(k, s); } s.add(fn); return () => s!.delete(fn); }, onRelease: (key, fn) => { const k = key.toLowerCase(); let s = this._keyUpHandlers.get(k); if (!s) { s = new Set(); this._keyUpHandlers.set(k, s); } s.add(fn); return () => s!.delete(fn); }, isDown: (key) => !!this.input.keys[key.toLowerCase()] };
    const mouseApi: MouseAPI = { onClick: (fn) => { this._mouseClickHandlers.add(fn); return () => this._mouseClickHandlers.delete(fn); } };
    const worldApi: WorldAPI = { onObjectAdded: (fn) => this._events.on("objectAdded", fn), onObjectRemoved: (fn) => this._events.on("objectRemoved", fn), onPlayerSpawned: (fn) => this._events.on("playerSpawned", fn), onPlayerDied: (fn) => this._events.on("playerDied", fn) };
    const onKey = (key: string, fn: () => void) => keyboardApi.onPress(key, fn);
    const onUpdateFn = (fn: (dt: number, time: number) => void) => this._events.on("update", fn);
    const every = (seconds: number, fn: () => void) => { const t = { fn, nextAt: this.time + seconds, interval: seconds, once: false }; this._timers.push(t); return () => { const i = this._timers.indexOf(t); if (i >= 0) this._timers.splice(i, 1); }; };
    const after = (seconds: number, fn: () => void) => { const t = { fn, nextAt: this.time + seconds, interval: seconds, once: true }; this._timers.push(t); return () => { const i = this._timers.indexOf(t); if (i >= 0) this._timers.splice(i, 1); }; };
    const wait = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, seconds * 1000)));
    const now = () => this.time;
    const tweenFn = (target: any, to: Record<string, any>, duration: number, easing: Easing = "linear", onDone?: () => void) => this._tweens.start(target, to, duration, easing, onDone);
    const random = (min: number, max: number) => min + Math.random() * (max - min);
    const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const dist = (a: Vec3 | { position: Vec3 }, b: Vec3 | { position: Vec3 }) => { const pa = "position" in a ? a.position : a; const pb = "position" in b ? b.position : b; return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z); };
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
      keyboard: keyboardApi, 
      mouse: mouseApi, 
      world: worldApi, 
      runService: this.runService, 
      time: this.time, 
      dt, 
      now, 
      log, 
      find, 
      spawn, 
      create, 
      destroy, 
      gui: { text: guiText, button: guiButton, clear: guiClear }, 
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
      raycast: raycastFn,
      network: networkApi,
    };
    return this._api!;
  }

  emitClick(objId: string | null) { const obj = objId ? (this._all.get(objId) ?? null) : null; if (obj) this.emitObjectEvent(obj.id, "clicked", [obj]); for (const fn of this._mouseClickHandlers) { try { fn(obj); } catch (e: any) { this.pushLog(`mouse.onClick error: ${formatErr(e)}`); } } }
  emitTap(objId: string) { this.emitObjectEvent(objId, "clicked", [this._all.get(objId)]); }

  private async runScripts() { const api = this.buildApi(0); for (const s of this.scripts) { if (s.error) { this.pushLog(`[${s.name}] compile error: ${s.error}`); continue; } if (!s.run) continue; try { const maybe = (s.run as any)(api); if (maybe && typeof maybe.then === "function") maybe.catch((e: any) => this.pushLog(`[${s.name}] runtime error: ${formatErr(e)}`)); } catch (e: any) { this.pushLog(`[${s.name}] runtime error: ${formatErr(e)}`); } } }

  start() { void this.runScripts(); this._events.emit("start", [], (e, fn) => this.pushLog(`internal start error: ${formatErr(e)}`)); this._events.emit("playerSpawned", [this.player], (e, fn) => this.pushLog(`internal playerSpawned error: ${formatErr(e)}`)); }

  stop() { this._events.emit("stop", [], () => {}); this._events.clear(); this._objectEvents.clear(); this._keyDownHandlers.clear(); this._keyUpHandlers.clear(); this._mouseClickHandlers.clear(); this._timers.length = 0; this._tweens.clear(); this.network.clear(); this.hierarchy.clear(); }

  private updateAutoProperties(dt: number) {
    for (const o of this._autoPropObjects) {
      if (o.autoRotateY !== undefined) o.rotation.y += o.autoRotateY * dt;
      if (o.autoSpin) {
        if (o.autoSpin.x) o.rotation.x += o.autoSpin.x * dt;
        if (o.autoSpin.y) o.rotation.y += o.autoSpin.y * dt;
        if (o.autoSpin.z) o.rotation.z += o.autoSpin.z * dt;
      }
      if (o.autoBob) {
        if (o.autoBob.startY === undefined) o.autoBob.startY = o.position.y;
        o.autoBob._time = (o.autoBob._time || 0) + dt * o.autoBob.speed;
        o.position.y = o.autoBob.startY + Math.sin(o.autoBob._time) * o.autoBob.amplitude;
      }
      if (o.autoFollow?.target) {
        const targetPos = o.autoFollow.target.position;
        const offset = o.autoFollow.offset || { x: 0, y: 0, z: 0 };
        const dx = targetPos.x + offset.x - o.position.x;
        const dy = targetPos.y + offset.y - o.position.y;
        const dz = targetPos.z + offset.z - o.position.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > 0.01) {
          const move = Math.min(o.autoFollow.speed * dt, dist);
          o.position.x += (dx / dist) * move;
          o.position.y += (dy / dist) * move;
          o.position.z += (dz / dist) * move;
        }
      }
      if (o.autoMove) {
        o.position.x += o.autoMove.direction.x * o.autoMove.speed * dt;
        o.position.y += o.autoMove.direction.y * o.autoMove.speed * dt;
        o.position.z += o.autoMove.direction.z * o.autoMove.speed * dt;
      }
    }

    if (this.player.autoFaceMovement) {
      const inputMag = Math.hypot(this.input.moveX, this.input.moveZ);
      if (inputMag > 0.01) {
        const cf = this.cameraForward;
        const up = this.player.up;
        const cfDot = cf.x * up.x + cf.y * up.y + cf.z * up.z;
        let fx = cf.x - up.x * cfDot;
        let fz = cf.z - up.z * cfDot;
        const len = Math.hypot(fx, fz);
        if (len > 0.001) { fx /= len; fz /= len; }
        const targetYaw = Math.atan2(this.input.moveX, this.input.moveZ);
        let diff = targetYaw - this.player.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.player.rotation.y += diff * Math.min(1, dt * 12);
      }
    }
  }

  step(dt: number) {
    if (dt > 0.1) dt = 0.1;
    this.time += dt;
    const p = this.player;

    // ========== INPUT PHASE ==========
    for (const k in this.input.keys) {
      const isDown = !!this.input.keys[k];
      const wasDown = !!this._prevKeys[k];
      if (isDown && !wasDown) {
        this._events.emit("keyDown", [k], (e, fn) => this.pushLog(`internal keyDown error: ${formatErr(e)}`));
        const set = this._keyDownHandlers.get(k);
        if (set) for (const fn of set) try { fn(); } catch (e: any) { this.pushLog(`keyboard.onPress("${k}") error: ${formatErr(e)}`); }
      } else if (!isDown && wasDown) {
        this._events.emit("keyUp", [k], (e, fn) => this.pushLog(`internal keyUp error: ${formatErr(e)}`));
        const set = this._keyUpHandlers.get(k);
        if (set) for (const fn of set) try { fn(); } catch (e: any) { this.pushLog(`keyboard.onRelease("${k}") error: ${formatErr(e)}`); }
      }
    }
    this._events.emit("input", [dt, this.time], (e, fn) => this.pushLog(`runService.input error: ${formatErr(e)}`));

    // ========== ANIMATION PHASE ==========
    this._tweens.step(dt);
    this._events.emit("animation", [dt, this.time], (e, fn) => this.pushLog(`runService.animation error: ${formatErr(e)}`));

    // ========== REPLICATION PHASE ==========
    this.network.step(dt, this.player, this.objectList, {
      t: this.time,
      moveX: this.input.moveX,
      moveZ: this.input.moveZ,
      jump: this.input.jump,
      keys: { ...this.input.keys },
    });
    this._events.emit("replication", [dt, this.time], (e, fn) => this.pushLog(`runService.replication error: ${formatErr(e)}`));

    // ========== PHYSICS PHASE ==========
    this.updateAutoProperties(dt);

    const gravityVec = this.computeGravity(p.position, p);
    const gMag = Math.hypot(gravityVec.x, gravityVec.y, gravityVec.z);
    const desiredUp = gMag > 0.001 ? { x: -gravityVec.x / gMag, y: -gravityVec.y / gMag, z: -gravityVec.z / gMag } : { x: 0, y: 1, z: 0 };
    const slerpT = Math.min(1, dt * 6);
    p.up.x = p.up.x + (desiredUp.x - p.up.x) * slerpT;
    p.up.y = p.up.y + (desiredUp.y - p.up.y) * slerpT;
    p.up.z = p.up.z + (desiredUp.z - p.up.z) * slerpT;
    const upLen = Math.hypot(p.up.x, p.up.y, p.up.z) || 1;
    p.up.x /= upLen; p.up.y /= upLen; p.up.z /= upLen;

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
    const rz = fx * p.up.y - fy * p.up.x;

    const speed = p.speed || 6;
    const wantX = rx * this.input.moveX - fx * this.input.moveZ;
    const wantZ = rz * this.input.moveX - fz * this.input.moveZ;
    const upVelDot = p.velocity.x * p.up.x + p.velocity.y * p.up.y + p.velocity.z * p.up.z;
    p.velocity.x = wantX * speed + p.up.x * upVelDot;
    p.velocity.z = wantZ * speed + p.up.z * upVelDot;

    if (this.input.jump && p.onGround) {
      const jp = p.jumpPower || 8;
      p.velocity.x += p.up.x * jp;
      p.velocity.y += p.up.y * jp;
      p.velocity.z += p.up.z * jp;
      p.onGround = false;
    }

    p.velocity.x += gravityVec.x * dt;
    p.velocity.y += gravityVec.y * dt;
    p.velocity.z += gravityVec.z * dt;
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    p.position.z += p.velocity.z * dt;

    for (const o of this.objectList) {
      if (o.anchored || o.container !== "Workspace") continue;
      const og = this.computeGravity(o.position, o);
      o.velocity.x += og.x * dt;
      o.velocity.y += og.y * dt;
      o.velocity.z += og.z * dt;
      o.position.x += o.velocity.x * dt;
      o.position.y += o.velocity.y * dt;
      o.position.z += o.velocity.z * dt;
    }

    for (const o of this.objectList) {
      if (!o.visible || !o.canCollide) continue;
      if (o.type === "light" || o.type === "spawn") continue;
      if (o.container !== "Workspace") continue;
      this.resolvePlayerVsObject(o);
    }

    this.runPickupSweep();

    if (p.position.y < 1) {
      p.position.y = 1;
      if (p.velocity.y < 0) p.velocity.y = 0;
      p.onGround = true;
      const f = 1 - Math.min(1, 0.4 * 8 * dt);
      p.velocity.x *= f;
      p.velocity.z *= f;
    } else if (p.position.y > 1.001) p.onGround = false;

    this.runTouchSweep();
    resolveObjectCollisions(this.objectList);
    this._events.emit("physics", [dt, this.time], (e, fn) => this.pushLog(`runService.physics error: ${formatErr(e)}`));

    // ========== RENDER PHASE ==========
    this._events.emit("render", [dt, this.time], (e, fn) => this.pushLog(`runService.render error: ${formatErr(e)}`));

    // ========== UPDATE PHASE ==========
    this._events.emit("update", [dt, this.time], (e, fn) => this.pushLog(`runService.update error: ${formatErr(e)}`));

    for (let i = this._timers.length - 1; i >= 0; i--) {
      const t = this._timers[i];
      if (this.time < t.nextAt) continue;
      try { t.fn(); } catch (e: any) { this.pushLog(`timer error: ${formatErr(e)}`); }
      if (t.once) this._timers.splice(i, 1);
      else t.nextAt = this.time + t.interval;
    }

    if (p.health <= 0 && (this as any)._lastHealth > 0) { this._events.emit("playerDied", [p], () => {}); p.respawn(); this._events.emit("playerSpawned", [p], () => {}); }
    (this as any)._lastHealth = p.health;

    this.input.jump = false;
    this._prevKeys = { ...this.input.keys };
    this.buildApi(dt);
  }

  private runTouchSweep() {
    const p = this.player;
    const pr = 0.45, ph = 0.95;
    const seenThisFrame = new Set<string>();
    for (const o of this.objectList) {
      if (!o.visible || o.type === "light" || o.type === "spawn" || o.container !== "Workspace") continue;
      let touching = false;
      if (o.primitiveType === "sphere") {
        const r = Math.max(o.scale.x, o.scale.y, o.scale.z) * 0.5;
        touching = Math.hypot(p.position.x - o.position.x, p.position.y - o.position.y, p.position.z - o.position.z) < r + pr + 0.05;
      } else {
        touching = Math.abs(p.position.x - o.position.x) < (o.scale.x || 1) * 0.5 + pr &&
                   Math.abs(p.position.y - o.position.y) < (o.scale.y || 1) * 0.5 + ph &&
                   Math.abs(p.position.z - o.position.z) < (o.scale.z || 1) * 0.5 + pr;
      }
      if (touching) { seenThisFrame.add(o.id); if (!this._playerContacts.has(o.id)) { this._playerContacts.add(o.id); this.emitObjectEvent(o.id, "touched", [p, o]); } }
    }
    for (const id of this._playerContacts) if (!seenThisFrame.has(id)) { this._playerContacts.delete(id); this.emitObjectEvent(id, "untouched", [p, this._all.get(id)]); }
  }

  private computeGravity(point: Vec3, subject: RuntimeObject | RuntimePlayer): Vec3 {
    let bestMag = 0, best: Vec3 | null = null;
    for (const o of this.objectList) {
      const src = (o as any)._gravitySource;
      if (!src.enabled) continue;
      // Check if subject excludes this source by name
      if (subject.gravity && subject.gravity[o.name] === false) continue;
      const { surfaceDistance, dirToCenter, surfaceRadius } = pointVsObjectSurface(point, o);
      if (surfaceDistance > src.radius) continue;
      const r = Math.max(surfaceRadius, surfaceRadius + Math.max(0, surfaceDistance));
      const accel = (src.strength * surfaceRadius * surfaceRadius) / (r * r);
      if (accel > bestMag) { bestMag = accel; best = { x: dirToCenter.x * accel, y: dirToCenter.y * accel, z: dirToCenter.z * accel }; }
    }
    return best || { x: 0, y: -(this.physics.gravity || 9.81), z: 0 };
  }

  private resolvePlayerVsObject(o: RuntimeObject) {
    const p = this.player;
    const pr = 0.4, ph = 0.9;
    if (o.primitiveType === "sphere") {
      const r = Math.max(o.scale.x, o.scale.y, o.scale.z) * 0.5;
      const dx = p.position.x - o.position.x, dy = p.position.y - o.position.y, dz = p.position.z - o.position.z;
      const dist = Math.hypot(dx, dy, dz);
      const minDist = r + pr;
      if (dist < minDist && dist > 0.0001) {
        const nx = dx / dist, ny = dy / dist, nz = dz / dist;
        const push = minDist - dist;
        p.position.x += nx * push; p.position.y += ny * push; p.position.z += nz * push;
        const vDotN = p.velocity.x * nx + p.velocity.y * ny + p.velocity.z * nz;
        if (vDotN < 0) {
          p.velocity.x -= nx * vDotN;
          p.velocity.y -= ny * vDotN;
          p.velocity.z -= nz * vDotN;
          if (!o.anchored) {
            const massRatio = o.mass / (p.mass ?? 1);
            o.velocity.x += nx * vDotN * massRatio;
            o.velocity.y += ny * vDotN * massRatio;
            o.velocity.z += nz * vDotN * massRatio;
          }
        }
        if (nx * p.up.x + ny * p.up.y + nz * p.up.z > 0.5) p.onGround = true;
      }
      return;
    }
    const halfX = (o.scale.x || 1) * 0.5 + pr, halfY = (o.scale.y || 1) * 0.5 + ph, halfZ = (o.scale.z || 1) * 0.5 + pr;
    const dx = p.position.x - o.position.x, dy = p.position.y - o.position.y, dz = p.position.z - o.position.z;
    if (Math.abs(dx) < halfX && Math.abs(dy) < halfY && Math.abs(dz) < halfZ) {
      const overlapX = halfX - Math.abs(dx), overlapY = halfY - Math.abs(dy), overlapZ = halfZ - Math.abs(dz);
      let nx = 0, ny = 0, nz = 0, overlap = 0;
      if (overlapY < overlapX && overlapY < overlapZ) {
        overlap = overlapY;
        ny = dy > 0 ? 1 : -1;
        if (ny > 0) { p.onGround = true; }
      } else if (overlapX < overlapZ) {
        overlap = overlapX;
        nx = dx > 0 ? 1 : -1;
      } else {
        overlap = overlapZ;
        nz = dz > 0 ? 1 : -1;
      }
      p.position.x += nx * overlap;
      p.position.y += ny * overlap;
      p.position.z += nz * overlap;
      const vDotN = p.velocity.x * nx + p.velocity.y * ny + p.velocity.z * nz;
      if (vDotN < 0) {
        p.velocity.x -= vDotN * nx;
        p.velocity.y -= vDotN * ny;
        p.velocity.z -= vDotN * nz;
        if (!o.anchored) {
          const massRatio = o.mass / (p.mass ?? 1);
          o.velocity.x += nx * vDotN * massRatio;
          o.velocity.y += ny * vDotN * massRatio;
          o.velocity.z += nz * vDotN * massRatio;
        }
      }
    }
  }
}

// ----------------------------------------------------------------------
//  DEFAULT SCRIPT AND DOCS (updated for new gravity)
// ----------------------------------------------------------------------
export const DEFAULT_SCRIPT = `// Welcome! Clean, consistent API - just .on(fn) for everything!

runService.update.on((dt) => {
  log("Game running at", (1/dt).toFixed(0), "fps");
});

// ========== NEW GRAVITY SYSTEM ==========
// Every object can have its own gravity field.
const planet = create({ 
  primitiveType: "sphere", 
  position: { x: 10, y: 10, z: 0 }, 
  scale: { x: 3, y: 3, z: 3 }, 
  color: "#ffaa66",
  gravity: true   // enables with default strength=9.81, radius=30
});
// Customize gravity parameters:
planet.gravity.strength = 15;
planet.gravity.radius = 25;
// Or set all at once:
planet.gravity = { enabled: true, strength: 20, radius: 40 };
// Disable planet's own gravity:
planet.gravity.enabled = false;

// ========== EXCLUDING GRAVITY SOURCES ==========
// To stop a specific gravity source from affecting an object, set:
player.gravity.planet1 = false;  // excludes the planet named "planet1"
// Re-enable:
player.gravity.planet1 = true;

// Any object can exclude any source by its name:
coin.gravity.planet1 = false;

// ========== AUTO-UPDATE PROPERTIES ==========
const coin = create({ primitiveType: "sphere", position: { x: 2, y: 2, z: 0 }, color: "#ffd700" });
coin.autoRotateY = 2;           // rotates automatically
coin.autoBob = { amplitude: 0.3, speed: 2 }; // bobs up and down

const enemy = create({ primitiveType: "cube", position: { x: 5, y: 1, z: 5 }, color: "#ff4444" });
enemy.autoFollow = { target: player, speed: 2 };  // follows player
enemy.autoSpin = { y: 1.5 };                     // spins while following

player.autoFaceMovement = true;  // player faces movement direction

log("Ready! New gravity system: object.gravity.enabled / strength / radius; exclusions via object.gravity.sourceName = false");
`;

export const SCRIPTING_DOCS = `# Scripting Guide - New Gravity System

## 🌍 Gravity API

Every object can be a gravity source:

\`\`\`js
const planet = create({ primitiveType: "sphere", gravity: true });
planet.gravity.strength = 15;   // pull strength
planet.gravity.radius = 25;     // radius of effect

// Disable gravity of this source
planet.gravity.enabled = false;

// Set all at once
planet.gravity = { enabled: true, strength: 20, radius: 40 };
\`\`\`

## ❌ Excluding Gravity Sources

To prevent a specific gravity source from affecting an object (player or other object), set that source's name to \`false\` on the object's \`gravity\` property:

\`\`\`js
// Exclude planet named "planet1" from affecting the player
player.gravity.planet1 = false;

// Re‑include
player.gravity.planet1 = true;

// Exclude same planet from affecting a coin
coin.gravity.planet1 = false;
\`\`\`

## ⚡ Auto‑Update Properties (still work)

\`\`\`js
obj.autoRotateY = 2;
obj.autoBob = { amplitude: 0.5, speed: 2 };
obj.autoFollow = { target: player, speed: 3 };
obj.autoSpin = { y: 1.5 };
obj.autoMove = { direction: { x: 1, y: 0, z: 0 }, speed: 2 };
player.autoFaceMovement = true;
\`\`\`

## 🎯 RunService Phases

\`\`\`js
runService.input.on((dt) => { });
runService.animation.on((dt) => { });
runService.replication.on((dt) => { });
runService.physics.on((dt) => { });
runService.render.on((dt) => { });
runService.update.on((dt) => { });
\`\`\`

All other APIs (parenting, raycast, networking, GUI, inventory, etc.) remain unchanged.
`;
