import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Terminal, Heart } from "lucide-react";
import {
  GameRuntime,
  type RuntimeObject,
  type RuntimePlayer,
} from "@/lib/gameRuntime";
import type { GameObject, Script } from "@shared/schema";
import SVGScene from "@/components/SVGScene";
import { isWebGLAvailable } from "@/lib/webgl";

class PlayCanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.error("[PlayCanvas]", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function Primitive({ obj, runtime }: { obj: RuntimeObject; runtime: GameRuntime }) {
  if (!obj.visible) return null;
  const opacity = 1 - (obj.transparency ?? 0);
  if (opacity <= 0.01) return null;
  const isTransparent = (obj.transparency ?? 0) > 0;
  const position: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z];
  const rotation: [number, number, number] = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
  const scale: [number, number, number] = [obj.scale.x, obj.scale.y, obj.scale.z];

  if (obj.type === "light") {
    return (
      <group position={position}>
        <pointLight color={obj.color} intensity={1.2} distance={20} />
      </group>
    );
  }

  let geometry: JSX.Element;
  switch (obj.primitiveType) {
    case "sphere":
      geometry = <sphereGeometry args={[0.5, 32, 32]} />;
      break;
    case "cylinder":
      geometry = <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
      break;
    case "plane":
      geometry = <planeGeometry args={[1, 1]} />;
      break;
    case "cube":
    default:
      geometry = <boxGeometry args={[1, 1, 1]} />;
  }

  // Forward 3D viewport clicks to the runtime so user scripts that registered
  // `obj.on("clicked", ...)` or `mouse.onClick(...)` fire. stopPropagation
  // ensures the deepest hit wins — only that mesh's id is delivered.
  const handleClick = (e: any) => {
    e.stopPropagation();
    runtime.emitClick(obj.id);
  };

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow
      receiveShadow
      onClick={handleClick}
    >
      {geometry}
      <meshStandardMaterial color={obj.color} transparent={isTransparent} opacity={opacity} />
    </mesh>
  );
}

function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  // Subtle arm/leg swing while moving.
  const moveAmount = Math.min(
    1,
    Math.hypot(player.velocity.x, player.velocity.z) / Math.max(1, player.speed)
  );
  const swing = Math.sin(runtime.time * 9) * 0.6 * moveAmount;
  const size = player.size || 1;

  // Build a quaternion that rotates world-up (0,1,0) onto the player's current up vector.
  // This makes the avatar's feet point toward the dominant gravity attractor (or world-down by default).
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  return (
    <group
      position={[player.position.x, player.position.y, player.position.z]}
      quaternion={orientQuat}
    >
    <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
      {/* Torso */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.7, 8, 16]} />
        <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* Belt accent */}
      <mesh position={[0, -0.18, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
        <meshStandardMaterial color="#1f2733" roughness={0.7} />
      </mesh>

      {/* Arms */}
      <group position={[0.42, 0.18, 0]} rotation={[swing, 0, 0.05]}>
        <mesh position={[0, -0.25, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
          <meshStandardMaterial color={player.color} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.55, 0]} castShadow>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={"#7a3e19"} roughness={0.7} />
        </mesh>
      </group>
      <group position={[-0.42, 0.18, 0]} rotation={[-swing, 0, -0.05]}>
        <mesh position={[0, -0.25, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
          <meshStandardMaterial color={player.color} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.55, 0]} castShadow>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={"#7a3e19"} roughness={0.7} />
        </mesh>
      </group>

      {/* Legs */}
      <group position={[0.18, -0.45, 0]} rotation={[-swing, 0, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
          <meshStandardMaterial color="#2a3142" roughness={0.7} />
        </mesh>
      </group>
      <group position={[-0.18, -0.45, 0]} rotation={[swing, 0, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
          <meshStandardMaterial color="#2a3142" roughness={0.7} />
        </mesh>
      </group>

      {/* Head */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.3, 24, 24]} />
        <meshStandardMaterial color={"#7a3e19"} roughness={0.6} />
      </mesh>

      {/* Hair cap */}
      <mesh position={[0, 0.86, -0.02]} castShadow>
        <sphereGeometry args={[0.31, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#000000" roughness={0.85} />
      </mesh>

      {/* Eyes */}
      <mesh position={[0.1, 0.72, 0.27]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[-0.1, 0.72, 0.27]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color="#0a0a0a" />
      </mesh>

      {/* Smile */}
      <mesh position={[0, 0.6, 0.28]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.07, 0.012, 8, 16, Math.PI]} />
        <meshBasicMaterial color="#252525" />
      </mesh>

      {/* Username tag */}
      <Html position={[0, 1.25, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
        <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
          {player.username}
        </div>
      </Html>
    </group>
    </group>
  );
}

/** HUD overlay that mirrors runtime.gui — text labels and clickable buttons added from scripts. */
function GuiOverlay({ runtime, version: _v }: { runtime: GameRuntime; version: number }) {
  const items = Array.from(runtime.gui.values());
  if (items.length === 0) return null;
  return (
    <div className="absolute inset-0 z-20 pointer-events-none" data-testid="gui-overlay">
      {items.map((el) => {
        const style: React.CSSProperties = {
          position: "absolute",
          color: el.color,
          fontSize: el.size,
          background: el.bg,
          padding: el.kind === "button" ? "8px 14px" : el.bg ? "4px 8px" : 0,
          borderRadius: 6,
          whiteSpace: "nowrap",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 600,
          textShadow: el.bg ? undefined : "0 1px 2px rgba(0,0,0,0.7)",
          lineHeight: 1.2,
        };
        const transforms: string[] = [];
        const v = el.anchor[0];
        const h = el.anchor[1];
        if (v === "t") style.top = el.y;
        else if (v === "b") style.bottom = el.y;
        else {
          style.top = "50%";
          transforms.push("translateY(-50%)");
        }
        if (h === "l") style.left = el.x;
        else if (h === "r") style.right = el.x;
        else {
          style.left = "50%";
          transforms.push("translateX(-50%)");
        }
        if (transforms.length) style.transform = transforms.join(" ");

        if (el.kind === "button") {
          return (
            <button
              key={el.id}
              style={{
                ...style,
                cursor: "pointer",
                pointerEvents: "auto",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
              onClick={() => runtime.invokeGuiClick(el.id)}
              data-testid={`gui-button-${el.id}`}
            >
              {el.text}
            </button>
          );
        }
        return (
          <div key={el.id} style={style} data-testid={`gui-text-${el.id}`}>
            {el.text}
          </div>
        );
      })}
    </div>
  );
}

function ChaseCameraRig({ runtime }: { runtime: GameRuntime }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  // Track the player's up vector across frames so we can rotate the camera offset
  // by the *change* in up. This is what keeps the camera-to-player relationship
  // looking identical no matter which way "up" is — when the player walks around
  // a spherical planet, the camera tumbles right along with them instead of
  // floating off into world-up space.
  //
  // We deliberately do NOT track player yaw here. Following yaw causes a
  // feedback loop (camera-relative movement turns the player, which turns the
  // camera, which turns the player...). Yaw is left to the user's mouse/orbit.
  const lastPlayerPos = useRef(new THREE.Vector3());
  const lastUp = useRef(new THREE.Vector3(0, 1, 0));
  const initialized = useRef(false);

  useFrame(() => {
    const p = runtime.player;
    const pos = new THREE.Vector3(p.position.x, p.position.y + 0.7, p.position.z);
    const up = new THREE.Vector3(p.up.x, p.up.y, p.up.z).normalize();

    if (!initialized.current) {
      lastPlayerPos.current.copy(pos);
      lastUp.current.copy(up);
      initialized.current = true;
    }

    // 1) Follow translation: shift camera by the player's positional delta.
    const delta = pos.clone().sub(lastPlayerPos.current);
    camera.position.add(delta);
    lastPlayerPos.current.copy(pos);

    // 2) Follow up rotation: rotate the camera's offset (around the player) by
    //    the quaternion that takes the previous up to the current up. This is
    //    what stops the world from "rolling out from under" the camera when
    //    gravity changes orientation. We snap on whole-frame deltas (no slerp
    //    on the offset itself) so the camera stays glued to the player; the
    //    only smoothing is on camera.up below, which keeps the horizon level.
    if (!up.equals(lastUp.current)) {
      const q = new THREE.Quaternion().setFromUnitVectors(lastUp.current, up);
      const offset = camera.position.clone().sub(pos).applyQuaternion(q);
      camera.position.copy(pos).add(offset);
      lastUp.current.copy(up);
    }

    // 3) Smoothly align camera.up with the player's up so the horizon stays put
    //    visually. Lerp+normalize is fine for small per-frame steps.
    camera.up.lerp(up, 0.15).normalize();

    if (controlsRef.current) {
      controlsRef.current.target.lerp(pos, 0.25);
      controlsRef.current.update();
    }

    // Write the camera's forward direction to the runtime so movement is properly camera-relative.
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    runtime.cameraForward.x = fwd.x;
    runtime.cameraForward.y = fwd.y;
    runtime.cameraForward.z = fwd.z;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      enablePan={false}
      minDistance={3}
      maxDistance={10}
    />
  );
}

// (CameraReader removed — ChaseCameraRig now writes runtime.cameraForward directly.)

function VirtualJoystick({
  onChange,
  side,
}: {
  onChange: (x: number, y: number) => void;
  side: "left" | "right";
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);
  const center = useRef({ x: 0, y: 0 });

  const start = (e: React.PointerEvent) => {
    const rect = baseRef.current!.getBoundingClientRect();
    center.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    activeId.current = e.pointerId;
    (e.target as Element).setPointerCapture(e.pointerId);
    move(e);
  };

  const move = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return;
    const dx = e.clientX - center.current.x;
    const dy = e.clientY - center.current.y;
    const max = 50;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampX = (dist > max ? (dx / dist) * max : dx);
    const clampY = (dist > max ? (dy / dist) * max : dy);
    setThumb({ x: clampX, y: clampY });
    onChange(clampX / max, clampY / max);
  };

  const end = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return;
    activeId.current = null;
    setThumb({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute bottom-6 ${side === "left" ? "left-6" : "right-6"} w-28 h-28 rounded-full bg-black/30 border border-white/20 backdrop-blur-sm touch-none select-none z-20`}
      data-testid={`joystick-${side}`}
    >
      <div
        className="absolute w-12 h-12 rounded-full bg-white/70 border border-white/80"
        style={{
          left: `calc(50% - 1.5rem + ${thumb.x}px)`,
          top: `calc(50% - 1.5rem + ${thumb.y}px)`,
        }}
      />
    </div>
  );
}

export default function PlayMode({
  objects,
  scripts,
  username,
  onExit,
}: {
  objects: GameObject[];
  scripts: Script[];
  username: string;
  onExit: () => void;
}) {
  const runtime = useMemo(
    () => new GameRuntime(objects, scripts, username, "#3b82f6"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  // Only Workspace + Lighting render in the live world; service containers
  // (ReplicatedStorage, ServerScriptService, ...) hold templates and scripts.
  const renderableObjects = useMemo(
    () => objects.filter((o) => {
      const c = o.container ?? "Workspace";
      return c === "Workspace" || c === "Lighting";
    }),
    [objects]
  );
  const [tick, setTick] = useState(0);
  const [showConsole, setShowConsole] = useState(false);
  const [isMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  );
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

  // Keyboard input
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      runtime.input.keys[e.key.toLowerCase()] = true;
      if (e.code === "Space") {
        runtime.input.jump = true;
        e.preventDefault();
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      computeMove();
    };
    const onUp = (e: KeyboardEvent) => {
      runtime.input.keys[e.key.toLowerCase()] = false;
      computeMove();
    };
    const computeMove = () => {
      const k = runtime.input.keys;
      const x = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0);
      const z = (k["s"] || k["arrowdown"] ? 1 : 0) - (k["w"] || k["arrowup"] ? 1 : 0);
      runtime.input.moveX = x;
      runtime.input.moveZ = z;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [runtime]);

  // Start scripts and run game loop independently of the Canvas — so logic still
  // executes even if WebGL fails. The Canvas just renders the current state.
  useEffect(() => {
    runtime.start();
    let raf = 0;
    let last = performance.now();
    const tickFn = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      runtime.step(dt);
      setTick((t) => (t + 1) % 1000000);
      raf = requestAnimationFrame(tickFn);
    };
    raf = requestAnimationFrame(tickFn);
    return () => {
      cancelAnimationFrame(raf);
      runtime.stop();
    };
  }, [runtime]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0e1116]" data-testid="play-mode-root">
      {webglAvailable ? (
        <PlayCanvasErrorBoundary
          fallback={
            <SVGScene objects={renderableObjects} runtime={runtime} cameraPosition={[0, 4, 8]} />
          }
        >
          <Canvas
            shadows
            camera={{ position: [0, 4, 8], fov: 60 }}
            onPointerMissed={() => runtime.emitClick(null)}
          >
          <color attach="background" args={["#1a1d24"]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 14, 6]} intensity={0.9} castShadow shadow-mapSize={[2048, 2048]} />
          <hemisphereLight args={["#88aaff", "#332211", 0.4]} />

          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#3a4252" />
          </mesh>
          <Grid
            args={[80, 80]}
            position={[0, 0.01, 0]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#4a5160"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#6a7384"
            fadeDistance={60}
            infiniteGrid
          />

          {runtime.objectList.map((o) => (
            <Primitive key={o.id} obj={o} runtime={runtime} />
          ))}

          <Avatar player={runtime.player} runtime={runtime} />
          <ChaseCameraRig runtime={runtime} />
        </Canvas>
        </PlayCanvasErrorBoundary>
      ) : (
        <>
          <SVGScene objects={renderableObjects} runtime={runtime} cameraPosition={[0, 4, 8]} />
          <div className="absolute top-12 left-3 px-2 py-1 rounded-md bg-black/60 text-white/80 text-[10px] uppercase tracking-wide pointer-events-none z-10" data-testid="badge-svg-fallback-play">
            SVG fallback (no WebGL)
          </div>
        </>
      )}

      {/* HUD */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10 pointer-events-none">
        <div className="px-3 py-1.5 rounded-md bg-black/50 backdrop-blur text-white text-xs font-medium pointer-events-auto">
          {username} · Playing
        </div>
        <div className="flex items-center gap-2 pointer-events-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowConsole((v) => !v)}
            data-testid="button-toggle-console"
          >
            <Terminal className="w-4 h-4" />
            <span className="ml-1 hidden sm:inline">Console</span>
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onExit(runtime.logs.slice())} data-testid="button-stop-play">
            <X className="w-4 h-4" />
            <span className="ml-1">Stop</span>
          </Button>
        </div>
      </div>

      {/* Health bar — appears as soon as the player isn't at full health. */}
      {runtime.player.health < runtime.player.maxHealth && (
        <div
          className="absolute top-12 left-3 z-10 pointer-events-none flex items-center gap-2 px-2 py-1 rounded-md bg-black/55 backdrop-blur"
          data-testid="hud-health"
        >
          <Heart className="w-3.5 h-3.5 text-red-400" />
          <div className="w-32 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-[width] duration-150"
              style={{
                width: `${Math.max(0, (runtime.player.health / runtime.player.maxHealth) * 100)}%`,
              }}
            />
          </div>
          <span className="text-[11px] text-white/80 tabular-nums">
            {Math.round(runtime.player.health)}/{runtime.player.maxHealth}
          </span>
        </div>
      )}

      {/* Script-driven HUD (game.gui.text / game.gui.button) */}
      <GuiOverlay runtime={runtime} version={runtime.guiVersion} />

      {/* Help */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md bg-black/40 backdrop-blur text-white/80 text-xs z-10 pointer-events-none hidden md:block">
        WASD to move · Space to jump · Drag to look
      </div>

      {/* Mobile controls */}
      {isMobile && (
        <>
          <VirtualJoystick
            side="left"
            onChange={(x, y) => {
              runtime.input.moveX = x;
              runtime.input.moveZ = y;
            }}
          />
          <button
            onPointerDown={() => {
              runtime.input.jump = true;
            }}
            className="absolute bottom-12 right-12 w-16 h-16 rounded-full bg-primary/80 text-primary-foreground text-sm font-bold border border-primary-border z-20 active:scale-95"
            data-testid="button-jump"
          >
            JUMP
          </button>
        </>
      )}

      {/* Console */}
      {showConsole && (
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-black/80 backdrop-blur border-t border-white/10 z-30 flex flex-col">
          <div className="flex items-center justify-between px-3 h-7 border-b border-white/10">
            <span className="text-xs text-white/70 uppercase tracking-wide">Console ({runtime.logs.length})</span>
            <button onClick={() => setShowConsole(false)} className="text-white/70 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ScrollArea className="flex-1 p-2">
            {runtime.logs.length === 0 ? (
              <div className="text-xs text-white/40 italic px-1">No log output yet. Use log("...") in your scripts.</div>
            ) : (
              <div className="font-mono text-xs text-green-300 space-y-0.5">
                {runtime.logs.map((line, i) => (
                  <div key={i} data-testid={`console-line-${i}`}>{line}</div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
