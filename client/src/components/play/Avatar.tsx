import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Among Us–style character with neck, head, and articulated arms.
 *
 * Body: elongated capsule (crewmate bean) with a backpack.
 * Head: rounded helmet with a glass visor.
 * Neck: short cylinder connecting body and head.
 * Arms: simple cylinders attached to shoulders, swing during walk/run.
 *
 * All original animations (idle, walk, run, jump, fall, hold, ragdoll) work seamlessly.
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  // --- Materials (crewmate colors) ---
  const bodyColor = player.color;
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.05 }),
    [bodyColor]
  );
  const backpackMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.2 }),
    []
  );
  const visorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x88ccff, emissive: 0x2266aa, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.2 }),
    []
  );
  const visorFrameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xccccdd, metalness: 0.7, roughness: 0.3 }),
    []
  );
  const neckMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 }),
    [bodyColor]
  );
  const headMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35 }),
    [bodyColor]
  );
  const armMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 }),
    [bodyColor]
  );

  // --- Geometries ---
  // Body: stretched sphere (crewmate bean)
  const bodyGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.48, 32, 32);
    geo.scale(0.9, 1.2, 0.8);
    return geo;
  }, []);
  // Backpack: rounded box on the back
  const backpackGeo = useMemo(() => new RoundedBoxGeometry(0.5, 0.6, 0.25, 6, 0.08), []);
  // Neck: short cylinder
  const neckGeo = useMemo(() => new THREE.CylinderGeometry(0.22, 0.24, 0.12, 12), []);
  // Head: round helmet
  const headGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.38, 32, 32);
    geo.scale(0.95, 0.92, 0.9);
    return geo;
  }, []);
  // Visor: curved glass (half sphere)
  const visorGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.28, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.rotateX(Math.PI / 2);
    geo.rotateZ(0);
    return geo;
  }, []);
  // Visor frame
  const visorFrameGeo = useMemo(() => new THREE.TorusGeometry(0.28, 0.035, 16, 48), []);
  // Arms (simple cylinders)
  const armGeo = useMemo(() => new THREE.CylinderGeometry(0.13, 0.1, 0.52, 8), []);

  // --- Animation state (same logic as before) ---
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(1, horiz / Math.max(1, player.runSpeed || player.speed || 6));
  const animRaw = player.motors.animation || "idle";
  const anim = (() => {
    if (animRaw === "jump" || animRaw === "fall" || animRaw === "hold") return animRaw;
    if (animRaw === "ragdoll") return "ragdoll";
    if (player.onGround === false && player.velocity.y > 0.5) return "jump";
    if (player.onGround === false && player.velocity.y < -1) return "fall";
    if (horiz < 0.15) return "idle";
    if (horiz > (player.walkSpeed || 6) * 1.1) return "run";
    return animRaw === "idle" ? "walk" : animRaw;
  })();

  // Refs for articulated arms (body itself just rotates)
  const bodyRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null); // for head bob

  // Smoothing state (simplified: arm swings, body sway, head bob)
  const smooth = useRef({
    bodyRotY: 0,
    bodyRotZ: 0,
    bodyY: 0,
    leftArmRot: 0,
    rightArmRot: 0,
    headRotX: 0,
    headRotY: 0,
  });

  useFrame((_, delta) => {
    if (player.ragdoll) return;
    const t = runtime.time;
    const k = Math.min(1, delta * 14);

    let bodyY = 0;
    let bodyRotY = 0;
    let bodyRotZ = 0;
    let leftArm = 0;
    let rightArm = 0;
    let headX = 0;
    let headY = 0;

    if (anim === "jump") {
      // Arms up, body compressed
      leftArm = -1.8;
      rightArm = -1.8;
      bodyY = -0.1;
      headX = -0.2;
    } else if (anim === "fall") {
      leftArm = 0.6;
      rightArm = 0.6;
      bodyRotZ = Math.sin(t * 3) * 0.1;
      headX = 0.15;
    } else if (anim === "hold") {
      // Right arm forward, left relaxed
      rightArm = -1.2;
      leftArm = -0.2;
      bodyY = Math.sin(t * 1.6) * 0.02;
      bodyRotY = Math.sin(t * 1.3) * 0.03;
      if (horiz > 0.15) {
        const freq = horiz > (player.walkSpeed || 6) * 1.1 ? 11 : 7;
        const amp = horiz > (player.walkSpeed || 6) * 1.1 ? 0.9 : 0.5;
        const swing = Math.sin(t * freq) * amp * moveAmount;
        leftArm = swing * 0.8;
        rightArm = -swing * 0.8;
      }
    } else if (anim === "walk" || anim === "run") {
      const isRun = anim === "run";
      const freq = isRun ? 11 : 7;
      const armAmp = isRun ? 1.3 : 0.8;
      const motion = Math.max(0.35, moveAmount);
      const phase = t * freq;
      const armSwing = Math.sin(phase) * armAmp * motion;
      leftArm = armSwing;
      rightArm = -armSwing;

      bodyY = Math.abs(Math.sin(phase)) * (isRun ? 0.08 : 0.04) * motion;
      bodyRotY = Math.sin(phase) * 0.1 * motion;
      bodyRotZ = Math.sin(phase) * 0.05 * motion;
      headX = Math.sin(phase * 2) * 0.02;
      headY = Math.sin(phase) * 0.03;
    } else {
      // Idle: gentle breathing, slight arm sway
      const breath = Math.sin(t * 1.6) * 0.03;
      bodyY = breath * 0.5;
      bodyRotY = Math.sin(t * 0.9) * 0.04;
      leftArm = 0.1 + Math.sin(t * 1.2) * 0.08;
      rightArm = 0.1 - Math.sin(t * 1.2) * 0.08;
      headX = Math.sin(t * 1.1) * 0.02;
      headY = Math.sin(t * 0.7) * 0.01;
    }

    // Smooth all values
    const s = smooth.current;
    s.bodyY += (bodyY - s.bodyY) * k;
    s.bodyRotY += (bodyRotY - s.bodyRotY) * k;
    s.bodyRotZ += (bodyRotZ - s.bodyRotZ) * k;
    s.leftArmRot += (leftArm - s.leftArmRot) * k;
    s.rightArmRot += (rightArm - s.rightArmRot) * k;
    s.headRotX += (headX - s.headRotX) * k;
    s.headRotY += (headY - s.headRotY) * k;

    // Apply transforms
    if (bodyRef.current) {
      bodyRef.current.position.y = s.bodyY;
      bodyRef.current.rotation.y = s.bodyRotY;
      bodyRef.current.rotation.z = s.bodyRotZ;
    }
    if (leftArmRef.current) leftArmRef.current.rotation.x = s.leftArmRot;
    if (rightArmRef.current) rightArmRef.current.rotation.x = s.rightArmRot;
    if (headRef.current) {
      headRef.current.rotation.x = s.headRotX;
      headRef.current.rotation.y = s.headRotY;
    }
  });

  // --- Positioning & orientation ---
  const ragPos = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  const RIG_LIFT = 0.95; // lift so feet (bottom of body) touch ground

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        {ragPos ? (
          <RagdollCrewmate
            ragPos={ragPos}
            geos={{ bodyGeo, backpackGeo, neckGeo, headGeo, visorGeo, visorFrameGeo, armGeo }}
            mats={{ bodyMat, backpackMat, neckMat, headMat, visorMat, visorFrameMat, armMat }}
            lift={RIG_LIFT}
          />
        ) : (
          <group position={[0, RIG_LIFT, 0]}>
            {/* Main body group (supports idle sway and rotation) */}
            <group ref={bodyRef}>
              {/* Body (bean) */}
              <mesh geometry={bodyGeo} material={bodyMat} castShadow receiveShadow />
              {/* Backpack */}
              <mesh geometry={backpackGeo} material={backpackMat} position={[0, 0.1, -0.48]} castShadow />

              {/* Neck */}
              <mesh geometry={neckGeo} material={neckMat} position={[0, 0.62, 0]} castShadow />

              {/* Head with visor */}
              <group ref={headRef} position={[0, 0.78, 0]}>
                <mesh geometry={headGeo} material={headMat} castShadow />
                {/* Visor (glass) */}
                <mesh geometry={visorGeo} material={visorMat} position={[0, 0.02, 0.42]} castShadow />
                {/* Visor frame ring */}
                <mesh geometry={visorFrameGeo} material={visorFrameMat} position={[0, 0.02, 0.43]} rotation={[Math.PI / 2, 0, 0]} />
              </group>

              {/* Arms (attached to body sides) */}
              <group ref={leftArmRef} position={[-0.55, 0.25, 0]}>
                <mesh geometry={armGeo} material={armMat} position={[0, -0.28, 0]} castShadow />
              </group>
              <group ref={rightArmRef} position={[0.55, 0.25, 0]}>
                <mesh geometry={armGeo} material={armMat} position={[0, -0.28, 0]} castShadow />
              </group>
            </group>

            {/* Name tag */}
            <Html position={[0, 1.45, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
              <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
                {player.username}
              </div>
            </Html>
          </group>
        )}
      </group>
    </group>
  );
}

// --- Ragdoll version (simple scatter for crewmate parts) ---
function RagdollCrewmate({
  ragPos,
  geos,
  mats,
  lift,
}: {
  ragPos: Record<string, { x: number; y: number; z: number }>;
  geos: any;
  mats: any;
  lift: number;
}) {
  const at = (k: string, fb: [number, number, number]): [number, number, number] => {
    const p = ragPos[k];
    return p ? [p.x, p.y + lift, p.z] : [fb[0], fb[1] + lift, fb[2]];
  };
  return (
    <group>
      <mesh geometry={geos.bodyGeo} material={mats.bodyMat} position={at("torso", [0, 0, 0])} castShadow />
      <mesh geometry={geos.backpackGeo} material={mats.backpackMat} position={at("backpack", [0, 0.1, -0.48])} castShadow />
      <mesh geometry={geos.neckGeo} material={mats.neckMat} position={at("neck", [0, 0.62, 0])} castShadow />
      <mesh geometry={geos.headGeo} material={mats.headMat} position={at("head", [0, 0.78, 0])} castShadow />
      <mesh geometry={geos.visorGeo} material={mats.visorMat} position={at("visor", [0, 0.8, 0.42])} castShadow />
      <mesh geometry={geos.armGeo} material={mats.armMat} position={at("leftArm", [-0.55, 0.25, 0])} castShadow />
      <mesh geometry={geos.armGeo} material={mats.armMat} position={at("rightArm", [0.55, 0.25, 0])} castShadow />
    </group>
  );
}
