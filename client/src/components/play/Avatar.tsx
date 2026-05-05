import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type AnimState = "idle" | "walk" | "run" | "jump" | "fall";

export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  // ---- Movement data ----
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const maxSpeed = Math.max(1, player.runSpeed || player.speed);
  const moveAmount = Math.min(1, horiz / maxSpeed);
  const isGrounded = player.grounded ?? true;   // assume grounded if not provided
  const verticalVel = player.velocity.y || 0;
  
  // ---- Animation state machine ----
  let animState: AnimState = "idle";
  if (!isGrounded) {
    animState = verticalVel > 1.5 ? "jump" : "fall";
  } else if (player.motors.animation === "run" && moveAmount > 0.2) {
    animState = "run";
  } else if (player.motors.animation === "walk" && moveAmount > 0.1) {
    animState = "walk";
  } else {
    animState = "idle";
  }

  // ---- Animation parameters per state ----
  const params = {
    idle: { speed: 0, armSwing: 0, legSwing: 0, elbowBend: 0.3, kneeLift: 0.2, torsoTwist: 0, hipSway: 0.02, headBob: 0.01, breathing: 0.03 },
    walk: { speed: 4.2, armSwing: 0.7, legSwing: 0.65, elbowBend: 0.5, kneeLift: 0.4, torsoTwist: 0.18, hipSway: 0.05, headBob: 0.03, breathing: 0 },
    run:  { speed: 6.8, armSwing: 1.0, legSwing: 0.95, elbowBend: 0.75, kneeLift: 0.7, torsoTwist: 0.3, hipSway: 0.08, headBob: 0.05, breathing: 0 },
    jump: { speed: 0, armSwing: 0, legSwing: 0, elbowBend: 0.9, kneeLift: 0.85, torsoTwist: 0, hipSway: 0, headBob: 0, breathing: 0, fixedPose: true },
    fall: { speed: 0, armSwing: 0, legSwing: 0, elbowBend: 0.4, kneeLift: 0.4, torsoTwist: 0, hipSway: 0, headBob: 0, breathing: 0, fixedPose: true }
  };
  const p = params[animState];

  // ---- Orientation & ragdoll ----
  const upVec = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVec);
  const rag = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const off = (k: string) => (rag && rag[k] ? rag[k] : null);

  // ---- Materials ----
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.55, metalness: 0.05 }),
    [player.color]
  );
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x7a3e19, roughness: 0.6 }), []);
  const limbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.7 }), []);

  // ---- Geometries (final size, no extra scaling) ----
  const torsoGeo = useMemo(() => {
    const topW = 0.82, bottomW = 0.5, height = 0.95, depth = 0.33, radius = 0.16;
    const geo = new RoundedBoxGeometry(bottomW, height, depth, 10, radius);
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const t = (y + height / 2) / height;
      const wScale = 1 + t * (topW / bottomW - 1);
      posAttr.setX(i, posAttr.getX(i) * wScale);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);
  const neckGeo = useMemo(() => new THREE.CylinderGeometry(0.11, 0.13, 0.12, 12), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.28, 48, 48), []);
  const hipGeo = useMemo(() => new RoundedBoxGeometry(0.53, 0.24, 0.33, 8, 0.13), []);
  const upperArmGeo = useMemo(() => {
    const len = 0.43, w = 0.2, d = 0.21, r = 0.11;
    const geo = new RoundedBoxGeometry(w, len, d, 8, r);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + len / 2) / len;
      pos.setX(i, pos.getX(i) * (1 - t * 0.35));
      pos.setZ(i, pos.getZ(i) * (1 - t * 0.2));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);
  const lowerArmGeo = useMemo(() => {
    const len = 0.39, w = 0.165, d = 0.19, r = 0.1;
    const geo = new RoundedBoxGeometry(w, len, d, 8, r);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + len / 2) / len;
      pos.setX(i, pos.getX(i) * (1 - t * 0.4));
      pos.setZ(i, pos.getZ(i) * (1 - t * 0.25));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);
  const handGeo = useMemo(() => new RoundedBoxGeometry(0.13, 0.16, 0.16, 6, 0.06), []);
  const upperLegGeo = useMemo(() => {
    const len = 0.47, w = 0.18, d = 0.24, r = 0.11;
    const geo = new RoundedBoxGeometry(w, len, d, 10, r);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + len / 2) / len;
      const scale = 1 - t * 0.3;
      pos.setX(i, pos.getX(i) * scale);
      pos.setZ(i, pos.getZ(i) * scale);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);
  const lowerLegGeo = useMemo(() => {
    const len = 0.38, w = 0.155, d = 0.2, r = 0.1;
    const geo = new RoundedBoxGeometry(w, len, d, 8, r);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + len / 2) / len;
      const scale = 1 - t * 0.25;
      pos.setX(i, pos.getX(i) * scale);
      pos.setZ(i, pos.getZ(i) * scale);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);
  const footGeo = useMemo(() => new RoundedBoxGeometry(0.21, 0.14, 0.33, 6, 0.07), []);

  // ---- Base positions (final avatar ~1.6u tall) ----
  const torsoPos: [number, number, number] = [0, 0.36, 0];
  const neckPos: [number, number, number] = [0, 0.82, 0];
  const headPos: [number, number, number] = [0, 1.11, 0];
  const hipPos: [number, number, number] = [0, -0.05, 0];
  const rightShoulder: [number, number, number] = [0.4, 0.73, 0.02];
  const leftShoulder: [number, number, number] = [-0.4, 0.73, 0.02];
  const rightHip: [number, number, number] = [0.145, 0.13, 0];
  const leftHip: [number, number, number] = [-0.145, 0.13, 0];

  // ---- Animation phase (for walk/run) ----
  const phase = useRef(0);
  const lastSpeed = useRef(0);
  useFrame((_, delta) => {
    if (!rag && !p.fixedPose && p.speed > 0.1) {
      phase.current += p.speed * delta;
      lastSpeed.current = p.speed;
    } else if (p.fixedPose || p.speed < 0.05) {
      if (lastSpeed.current > 0.1) phase.current = 0;
      lastSpeed.current = 0;
    }
  });

  // ---- Helper to get cyclic value (only for walk/run) ----
  const cycle = (offset: number, amp: number) => (p.fixedPose ? 0 : Math.sin(phase.current + offset) * amp * moveAmount);

  // ---- Per‑state target rotations (for fixed poses: jump/fall) ----
  const getFixedArmAngles = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    if (animState === "jump") {
      // Arms up, elbows slightly bent
      return { shoulder: new THREE.Vector3(-0.8 * sign, 0.2 * sign, -0.2), elbow: new THREE.Vector3(0.5 * sign, 0, 0) };
    } else { // fall
      // Arms out for balance
      return { shoulder: new THREE.Vector3(0.3 * sign, 0.8 * sign, 0.1), elbow: new THREE.Vector3(0.2 * sign, 0, 0) };
    }
  };

  const getFixedLegAngles = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    if (animState === "jump") {
      // Legs tucked
      return { hip: new THREE.Vector3(-0.9 * sign, 0, 0), knee: new THREE.Vector3(1.2 * sign, 0, 0), ankle: 0 };
    } else { // fall
      // Legs slightly spread
      return { hip: new THREE.Vector3(0.2 * sign, 0.3 * sign, 0), knee: new THREE.Vector3(0.2 * sign, 0, 0), ankle: 0 };
    }
  };

  // ---- Dynamic rotations (walk/run) ----
  const getArmRotation = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    const forward = cycle(0, p.armSwing) * sign;
    const lateral = cycle(Math.PI / 2, 0.12 * moveAmount) * sign;
    const elbowFlex = Math.PI / 2 + cycle(Math.PI / 2, p.elbowBend * 0.7);
    return { shoulder: new THREE.Vector3(forward, lateral, 0.08), elbow: new THREE.Vector3(elbowFlex * sign, 0, 0) };
  };

  const getLegRotation = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    const forward = cycle(Math.PI, p.legSwing) * sign;
    const abduction = cycle(Math.PI / 2, 0.08 * moveAmount) * sign;
    const kneeBend = 0.4 + cycle(Math.PI, p.kneeLift) * 0.8;
    const ankleTilt = cycle(0, 0.2 * moveAmount) * sign;
    return { hip: new THREE.Vector3(forward, abduction, 0), knee: new THREE.Vector3(kneeBend * sign, 0, 0), ankle: ankleTilt };
  };

  // ---- Torso twist and idle breathing ----
  const twist = cycle(0, p.torsoTwist);
  const hipSway = cycle(Math.PI / 2, p.hipSway);
  const headBob = Math.abs(cycle(0, p.headBob));
  const breathing = p.breathing > 0 ? Math.sin(Date.now() * 0.003) * p.breathing : 0;

  // ---- Articulated arm ----
  const ArticulatedArm = ({ side, shoulderPos }: { side: 'right' | 'left'; shoulderPos: THREE.Vector3Tuple }) => {
    const armGroup = useRef<THREE.Group>(null);
    const lowerArmGroup = useRef<THREE.Group>(null);
    useFrame(() => {
      if (armGroup.current && !rag) {
        let shoulderRot, elbowRot;
        if (p.fixedPose) {
          const fixed = getFixedArmAngles(side);
          shoulderRot = fixed.shoulder;
          elbowRot = fixed.elbow;
        } else {
          const dynamic = getArmRotation(side);
          shoulderRot = dynamic.shoulder;
          elbowRot = dynamic.elbow;
        }
        armGroup.current.rotation.set(shoulderRot.x, shoulderRot.y, shoulderRot.z);
        if (lowerArmGroup.current) lowerArmGroup.current.rotation.set(elbowRot.x, elbowRot.y, elbowRot.z);
      }
    });
    return (
      <group ref={armGroup} position={shoulderPos}>
        <mesh geometry={upperArmGeo} material={bodyMat} position={[0, -0.215, 0]} castShadow />
        <group ref={lowerArmGroup} position={[0, -0.43, 0]}>
          <mesh geometry={lowerArmGeo} material={bodyMat} position={[0, -0.195, 0]} castShadow />
          <mesh geometry={handGeo} material={bodyMat} position={[0.01 * (side === 'right' ? 1 : -1), -0.39, 0.05]} castShadow />
        </group>
      </group>
    );
  };

  // ---- Articulated leg ----
  const ArticulatedLeg = ({ side, hipPos }: { side: 'right' | 'left'; hipPos: THREE.Vector3Tuple }) => {
    const legGroup = useRef<THREE.Group>(null);
    const lowerLegGroup = useRef<THREE.Group>(null);
    const footGroup = useRef<THREE.Group>(null);
    useFrame(() => {
      if (legGroup.current && !rag) {
        let hipRot, kneeRot, ankleRot;
        if (p.fixedPose) {
          const fixed = getFixedLegAngles(side);
          hipRot = fixed.hip;
          kneeRot = fixed.knee;
          ankleRot = fixed.ankle;
        } else {
          const dynamic = getLegRotation(side);
          hipRot = dynamic.hip;
          kneeRot = dynamic.knee;
          ankleRot = dynamic.ankle;
        }
        legGroup.current.rotation.set(hipRot.x, hipRot.y, hipRot.z);
        if (lowerLegGroup.current) lowerLegGroup.current.rotation.set(kneeRot.x, kneeRot.y, kneeRot.z);
        if (footGroup.current) footGroup.current.rotation.set(ankleRot, 0, 0);
      }
    });
    return (
      <group ref={legGroup} position={hipPos}>
        <mesh geometry={upperLegGeo} material={limbMat} position={[0, -0.235, 0]} castShadow />
        <group ref={lowerLegGroup} position={[0, -0.47, 0]}>
          <mesh geometry={lowerLegGeo} material={limbMat} position={[0, -0.19, 0]} castShadow />
          <group ref={footGroup} position={[0, -0.38, 0]}>
            <mesh geometry={footGeo} material={limbMat} position={[0, -0.07, 0.08]} castShadow />
          </group>
        </group>
      </group>
    );
  };

  // ---- Render ----
  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        {/* Torso with twist, hip sway, and breathing offset */}
        <group rotation={rag ? undefined : [0, twist, 0]} position={ragTorso || [0, hipSway + breathing * 0.1, 0]}>
          <mesh geometry={torsoGeo} material={bodyMat} position={torsoPos} castShadow receiveShadow />
        </group>

        <mesh geometry={neckGeo} material={bodyMat} position={neckPos} castShadow />
        <group position={ragHead || headPos}>
          <mesh geometry={headGeo} material={headMat} position={[0, headBob + breathing * 0.05, 0]} castShadow />
        </group>

        <mesh geometry={hipGeo} material={bodyMat} position={hipPos} castShadow />

        {/* Arms */}
        {!rag ? (
          <>
            <ArticulatedArm side="right" shoulderPos={rightShoulder} />
            <ArticulatedArm side="left" shoulderPos={leftShoulder} />
          </>
        ) : (
          // Ragdoll fallback (simple static)
          <>
            <group position={ragRightArm || rightShoulder}>
              <mesh geometry={upperArmGeo} material={bodyMat} position={[0, -0.2, 0]} castShadow />
              <mesh geometry={handGeo} material={bodyMat} position={[0.02, -0.6, 0.05]} castShadow />
            </group>
            <group position={ragLeftArm || leftShoulder}>
              <mesh geometry={upperArmGeo} material={bodyMat} position={[0, -0.2, 0]} castShadow />
              <mesh geometry={handGeo} material={bodyMat} position={[-0.02, -0.6, 0.05]} castShadow />
            </group>
          </>
        )}

        {/* Legs */}
        {!rag ? (
          <>
            <ArticulatedLeg side="right" hipPos={rightHip} />
            <ArticulatedLeg side="left" hipPos={leftHip} />
          </>
        ) : (
          <>
            <group position={ragRightLeg || rightHip}>
              <mesh geometry={upperLegGeo} material={limbMat} position={[0, -0.235, 0]} castShadow />
              <mesh geometry={footGeo} material={limbMat} position={[0, -0.62, 0.08]} castShadow />
            </group>
            <group position={ragLeftLeg || leftHip}>
              <mesh geometry={upperLegGeo} material={limbMat} position={[0, -0.235, 0]} castShadow />
              <mesh geometry={footGeo} material={limbMat} position={[0, -0.62, 0.08]} castShadow />
            </group>
          </>
        )}

        {/* Name tag */}
        <Html position={[0, 1.25, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
