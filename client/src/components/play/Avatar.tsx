import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Rebur Engine humanoid character rig.
 *
 * The torso is no longer a single block — it's built from a chest (broad
 * shoulders), a tapered ribcage, and a narrower pelvis, giving the avatar a
 * proper humanoid silhouette.
 *
 * 15 animated bones organized as a joint hierarchy with elbows + knees:
 *   pelvis → chest → neck → head
 *           ↳ leftUpperArm → leftLowerArm → leftHand
 *           ↳ rightUpperArm → rightLowerArm → rightHand
 *   pelvis → leftUpperLeg → leftLowerLeg → leftFoot
 *   pelvis → rightUpperLeg → rightLowerLeg → rightFoot
 *
 * Built-in animations (set via `player.motors.animation`):
 *   idle  – breathing, gentle sway, slight head bob
 *   walk  – heel/toe gait, contralateral arm swing, knee/elbow flex, hip sway
 *   run   – fast cycle, deep knee/elbow bend, vertical bob, forward lean
 *   jump  – arms up, legs tucked
 *   fall  – arms out, legs spread
 *   hold  – right arm forward, left arm relaxed, ideal for tools/weapons
 *   ragdoll – limbs detach and tumble (positions driven by core)
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  // --- Materials ---
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xf2c79b, roughness: 0.7, metalness: 0 }),
    []
  );
  const shirtMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.55, metalness: 0.04 }),
    [player.color]
  );
  const shirtDarkMat = useMemo(() => {
    const c = new THREE.Color(player.color);
    c.multiplyScalar(0.85);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  }, [player.color]);
  const pantsMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.75 }),
    []
  );
  const shoeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x1a1d26, roughness: 0.5 }),
    []
  );

  // --- Humanoid torso geometries (chest > waist > pelvis) ---
  const chestGeo = useMemo(() => new RoundedBoxGeometry(1.05, 0.55, 0.55, 6, 0.18), []);
  const waistGeo = useMemo(() => new RoundedBoxGeometry(0.78, 0.32, 0.48, 6, 0.14), []);
  const pelvisGeo = useMemo(() => new RoundedBoxGeometry(0.85, 0.3, 0.5, 6, 0.14), []);

  const neckGeo = useMemo(() => new THREE.CylinderGeometry(0.14, 0.17, 0.18, 16), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.32, 24, 20), []);

  // Tapered limbs (top wider than bottom) for a more anatomical silhouette
  const upperArmGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.13, 0.55, 14), []);
  const lowerArmGeo = useMemo(() => new THREE.CylinderGeometry(0.13, 0.1, 0.5, 14), []);
  const handGeo = useMemo(() => new RoundedBoxGeometry(0.22, 0.22, 0.12, 4, 0.06), []);
  const shoulderCapGeo = useMemo(() => new THREE.SphereGeometry(0.18, 16, 14), []);

  const upperLegGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.16, 0.6, 14), []);
  const lowerLegGeo = useMemo(() => new THREE.CylinderGeometry(0.15, 0.12, 0.55, 14), []);
  const footGeo = useMemo(() => new RoundedBoxGeometry(0.3, 0.16, 0.5, 4, 0.07), []);

  // --- Animation state ---
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(1, horiz / Math.max(1, player.runSpeed || player.speed || 6));
  const animRaw = player.motors.animation || "idle";
  // Auto-pick walk vs run when the script just says "walk" but velocity is fast,
  // and idle when nearly stopped (so scripts can leave animation alone).
  const anim = (() => {
    if (animRaw === "jump" || animRaw === "fall" || animRaw === "hold") return animRaw;
    if (animRaw === "ragdoll") return "ragdoll";
    if (player.onGround === false && player.velocity.y > 0.5) return "jump";
    if (player.onGround === false && player.velocity.y < -1) return "fall";
    if (horiz < 0.15) return "idle";
    if (horiz > (player.walkSpeed || 6) * 1.1) return "run";
    return animRaw === "idle" ? "walk" : animRaw;
  })();

  // Refs to joint groups
  const pelvisRef = useRef<THREE.Group>(null);
  const chestRef = useRef<THREE.Group>(null);
  const neckRef = useRef<THREE.Group>(null);
  const lUpArmRef = useRef<THREE.Group>(null);
  const lLoArmRef = useRef<THREE.Group>(null);
  const rUpArmRef = useRef<THREE.Group>(null);
  const rLoArmRef = useRef<THREE.Group>(null);
  const lUpLegRef = useRef<THREE.Group>(null);
  const lLoLegRef = useRef<THREE.Group>(null);
  const rUpLegRef = useRef<THREE.Group>(null);
  const rLoLegRef = useRef<THREE.Group>(null);

  // Smoothing state (rotations lerp between targets so transitions feel pro)
  const smooth = useRef({
    pelvisY: 0,
    pelvisRotY: 0,
    pelvisRotZ: 0,
    chestRotY: 0,
    chestRotX: 0,
    lUpArm: new THREE.Vector3(),
    rUpArm: new THREE.Vector3(),
    lLoArm: 0,
    rLoArm: 0,
    lUpLeg: 0,
    rUpLeg: 0,
    lLoLeg: 0,
    rLoLeg: 0,
    neckX: 0,
  });

  useFrame((_, delta) => {
    if (player.ragdoll) return;
    const t = runtime.time;
    const k = Math.min(1, delta * 14); // smoothing factor

    // Default targets
    let pelvisY = 0;
    let pelvisRotY = 0;
    let pelvisRotZ = 0;
    let chestRotY = 0;
    let chestRotX = 0;
    let neckX = 0;

    let lUp = new THREE.Vector3(0, 0, 0.08);  // x=pitch (forward/back), y=yaw, z=roll(out)
    let rUp = new THREE.Vector3(0, 0, -0.08);
    let lLo = 0.1; // elbow flex
    let rLo = 0.1;
    let lUpLeg = 0;
    let rUpLeg = 0;
    let lLoLeg = 0.05;
    let rLoLeg = 0.05;

    if (anim === "jump") {
      lUp.set(-2.2, 0, 0.15);
      rUp.set(-2.2, 0, -0.15);
      lLo = 0.1; rLo = 0.1;
      lUpLeg = -0.7; rUpLeg = -0.7;
      lLoLeg = 1.1; rLoLeg = 1.1;
      chestRotX = -0.1;
      neckX = -0.1;
    } else if (anim === "fall") {
      lUp.set(-0.5, 0, 1.2);
      rUp.set(-0.5, 0, -1.2);
      lLo = 0.4; rLo = 0.4;
      lUpLeg = 0.25; rUpLeg = 0.25;
      lLoLeg = 0.2; rLoLeg = 0.2;
      // Add roll on chest for a windswept feel
      chestRotX = 0.15;
      pelvisRotZ = Math.sin(t * 2) * 0.06;
      neckX = 0.2;
    } else if (anim === "hold") {
      // Right arm forward, slightly bent (holding stance). Left relaxed.
      rUp.set(-1.45, 0, -0.15);
      rLo = 0.55;
      lUp.set(-0.15, 0, 0.18);
      lLo = 0.25;
      // Subtle breathing
      pelvisY = Math.sin(t * 1.6) * 0.03;
      chestRotY = Math.sin(t * 1.3) * 0.02;
      // If also moving, layer a leg gait
      if (horiz > 0.15) {
        const freq = anim === "hold" && horiz > (player.walkSpeed || 6) * 1.1 ? 11 : 7;
        const amp = horiz > (player.walkSpeed || 6) * 1.1 ? 1.0 : 0.55;
        const motion = Math.max(0.3, moveAmount);
        const swing = Math.sin(t * freq) * amp * motion;
        lUpLeg = swing;
        rUpLeg = -swing;
        lLoLeg = Math.max(0, -Math.sin(t * freq)) * 0.45 * motion + 0.06;
        rLoLeg = Math.max(0, Math.sin(t * freq)) * 0.45 * motion + 0.06;
        pelvisY = Math.abs(Math.sin(t * freq)) * 0.06 * motion;
      }
    } else if (anim === "walk" || anim === "run") {
      const isRun = anim === "run";
      const freq = isRun ? 11 : 7;
      const armAmp = isRun ? 1.15 : 0.65;
      const legAmp = isRun ? 1.05 : 0.6;
      const elbowBend = isRun ? 0.7 : 0.35;
      const kneeBend = isRun ? 0.85 : 0.45;
      const motion = Math.max(0.35, moveAmount);

      const phase = t * freq;
      const legSwing = Math.sin(phase) * legAmp * motion;
      // Arms swing OPPOSITE to legs (contralateral gait)
      const armSwing = -Math.sin(phase) * armAmp * motion;

      // Bobbing (lowest when both feet planted, peaks twice per cycle)
      pelvisY = Math.abs(Math.sin(phase)) * (isRun ? 0.14 : 0.07) * motion;
      // Slight forward lean while running
      chestRotX = isRun ? -0.18 * motion : -0.05 * motion;
      // Hip sway (counter-rotation between pelvis and chest)
      pelvisRotY = Math.sin(phase) * 0.12 * motion;
      chestRotY = -Math.sin(phase) * 0.18 * motion;
      // Tiny side-to-side hip drop on the swing leg
      pelvisRotZ = Math.sin(phase) * 0.06 * motion;
      neckX = Math.sin(phase * 2) * 0.02;

      lUp.set(armSwing, 0, 0.05);
      rUp.set(-armSwing, 0, -0.05);
      // Elbow flexes harder on the forward swing
      lLo = Math.max(0, -armSwing) * elbowBend + 0.12;
      rLo = Math.max(0, armSwing) * elbowBend + 0.12;

      lUpLeg = legSwing;
      rUpLeg = -legSwing;
      // Knee bends most as the leg swings FORWARD (preparing to plant)
      lLoLeg = Math.max(0, -Math.sin(phase)) * kneeBend + 0.08;
      rLoLeg = Math.max(0, Math.sin(phase)) * kneeBend + 0.08;
    } else {
      // idle
      const breathe = Math.sin(t * 1.6) * 0.04;
      pelvisY = breathe * 0.5;
      chestRotY = Math.sin(t * 0.9) * 0.04;
      neckX = Math.sin(t * 1.1) * 0.03;
      lUp.set(Math.sin(t * 1.1) * 0.05, 0, 0.1 + Math.sin(t * 1.6) * 0.02);
      rUp.set(-Math.sin(t * 1.1) * 0.05, 0, -0.1 - Math.sin(t * 1.6) * 0.02);
      lLo = 0.1 + Math.sin(t * 1.1) * 0.03;
      rLo = 0.1 + Math.sin(t * 1.1) * 0.03;
    }

    // Smooth toward targets
    const s = smooth.current;
    s.pelvisY += (pelvisY - s.pelvisY) * k;
    s.pelvisRotY += (pelvisRotY - s.pelvisRotY) * k;
    s.pelvisRotZ += (pelvisRotZ - s.pelvisRotZ) * k;
    s.chestRotY += (chestRotY - s.chestRotY) * k;
    s.chestRotX += (chestRotX - s.chestRotX) * k;
    s.neckX += (neckX - s.neckX) * k;
    s.lUpArm.lerp(lUp, k);
    s.rUpArm.lerp(rUp, k);
    s.lLoArm += (lLo - s.lLoArm) * k;
    s.rLoArm += (rLo - s.rLoArm) * k;
    s.lUpLeg += (lUpLeg - s.lUpLeg) * k;
    s.rUpLeg += (rUpLeg - s.rUpLeg) * k;
    s.lLoLeg += (lLoLeg - s.lLoLeg) * k;
    s.rLoLeg += (rLoLeg - s.rLoLeg) * k;

    // Apply
    if (pelvisRef.current) {
      pelvisRef.current.position.y = s.pelvisY;
      pelvisRef.current.rotation.y = s.pelvisRotY;
      pelvisRef.current.rotation.z = s.pelvisRotZ;
    }
    if (chestRef.current) {
      chestRef.current.rotation.y = s.chestRotY;
      chestRef.current.rotation.x = s.chestRotX;
    }
    if (neckRef.current) neckRef.current.rotation.x = s.neckX;
    if (lUpArmRef.current) lUpArmRef.current.rotation.set(s.lUpArm.x, s.lUpArm.y, s.lUpArm.z);
    if (rUpArmRef.current) rUpArmRef.current.rotation.set(s.rUpArm.x, s.rUpArm.y, s.rUpArm.z);
    if (lLoArmRef.current) lLoArmRef.current.rotation.x = s.lLoArm;
    if (rLoArmRef.current) rLoArmRef.current.rotation.x = s.rLoArm;
    if (lUpLegRef.current) lUpLegRef.current.rotation.x = s.lUpLeg;
    if (rUpLegRef.current) rUpLegRef.current.rotation.x = s.rUpLeg;
    if (lLoLegRef.current) lLoLegRef.current.rotation.x = s.lLoLeg;
    if (rLoLegRef.current) rLoLegRef.current.rotation.x = s.rLoLeg;
  });

  // --- Layout ---
  const ragPos = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  // Lift rig so feet rest on player.position. Pelvis sits at hip height.
  const RIG_LIFT = 1.0;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        {ragPos ? (
          <RagdollRig
            ragPos={ragPos}
            geos={{ chestGeo, headGeo, neckGeo, upperArmGeo, lowerArmGeo, handGeo, upperLegGeo, lowerLegGeo, footGeo, pelvisGeo }}
            mats={{ skinMat, shirtMat, pantsMat, shoeMat }}
            lift={RIG_LIFT}
          />
        ) : (
          <group position={[0, RIG_LIFT, 0]}>
            {/* PELVIS = root of the live rig (sits at hip height) */}
            <group ref={pelvisRef}>
              <mesh geometry={pelvisGeo} material={pantsMat} castShadow receiveShadow />

              {/* CHEST/RIBCAGE pivots above pelvis (humanoid taper) */}
              <group ref={chestRef} position={[0, 0.35, 0]}>
                {/* Waist transition */}
                <mesh geometry={waistGeo} material={shirtDarkMat} position={[0, -0.1, 0]} castShadow />
                {/* Chest */}
                <mesh geometry={chestGeo} material={shirtMat} position={[0, 0.27, 0]} castShadow receiveShadow />

                {/* NECK + HEAD */}
                <group ref={neckRef} position={[0, 0.6, 0]}>
                  <mesh geometry={neckGeo} material={skinMat} position={[0, 0.05, 0]} castShadow />
                  <mesh geometry={headGeo} material={skinMat} position={[0, 0.4, 0]} castShadow>
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

                {/* LEFT ARM: shoulder cap + tapered upper arm */}
                <group ref={lUpArmRef} position={[-0.58, 0.42, 0]}>
                  <mesh geometry={shoulderCapGeo} material={shirtMat} castShadow />
                  <mesh geometry={upperArmGeo} material={shirtMat} position={[0, -0.3, 0]} castShadow />
                  <group ref={lLoArmRef} position={[0, -0.58, 0]}>
                    <mesh geometry={lowerArmGeo} material={skinMat} position={[0, -0.25, 0]} castShadow />
                    <mesh geometry={handGeo} material={skinMat} position={[0, -0.58, 0]} castShadow />
                  </group>
                </group>

                {/* RIGHT ARM */}
                <group ref={rUpArmRef} position={[0.58, 0.42, 0]}>
                  <mesh geometry={shoulderCapGeo} material={shirtMat} castShadow />
                  <mesh geometry={upperArmGeo} material={shirtMat} position={[0, -0.3, 0]} castShadow />
                  <group ref={rLoArmRef} position={[0, -0.58, 0]}>
                    <mesh geometry={lowerArmGeo} material={skinMat} position={[0, -0.25, 0]} castShadow />
                    <mesh geometry={handGeo} material={skinMat} position={[0, -0.58, 0]} castShadow />
                  </group>
                </group>
              </group>

              {/* LEFT LEG: hip pivot at bottom of pelvis */}
              <group ref={lUpLegRef} position={[-0.22, -0.18, 0]}>
                <mesh geometry={upperLegGeo} material={pantsMat} position={[0, -0.32, 0]} castShadow />
                <group ref={lLoLegRef} position={[0, -0.62, 0]}>
                  <mesh geometry={lowerLegGeo} material={pantsMat} position={[0, -0.28, 0]} castShadow />
                  <mesh geometry={footGeo} material={shoeMat} position={[0, -0.6, 0.08]} castShadow />
                </group>
              </group>

              {/* RIGHT LEG */}
              <group ref={rUpLegRef} position={[0.22, -0.18, 0]}>
                <mesh geometry={upperLegGeo} material={pantsMat} position={[0, -0.32, 0]} castShadow />
                <group ref={rLoLegRef} position={[0, -0.62, 0]}>
                  <mesh geometry={lowerLegGeo} material={pantsMat} position={[0, -0.28, 0]} castShadow />
                  <mesh geometry={footGeo} material={shoeMat} position={[0, -0.6, 0.08]} castShadow />
                </group>
              </group>
            </group>
          </group>
        )}

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
      <mesh geometry={geos.pelvisGeo} material={mats.pantsMat} position={at("torso", [0, 0, 0])} castShadow />
      <mesh geometry={geos.chestGeo} material={mats.shirtMat} position={at("torso", [0, 0.3, 0])} castShadow />
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
