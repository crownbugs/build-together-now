import type { GameObject, Script } from "@shared/schema";

export type Vec3 = { x: number; y: number; z: number };

export type ContainerName =
  | "Workspace"
  | "Lighting"
  | "Players"
  | "ServerScriptService"
  | "StarterPlayer"
  | "ReplicatedStorage";

export type ObjectProperties = {
  anchored: boolean;
  canCollide: boolean;
  transparency: number;
  mass: number;
  friction: number;
  gravityEnabled: boolean;
  gravityStrength: number;
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

export type ObjectEventName = "touched" | "untouched" | "clicked" | "destroyed";

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
  gravityEnabled: boolean;
  gravityStrength: number;
  gravityRadius: number;
  velocity: Vec3;
  isPickup?: boolean;
  pickupName?: string;
  pickupData?: Record<string, any>;
  on: (event: ObjectEventName, fn: (...args: any[]) => void) => () => void;
  off: (event: ObjectEventName, fn: (...args: any[]) => void) => void;
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
  takeDamage: (n: number) => void;
  heal: (n: number) => void;
  teleport: (x: number, y: number, z: number) => void;
  respawn: () => void;
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

export type EngineEvents = {
  update: [dt: number, time: number];
  step: [dt: number, time: number];
  start: [];
  stop: [];
  keyDown: [key: string];
  keyUp: [key: string];
  objectAdded: [obj: RuntimeObject];
  objectRemoved: [obj: RuntimeObject];
  playerSpawned: [player: RuntimePlayer];
  playerDied: [player: RuntimePlayer];
  renderStepped: [dt: number, time: number];
  stepped: [dt: number, time: number];
  heartbeat: [dt: number, time: number];
};

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
  emit<K extends keyof T>(event: K, args: T[K], onError?: (e: any, fn: Function) => void): void {
    const s = this.subs.get(event);
    if (!s) return;
    for (const fn of s) {
      try { (fn as any)(...args); }
      catch (e) { onError?.(e, fn); }
    }
  }
  clear() { this.subs.clear(); }
}

export type EventsAPI = {
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

export type RunServiceAPI = {
  renderStepped: EventsAPI;
  stepped: EventsAPI;
  heartbeat: EventsAPI;
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
  events: EventsAPI;
  runService: RunServiceAPI;
  keyboard: KeyboardAPI;
  mouse: MouseAPI;
  world: WorldAPI;
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
  }) => RuntimeObject;
  destroy: (objOrName: RuntimeObject | string) => void;
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

export function compileScript(code: string, name: string): CompiledScript {
  try {
    const safeCode = code
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\${/g, "\\${");
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const factory = new AsyncFunction(
      "game",
      `"use strict"; const objects = game.objects; const workspace = game.workspace; const lighting = game.lighting; const replicatedStorage = game.replicatedStorage; const serverScriptService = game.serverScriptService; const starterPlayer = game.starterPlayer; const players = game.players; const player = game.player; const input = game.input; const physics = game.physics; const state = game.state; const events = game.events; const keyboard = game.keyboard; const mouse = game.mouse; const world = game.world; const gui = game.gui; const log = game.log; const inventory = game.player ? game.player.inventory : undefined; const find = game.find; const spawn = game.spawn; const create = game.create; const destroy = game.destroy; const onKey = game.onKey; const onUpdate = game.onUpdate; const every = game.every; const after = game.after; const wait = game.wait; const now = game.now; const random = game.random; const randInt = game.randInt; const pick = game.pick; const dist = game.dist; const lerp = game.lerp; const clamp = game.clamp; const console = { log: (...a) => game.log(...a), info: (...a) => game.log("[info]", ...a), warn: (...a) => game.log("[warn]", ...a), error: (...a) => game.log("[error]", ...a), }; ${safeCode}`
    );
    return { name, run: factory as (api: GameAPI) => void };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    const stack = typeof e?.stack === "string" ? `\n${e.stack.split("\n").slice(0, 3).join("\n")}` : "";
    return { name, error: `${msg}${stack}` };
  }
}

function newId() {
  return `rt_${Math.random().toString(36).slice(2, 10)}`;
}

function formatErr(e: any): string {
  const msg = e?.message ?? String(e);
  const stack = typeof e?.stack === "string"
    ? e.stack.split("\n").slice(1, 4).map((l: string) => "  " + l.trim()).join("\n")
    : "";
  return stack ? `${msg}\n${stack}` : msg;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

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

// ========== ULTRA-FAST RUNTIME: NO REACTIVITY, NO TRACKING ==========
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
  private _keyDownHandlers = new Map<string, Set<() => void>>();
  private _keyUpHandlers = new Map<string, Set<() => void>>();
  private _events = new EventBus<EngineEvents>();
  private _objectEvents = new Map<string, EventBus<Record<ObjectEventName, any[]>>>();
  private _playerContacts = new Set<string>();
  private _api: GameAPI | null = null;
  private _eventsApi: EventsAPI | null = null;
  private _keyboardApi: KeyboardAPI | null = null;
  private _mouseApi: MouseAPI | null = null;
  private _worldApi: WorldAPI | null = null;
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
  runService!: RunServiceAPI;
  
  private _gravityCache = new Map<string, Vec3>();
  private _rebuildScheduled = false;
  private _framesSinceLastRebuild = 0;

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
    
    // Create plain objects (no reactive wrappers)
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
      };
      // Attach event methods
      ro.on = (event, fn) => {
        let bus = this._objectEvents.get(ro.id);
        if (!bus) { bus = new EventBus(); this._objectEvents.set(ro.id, bus); }
        return bus.on(event as any, fn as any);
      };
      ro.off = (event, fn) => this._objectEvents.get(ro.id)?.off(event as any, fn as any);
      this._all.set(ro.id, ro);
    }
    
    this.rebuildIndexes();
    
    const spawnObj = [...this._all.values()].find(o => o.name === "SpawnLocation" || o.type === "spawn");
    const spawnPoint: Vec3 = spawnObj
      ? { x: spawnObj.position.x, y: spawnObj.position.y + 1.2, z: spawnObj.position.z }
      : { x: 0, y: 1, z: 4 };
    
    const rawPlayer = {
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
    this.player = rawPlayer as RuntimePlayer;
    
    this.mountPlayerInventory();
    this.mountPlayerMethods();
    
    this.runService = {
      renderStepped: {
        on: (_, fn) => this._events.on("renderStepped" as any, fn as any),
        off: (_, fn) => this._events.off("renderStepped" as any, fn as any),
      },
      stepped: {
        on: (_, fn) => this._events.on("stepped" as any, fn as any),
        off: (_, fn) => this._events.off("stepped" as any, fn as any),
      },
      heartbeat: {
        on: (_, fn) => this._events.on("heartbeat" as any, fn as any),
        off: (_, fn) => this._events.off("heartbeat" as any, fn as any),
      },
    };
    
    this.scripts = scripts.filter(s => s.enabled !== false).map(s => compileScript(s.code, s.name));
  }

  private normalizeContainer(raw: string | undefined | null): ContainerName {
    const valid: ContainerName[] = [
      "Workspace", "Lighting", "Players",
      "ServerScriptService", "StarterPlayer", "ReplicatedStorage"
    ];
    if (raw && valid.includes(raw as ContainerName)) return raw as ContainerName;
    return "Workspace";
  }

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
      const slot: InventoryItem = { id: newId(), name, count, template: opts?.template, data: { ...(opts?.data ?? {}) } };
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
    
    inv.get = (name: string): InventoryItem | null => items.find((i) => i.name === name) ?? null;
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
      const fx = fwd.x / fLen, fz = fwd.z / fLen;
      const dropPos: Vec3 = {
        x: this.player.position.x + fx * 1.5,
        y: this.player.position.y + 0.5,
        z: this.player.position.z + fz * 1.5,
      };
      const template = slot.template ?? name;
      const tpl = this.replicatedStorage[template];
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
    p.takeDamage = (n: number) => {
      p.health = Math.max(0, p.health - n);
      if (p.health <= 0) p.respawn();
    };
    p.heal = (n: number) => { p.health = Math.min(p.maxHealth, p.health + n); };
    p.teleport = (x: number, y: number, z: number) => {
      p.position.x = x; p.position.y = y; p.position.z = z;
      p.velocity.x = 0; p.velocity.y = 0; p.velocity.z = 0;
    };
    p.respawn = () => {
      const sp = p.spawnPoint;
      p.position.x = sp.x; p.position.y = sp.y; p.position.z = sp.z;
      p.velocity.x = 0; p.velocity.y = 0; p.velocity.z = 0;
      p.health = p.maxHealth;
      this.pushLog(`${p.username} respawned.`);
    };
  }

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
    };
    ro.on = (event, fn) => {
      let bus = this._objectEvents.get(ro.id);
      if (!bus) { bus = new EventBus(); this._objectEvents.set(ro.id, bus); }
      return bus.on(event as any, fn as any);
    };
    ro.off = (event, fn) => this._objectEvents.get(ro.id)?.off(event as any, fn as any);
    this._all.set(ro.id, ro);
    this.rebuildIndexes();
    this._events.emit("objectAdded", [ro]);
    return ro;
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
    };
    ro.on = (event, fn) => {
      let bus = this._objectEvents.get(ro.id);
      if (!bus) { bus = new EventBus(); this._objectEvents.set(ro.id, bus); }
      return bus.on(event as any, fn as any);
    };
    ro.off = (event, fn) => this._objectEvents.get(ro.id)?.off(event as any, fn as any);
    this._all.set(ro.id, ro);
    this.rebuildIndexes();
    this._events.emit("objectAdded", [ro]);
    return ro;
  }

  private removeObject(id: string) {
    const ro = this._all.get(id);
    if (!ro) return;
    this._all.delete(id);
    this._playerContacts.delete(id);
    this.emitObjectEvent(id, "destroyed", []);
    this._objectEvents.delete(id);
    this._events.emit("objectRemoved", [ro]);
  }

  private scheduleIndexRebuild() {
    if (this._rebuildScheduled) return;
    this._rebuildScheduled = true;
    setTimeout(() => { this.rebuildIndexes(); this._rebuildScheduled = false; }, 0);
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

  private pushLog(line: string) {
    this.logs.push(line);
    if (this.logs.length > 200) this.logs.shift();
    this.onLog?.(line);
  }

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
        for (const fn of subs) { try { fn(v, prev); } catch (e: any) { this.pushLog(`state.on("${key}") error: ${formatErr(e)}`); } }
      },
      on: (key, fn) => {
        let subs = this._stateSubs.get(key);
        if (!subs) { subs = new Set(); this._stateSubs.set(key, subs); }
        subs.add(fn);
        return () => subs?.delete(fn);
      },
      keys: () => Array.from(this._stateValues.keys()),
    };
    return this._stateApi;
  }

  invokeGuiClick(id: string) {
    const el = this.gui.get(id);
    if (!el?.onClick) return;
    try { el.onClick(this.buildApi(0)); } catch (e: any) { this.pushLog(`gui[${id}] onClick error: ${formatErr(e)}`); }
  }

  private buildApi(dt: number): GameAPI {
    if (this._api) {
      this._api.time = this.time;
      this._api.dt = dt;
      return this._api;
    }
    
    const log = (...args: any[]) => {
      const text = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      this.pushLog(text);
    };
    
    const find = (name: string): RuntimeObject | null => {
      const containers = [this.workspace, this.lighting, this.replicatedStorage, this.serverScriptService, this.starterPlayer, this.players];
      for (const c of containers) if (c[name]) return c[name];
      for (const o of this._all.values()) if (o.name === name) return o;
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
      if (!tpl) { this.pushLog(`spawn(): no ReplicatedStorage template named "${templateName}"`); return null; }
      const ro = this.cloneTemplateInto(tpl, "Workspace", overrides?.position ? { ...tpl.position, ...overrides.position } : undefined);
      if (overrides) {
        if (overrides.name) { ro.name = overrides.name; this.rebuildIndexes(); }
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
        for (const ro of this._all.values()) if (ro.name === target || ro.id === target) { this.removeObject(ro.id); this.rebuildIndexes(); return; }
        return;
      }
      this.removeObject(target.id);
      this.rebuildIndexes();
    };
    
    const guiText = (id: string, text: string, opts?: Partial<Omit<GuiElement, "id" | "kind" | "text">>) => {
      const prev = this.gui.get(id);
      const el: GuiElement = {
        id, kind: "text", text,
        x: opts?.x ?? prev?.x ?? 0, y: opts?.y ?? prev?.y ?? 0,
        anchor: opts?.anchor ?? prev?.anchor ?? "tl",
        color: opts?.color ?? prev?.color ?? "#ffffff",
        size: opts?.size ?? prev?.size ?? 16,
        bg: opts?.bg ?? prev?.bg,
      };
      this.gui.set(id, el);
      this.guiVersion++;
    };
    
    const guiButton = (id: string, text: string, opts: Partial<Omit<GuiElement, "id" | "kind" | "text">> | undefined, onClick?: (game: GameAPI) => void) => {
      const prev = this.gui.get(id);
      const el: GuiElement = {
        id, kind: "button", text,
        x: opts?.x ?? prev?.x ?? 16, y: opts?.y ?? prev?.y ?? 16,
        anchor: opts?.anchor ?? prev?.anchor ?? "tl",
        color: opts?.color ?? prev?.color ?? "#ffffff",
        size: opts?.size ?? prev?.size ?? 14,
        bg: opts?.bg ?? prev?.bg ?? "rgba(30,40,60,0.85)",
        onClick: onClick ?? prev?.onClick,
      };
      this.gui.set(id, el);
      this.guiVersion++;
    };
    
    const guiClear = (id?: string) => { if (id == null) this.gui.clear(); else this.gui.delete(id); this.guiVersion++; };
    
    const eventsApi: EventsAPI = { on: (event, fn) => this._events.on(event, fn), off: (event, fn) => this._events.off(event, fn) };
    this._eventsApi = eventsApi;
    
    const keyboardApi: KeyboardAPI = {
      onPress: (key, fn) => { const k = key.toLowerCase(); let s = this._keyDownHandlers.get(k); if (!s) { s = new Set(); this._keyDownHandlers.set(k, s); } s.add(fn); return () => s!.delete(fn); },
      onRelease: (key, fn) => { const k = key.toLowerCase(); let s = this._keyUpHandlers.get(k); if (!s) { s = new Set(); this._keyUpHandlers.set(k, s); } s.add(fn); return () => s!.delete(fn); },
      isDown: (key) => !!this.input.keys[key.toLowerCase()],
    };
    this._keyboardApi = keyboardApi;
    
    const mouseApi: MouseAPI = { onClick: (fn) => { this._mouseClickHandlers.add(fn); return () => this._mouseClickHandlers.delete(fn); } };
    this._mouseApi = mouseApi;
    
    const worldApi: WorldAPI = {
      onObjectAdded: (fn) => this._events.on("objectAdded", fn),
      onObjectRemoved: (fn) => this._events.on("objectRemoved", fn),
      onPlayerSpawned: (fn) => this._events.on("playerSpawned", fn),
      onPlayerDied: (fn) => this._events.on("playerDied", fn),
    };
    this._worldApi = worldApi;
    
    const onKey = (key: string, fn: () => void) => keyboardApi.onPress(key, fn);
    const onUpdateFn = (fn: (dt: number, time: number) => void) => this._events.on("update", fn);
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
    const wait = (seconds: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, seconds * 1000)));
    const now = () => this.time;
    const random = (min: number, max: number) => min + Math.random() * (max - min);
    const randInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const dist = (a: Vec3 | { position: Vec3 }, b: Vec3 | { position: Vec3 }) => {
      const pa = "position" in a ? a.position : a;
      const pb = "position" in b ? b.position : b;
      return Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    };
    const lerpFn = (a: number, b: number, t: number) => a + (b - a) * t;
    const clampFn = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    
    this._api = {
      objects: this.objects, workspace: this.workspace, lighting: this.lighting,
      replicatedStorage: this.replicatedStorage, serverScriptService: this.serverScriptService,
      starterPlayer: this.starterPlayer, players: this.players, player: this.player,
      input: this.input, physics: this.physics, state: this.buildState(),
      events: eventsApi, keyboard: keyboardApi, mouse: mouseApi, world: worldApi,
      runService: this.runService,
      time: this.time, dt, now, log, find, spawn, create, destroy,
      gui: { text: guiText, button: guiButton, clear: guiClear },
      onKey, onUpdate: onUpdateFn, every, after, wait, random, randInt, pick, dist, lerp: lerpFn, clamp: clampFn,
    };
    return this._api;
  }

  emitClick(objId: string | null) {
    const obj = objId ? (this._all.get(objId) ?? null) : null;
    if (obj) this.emitObjectEvent(obj.id, "clicked", [obj]);
    for (const fn of this._mouseClickHandlers) { try { fn(obj); } catch (e: any) { this.pushLog(`mouse.onClick error: ${formatErr(e)}`); } }
  }

  emitTap(objId: string) { this.emitObjectEvent(objId, "clicked", [this._all.get(objId)]); }

  emitRenderStepped(dt: number) {
    this._events.emit("renderStepped", [dt, this.time], (e, fn) =>
      this.pushLog(`RunService.RenderStepped error: ${formatErr(e)} (${(fn as any).name || "anonymous"})`)
    );
  }

  private async runScripts() {
    const api = this.buildApi(0);
    for (const s of this.scripts) {
      if (s.error) { this.pushLog(`[${s.name}] compile error: ${s.error}`); continue; }
      if (!s.run) continue;
      try {
        const maybe = (s.run as any)(api);
        if (maybe && typeof maybe.then === "function") maybe.then(undefined, (e: any) => this.pushLog(`[${s.name}] runtime error: ${formatErr(e)}`));
      } catch (e: any) { this.pushLog(`[${s.name}] runtime error: ${formatErr(e)}`); }
    }
  }

  start() {
    void this.runScripts();
    this._events.emit("start", []);
    this._events.emit("playerSpawned", [this.player]);
  }

  stop() {
    this._events.emit("stop", []);
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
    this._gravityCache.clear();
    
    const p = this.player;
    
    // Gravity for player
    const gravityVec = this.computeGravityCached(p.position, "player");
    const gMag = Math.hypot(gravityVec.x, gravityVec.y, gravityVec.z);
    const desiredUp = gMag > 0.001 ? { x: -gravityVec.x / gMag, y: -gravityVec.y / gMag, z: -gravityVec.z / gMag } : { x: 0, y: 1, z: 0 };
    const slerpT = Math.min(1, dt * 6);
    p.up.x += (desiredUp.x - p.up.x) * slerpT;
    p.up.y += (desiredUp.y - p.up.y) * slerpT;
    p.up.z += (desiredUp.z - p.up.z) * slerpT;
    const upLen = Math.hypot(p.up.x, p.up.y, p.up.z) || 1;
    p.up.x /= upLen; p.up.y /= upLen; p.up.z /= upLen;
    
    // Player movement
    const cf = this.cameraForward;
    const cfDot = cf.x * p.up.x + cf.y * p.up.y + cf.z * p.up.z;
    let fx = cf.x - p.up.x * cfDot, fy = cf.y - p.up.y * cfDot, fz = cf.z - p.up.z * cfDot;
    let fLen = Math.hypot(fx, fy, fz);
    if (fLen < 0.0001) {
      const fallback = Math.abs(p.up.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const fbDot = fallback.x * p.up.x + fallback.y * p.up.y + fallback.z * p.up.z;
      fx = fallback.x - p.up.x * fbDot; fy = fallback.y - p.up.y * fbDot; fz = fallback.z - p.up.z * fbDot;
      fLen = Math.hypot(fx, fy, fz) || 1;
    }
    fx /= fLen; fy /= fLen; fz /= fLen;
    const rx = fy * p.up.z - fz * p.up.y;
    const ry = fz * p.up.x - fx * p.up.z;
    const rz = fx * p.up.y - fy * p.up.x;
    const wantX = rx * this.input.moveX - fx * this.input.moveZ;
    const wantY = ry * this.input.moveX - fy * this.input.moveZ;
    const wantZ = rz * this.input.moveX - fz * this.input.moveZ;
    const upVelDot = p.velocity.x * p.up.x + p.velocity.y * p.up.y + p.velocity.z * p.up.z;
    p.velocity.x = wantX * p.speed + p.up.x * upVelDot;
    p.velocity.y = wantY * p.speed + p.up.y * upVelDot;
    p.velocity.z = wantZ * p.speed + p.up.z * upVelDot;
    
    const inputMag = Math.hypot(this.input.moveX, this.input.moveZ);
    if (inputMag > 0.01) {
      const moveMag = Math.hypot(wantX, wantZ);
      if (moveMag > 0.0001) {
        let targetYaw = Math.atan2(wantX, wantZ);
        let diff = targetYaw - p.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.rotation.y += diff * Math.min(1, dt * 12);
      }
    }
    
    if (this.input.jump && p.onGround) {
      p.velocity.x += p.up.x * p.jumpPower;
      p.velocity.y += p.up.y * p.jumpPower;
      p.velocity.z += p.up.z * p.jumpPower;
      p.onGround = false;
    }
    
    p.velocity.x += gravityVec.x * dt;
    p.velocity.y += gravityVec.y * dt;
    p.velocity.z += gravityVec.z * dt;
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    p.position.z += p.velocity.z * dt;
    
    // Physics for dynamic objects
    for (const o of this.objectList) {
      if (o.anchored || o.container !== "Workspace") continue;
      const og = this.computeGravityCached(o.position, o.id);
      o.velocity.x += og.x * dt;
      o.velocity.y += og.y * dt;
      o.velocity.z += og.z * dt;
      o.position.x += o.velocity.x * dt;
      o.position.y += o.velocity.y * dt;
      o.position.z += o.velocity.z * dt;
    }
    
    // Collisions
    for (const o of this.objectList) {
      if (!o.visible || !o.canCollide || o.type === "light" || o.type === "spawn" || o.container !== "Workspace") continue;
      this.resolvePlayerVsObject(o);
    }
    
    // Touches and pickups (single pass)
    const pr = 0.45, ph = 0.95;
    const seen = new Set<string>();
    for (const o of this.objectList) {
      if (!o.visible || o.type === "light" || o.type === "spawn" || o.container !== "Workspace") continue;
      let touching = false;
      if (o.primitiveType === "sphere") {
        const r = Math.max(o.scale.x, o.scale.y, o.scale.z) * 0.5;
        const dx = p.position.x - o.position.x, dy = p.position.y - o.position.y, dz = p.position.z - o.position.z;
        touching = Math.hypot(dx, dy, dz) < r + pr + 0.05;
      } else {
        const hx = (o.scale.x || 1) * 0.5 + pr, hy = (o.scale.y || 1) * 0.5 + ph, hz = (o.scale.z || 1) * 0.5 + pr;
        touching = Math.abs(p.position.x - o.position.x) < hx && Math.abs(p.position.y - o.position.y) < hy && Math.abs(p.position.z - o.position.z) < hz;
      }
      if (touching) {
        seen.add(o.id);
        if (!this._playerContacts.has(o.id)) {
          this._playerContacts.add(o.id);
          this.emitObjectEvent(o.id, "touched", [p, o]);
        }
      }
      if (o.isPickup) {
        const dx = p.position.x - o.position.x, dy = p.position.y - o.position.y, dz = p.position.z - o.position.z;
        if (Math.hypot(dx, dy, dz) < 1.0) {
          const name = o.pickupName ?? o.name;
          const slot = p.inventory.add(name, { template: o.name, data: o.pickupData ?? {} });
          if (slot) {
            this.pushLog(`Picked up ${name}.`);
            this.removeObject(o.id);
          }
        }
      }
    }
    for (const id of this._playerContacts) {
      if (!seen.has(id)) {
        this._playerContacts.delete(id);
        this.emitObjectEvent(id, "untouched", [p, this._all.get(id)]);
      }
    }
    
    // Ground
    if (p.position.y < 1) {
      p.position.y = 1;
      if (p.velocity.y < 0) p.velocity.y = 0;
      p.onGround = true;
      const f = 1 - Math.min(1, 0.4 * 8 * dt);
      p.velocity.x *= f; p.velocity.z *= f;
    } else if (p.position.y > 1.001) p.onGround = false;
    
    // Update API time
    this.buildApi(dt);
    
    // Engine events
    this._events.emit("stepped", [dt, this.time]);
    for (const k in this.input.keys) {
      const isDown = !!this.input.keys[k], wasDown = !!this._prevKeys[k];
      if (isDown && !wasDown) {
        this._events.emit("keyDown", [k]);
        this._keyDownHandlers.get(k)?.forEach(fn => { try { fn(); } catch(e) { this.pushLog(`keyboard.onPress error: ${formatErr(e)}`); } });
      } else if (!isDown && wasDown) {
        this._events.emit("keyUp", [k]);
        this._keyUpHandlers.get(k)?.forEach(fn => { try { fn(); } catch(e) { this.pushLog(`keyboard.onRelease error: ${formatErr(e)}`); } });
      }
    }
    this._events.emit("heartbeat", [dt, this.time]);
    this._events.emit("update", [dt, this.time]);
    this._events.emit("step", [dt, this.time]);
    
    // Timers
    for (let i = this._timers.length - 1; i >= 0; i--) {
      const t = this._timers[i];
      if (this.time >= t.nextAt) {
        try { t.fn(); } catch(e) { this.pushLog(`timer error: ${formatErr(e)}`); }
        if (t.once) this._timers.splice(i, 1);
        else t.nextAt = this.time + t.interval;
      }
    }
    
    // Death/respawn
    if (p.health <= 0 && (this as any)._lastHealth > 0) {
      this._events.emit("playerDied", [p]);
      p.respawn();
      this._events.emit("playerSpawned", [p]);
    }
    (this as any)._lastHealth = p.health;
    
    this.input.jump = false;
    this._prevKeys = { ...this.input.keys };
    
    // Periodic rebuild
    this._framesSinceLastRebuild++;
    if (this._rebuildScheduled && this._framesSinceLastRebuild > 10) {
      this.rebuildIndexes();
      this._rebuildScheduled = false;
      this._framesSinceLastRebuild = 0;
    }
  }

  private computeGravityCached(point: Vec3, id: string): Vec3 {
    const cached = this._gravityCache.get(id);
    if (cached) return cached;
    const result = this.computeGravity(point, id);
    this._gravityCache.set(id, result);
    return result;
  }

  private computeGravity(point: Vec3, excludeId?: string): Vec3 {
    let bestMag = 0, best: Vec3 | null = null;
    for (const o of this.objectList) {
      if (!o.gravityEnabled || o.id === excludeId) continue;
      const { surfaceDistance, dirToCenter, surfaceRadius } = pointVsObjectSurface(point, o);
      if (surfaceDistance > o.gravityRadius) continue;
      const r = Math.max(surfaceRadius, surfaceRadius + Math.max(0, surfaceDistance));
      const accel = (o.gravityStrength * surfaceRadius * surfaceRadius) / (r * r);
      if (accel > bestMag) { bestMag = accel; best = { x: dirToCenter.x * accel, y: dirToCenter.y * accel, z: dirToCenter.z * accel }; }
    }
    return best ?? { x: 0, y: -(this.physics.gravity || 9.81), z: 0 };
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
        if (vDotN < 0) { p.velocity.x -= nx * vDotN; p.velocity.y -= ny * vDotN; p.velocity.z -= nz * vDotN; }
        if (nx * p.up.x + ny * p.up.y + nz * p.up.z > 0.5) p.onGround = true;
      }
      return;
    }
    const hx = (o.scale.x || 1) * 0.5 + pr, hy = (o.scale.y || 1) * 0.5 + ph, hz = (o.scale.z || 1) * 0.5 + pr;
    const dx = p.position.x - o.position.x, dy = p.position.y - o.position.y, dz = p.position.z - o.position.z;
    if (Math.abs(dx) < hx && Math.abs(dy) < hy && Math.abs(dz) < hz) {
      const ox = hx - Math.abs(dx), oy = hy - Math.abs(dy), oz = hz - Math.abs(dz);
      if (oy < ox && oy < oz) {
        if (dy > 0) { p.position.y = o.position.y + hy; if (p.velocity.y < 0) p.velocity.y = 0; if (p.up.y > 0.5) p.onGround = true; }
        else { p.position.y = o.position.y - hy; if (p.velocity.y > 0) p.velocity.y = 0; }
      } else if (ox < oz) { p.position.x += dx >= 0 ? ox : -ox; p.velocity.x = 0; if (Math.abs(p.up.x) > 0.5) p.onGround = true; }
      else { p.position.z += dz >= 0 ? oz : -oz; p.velocity.z = 0; if (Math.abs(p.up.z) > 0.5) p.onGround = true; }
    }
  }
}

// Keep DEFAULT_SCRIPT and SCRIPTING_DOCS unchanged (same as your original)
export const DEFAULT_SCRIPT = `// Welcome! Your script runs ONCE...`; // (your existing content)
export const SCRIPTING_DOCS = `# Scripting Guide...`; // (your existing content)
