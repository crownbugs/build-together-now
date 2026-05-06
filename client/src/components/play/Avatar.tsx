import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Rebur Engine character rig.
 *
 * 15 bones organized as a proper joint hierarchy with elbows + knees:
 *   torso
 *     neck → head
 *     leftUpperArm → leftLowerArm → leftHand
 *     rightUpperArm → rightLowerArm → rightHand
 *     leftUpperLeg → leftLowerLeg → leftFoot
 *     rightUpperLeg → rightLowerLeg → rightFoot
 *
 * Built-in animations driven by `player.motors.animation`:
 *   idle  – subtle breathing + arm sway
 *   walk  – moderate limb swing, soft knee/elbow bend
 *   run   – fast, exaggerated swing, deeper bends, arm pump
 *   jump  – arms up, legs tucked
 *   fall  – arms out, legs spread
 *   ragdoll – limbs detach and tumble (positions driven by core)
 *
 * Scripts can also drive limbs manually via `player.motors.attach(slot, obj)`.
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  // --- Materials (warm, simple, slightly stylized) ---
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xf2c79b, roughness: 0.7, metalness: 0 }),
    []
  );
  const shirtMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.55, metalness: 0.04 }),
    [player.color]
  );
  const pantsMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.75 }),
    []
  );
  const shoeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x1a1d26, roughness: 0.5 }),
    []
  );

  // --- Geometries (cached) ---
  const torsoGeo = useMemo(() => new RoundedBoxGeometry(0.95, 1.1, 0.55, 6, 0.12), []);
  const neckGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.18, 0.16, 16), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.32, 24, 20), []);
  const upperArmGeo = useMemo(() => new RoundedBoxGeometry(0.26, 0.55, 0.28, 4, 0.1), []);
  const lowerArmGeo = useMemo(() => new RoundedBoxGeometry(0.22, 0.5, 0.24, 4, 0.09), []);
  const handGeo = useMemo(() => new RoundedBoxGeometry(0.22, 0.22, 0.22, 4, 0.08), []);
  const upperLegGeo = useMemo(() => new RoundedBoxGeometry(0.32, 0.6, 0.32, 4, 0.1), []);
  const lowerLegGeo = useMemo(() => new RoundedBoxGeometry(0.28, 0.55, 0.28, 4, 0.09), []);
  const footGeo = useMemo(() => new RoundedBoxGeometry(0.3, 0.18, 0.45, 4, 0.08), []);

  // --- Animation state ---
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(1, horiz / Math.max(1, player.runSpeed || player.speed || 6));
  const anim = player.motors.animation || "idle";

  // Refs to joint groups so we can animate per-frame without re-rendering
  const torsoRef = useRef<THREE.Group>(null);
  const neckRef = useRef<THREE.Group>(null);
  const lUpArmRef = useRef<THREE.Group>(null);
  const lLoArmRef = useRef<THREE.Group>(null);
  const rUpArmRef = useRef<THREE.Group>(null);
  const rLoArmRef = useRef<THREE.Group>(null);
  const lUpLegRef = useRef<THREE.Group>(null);
  const lLoLegRef = useRef<THREE.Group>(null);
  const rUpLegRef = useRef<THREE.Group>(null);
  const rLoLegRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (player.ragdoll) return;
    const t = runtime.time;

    // Animation parameter tables.
    // amp  = swing amplitude (radians) for upper limbs
    // freq = oscillation rate
    // bend = elbow/knee flex baseline (radians)
    let amp = 0, freq = 0, bend = 0.05, armBase = 0.08, breathe = 0.03;

    switch (anim) {
      case "run":
        amp = 1.05; freq = 11; bend = 0.55; armBase = 0; breathe = 0.05;
        break;
      case "walk":
        amp = 0.6; freq = 7; bend = 0.25; armBase = 0.05; breathe = 0.04;
        break;
      case "jump":
        // Arms up, legs tucked (static pose)
        if (lUpArmRef.current) lUpArmRef.current.rotation.set(-2.2, 0, 0.1);
        if (rUpArmRef.current) rUpArmRef.current.rotation.set(-2.2, 0, -0.1);
        if (lLoArmRef.current) lLoArmRef.current.rotation.set(0, 0, 0);
        if (rLoArmRef.current) rLoArmRef.current.rotation.set(0, 0, 0);
        if (lUpLegRef.current) lUpLegRef.current.rotation.set(-0.6, 0, 0);
        if (rUpLegRef.current) rUpLegRef.current.rotation.set(-0.6, 0, 0);
        if (lLoLegRef.current) lLoLegRef.current.rotation.set(0.9, 0, 0);
        if (rLoLegRef.current) rLoLegRef.current.rotation.set(0.9, 0, 0);
        if (torsoRef.current) torsoRef.current.position.y = 0;
        if (neckRef.current) neckRef.current.rotation.x = -0.05;
        return;
      case "fall":
        // Arms out, legs spread
        if (lUpArmRef.current) lUpArmRef.current.rotation.set(-0.4, 0, 1.1);
        if (rUpArmRef.current) rUpArmRef.current.rotation.set(-0.4, 0, -1.1);
        if (lLoArmRef.current) lLoArmRef.current.rotation.set(0.3, 0, 0);
        if (rLoArmRef.current) rLoArmRef.current.rotation.set(0.3, 0, 0);
        if (lUpLegRef.current) lUpLegRef.current.rotation.set(0.2, 0, -0.25);
        if (rUpLegRef.current) rUpLegRef.current.rotation.set(0.2, 0, 0.25);
        if (lLoLegRef.current) lLoLegRef.current.rotation.set(0.15, 0, 0);
        if (rLoLegRef.current) rLoLegRef.current.rotation.set(0.15, 0, 0);
        if (torsoRef.current) torsoRef.current.position.y = 0;
        if (neckRef.current) neckRef.current.rotation.x = 0.1;
        return;
      case "idle":
      default:
        amp = 0.08; freq = 2.2; bend = 0.1; armBase = 0.1; breathe = 0.04;
        break;
    }

    // Scale walk/run by actual movement so you transition smoothly.
    const motion = anim === "idle" ? 1 : Math.max(0.25, moveAmount);
    const swing = Math.sin(t * freq) * amp * motion;
    const swingOpp = -swing;
    // Counter-arm rotation while running (arms opposite of legs)
    const armSwing = Math.sin(t * freq + Math.PI) * amp * motion;
    // Knee/elbow bend pulses with the same phase
    const bendPulse = (Math.abs(Math.sin(t * freq))) * bend * motion + 0.05;

    // Subtle breathing on torso
    if (torsoRef.current) {
      torsoRef.current.position.y = Math.sin(t * 1.6) * breathe;
    }
    if (neckRef.current) {
      neckRef.current.rotation.x = Math.sin(t * 1.4) * 0.02;
    }

    // Arms (upper rotates around shoulder, lower rotates around elbow)
    if (lUpArmRef.current) lUpArmRef.current.rotation.set(armSwing, 0, armBase);
    if (rUpArmRef.current) rUpArmRef.current.rotation.set(-armSwing, 0, -armBase);
    if (lLoArmRef.current) lLoArmRef.current.rotation.set(bendPulse, 0, 0);
    if (rLoArmRef.current) rLoArmRef.current.rotation.set(bendPulse, 0, 0);

    // Legs (upper rotates around hip, lower rotates around knee, knee always flexes forward)
    if (lUpLegRef.current) lUpLegRef.current.rotation.set(swing, 0, 0);
    if (rUpLegRef.current) rUpLegRef.current.rotation.set(swingOpp, 0, 0);
    // Knee bends most when the leg is swinging back (preparing next stride)
    const lKnee = Math.max(0, -Math.sin(t * freq)) * bend * motion + 0.05;
    const rKnee = Math.max(0, Math.sin(t * freq)) * bend * motion + 0.05;
    if (lLoLegRef.current) lLoLegRef.current.rotation.set(lKnee, 0, 0);
    if (rLoLegRef.current) rLoLegRef.current.rotation.set(rKnee, 0, 0);
  });

  // --- Layout: pivot offsets (where joints attach to parent) ---
  // Torso center is the rig origin (player.position is feet, so we lift below)
  const ragPos = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;

  // World up & body orientation (gravity-aware)
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  // Lift the rig so the feet sit on player.position (torso origin sits at hip height ≈ 0.9)
  const RIG_LIFT = 1.0;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        {ragPos ? (
          // Ragdoll: each part rendered at its scattered offset, no joint hierarchy
          <RagdollRig
            ragPos={ragPos}
            geos={{ torsoGeo, headGeo, neckGeo, upperArmGeo, lowerArmGeo, handGeo, upperLegGeo, lowerLegGeo, footGeo }}
            mats={{ skinMat, shirtMat, pantsMat, shoeMat }}
            lift={RIG_LIFT}
          />
        ) : (
          <group position={[0, RIG_LIFT, 0]}>
            {/* TORSO (root of rig) */}
            <group ref={torsoRef}>
              <mesh geometry={torsoGeo} material={shirtMat} castShadow receiveShadow />

              {/* NECK + HEAD pivots at top of torso */}
              <group ref={neckRef} position={[0, 0.55, 0]}>
                <mesh geometry={neckGeo} material={skinMat} position={[0, 0.08, 0]} castShadow />
                <mesh geometry={headGeo} material={skinMat} position={[0, 0.45, 0]} castShadow>
                  {/* Eyes */}
                  <mesh position={[0.11, 0.05, 0.28]}>
                    <sphereGeometry args={[0.045, 12, 12]} />
                    <meshStandardMaterial color={0x111111} />
                  </mesh>
                  <mesh position={[-0.11, 0.05, 0.28]}>
                    <sphereGeometry args={[0.045, 12, 12]} />
                    <meshStandardMaterial color={0x111111} />
                  </mesh>
                </mesh>
              </group>

              {/* LEFT ARM: shoulder pivot at top-left of torso */}
              <group ref={lUpArmRef} position={[-0.55, 0.45, 0]}>
                <mesh geometry={upperArmGeo} material={shirtMat} position={[0, -0.275, 0]} castShadow />
                {/* ELBOW pivot at bottom of upper arm */}
                <group ref={lLoArmRef} position={[0, -0.55, 0]}>
                  <mesh geometry={lowerArmGeo} material={skinMat} position={[0, -0.25, 0]} castShadow />
                  <mesh geometry={handGeo} material={skinMat} position={[0, -0.6, 0]} castShadow />
                  {/* Slot anchor for player.motors.attach("leftHand", obj) — visual hint only */}
                </group>
              </group>

              {/* RIGHT ARM */}
              <group ref={rUpArmRef} position={[0.55, 0.45, 0]}>
                <mesh geometry={upperArmGeo} material={shirtMat} position={[0, -0.275, 0]} castShadow />
                <group ref={rLoArmRef} position={[0, -0.55, 0]}>
                  <mesh geometry={lowerArmGeo} material={skinMat} position={[0, -0.25, 0]} castShadow />
                  <mesh geometry={handGeo} material={skinMat} position={[0, -0.6, 0]} castShadow />
                </group>
              </group>

              {/* LEFT LEG: hip pivot at bottom of torso */}
              <group ref={lUpLegRef} position={[-0.22, -0.55, 0]}>
                <mesh geometry={upperLegGeo} material={pantsMat} position={[0, -0.3, 0]} castShadow />
                {/* KNEE pivot at bottom of upper leg */}
                <group ref={lLoLegRef} position={[0, -0.6, 0]}>
                  <mesh geometry={lowerLegGeo} material={pantsMat} position={[0, -0.275, 0]} castShadow />
                  <mesh geometry={footGeo} material={shoeMat} position={[0, -0.6, 0.07]} castShadow />
                </group>
              </group>

              {/* RIGHT LEG */}
              <group ref={rUpLegRef} position={[0.22, -0.55, 0]}>
                <mesh geometry={upperLegGeo} material={pantsMat} position={[0, -0.3, 0]} castShadow />
                <group ref={rLoLegRef} position={[0, -0.6, 0]}>
                  <mesh geometry={lowerLegGeo} material={pantsMat} position={[0, -0.275, 0]} castShadow />
                  <mesh geometry={footGeo} material={shoeMat} position={[0, -0.6, 0.07]} castShadow />
                </group>
              </group>
            </group>
          </group>
        )}

        {/* Name tag */}
        <Html position={[0, 2.4, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}

// ---------- Ragdoll renderer ----------
function RagdollRig({
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
      <mesh geometry={geos.torsoGeo} material={mats.shirtMat} position={at("torso", [0, 0, 0])} castShadow />
      <mesh geometry={geos.neckGeo} material={mats.skinMat} position={at("neck", [0, 0.6, 0])} castShadow />
      <mesh geometry={geos.headGeo} material={mats.skinMat} position={at("head", [0, 1.0, 0])} castShadow />

      <mesh geometry={geos.upperArmGeo} material={mats.shirtMat} position={at("leftUpperArm", [-0.55, 0.2, 0])} castShadow />
      <mesh geometry={geos.lowerArmGeo} material={mats.skinMat} position={at("leftLowerArm", [-0.55, -0.3, 0])} castShadow />
      <mesh geometry={geos.handGeo} material={mats.skinMat} position={at("leftHand", [-0.55, -0.7, 0])} castShadow />

      <mesh geometry={geos.upperArmGeo} material={mats.shirtMat} position={at("rightUpperArm", [0.55, 0.2, 0])} castShadow />
      <mesh geometry={geos.lowerArmGeo} material={mats.skinMat} position={at("rightLowerArm", [0.55, -0.3, 0])} castShadow />
      <mesh geometry={geos.handGeo} material={mats.skinMat} position={at("rightHand", [0.55, -0.7, 0])} castShadow />

      <mesh geometry={geos.upperLegGeo} material={mats.pantsMat} position={at("leftUpperLeg", [-0.22, -0.85, 0])} castShadow />
      <mesh geometry={geos.lowerLegGeo} material={mats.pantsMat} position={at("leftLowerLeg", [-0.22, -1.4, 0])} castShadow />
      <mesh geometry={geos.footGeo} material={mats.shoeMat} position={at("leftFoot", [-0.22, -1.75, 0.05])} castShadow />

      <mesh geometry={geos.upperLegGeo} material={mats.pantsMat} position={at("rightUpperLeg", [0.22, -0.85, 0])} castShadow />
      <mesh geometry={geos.lowerLegGeo} material={mats.pantsMat} position={at("rightLowerLeg", [0.22, -1.4, 0])} castShadow />
      <mesh geometry={geos.footGeo} material={mats.shoeMat} position={at("rightFoot", [0.22, -1.75, 0.05])} castShadow />
    </group>
  );
}
