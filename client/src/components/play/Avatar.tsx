import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  const anim = player.motors.animation;
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const maxSpeed = Math.max(1, player.runSpeed || player.speed);
  const moveAmount = Math.min(1, horiz / maxSpeed);
  const isRunning = anim === "run";
  const isWalking = anim === "walk";
  const walkSpeed = isRunning ? 6.5 : isWalking ? 4.2 : 0;

  // Gait parameters – feel free to tweak
  const strideFactor = moveAmount * (isRunning ? 1.4 : 1.0);
  const armSwingRange = 0.9 * strideFactor;
  const legSwingRange = 0.85 * strideFactor;
  const elbowBendFactor = 0.5 + 0.4 * strideFactor;
  const kneeLiftFactor = 0.3 + 0.6 * strideFactor;
  const torsoTwistRange = 0.25 * strideFactor;
  const hipSwayRange = 0.07 * strideFactor;
  const headBobRange = 0.05 * strideFactor;

  // Orientation
  const upVec = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upVec);

  // Ragdoll overrides
  const rag = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const off = (k: string) => (rag && rag[k] ? rag[k] : null);
  const ragTorso = off("torso");
  const ragHead = off("head");
  const ragRightArm = off("rightArm");
  const ragLeftArm = off("leftArm");
  const ragRightLeg = off("rightLeg");
  const ragLeftLeg = off("leftLeg");

  // Materials
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.55, metalness: 0.05 }),
    [player.color]
  );
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x7a3e19, roughness: 0.6 }), []);
  const limbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.7 }), []);

  // ---------- Geometry (final size, no scaling) ----------
  // Torso
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

  // Upper arm
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

  // Lower arm
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

  // Upper leg
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

  // Lower leg
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

  // ---------- Joint positions (new final size) ----------
  const torsoPos: [number, number, number] = [0, 0.36, 0];
  const neckPos: [number, number, number] = [0, 0.82, 0];
  const headPos: [number, number, number] = [0, 1.11, 0];
  const hipPos: [number, number, number] = [0, -0.05, 0];

  const shoulderY = 0.73;
  const rightShoulder: [number, number, number] = [0.4, shoulderY, 0.02];
  const leftShoulder: [number, number, number] = [-0.4, shoulderY, 0.02];

  const hipJointY = 0.13;
  const rightHip: [number, number, number] = [0.145, hipJointY, 0];
  const leftHip: [number, number, number] = [-0.145, hipJointY, 0];

  // ---------- Animation state ----------
  const phase = useRef(0);
  const lastWalkSpeed = useRef(0);

  useFrame((_, delta) => {
    if (!rag && walkSpeed > 0.1) {
      // Phase advances with ground speed
      const stepDelta = walkSpeed * delta * (isRunning ? 1.3 : 1.0);
      phase.current += stepDelta;
      lastWalkSpeed.current = walkSpeed;
    } else if (walkSpeed < 0.05 && lastWalkSpeed.current > 0.1) {
      // Reset phase when stopping to avoid twitching
      phase.current = 0;
      lastWalkSpeed.current = 0;
    }
  });

  // Helper to get smooth gait value (sine with offset for left/right)
  const gait = (offset: number, amplitude: number) => Math.sin(phase.current + offset) * amplitude;

  // ---------- Limb orientation builders (used inside useFrame) ----------
  const getArmRotation = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    const forward = gait(0, armSwingRange) * sign;
    const lateral = gait(Math.PI / 2, 0.12 * strideFactor) * sign;
    const elbowFlex = Math.PI / 2 + Math.sin(phase.current + Math.PI / 2) * elbowBendFactor * 0.7;
    return { shoulder: new THREE.Vector3(forward, lateral, 0.08), elbow: new THREE.Vector3(elbowFlex * sign, 0, 0) };
  };

  const getLegRotation = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    // Legs move opposite to arms
    const forward = gait(Math.PI, legSwingRange) * sign;
    const abduction = gait(Math.PI / 2, 0.08 * strideFactor) * sign;
    // Knee bend – more when leg is swinging forward
    const kneeBendRaw = Math.sin(phase.current + Math.PI) * kneeLiftFactor;
    const kneeBend = Math.max(0.1, 0.4 + kneeBendRaw * 0.8);
    // Ankle tilt for toe‑off
    const ankleTilt = gait(0, 0.2 * strideFactor) * sign;
    return { hip: new THREE.Vector3(forward, abduction, 0), knee: new THREE.Vector3(kneeBend * sign, 0, 0), ankle: ankleTilt };
  };

  // Torso twist and hip sway
  const torsoTwist = gait(0, torsoTwistRange);
  const hipSway = gait(Math.PI / 2, hipSwayRange);
  const headBob = Math.abs(gait(0, headBobRange));

  // ----- Articulated arm component (updates every frame) -----
  const ArticulatedArm = ({ side, shoulderPos }: { side: 'right' | 'left'; shoulderPos: THREE.Vector3Tuple }) => {
    const armGroup = useRef<THREE.Group>(null);
    const lowerArmGroup = useRef<THREE.Group>(null);
    useFrame(() => {
      if (armGroup.current && !rag) {
        const { shoulder, elbow } = getArmRotation(side);
        armGroup.current.rotation.set(shoulder.x, shoulder.y, shoulder.z);
        if (lowerArmGroup.current) lowerArmGroup.current.rotation.set(elbow.x, elbow.y, elbow.z);
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

  // ----- Articulated leg component -----
  const ArticulatedLeg = ({ side, hipPos }: { side: 'right' | 'left'; hipPos: THREE.Vector3Tuple }) => {
    const legGroup = useRef<THREE.Group>(null);
    const lowerLegGroup = useRef<THREE.Group>(null);
    const footGroup = useRef<THREE.Group>(null);
    useFrame(() => {
      if (legGroup.current && !rag) {
        const { hip, knee, ankle } = getLegRotation(side);
        legGroup.current.rotation.set(hip.x, hip.y, hip.z);
        if (lowerLegGroup.current) lowerLegGroup.current.rotation.set(knee.x, knee.y, knee.z);
        if (footGroup.current) footGroup.current.rotation.set(ankle, 0, 0);
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

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        {/* Torso with twist and hip sway */}
        <group rotation={rag ? undefined : [0, torsoTwist, 0]} position={ragTorso || [0, hipSway, 0]}>
          <mesh geometry={torsoGeo} material={bodyMat} position={torsoPos} castShadow receiveShadow />
        </group>

        {/* Neck and head with bob */}
        <mesh geometry={neckGeo} material={bodyMat} position={neckPos} castShadow />
        <group position={ragHead || headPos}>
          <mesh geometry={headGeo} material={headMat} position={[0, headBob, 0]} castShadow />
        </group>

        {/* Hip piece (pelvis) */}
        <mesh geometry={hipGeo} material={bodyMat} position={hipPos} castShadow />

        {/* Arms */}
        {!rag ? (
          <>
            <ArticulatedArm side="right" shoulderPos={rightShoulder} />
            <ArticulatedArm side="left" shoulderPos={leftShoulder} />
          </>
        ) : (
          // Ragdoll fallback: simple static limbs
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
