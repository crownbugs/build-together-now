import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Enhanced humanoid character rig with improved anatomical proportions,
 * smoother connections between body parts, and detailed facial features.
 *
 * Key improvements:
 * - More realistic body proportions (broader shoulders, narrower waist, curved limbs)
 * - Smooth transitions between joints (neck, shoulders, hips)
 * - Detailed face with eyes, eyebrows, and subtle mouth
 * - Better skin material with natural subsurface-like appearance
 * - Properly connected limbs with seamless overlaps
 * - Improved hand and foot shapes
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  // --- Enhanced Materials with natural appearance ---
  const skinMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xf2c79b,
        roughness: 0.45,
        metalness: 0,
        emissive: 0x221100,
        emissiveIntensity: 0.02,
      }),
    []
  );
  const shirtMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: player.color,
        roughness: 0.5,
        metalness: 0.05,
        emissive: player.color,
        emissiveIntensity: 0.03,
      }),
    [player.color]
  );
  const shirtDarkMat = useMemo(() => {
    const c = new THREE.Color(player.color);
    c.multiplyScalar(0.75);
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.04 });
  }, [player.color]);
  const pantsMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.65, metalness: 0.02 }),
    []
  );
  const shoeMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x1a1d26, roughness: 0.48, metalness: 0.1 }),
    []
  );
  const eyeWhiteMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }), []);
  const eyePupilMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }), []);
  const eyebrowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.8 }), []);

  // --- Improved Humanoid Geometries with anatomical shapes ---
  // Chest: broader, rounded, with V-taper
  const chestGeo = useMemo(() => {
    const geo = new RoundedBoxGeometry(1.15, 0.58, 0.62, 8, 0.2);
    return geo;
  }, []);

  // Waist: narrower for hourglass silhouette
  const waistGeo = useMemo(() => new RoundedBoxGeometry(0.82, 0.34, 0.52, 6, 0.15), []);

  // Pelvis: wider and rounded
  const pelvisGeo = useMemo(() => new RoundedBoxGeometry(0.92, 0.32, 0.58, 8, 0.16), []);

  // Neck: smoother, slightly tapered
  const neckGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.18, 0.2, 24), []);

  // Head: improved shape (slightly elongated for realism)
  const headGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.34, 32, 32);
    geo.scale(0.95, 1.08, 0.92);
    return geo;
  }, []);

  // Limbs with anatomical taper
  const upperArmGeo = useMemo(() => new THREE.CylinderGeometry(0.165, 0.135, 0.5, 16), []);
  const lowerArmGeo = useMemo(() => new THREE.CylinderGeometry(0.135, 0.11, 0.46, 16), []);
  const handGeo = useMemo(() => {
    const geo = new RoundedBoxGeometry(0.24, 0.24, 0.14, 6, 0.08);
    return geo;
  }, []);
  const shoulderCapGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.19, 24, 20);
    geo.scale(0.9, 0.85, 1.0);
    return geo;
  }, []);

  const upperLegGeo = useMemo(() => new THREE.CylinderGeometry(0.22, 0.17, 0.58, 16), []);
  const lowerLegGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.125, 0.52, 16), []);
  const footGeo = useMemo(() => {
    const geo = new RoundedBoxGeometry(0.34, 0.18, 0.55, 6, 0.08);
    return geo;
  }, []);

  // --- Animation state (unchanged logic) ---
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

  // Smoothing state
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
    const k = Math.min(1, delta * 14);

    let pelvisY = 0;
    let pelvisRotY = 0;
    let pelvisRotZ = 0;
    let chestRotY = 0;
    let chestRotX = 0;
    let neckX = 0;

    let lUp = new THREE.Vector3(0, 0, 0.08);
    let rUp = new THREE.Vector3(0, 0, -0.08);
    let lLo = 0.1;
    let rLo = 0.1;
    let lUpLeg = 0;
    let rUpLeg = 0;
    let lLoLeg = 0.05;
    let rLoLeg = 0.05;

    if (anim === "jump") {
      lUp.set(-2.2, 0, 0.15);
      rUp.set(-2.2, 0, -0.15);
      lLo = 0.1;
      rLo = 0.1;
      lUpLeg = -0.7;
      rUpLeg = -0.7;
      lLoLeg = 1.1;
      rLoLeg = 1.1;
      chestRotX = -0.1;
      neckX = -0.1;
    } else if (anim === "fall") {
      lUp.set(-0.5, 0, 1.2);
      rUp.set(-0.5, 0, -1.2);
      lLo = 0.4;
      rLo = 0.4;
      lUpLeg = 0.25;
      rUpLeg = 0.25;
      lLoLeg = 0.2;
      rLoLeg = 0.2;
      chestRotX = 0.15;
      pelvisRotZ = Math.sin(t * 2) * 0.06;
      neckX = 0.2;
    } else if (anim === "hold") {
      rUp.set(-1.45, 0, -0.15);
      rLo = 0.55;
      lUp.set(-0.15, 0, 0.18);
      lLo = 0.25;
      pelvisY = Math.sin(t * 1.6) * 0.03;
      chestRotY = Math.sin(t * 1.3) * 0.02;
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
      const armSwing = -Math.sin(phase) * armAmp * motion;

      pelvisY = Math.abs(Math.sin(phase)) * (isRun ? 0.14 : 0.07) * motion;
      chestRotX = isRun ? -0.18 * motion : -0.05 * motion;
      pelvisRotY = Math.sin(phase) * 0.12 * motion;
      chestRotY = -Math.sin(phase) * 0.18 * motion;
      pelvisRotZ = Math.sin(phase) * 0.06 * motion;
      neckX = Math.sin(phase * 2) * 0.02;

      lUp.set(armSwing, 0, 0.05);
      rUp.set(-armSwing, 0, -0.05);
      lLo = Math.max(0, -armSwing) * elbowBend + 0.12;
      rLo = Math.max(0, armSwing) * elbowBend + 0.12;

      lUpLeg = legSwing;
      rUpLeg = -legSwing;
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

    // Apply rotations
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

  // --- Layout with improved positioning for seamless connections ---
  const ragPos = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
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
            {/* PELVIS - root of rig with improved hip shape */}
            <group ref={pelvisRef}>
              <mesh geometry={pelvisGeo} material={pantsMat} castShadow receiveShadow position={[0, 0, 0]} />

              {/* Belt accessory for visual connection */}
              <mesh position={[0, -0.08, 0.05]} rotation={[0, 0, 0]}>
                <torusGeometry args={[0.48, 0.045, 16, 48]} />
                <meshStandardMaterial color={0x5a3e2b} metalness={0.3} roughness={0.6} />
              </mesh>

              {/* CHEST with improved V-taper */}
              <group ref={chestRef} position={[0, 0.38, 0]}>
                {/* Waist transition piece for smooth connection */}
                <mesh geometry={waistGeo} material={shirtDarkMat} position={[0, -0.12, 0]} castShadow />
                {/* Chest piece */}
                <mesh geometry={chestGeo} material={shirtMat} position={[0, 0.29, 0.02]} castShadow receiveShadow />

                {/* Collar detail */}
                <mesh position={[0, 0.58, 0.28]} rotation={[0.2, 0, 0]}>
                  <boxGeometry args={[0.65, 0.08, 0.15]} />
                  <meshStandardMaterial color={0xccaa88} roughness={0.4} />
                </mesh>

                {/* NECK with smoother transition */}
                <group ref={neckRef} position={[0, 0.64, 0]}>
                  <mesh geometry={neckGeo} material={skinMat} position={[0, 0.06, 0]} castShadow />

                  {/* HEAD with detailed face */}
                  <group position={[0, 0.44, 0]}>
                    <mesh geometry={headGeo} material={skinMat} castShadow receiveShadow />

                    {/* Eyes - whites */}
                    <mesh position={[0.11, 0.05, 0.32]} material={eyeWhiteMat}>
                      <sphereGeometry args={[0.045, 24, 24]} />
                    </mesh>
                    <mesh position={[-0.11, 0.05, 0.32]} material={eyeWhiteMat}>
                      <sphereGeometry args={[0.045, 24, 24]} />
                    </mesh>

                    {/* Pupils */}
                    <mesh position={[0.115, 0.045, 0.36]} material={eyePupilMat}>
                      <sphereGeometry args={[0.025, 20, 20]} />
                    </mesh>
                    <mesh position={[-0.105, 0.045, 0.36]} material={eyePupilMat}>
                      <sphereGeometry args={[0.025, 20, 20]} />
                    </mesh>

                    {/* Eyebrows */}
                    <mesh position={[0.11, 0.115, 0.32]} material={eyebrowMat} rotation={[-0.1, 0, 0]}>
                      <boxGeometry args={[0.12, 0.04, 0.06]} />
                    </mesh>
                    <mesh position={[-0.11, 0.115, 0.32]} material={eyebrowMat} rotation={[-0.1, 0, 0]}>
                      <boxGeometry args={[0.12, 0.04, 0.06]} />
                    </mesh>

                    {/* Subtle mouth line */}
                    <mesh position={[0, -0.05, 0.34]} rotation={[0.1, 0, 0]}>
                      <boxGeometry args={[0.14, 0.02, 0.03]} />
                      <meshStandardMaterial color={0xaa7766} roughness={0.3} />
                    </mesh>

                    {/* Simple nose hint */}
                    <mesh position={[0, 0.02, 0.36]}>
                      <sphereGeometry args={[0.028, 16, 16]} />
                      <meshStandardMaterial color={0xe0b08a} roughness={0.3} />
                    </mesh>
                  </group>
                </group>

                {/* LEFT ARM - improved shoulder connection */}
                <group ref={lUpArmRef} position={[-0.62, 0.44, 0]}>
                  <mesh geometry={shoulderCapGeo} material={shirtMat} position={[0, 0, 0]} castShadow />
                  <mesh geometry={upperArmGeo} material={shirtMat} position={[0, -0.28, 0]} castShadow />
                  <group ref={lLoArmRef} position={[0, -0.54, 0]}>
                    <mesh geometry={lowerArmGeo} material={skinMat} position={[0, -0.23, 0]} castShadow />
                    <mesh geometry={handGeo} material={skinMat} position={[0, -0.52, 0.02]} castShadow />
                  </group>
                </group>

                {/* RIGHT ARM */}
                <group ref={rUpArmRef} position={[0.62, 0.44, 0]}>
                  <mesh geometry={shoulderCapGeo} material={shirtMat} position={[0, 0, 0]} castShadow />
                  <mesh geometry={upperArmGeo} material={shirtMat} position={[0, -0.28, 0]} castShadow />
                  <group ref={rLoArmRef} position={[0, -0.54, 0]}>
                    <mesh geometry={lowerArmGeo} material={skinMat} position={[0, -0.23, 0]} castShadow />
                    <mesh geometry={handGeo} material={skinMat} position={[0, -0.52, 0.02]} castShadow />
                  </group>
                </group>
              </group>

              {/* LEFT LEG with better hip joint connection */}
              <group ref={lUpLegRef} position={[-0.25, -0.16, 0]}>
                <mesh geometry={upperLegGeo} material={pantsMat} position={[0, -0.31, 0]} castShadow />
                <group ref={lLoLegRef} position={[0, -0.61, 0]}>
                  <mesh geometry={lowerLegGeo} material={pantsMat} position={[0, -0.27, 0]} castShadow />
                  <mesh geometry={footGeo} material={shoeMat} position={[0, -0.58, 0.1]} castShadow />
                </group>
              </group>

              {/* RIGHT LEG */}
              <group ref={rUpLegRef} position={[0.25, -0.16, 0]}>
                <mesh geometry={upperLegGeo} material={pantsMat} position={[0, -0.31, 0]} castShadow />
                <group ref={rLoLegRef} position={[0, -0.61, 0]}>
                  <mesh geometry={lowerLegGeo} material={pantsMat} position={[0, -0.27, 0]} castShadow />
                  <mesh geometry={footGeo} material={shoeMat} position={[0, -0.58, 0.1]} castShadow />
                </group>
              </group>
            </group>
          </group>
        )}

        <Html position={[0, 2.45, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}

// ---------- Enhanced Ragdoll renderer ----------
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
      <mesh geometry={geos.chestGeo} material={mats.shirtMat} position={at("torso", [0, 0.32, 0])} castShadow />
      <mesh geometry={geos.neckGeo} material={mats.skinMat} position={at("neck", [0, 0.62, 0])} castShadow />
      <mesh geometry={geos.headGeo} material={mats.skinMat} position={at("head", [0, 1.02, 0])} castShadow />

      <mesh geometry={geos.upperArmGeo} material={mats.shirtMat} position={at("leftUpperArm", [-0.6, 0.22, 0])} castShadow />
      <mesh geometry={geos.lowerArmGeo} material={mats.skinMat} position={at("leftLowerArm", [-0.6, -0.28, 0])} castShadow />
      <mesh geometry={geos.handGeo} material={mats.skinMat} position={at("leftHand", [-0.6, -0.68, 0])} castShadow />

      <mesh geometry={geos.upperArmGeo} material={mats.shirtMat} position={at("rightUpperArm", [0.6, 0.22, 0])} castShadow />
      <mesh geometry={geos.lowerArmGeo} material={mats.skinMat} position={at("rightLowerArm", [0.6, -0.28, 0])} castShadow />
      <mesh geometry={geos.handGeo} material={mats.skinMat} position={at("rightHand", [0.6, -0.68, 0])} castShadow />

      <mesh geometry={geos.upperLegGeo} material={mats.pantsMat} position={at("leftUpperLeg", [-0.25, -0.82, 0])} castShadow />
      <mesh geometry={geos.lowerLegGeo} material={mats.pantsMat} position={at("leftLowerLeg", [-0.25, -1.38, 0])} castShadow />
      <mesh geometry={geos.footGeo} material={mats.shoeMat} position={at("leftFoot", [-0.25, -1.72, 0.08])} castShadow />

      <mesh geometry={geos.upperLegGeo} material={mats.pantsMat} position={at("rightUpperLeg", [0.25, -0.82, 0])} castShadow />
      <mesh geometry={geos.lowerLegGeo} material={mats.pantsMat} position={at("rightLowerLeg", [0.25, -1.38, 0])} castShadow />
      <mesh geometry={geos.footGeo} material={mats.shoeMat} position={at("rightFoot", [0.25, -1.72, 0.08])} castShadow />
    </group>
  );
}
