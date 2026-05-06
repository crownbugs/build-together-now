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
player.motors.animation = "hold"; // right arm forward holding stance

// Switch to first person with C, back to third with V.
keyboard.onPress("c", () => { camera.mode = "firstPerson"; });
keyboard.onPress("v", () => { camera.mode = "thirdPerson"; });

// React to death:
world.onPlayerDied(() => log("oof"));
world.onPlayerSpawned(() => log("hello again"));
`;

export const SCRIPTING_DOCS = `# Rebur Engine — Scripting Reference

The engine handles the clock (~60 fps), physics, collisions, rendering, input,
camera, networking and the player rig. **Your scripts handle game logic.**

Every script runs inside a sandbox where the entire \`game\` API is available
as bare globals: \`workspace\`, \`player\`, \`create\`, \`destroy\`, \`keyboard\`,
\`runService\`, \`raycast\`, \`network\`, \`tags\`, \`task\`, \`tween\`, \`gui\`,
\`Emitter\`, \`Callable\`, \`require\`, \`log\`, etc.

---

## 1. Containers (Roblox-style)

| Container | Purpose |
|---|---|
| \`workspace\` | Live, simulated 3D world. Anything visible/physical lives here. |
| \`lighting\` | Lights and atmosphere objects. |
| \`players\` | Per-player avatars + non-physical data. |
| \`serverScriptService\` | Server-authoritative scripts. |
| \`starterPlayer\` | Scripts/objects copied to each client (for LocalScripts). |
| \`replicatedStorage\` | Shared templates + ModuleScripts. |

Each is a \`Record<name, RuntimeObject>\` — index by object name:

\`\`\`js
const door = workspace.Door;
const swordTemplate = replicatedStorage.SwordTemplate;
\`\`\`

\`find(name)\` searches everywhere; \`debug.getChildren(obj)\` walks the tree.

---

## 2. Script Types

| Type | Behavior |
|---|---|
| **Script** | Default. Top-level code runs once at start. Register events for everything that fires later. |
| **LocalScript** | Same as Script in single-player. With networking enabled, runs on the client. |
| **ModuleScript** | Does NOT auto-run. Other scripts pull it in with \`require("Name")\` and use the \`exports\` it sets. |

\`\`\`js
// ModuleScript "MathLib" in ReplicatedStorage:
exports.add = (a, b) => a + b;

// Any other script:
const MathLib = require("MathLib");
log(MathLib.add(2, 3));
\`\`\`

---

## 3. Player Rig

The avatar is a 15-bone humanoid (head, neck, chest, pelvis, upper/lower arms,
hands, upper/lower legs, feet). It plays built-in animations automatically based
on movement, but scripts can override.

\`\`\`js
player.username       // string
player.color          // hex color of the shirt material
player.position       // { x, y, z } — feet position in world
player.rotation       // { x, y, z } — y is facing yaw (radians)
player.velocity       // { x, y, z } — current velocity
player.onGround       // bool — true when standing on something
player.up             // { x, y, z } — world up axis (gravity-aware)
player.size           // 1 by default; scale of the entire rig
player.spawnPoint     // { x, y, z } — where respawn lands

player.health = 100;
player.maxHealth = 100;
player.walkSpeed = 6;     // hold Shift to switch to runSpeed
player.runSpeed  = 12;
player.jumpPower = 8;
player.killY     = -50;   // dies if y drops below
player.autoFaceMovement = true;

player.takeDamage(10);
player.heal(25);
player.kill();             // ragdolls then respawns
player.teleport(x, y, z);
player.respawn();
\`\`\`

---

## 4. Animations

Set the active animation via \`player.motors.animation\`. Built-ins:

| Name | Use |
|---|---|
| \`"idle"\` | Breathing, gentle sway, head bob. |
| \`"walk"\` | Heel/toe gait, contralateral arm swing, hip sway. Auto-scales with speed. |
| \`"run"\` | Fast cycle, deep knee/elbow bend, vertical bob, forward lean. |
| \`"jump"\` | Arms up, legs tucked. Auto-played while ascending. |
| \`"fall"\` | Arms out, legs spread. Auto-played while falling fast. |
| \`"hold"\` | Right arm forward in a holding stance. Pairs perfectly with \`motors.attach("rightHand", ...)\`. Walking/running while in \`hold\` overlays the leg gait so the upper body keeps holding the item. |
| \`"ragdoll"\` | Limbs detach and tumble (set automatically on death). |

The avatar auto-promotes \`walk → run\` based on velocity, and \`idle\`/\`jump\`/\`fall\` are
chosen automatically if you leave \`animation\` at \`"idle"\`. Setting \`"hold"\` is sticky
— it persists through walking/running so tools stay in hand.

---

## 5. Motors (holding things in joint slots)

The avatar has motor slots that pin a RuntimeObject to a bone every frame:

\`\`\`ts
type MotorSlot = "rightHand" | "leftHand" | "back" | "head" | "torso";
\`\`\`

\`\`\`js
const gun = create({
  primitiveType: "cube",
  scale: { x: 0.4, y: 0.2, z: 0.8 },
  color: "#222",
});
player.motors.attach("rightHand", gun, { x: 0, y: 0.1, z: 0.2 }, { x: 0, y: 0, z: 0 });
player.motors.animation = "hold";

const removed = player.motors.detach("rightHand"); // un-pin and re-enable collision
const held    = player.motors.get("rightHand");    // what's currently in this slot
\`\`\`

Attaching auto-disables \`anchored\` and \`canCollide\` on the held object.
Detaching restores collision.

---

## 6. Camera (scriptable: FPS, top-down, cinematic, anything)

\`\`\`js
camera.mode = "firstPerson";   // "thirdPerson" | "firstPerson" | "free" | "scripted"
camera.distance = 8;           // third-person zoom
camera.minDistance = 2;
camera.maxDistance = 20;
camera.offset = { x: 0, y: 0.7, z: 0 };  // local lookAt offset on the player
camera.sensitivity = 1.2;
camera.lockYaw = false;
camera.lockPitch = false;
camera.fov = 70;

// Scripted control — drive position + lookAt yourself:
camera.mode = "scripted";
runService.update.on(() => {
  camera.position = { x: player.position.x, y: 30, z: player.position.z };
  camera.lookAt   = player.position;
});
\`\`\`

---

## 7. Death & Ragdoll

When \`health <= 0\` or \`y < player.killY\`, the avatar ragdolls: all 15 limbs
scatter under gravity for ~1.6s, then respawns at \`player.spawnPoint\`.
Listen with \`world.onPlayerDied\` / \`world.onPlayerSpawned\`.

---

## 8. Creating & Destroying Objects

\`\`\`js
const box = create({
  name: "MyBox",                  // optional
  primitiveType: "cube",          // "cube" | "sphere" | "cylinder" | "plane"
  container: "Workspace",         // optional, defaults to Workspace
  position: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale:    { x: 1, y: 1, z: 1 },
  color: "#ff8844",
  anchored: false,
  canCollide: true,
  parent: someObject,             // optional parent in hierarchy
  gravity: { strength: 9.81, radius: 30 },  // optional local gravity field
});

destroy(box);          // cascades to children and disconnects all events
destroy("MyBox");      // by name
spawn("Template");     // clone a template object by name
\`\`\`

### RuntimeObject properties (mutable)

\`position, rotation, scale, color, visible, anchored, canCollide, transparency,
mass, friction, velocity, gravity, autoRotateY, autoBob, autoFollow, autoSpin,
autoMove, isPickup, pickupName, pickupData\`

### Per-object behaviors

\`\`\`js
box.autoRotateY = 2;                                    // rad/sec around y
box.autoBob     = { amplitude: 0.3, speed: 2 };         // sine bob on y
box.autoSpin    = { x: 0.5, y: 1, z: 0 };               // continuous spin
box.autoMove    = { direction: { x: 1, y: 0, z: 0 }, speed: 3 };
box.autoFollow  = { target: player, speed: 4, offset: { x: 0, y: 2, z: 0 } };
\`\`\`

### Object events

\`\`\`js
box.on("touched",   (other) => log("touched by", other.name));
box.on("untouched", (other) => {});
box.on("clicked",   () => {});
box.on("changed",   (key, newVal, oldVal) => {});
box.on("destroyed", () => {});

const sig = box.GetPropertyChangedSignal("position");
sig.on(() => log("moved"));
\`\`\`

### Hierarchy

\`\`\`js
box.setParent(workspace.Container);
box.parentId;
box.children;
box.findFirstChild("Sword");
debug.getChildren(box);
debug.getDescendants(box);
debug.getFullName(box);   // "Workspace.Container.MyBox"
\`\`\`

### Attributes (arbitrary metadata)

\`\`\`js
box.setAttribute("team", "red");
box.getAttribute("team");
box.getAttributes();
\`\`\`

---

## 9. Input

\`\`\`js
keyboard.onPress("space", () => log("jumped"));
keyboard.onRelease("e", () => {});
keyboard.isDown("shift");

mouse.onClick((obj) => {
  if (obj) log("clicked", obj.name);
  else log("missed");
});

input.held("w");        // raw key state
input.pressed("space"); // edge: pressed this frame
input.released("space");
input.moveX; input.moveZ; input.jump;  // resolved movement axes
\`\`\`

---

## 10. RunService (the heartbeat)

Six ordered phases per frame. Subscribe via \`.on(callback)\`:

\`\`\`js
runService.input.on((dt, t)       => {});  // 1. read input
runService.animation.on((dt, t)   => {});  // 2. animation
runService.replication.on((dt, t) => {});  // 3. network sync
runService.physics.on((dt, t)     => {});  // 4. velocities/collisions
runService.render.on((dt, t)      => {});  // 5. camera/world render
runService.update.on((dt, t)      => {});  // 6. gameplay tick (most scripts)
\`\`\`

Convenience helpers:

\`\`\`js
onUpdate((dt, t) => {});
onKey("space", () => {});
every(2, () => log("every 2s"));
after(5, () => log("once after 5s"));
await wait(1.5);
\`\`\`

---

## 11. Physics & Raycasting

\`\`\`js
physics.gravity = 9.81;   // global gravity
physics.airDrag = 0;

const hit = raycast(player.position, { x: 0, y: -1, z: 0 }, 5, {
  ignore: [player /* RuntimeObject[] */],
});
if (hit) log("hit", hit.object.name, "at distance", hit.distance, hit.point);
\`\`\`

Set per-object gravity fields for planet-style worlds:

\`\`\`js
const planet = create({
  primitiveType: "sphere",
  scale: { x: 20, y: 20, z: 20 },
  gravity: { strength: 9.81, radius: 40 },
});
\`\`\`

---

## 12. Tweens

\`\`\`js
const cancel = tween(box.position, { x: 10, y: 5, z: 0 }, 1.5, "easeOutCubic", () => log("done"));
// cancel() to stop early

// Available easings:
// "linear" | "easeIn" | "easeOut" | "easeInOut"
// "easeInCubic" | "easeOutCubic" | "easeInOutCubic"
// "easeInQuad" | "easeOutQuad" | "easeInOutQuad"
// "easeInBack" | "easeOutBack" | "easeOutBounce"
\`\`\`

---

## 13. Custom Events (Emitter)

\`\`\`js
const e = new Emitter();
const off = e.on((msg) => log(msg));
e.emit("hello");
const [data] = await e.wait();
off();
\`\`\`

## 14. Cross-script Calls (Callable)

\`\`\`js
const adder = new Callable();
adder.setHandler((a, b) => a + b);
const sum = adder.invoke(2, 3); // 5
\`\`\`

---

## 15. Tagging (CollectionService)

\`\`\`js
tags.add(part, "enemy");
tags.has(part, "enemy");          // bool
tags.get("enemy");                // RuntimeObject[]
tags.all(part);                   // string[] of all tags on this object
tags.remove(part, "enemy");
\`\`\`

---

## 16. Task Scheduler

\`\`\`js
await task.wait(1.5);
const cancel = task.delay(2, () => log("later"));
task.spawn(function* () {
  yield task.wait(1);
  log("step 1");
  yield task.wait(1);
  log("step 2");
});
\`\`\`

---

## 17. Networking (local stub today, real wire later)

\`\`\`js
network.server.on("buyItem",   (payload) => { /* validate, mutate */ });
network.client.send("buyItem", { id: "sword" });
network.server.broadcast("score", { player: "Bob", score: 100 });
network.client.on("score", (payload) => log(payload));
\`\`\`

---

## 18. State (shared key/value store)

\`\`\`js
state.set("score", "100");
state.get("score");          // "100"
state.keys();                // string[]
state.on("score", (val, prev) => log("score changed", prev, "→", val));
\`\`\`

---

## 19. GUI

\`\`\`js
// anchors: "tl" | "tc" | "tr" | "cl" | "cc" | "cr" | "bl" | "bc" | "br"
gui.text("hud", "Hello", { x: 16, y: 16, color: "#fff", anchor: "tl", size: 18 });
gui.button("start", "Start", { x: 0, y: 100, anchor: "tc", bg: "#0a84ff" }, (g) => g.log("clicked"));
gui.clear("hud");   // clear one
gui.clear();        // clear all
\`\`\`

---

## 20. Debug / Introspection

\`\`\`js
debug.getChildren(obj);
debug.getDescendants(obj);
debug.getFullName(obj);
debug.getPropertyNames(obj);
debug.getObjectsWithTag("enemy");
debug.getEventConnections(obj);   // count of active listeners on this object
\`\`\`

---

## 21. Math & Helpers

\`\`\`js
random(0, 10);          // float in [0,10)
randInt(1, 6);          // integer in [1,6]
pick(["a","b","c"]);    // random element
dist(a, b);             // Euclidean distance, accepts {x,y,z} or {position:{x,y,z}}
lerp(0, 10, 0.5);       // 5
clamp(value, 0, 1);
log("anything", obj);   // appears in the in-game log + onLog hook
now();                  // engine seconds (same as game.time)
\`\`\`

---

## 22. World Events

\`\`\`js
world.onObjectAdded((obj)   => log("added",  obj.name));
world.onObjectRemoved((obj) => log("removed", obj.name));
world.onPlayerSpawned((p)   => log("spawn",  p.username));
world.onPlayerDied((p)      => log("died",   p.username));
\`\`\`

---

## 23. Weak References & Classes

\`\`\`js
const ref = weakRef(someObj);
const stillThere = ref.get();   // null if collected/destroyed
const tbl = new WeakTable();    // weak-keyed map

const Enemy = new Class("Enemy", {
  init(self, hp) { self.hp = hp; },
  hurt(self, dmg) { self.hp -= dmg; },
});
const e = Enemy.new(100);
e.hurt(10);
\`\`\`

---

## 24. Automatic Cleanup

All \`.on()\` connections, \`GetPropertyChangedSignal\` subscriptions, and Emitter
listeners attached to a RuntimeObject are **automatically disconnected** when
that object is destroyed. Tweens targeting destroyed objects auto-cancel.
Timers are tied to the runtime lifecycle.

You usually don't need to call disconnect handlers manually — but they ARE
returned for explicit cleanup if you want it.
`;
