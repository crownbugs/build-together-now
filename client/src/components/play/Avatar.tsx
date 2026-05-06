import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  const bodyColor = player.color;
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.05 }), [bodyColor]);
  const neckMat = useMemo(() => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 }), [bodyColor]);
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.35 }), [bodyColor]);
  const armMat = useMemo(() => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 }), [bodyColor]);
  const legMat = useMemo(() => new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 }), [bodyColor]);

  const bodyGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.48, 32, 32);
    geo.scale(0.9, 1.2, 0.8);
    return geo;
  }, []);
  const neckGeo = useMemo(() => new THREE.CylinderGeometry(0.22, 0.24, 0.12, 12), []);
  const headGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.38, 32, 32);
    geo.scale(0.95, 0.92, 0.9);
    return geo;
  }, []);
  const armGeo = useMemo(() => new THREE.CylinderGeometry(0.13, 0.1, 0.52, 8), []);
  // Even longer legs (lower leg) – height 0.95
  const legGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.14, 0.95, 8), []);

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

  const bodyRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const smooth = useRef({
    bodyRotY: 0, bodyRotZ: 0, bodyY: 0,
    leftArmRot: 0, rightArmRot: 0,
    leftLegRot: 0, rightLegRot: 0,
    headRotX: 0, headRotY: 0,
  });

  useFrame((_, delta) => {
    if (player.ragdoll) return;
    const t = runtime.time;
    const k = Math.min(1, delta * 14);
    let bodyY = 0, bodyRotY = 0, bodyRotZ = 0;
    let leftArm = 0, rightArm = 0, leftLeg = 0, rightLeg = 0, headX = 0, headY = 0;

    if (anim === "jump") {
      leftArm = -1.8; rightArm = -1.8; leftLeg = -0.3; rightLeg = -0.3;
      bodyY = -0.1; headX = -0.2;
    } else if (anim === "fall") {
      leftArm = 0.6; rightArm = 0.6; leftLeg = 0.2; rightLeg = 0.2;
      bodyRotZ = Math.sin(t * 3) * 0.1; headX = 0.15;
    } else if (anim === "hold") {
      rightArm = -1.2; leftArm = -0.2; leftLeg = 0.1; rightLeg = 0.3;
      bodyY = Math.sin(t * 1.6) * 0.02; bodyRotY = Math.sin(t * 1.3) * 0.03;
      if (horiz > 0.15) {
        const freq = horiz > (player.walkSpeed || 6) * 1.1 ? 11 : 7;
        const amp = horiz > (player.walkSpeed || 6) * 1.1 ? 0.9 : 0.5;
        const swing = Math.sin(t * freq) * amp * moveAmount;
        leftArm = swing * 0.8; rightArm = -swing * 0.8;
        leftLeg = -rightArm * 0.7; rightLeg = -leftArm * 0.7;
      }
    } else if (anim === "walk" || anim === "run") {
      const isRun = anim === "run";
      const freq = isRun ? 11 : 7;
      const armAmp = isRun ? 1.3 : 0.8;
      const legAmp = isRun ? 1.0 : 0.6;
      const motion = Math.max(0.35, moveAmount);
      const phase = t * freq;
      const armSwing = Math.sin(phase) * armAmp * motion;
      leftArm = armSwing; rightArm = -armSwing;
      leftLeg = -rightArm * legAmp; rightLeg = -leftArm * legAmp;
      bodyY = Math.abs(Math.sin(phase)) * (isRun ? 0.08 : 0.04) * motion;
      bodyRotY = Math.sin(phase) * 0.1 * motion;
      bodyRotZ = Math.sin(phase) * 0.05 * motion;
      headX = Math.sin(phase * 2) * 0.02; headY = Math.sin(phase) * 0.03;
    } else {
      const breath = Math.sin(t * 1.6) * 0.03;
      bodyY = breath * 0.5; bodyRotY = Math.sin(t * 0.9) * 0.04;
      leftArm = 0.1 + Math.sin(t * 1.2) * 0.08; rightArm = 0.1 - Math.sin(t * 1.2) * 0.08;
      leftLeg = 0.05 + Math.sin(t * 1.2) * 0.05; rightLeg = 0.05 - Math.sin(t * 1.2) * 0.05;
      headX = Math.sin(t * 1.1) * 0.02; headY = Math.sin(t * 0.7) * 0.01;
    }

    const s = smooth.current;
    s.bodyY += (bodyY - s.bodyY) * k;
    s.bodyRotY += (bodyRotY - s.bodyRotY) * k;
    s.bodyRotZ += (bodyRotZ - s.bodyRotZ) * k;
    s.leftArmRot += (leftArm - s.leftArmRot) * k;
    s.rightArmRot += (rightArm - s.rightArmRot) * k;
    s.leftLegRot += (leftLeg - s.leftLegRot) * k;
    s.rightLegRot += (rightLeg - s.rightLegRot) * k;
    s.headRotX += (headX - s.headRotX) * k;
    s.headRotY += (headY - s.headRotY) * k;

    if (bodyRef.current) {
      bodyRef.current.position.y = s.bodyY;
      bodyRef.current.rotation.y = s.bodyRotY;
      bodyRef.current.rotation.z = s.bodyRotZ;
    }
    if (leftArmRef.current) leftArmRef.current.rotation.x = s.leftArmRot;
    if (rightArmRef.current) rightArmRef.current.rotation.x = s.rightArmRot;
    if (leftLegRef.current) leftLegRef.current.rotation.x = s.leftLegRot;
    if (rightLegRef.current) rightLegRef.current.rotation.x = s.rightLegRot;
    if (headRef.current) {
      headRef.current.rotation.x = s.headRotX;
      headRef.current.rotation.y = s.headRotY;
    }
  });

  const ragPos = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  // Adjusted lift so feet touch ground: bottom of leg = -0.55 (group) + -0.25 (mesh offset) + -0.475 (half of 0.95) = -1.275
  // Lift = 1.275 to put feet at y≈0
  const RIG_LIFT = 1.275;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        {ragPos ? (
          <RagdollCrewmate
            ragPos={ragPos}
            geos={{ bodyGeo, neckGeo, headGeo, armGeo, legGeo }}
            mats={{ bodyMat, neckMat, headMat, armMat, legMat }}
            lift={RIG_LIFT}
          />
        ) : (
          <group position={[0, RIG_LIFT, 0]}>
            <group ref={bodyRef}>
              <mesh geometry={bodyGeo} material={bodyMat} castShadow receiveShadow />
              <mesh geometry={neckGeo} material={neckMat} position={[0, 0.62, 0]} castShadow />
              <group ref={headRef} position={[0, 0.78, 0]}>
                <mesh geometry={headGeo} material={headMat} castShadow />
              </group>
              {/* Arms */}
              <group ref={leftArmRef} position={[-0.55, 0.25, 0]}>
                <mesh geometry={armGeo} material={armMat} position={[0, -0.28, 0]} castShadow />
              </group>
              <group ref={rightArmRef} position={[0.55, 0.25, 0]}>
                <mesh geometry={armGeo} material={armMat} position={[0, -0.28, 0]} castShadow />
              </group>
              {/* Extended lower legs */}
              <group ref={leftLegRef} position={[-0.35, -0.55, 0]}>
                <mesh geometry={legGeo} material={legMat} position={[0, -0.25, 0]} castShadow />
              </group>
              <group ref={rightLegRef} position={[0.35, -0.55, 0]}>
                <mesh geometry={legGeo} material={legMat} position={[0, -0.25, 0]} castShadow />
              </group>
            </group>
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

function RagdollCrewmate({ ragPos, geos, mats, lift }: any) {
  const at = (k: string, fb: [number, number, number]) => {
    const p = ragPos[k];
    return p ? [p.x, p.y + lift, p.z] : [fb[0], fb[1] + lift, fb[2]];
  };
  return (
    <group>
      <mesh geometry={geos.bodyGeo} material={mats.bodyMat} position={at("torso", [0, 0, 0])} castShadow />
      <mesh geometry={geos.neckGeo} material={mats.neckMat} position={at("neck", [0, 0.62, 0])} castShadow />
      <mesh geometry={geos.headGeo} material={mats.headMat} position={at("head", [0, 0.78, 0])} castShadow />
      <mesh geometry={geos.armGeo} material={mats.armMat} position={at("leftArm", [-0.55, 0.25, 0])} castShadow />
      <mesh geometry={geos.armGeo} material={mats.armMat} position={at("rightArm", [0.55, 0.25, 0])} castShadow />
      <mesh geometry={geos.legGeo} material={mats.legMat} position={at("leftLeg", [-0.35, -0.55, 0])} castShadow />
      <mesh geometry={geos.legGeo} material={mats.legMat} position={at("rightLeg", [0.35, -0.55, 0])} castShadow />
    </group>
  );
}
