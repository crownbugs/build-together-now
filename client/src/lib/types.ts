// types.ts
import type { RaycastParams, RaycastResult } from "./raycast";
import type { NetSnapshot, NetInput } from "./network";
import type { Easing } from "./tween";

export type { RaycastResult, RaycastParams } from "./raycast";
export type { NetSnapshot, NetInput } from "./network";

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
  gravity?: false | { strength: number; radius: number };
  autoRotateY?: number;
  autoBob?: { amplitude: number; speed: number; startY?: number };
  autoFollow?: { target: any; speed: number; offset?: Vec3 }; // RuntimeObject | RuntimePlayer
  autoSpin?: { x?: number; y?: number; z?: number };
  autoMove?: { direction: Vec3; speed: number };
};

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
  gravity?: false | { strength: number; radius: number };
  autoRotateY?: number;
  autoBob?: { amplitude: number; speed: number; startY?: number; _time?: number };
  autoFollow?: { target: any; speed: number; offset?: Vec3 };
  autoSpin?: { x?: number; y?: number; z?: number };
  autoMove?: { direction: Vec3; speed: number };
  parentId: string | null;
  readonly children: RuntimeObject[];
  findFirstChild: (name: string) => RuntimeObject | null;
  setParent: (parent: RuntimeObject | null) => void;
  on: (event: ObjectEventName, fn: (...args: any[]) => void) => () => void;
  off: (event: ObjectEventName, fn: (...args: any[]) => void) => void;
  GetPropertyChangedSignal: (property: string) => EventsAPI;
  _gravityExclusions: Set<string>;
  setAttribute: (key: string, value: any) => void;
  getAttribute: (key: string) => any;
  getAttributes: () => Record<string, any>;
  __cleanup: Set<() => void>;
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
  autoFaceMovement?: boolean;
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
  onClick?: (game: any) => void;
};

export type EngineEvents = {
  input: [dt: number, time: number];
  animation: [dt: number, time: number];
  replication: [dt: number, time: number];
  physics: [dt: number, time: number];
  render: [dt: number, time: number];
  update: [dt: number, time: number];
  start: [];
  stop: [];
  keyDown: [key: string];
  keyUp: [key: string];
  objectAdded: [obj: RuntimeObject];
  objectRemoved: [obj: RuntimeObject];
  playerSpawned: [player: RuntimePlayer];
  playerDied: [player: RuntimePlayer];
};

export type EventChannel<T extends any[]> = {
  on: (fn: (...args: T) => void) => () => void;
  off: (fn: (...args: T) => void) => void;
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
    const handlers = Array.from(s);
    for (const fn of handlers) {
      try { (fn as any)(...args); } catch (e) { onError?.(e, fn); }
    }
  }
  createChannel<K extends keyof T>(event: K): EventChannel<T[K]> {
    const self = this;
    return {
      on(fn: (...args: T[K]) => void) { return self.on(event, fn); },
      off(fn: (...args: T[K]) => void) { self.off(event, fn); }
    };
  }
  clear() { this.subs.clear(); }
}

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

export type RunServiceAPI = {
  input: EventChannel<[dt: number, time: number]>;
  animation: EventChannel<[dt: number, time: number]>;
  replication: EventChannel<[dt: number, time: number]>;
  physics: EventChannel<[dt: number, time: number]>;
  render: EventChannel<[dt: number, time: number]>;
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
    parent?: RuntimeObject | null;
    canCollide?: boolean;
    anchored?: boolean;
    gravity?: false | { strength: number; radius: number };
  }) => RuntimeObject;
  destroy: (objOrName: RuntimeObject | string) => void;
  raycast: (origin: Vec3, direction: Vec3, maxDistance?: number, params?: RaycastParams) => RaycastResult;
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
  // APIs
  Emitter: any;
  Callable: any;
  tags: {
    add: (obj: RuntimeObject, tag: string) => void;
    remove: (obj: RuntimeObject, tag: string) => void;
    has: (obj: RuntimeObject, tag: string) => boolean;
    get: (tag: string) => RuntimeObject[];
    all: (obj: RuntimeObject) => string[];
  };
  require: (name: string) => any;
  task: {
    wait: (seconds: number) => Promise<void>;
    delay: (seconds: number, callback: () => void) => () => void;
    spawn: (fn: Function, ...args: any[]) => void;
  };
  debug: {
    getChildren: (obj: RuntimeObject) => RuntimeObject[];
    getDescendants: (obj: RuntimeObject) => RuntimeObject[];
    getFullName: (obj: RuntimeObject) => string;
    getPropertyNames: (obj: RuntimeObject) => string[];
    getObjectsWithTag: (tag: string) => RuntimeObject[];
    getEventConnections: (obj: RuntimeObject) => number;
  };
  weakRef: <T extends object>(obj: T) => { get: () => T | null };
  WeakTable: any;
  Class: any;
  exports?: any;
  module?: { exports: any };
};

export type CompiledScript = {
  name: string;
  run?: (api: GameAPI) => void;
  error?: string;
};

export const DEFAULT_PROPERTIES: ObjectProperties = {
  anchored: true,
  canCollide: true,
  transparency: 0,
  mass: 1,
  friction: 0.4,
  gravity: false,
};
