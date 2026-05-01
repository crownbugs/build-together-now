/**
 * Browser-side data layer that mimics the server's MemStorage so the editor can
 * run on hosts (like Lovable) that don't boot the Express backend.
 *
 * State is kept in-memory and mirrored to localStorage so refreshing the page
 * preserves your worlds. The shape of every record matches @shared/schema, so
 * the same React components / queries work whether they hit the real server or
 * this shim (see queryClient.ts for the routing layer).
 */
import type {
  User,
  Game,
  GameObject,
  Script,
  Asset,
  MultiplayerSession,
  SessionPlayer,
} from "@shared/schema";

// v3 — event-first scripting reshape: dropped onStart/onUpdate from seed
// scripts in favor of top-level execution + events.on(...). Bumping the
// key wipes any v2 worlds whose seeded "Welcome" still has the old shape.
// v2 — schema reshape (Roblox-style service names: Workspace, Lighting,
// Players, ServerScriptService, StarterPlayer, ReplicatedStorage). Bumping
// the key wipes any v1 worlds since we explicitly dropped backwards compat.
const LS_KEY = "pygame-engine:store:v3";

type DB = {
  users: Record<string, User>;
  games: Record<string, Game>;
  gameObjects: Record<string, GameObject>;
  scripts: Record<string, Script>;
  assets: Record<string, Asset>;
  sessions: Record<string, MultiplayerSession>;
  sessionPlayers: Record<string, SessionPlayer>;
  /** Currently logged-in user id (null = logged out). */
  currentUserId: string | null;
};

function emptyDb(): DB {
  const testUser: User = {
    id: "test",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    profileImageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return {
    users: { test: testUser },
    games: {},
    gameObjects: {},
    scripts: {},
    assets: {},
    sessions: {},
    sessionPlayers: {},
    // Auto-login as the seeded test user — no real auth in the browser-only shim.
    currentUserId: "test",
  };
}

function load(): DB {
  if (typeof window === "undefined") return emptyDb();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as DB;
    if (!parsed.users || !parsed.users.test) {
      const fresh = emptyDb();
      parsed.users = { ...fresh.users, ...(parsed.users ?? {}) };
    }
    if (parsed.currentUserId === undefined) parsed.currentUserId = "test";
    return parsed;
  } catch {
    return emptyDb();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch {
    // localStorage full / disabled — runtime continues, just no persistence.
  }
}

const db: DB = load();

function newId() {
  return Math.random().toString(36).slice(2, 9);
}

function values<T>(rec: Record<string, T>): T[] {
  return Object.values(rec);
}

/* ---------- Default world seeding (mirrors server/routes.ts) ---------- */

function seedDefaultWorld(gameId: string) {
  // Workspace/World — large green sphere acting as the planet
  createGameObject({
    gameId,
    name: "World",
    type: "primitive",
    container: "Workspace",
    primitiveType: "sphere",
    positionX: 0, positionY: 0.5, positionZ: 0,
    scaleX: 8, scaleY: 8, scaleZ: 8,
    color: "#5d8a4a",
  });
  createGameObject({
    gameId,
    name: "SpawnLocation",
    type: "spawn",
    container: "Workspace",
    primitiveType: "cylinder",
    positionX: 5, positionY: 0.05, positionZ: 0,
    scaleX: 2, scaleY: 0.1, scaleZ: 2,
    color: "#3b82f6",
  });
  createGameObject({
    gameId,
    name: "Sun",
    type: "light",
    container: "Lighting",
    primitiveType: null,
    positionX: 6, positionY: 10, positionZ: 4,
    color: "#fff3c8",
  });

  // Welcome script — Earth-like physics is on by default. Uses the bare-global
  // scripting style (no `game.` prefix) so it matches the in-editor Docs and
  // the snippet menu. Users can edit anything below.
  createScript({
    gameId,
    name: "Welcome",
    enabled: true,
    code: WELCOME_SCRIPT,
  });
}

const WELCOME_SCRIPT = `// Welcome to your new game!
// Your script runs ONCE when Play starts — top to bottom.
// To do something every frame, listen for the "heartbeat" event.
// \`events.on("update", ...)\` still works too as a compatibility alias.
// Open the Docs button (top of the editor) for the full reference.

let timer = 0;
let score = 0;

log("Welcome, " + player.username + "!");
gui.text("title", "My Game", { anchor: "tc", y: 16, size: 22 });
gui.text("hint",  "WASD to move · Space to jump · E to score",
  { anchor: "bc", y: 24, size: 14, bg: "rgba(0,0,0,0.45)" });
gui.text("score", "Score: 0", { anchor: "tl", x: 16, y: 16, size: 18 });

// ── Global game state (string-based — multiplayer-ready) ────────────────
state.set("phase", "Playing");
state.on("phase", (next) => log("phase →", next));

// ── Input ───────────────────────────────────────────────────────────────
keyboard.onPress("r", () => player.respawn());
keyboard.onPress("e", () => {
  score += 1;
  gui.text("score", "Score: " + score);
  if (score >= 10) state.set("phase", "GameOver");
});

// ── Drop a pickup coin nearby — walk into it to collect ─────────────────
const coin = create({
  name: "Coin",
  primitiveType: "sphere",
  position: { x: 2, y: 1, z: 2 },
  scale:    { x: 0.4, y: 0.4, z: 0.4 },
  color: "#fbbf24",
});
coin.isPickup = true;
coin.pickupName = "Coin";
coin.on("clicked", () => log("you clicked the coin"));

// ── Per-frame work ──────────────────────────────────────────────────────
runService.heartbeat.on((dt) => {
  timer += dt;

  const world = find("World");
  if (world) world.rotation.y += dt * 0.1;

  gui.text(
    "clock",
    "Time: " + timer.toFixed(1) + "s",
    { anchor: "tr", x: 16, y: 16, size: 14, bg: "rgba(0,0,0,0.45)" }
  );

  if (state.get("phase") === "GameOver") {
    gui.text("over", "Game Over — press R to restart",
      { anchor: "cc", y: 0, size: 28, bg: "rgba(0,0,0,0.6)" });
  } else {
    gui.clear("over");
  }
});

// ── World lifecycle ─────────────────────────────────────────────────────
world.onPlayerSpawned((p) => log(p.username, "spawned at",
  p.spawnPoint.x.toFixed(1), p.spawnPoint.y.toFixed(1), p.spawnPoint.z.toFixed(1)));
`;

/* ---------- Auth ---------- */

export function getCurrentUser(): User | null {
  if (!db.currentUserId) return null;
  return db.users[db.currentUserId] ?? null;
}

export function login(username: string, password: string): { ok: boolean; user?: User } {
  // Hard-coded "test" / "pass123" mirrors server/replitAuth.ts
  if (username === "test" && password === "pass123") {
    db.currentUserId = "test";
    persist();
    return { ok: true, user: db.users.test };
  }
  return { ok: false };
}

export function logout() {
  db.currentUserId = null;
  persist();
}

/* ---------- Games ---------- */

export function createGame(input: { userId: string; title: string; description?: string | null }): Game {
  const id = newId();
  const game: Game = {
    id,
    userId: input.userId,
    title: input.title,
    description: input.description ?? null,
    thumbnail: null,
    isPublished: false,
    isPublic: true,
    plays: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.games[id] = game;
  seedDefaultWorld(id);
  persist();
  return game;
}

export function getGame(id: string) { return db.games[id]; }
export function getGamesByUser(userId: string) { return values(db.games).filter(g => g.userId === userId); }
export function getPublishedGames() { return values(db.games).filter(g => g.isPublished && g.isPublic); }

export function updateGame(id: string, updates: Partial<Game>): Game | undefined {
  const g = db.games[id];
  if (!g) return undefined;
  Object.assign(g, updates, { updatedAt: new Date() });
  persist();
  return g;
}

export function deleteGame(id: string) {
  delete db.games[id];
  for (const o of values(db.gameObjects)) if (o.gameId === id) delete db.gameObjects[o.id];
  for (const s of values(db.scripts)) if (s.gameId === id) delete db.scripts[s.id];
  persist();
}

export function incrementPlays(id: string) {
  const g = db.games[id];
  if (g) { g.plays = (g.plays ?? 0) + 1; persist(); }
}

/* ---------- Game Objects ---------- */

export function createGameObject(input: Partial<GameObject> & { gameId: string; name: string; type: string }): GameObject {
  const id = newId();
  const obj: GameObject = {
    id,
    gameId: input.gameId,
    parentId: input.parentId ?? null,
    name: input.name,
    type: input.type,
    container: input.container ?? "Workspace",
    positionX: input.positionX ?? 0,
    positionY: input.positionY ?? 0,
    positionZ: input.positionZ ?? 0,
    rotationX: input.rotationX ?? 0,
    rotationY: input.rotationY ?? 0,
    rotationZ: input.rotationZ ?? 0,
    scaleX: input.scaleX ?? 1,
    scaleY: input.scaleY ?? 1,
    scaleZ: input.scaleZ ?? 1,
    primitiveType: input.primitiveType ?? null,
    color: input.color ?? "#888888",
    assetId: input.assetId ?? null,
    properties: input.properties ?? {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.gameObjects[id] = obj;
  persist();
  return obj;
}

export function getGameObjects(gameId: string) { return values(db.gameObjects).filter(o => o.gameId === gameId); }
export function getGameObject(id: string) { return db.gameObjects[id]; }

export function updateGameObject(id: string, updates: Partial<GameObject>): GameObject | undefined {
  const o = db.gameObjects[id];
  if (!o) return undefined;
  Object.assign(o, updates, { updatedAt: new Date() });
  persist();
  return o;
}

export function deleteGameObject(id: string) {
  delete db.gameObjects[id];
  persist();
}

/* ---------- Scripts ---------- */

export function createScript(input: Partial<Script> & { gameId: string; name: string }): Script {
  const id = newId();
  const s: Script = {
    id,
    gameId: input.gameId,
    objectId: input.objectId ?? null,
    container: input.container ?? "ServerScriptService",
    scriptType: input.scriptType ?? "Script",
    name: input.name,
    code: input.code ?? "// Write your JavaScript code here\n",
    enabled: input.enabled ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  db.scripts[id] = s;
  persist();
  return s;
}

export function getScripts(gameId: string) { return values(db.scripts).filter(s => s.gameId === gameId); }
export function getScript(id: string) { return db.scripts[id]; }

export function updateScript(id: string, updates: Partial<Script>): Script | undefined {
  const s = db.scripts[id];
  if (!s) return undefined;
  Object.assign(s, updates, { updatedAt: new Date() });
  persist();
  return s;
}

export function deleteScript(id: string) {
  delete db.scripts[id];
  persist();
}

/* ---------- Assets (no real upload in browser shim) ---------- */

export function getAssets(userId?: string) {
  if (userId) return values(db.assets).filter(a => a.userId === userId);
  return values(db.assets).filter(a => a.isPublic);
}
export function getBuiltInAssets() { return values(db.assets).filter(a => a.isBuiltIn); }
export function getAsset(id: string) { return db.assets[id]; }
export function deleteAsset(id: string) { delete db.assets[id]; persist(); }

/* ---------- Multiplayer (stubs — no networking in browser-only mode) ---------- */

export function getActiveSessionForGame(_gameId: string): MultiplayerSession | null {
  return null;
}
export function getSessionPlayers(_sessionId: string): SessionPlayer[] {
  return [];
}