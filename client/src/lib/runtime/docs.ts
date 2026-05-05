/**
 * Default starter script + the SCRIPTING_DOCS markdown shown in the editor's
 * Docs panel. Kept separate from the engine so docs edits don't risk touching
 * runtime code.
 */

export const DEFAULT_SCRIPT = `// Starter script — see Docs for the full API.
// The world auto-includes a Baseplate and a SpawnLocation if you have none.

const coin = create({
  primitiveType: "sphere",
  position: { x: 2, y: 2, z: 0 },
  color: "#ffd700",
});
coin.autoRotateY = 2;
coin.autoBob = { amplitude: 0.3, speed: 2 };

player.autoFaceMovement = true;

// Hold Shift to sprint (player.runSpeed). Tweak speeds:
player.walkSpeed = 6;
player.runSpeed  = 12;

// Make a sword and put it in the player's right hand.
const sword = create({
  primitiveType: "cube",
  position: { x: 0, y: 1, z: 0 },
  scale: { x: 0.15, y: 1.0, z: 0.15 },
  color: "#cbd5e1",
});
player.motors.attach("rightHand", sword, { y: 0.4 });

// Switch to first person with C, back to third with V.
keyboard.onPress("c", () => { camera.mode = "firstPerson"; });
keyboard.onPress("v", () => { camera.mode = "thirdPerson"; });

// React to death:
world.onPlayerDied(() => log("oof"));
world.onPlayerSpawned(() => log("hello again"));
`;

export const SCRIPTING_DOCS = `# Scripting Reference

The engine handles the clock (~60fps), physics, rendering, input, replication,
camera and player rig. Your scripts handle game logic.

## Containers (Roblox-style)

- **Workspace** — live, simulated 3D world.
- **Lighting** — lights and atmosphere.
- **Players** — per-player avatars + non-physical data.
- **ServerScriptService** — server-authoritative scripts.
- **StarterPlayer** — scripts/objects copied to each client (LocalScript).
- **ReplicatedStorage** — shared templates + ModuleScripts.

## Script Types

- **Script** (default) — runs once at start. Top-level code executes; register
  events for everything that should fire later.
- **LocalScript** — same execution model in single-player. When networking is
  enabled, runs on the client.
- **ModuleScript** — does NOT auto-run. Other scripts pull it in with
  \`require("Name")\` and use the \`exports\` it sets.

\`\`\`js
// ModuleScript "MathLib" in ReplicatedStorage:
exports.add = (a, b) => a + b;

// Any other script:
const MathLib = require("MathLib");
log(MathLib.add(2, 3));
\`\`\`

## Player Rig

\`\`\`js
player.walkSpeed = 6;       // hold Shift to switch to runSpeed
player.runSpeed  = 12;
player.jumpPower = 8;
player.health    = 100;
player.killY     = -50;     // dies if y drops below
player.kill();              // ragdolls then respawns
player.teleport(x, y, z);
player.heal(25);
\`\`\`

## Motors (holding stuff)

The avatar has motor slots: \`"rightHand" | "leftHand" | "back" | "head" | "torso"\`.

\`\`\`js
const gun = create({ primitiveType: "cube", scale: { x: 0.4, y: 0.2, z: 0.8 }, color: "#222" });
player.motors.attach("rightHand", gun, { x: 0, y: 0.1, z: 0.2 });
const removed = player.motors.detach("rightHand"); // returns the object back
const held    = player.motors.get("rightHand");
\`\`\`

## Camera (scriptable — make FPS, top-down, cinematic, anything)

\`\`\`js
camera.mode = "firstPerson";   // "thirdPerson" | "firstPerson" | "free" | "scripted"
camera.distance = 8;           // third person zoom
camera.minDistance = 2;
camera.maxDistance = 20;
camera.offset = { x: 0, y: 0.7, z: 0 };
camera.sensitivity = 1.2;
camera.lockYaw = false;
camera.lockPitch = false;
camera.fov = 70;

// Drive it manually:
camera.mode = "scripted";
runService.update.on(() => {
  camera.position = { x: player.position.x, y: 30, z: player.position.z };
  camera.lookAt   = player.position;
});
\`\`\`

## Death & Ragdoll

When health hits 0 or the player falls below \`player.killY\`, the avatar
ragdolls (limbs scatter under gravity) for ~1.6s, then respawns at
\`player.spawnPoint\`. Listen with \`world.onPlayerDied\` /
\`world.onPlayerSpawned\`.

## Create / Destroy

\`\`\`js
const box = create({
  primitiveType: "cube",
  position: { x: 0, y: 1, z: 0 },
  color: "#ff8844",
  anchored: false,
  canCollide: true,
  parent: someObject,
});
destroy(box); // cascades to children, disconnects all events
\`\`\`

## Custom Events (Emitter)

\`\`\`js
const e = new Emitter();
e.on((msg) => log(msg));
e.emit("hello");
const [data] = await e.wait();
\`\`\`

## Cross-script Calls (Callable)

\`\`\`js
const adder = new Callable();
adder.setHandler((a, b) => a + b);
adder.invoke(2, 3); // 5
\`\`\`

## Attributes

\`\`\`js
part.setAttribute("team", "red");
part.getAttribute("team");
part.getAttributes();
\`\`\`

## Tagging (Collection Service)

\`\`\`js
tags.add(part, "enemy");
tags.has(part, "enemy");
tags.get("enemy"); // RuntimeObject[]
tags.remove(part, "enemy");
\`\`\`

## Task Scheduler

\`\`\`js
await task.wait(1.5);
task.delay(2, () => log("later"));
task.spawn(function* () { yield task.wait(1); log("step"); });
\`\`\`

## RunService Phases

\`\`\`js
runService.input.on((dt, t) => {});
runService.animation.on((dt, t) => {});
runService.replication.on((dt, t) => {});
runService.physics.on((dt, t) => {});
runService.render.on((dt, t) => {});
runService.update.on((dt, t) => {});
\`\`\`

## Raycasting

\`\`\`js
const hit = raycast(player.position, { x: 0, y: -1, z: 0 }, 5);
if (hit) log("standing on", hit.object.name, "dist", hit.distance);
\`\`\`

## Networking (local stub today, real wire later)

\`\`\`js
network.server.on("buyItem", (p) => { /* validate, mutate */ });
network.client.send("buyItem", { id: "sword" });
network.server.broadcast("score", { player: "Bob", score: 100 });
network.client.on("score", (p) => log(p));
\`\`\`

## GUI

\`\`\`js
gui.text("hud", "Hello", { x: 16, y: 16, color: "#fff", anchor: "tl" });
gui.button("start", "Start", { x: 0, y: 100, anchor: "tc" }, (g) => g.log("clicked"));
gui.clear("hud");
\`\`\`

## Debug / Introspection

\`\`\`js
debug.getChildren(workspace);
debug.getDescendants(player);
debug.getFullName(part);
debug.getObjectsWithTag("enemy");
debug.getEventConnections(part);
\`\`\`

## Automatic Cleanup

All \`.on()\`, \`GetPropertyChangedSignal\`, and Emitter connections are
automatically disconnected when the owning object is destroyed.
`;
