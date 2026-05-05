import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";
import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  const anim = player.motors.animation;
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(1, horiz / Math.max(1, player.runSpeed || player.speed));
  const swingSpeed = anim === "run" ? 14 : anim === "walk" ? 9 : 0;

  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  const rag = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const off = (k: string) => (rag && rag[k] ? rag[k] : null);

  // --- Shared material ---
  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x3a3a3a,
        roughness: 0.75,
        metalness: 0.0,
      }),
    []
  );

  // --- Torso (tapered rounded box) ---
  const torsoGeo = useMemo(() => {
    const torsoTopWidth = 2.4;
    const torsoBottomWidth = 1.45;
    const torsoHeight = 2.75;
    const torsoDepth = 0.95;
    const torsoRadius = 0.48;
    const geo = new RoundedBoxGeometry(torsoBottomWidth, torsoHeight, torsoDepth, 10, torsoRadius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = (y + torsoHeight / 2) / torsoHeight;
      const widthScale = 1.0 + t * (torsoTopWidth / torsoBottomWidth - 1.0);
      positions.setX(i, positions.getX(i) * widthScale);
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // --- Neck (cylinder) ---
  const neckGeo = useMemo(() => {
    const neckHeight = 0.35;
    const neckTopRadius = 0.32;
    const neckBottomRadius = 0.38;
    return new THREE.CylinderGeometry(neckTopRadius, neckBottomRadius, neckHeight, 18);
  }, []);

  // --- Head (sphere) ---
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.82, 48, 48), []);

  // --- Arm geometry (tapered rounded box) ---
  const armGeo = useMemo(() => {
    const armLength = 2.48;
    const armTopWidth = 0.58;
    const armDepth = 0.62;
    const radius = 0.32;
    const geo = new RoundedBoxGeometry(armTopWidth, armLength, armDepth, 12, radius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const t = (y + armLength / 2) / armLength;
      const widthScale = 1.0 - t * 0.4;
      const curveZ = -0.1 * Math.sin(Math.PI * t);
      positions.setX(i, x * widthScale);
      positions.setZ(i, z + curveZ);
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // --- Hand geometry ---
  const handGeo = useMemo(() => new RoundedBoxGeometry(0.38, 0.45, 0.45, 8, 0.18), []);

  // --- Hip geometry ---
  const hipGeo = useMemo(() => {
    const hipWidth = 1.55;
    const hipHeight = 0.68;
    const hipDepth = 0.95;
    const hipRadius = 0.38;
    return new RoundedBoxGeometry(hipWidth, hipHeight, hipDepth, 10, hipRadius);
  }, []);

  // --- Leg geometry (tapered rounded box) ---
  const legGeo = useMemo(() => {
    const legLength = 2.45;
    const legTopWidth = 0.52;
    const legDepth = 0.68;
    const radius = 0.32;
    const geo = new RoundedBoxGeometry(legTopWidth, legLength, legDepth, 10, radius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = (y + legLength / 2) / legLength;
      const scale = 1.0 - t * 0.35;
      positions.setX(i, positions.getX(i) * scale);
      positions.setZ(i, positions.getZ(i) * scale);
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // --- Foot geometry ---
  const footGeo = useMemo(() => new RoundedBoxGeometry(0.6, 0.4, 0.95, 8, 0.2), []);

  // --- Compute shoulder X based on torso width at arm centre Y ---
  const torsoHeightVal = 2.75;
  const torsoBottomWidth = 1.45;
  const torsoTopWidth = 2.4;
  const torsoY = 1.05;
  const armCenterY = 0.85;
  const torsoHalfHeight = torsoHeightVal / 2;
  const armAttachT = (armCenterY + 2.48 / 2 - torsoY + torsoHalfHeight) / torsoHeightVal;
  const torsoWidthAtArmTop = torsoBottomWidth * (1.0 + armAttachT * (torsoTopWidth / torsoBottomWidth - 1.0));
  const edgeInset = 0.48 * 0.2; // torsoRadius * 0.2
  const naturalArmX = Math.min(torsoWidthAtArmTop / 2 - edgeInset + 0.58 / 2, 1.15);

  // --- Pivot points for swing animation ---
  const shoulderY = armCenterY + 2.48 / 2; // 0.85 + 1.24 = 2.09
  const hipY = -0.85 + 2.45 / 2; // -0.85 + 1.225 = 0.375

  // --- Swing value (updated in useFrame) ---
  const swingRef = useRef(0);
  useFrame(({ clock }) => {
    const time = runtime.time;
    const swingValue = Math.sin(time * swingSpeed) * 0.6 * moveAmount;
    swingRef.current = swingValue;
  });

  // --- Helper to build a limb with pivot rotation ---
  const Limb = ({
    pivotPos,
    meshPos,
    geometry,
    material,
    rotation,
    ragPos,
    children,
  }: {
    pivotPos: [number, number, number];
    meshPos: [number, number, number];
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    rotation: THREE.Euler;
    ragPos?: THREE.Vector3 | null;
    children?: React.ReactNode;
  }) => {
    const groupRef = useRef<THREE.Group>(null);
    // If ragdoll, use ragPos as group position and disable rotation
    if (rag && ragPos) {
      return (
        <group position={[ragPos.x, ragPos.y, ragPos.z]}>
          <mesh geometry={geometry} material={material} position={meshPos} castShadow />
          {children}
        </group>
      );
    }
    return (
      <group ref={groupRef} position={pivotPos} rotation={rotation}>
        <mesh geometry={geometry} material={material} position={meshPos} castShadow />
        {children}
      </group>
    );
  };

  // Get ragdoll positions if any
  const ragTorsoPos = off("torso") ? new THREE.Vector3(off("torso")!.x, off("torso")!.y, off("torso")!.z) : null;
  const ragHeadPos = off("head") ? new THREE.Vector3(off("head")!.x, off("head")!.y, off("head")!.z) : null;
  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;
  const ragRightLegPos = off("rightLeg") ? new THREE.Vector3(off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z) : null;
  const ragLeftLegPos = off("leftLeg") ? new THREE.Vector3(off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z) : null;

  // Face details (same as original)
  const FaceDetails = () => (
    <>
      <mesh position={[0.2, 0.15, 0.85]} castShadow>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#000000" roughness={0.85} />
      </mesh>
      <mesh position={[-0.2, 0.15, 0.85]} castShadow>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#000000" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.05, 0.85]} castShadow>
        <torusGeometry args={[0.12, 0.03, 8, 20, Math.PI]} />
        <meshStandardMaterial color="#111111" roughness={0.5} />
      </mesh>
    </>
  );

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        {/* Torso */}
        {!ragTorsoPos ? (
          <mesh geometry={torsoGeo} material={bodyMaterial} position={[0, 1.05, 0]} castShadow receiveShadow />
        ) : (
          <mesh geometry={torsoGeo} material={bodyMaterial} position={[ragTorsoPos.x, ragTorsoPos.y, ragTorsoPos.z]} castShadow receiveShadow />
        )}

        {/* Neck */}
        <mesh geometry={neckGeo} material={bodyMaterial} position={[0, 2.355, 0]} castShadow />

        {/* Head */}
        {!ragHeadPos ? (
          <group position={[0, 3.202, 0]}>
            <mesh geometry={headGeo} material={bodyMaterial} castShadow />
            {!rag && <FaceDetails />}
          </group>
        ) : (
          <group position={[ragHeadPos.x, ragHeadPos.y, ragHeadPos.z]}>
            <mesh geometry={headGeo} material={bodyMaterial} castShadow />
          </group>
        )}

        {/* Hip / pelvis */}
        <mesh geometry={hipGeo} material={bodyMaterial} position={[0, -0.144, 0]} castShadow />

        {/* Right Arm */}
        <Limb
          pivotPos={[naturalArmX, shoulderY, 0.04]}
          meshPos={[0, -1.24, 0]}
          geometry={armGeo}
          material={bodyMaterial}
          rotation={!rag ? new THREE.Euler(swingRef.current, 0, 0.1) : new THREE.Euler(0, 0, 0)}
          ragPos={ragRightArmPos}
        >
          <mesh geometry={handGeo} material={bodyMaterial} position={[0, -1.24 - 0.225, 0.14]} castShadow />
        </Limb>

        {/* Left Arm */}
        <Limb
          pivotPos={[-naturalArmX, shoulderY, 0.04]}
          meshPos={[0, -1.24, 0]}
          geometry={armGeo}
          material={bodyMaterial}
          rotation={!rag ? new THREE.Euler(-swingRef.current, 0, -0.1) : new THREE.Euler(0, 0, 0)}
          ragPos={ragLeftArmPos}
        >
          <mesh geometry={handGeo} material={bodyMaterial} position={[0, -1.24 - 0.225, 0.14]} castShadow />
        </Limb>

        {/* Right Leg */}
        <Limb
          pivotPos={[0.42, hipY, 0]}
          meshPos={[0, -1.225, 0]}
          geometry={legGeo}
          material={bodyMaterial}
          rotation={!rag ? new THREE.Euler(-swingRef.current * 0.5, 0, 0) : new THREE.Euler(0, 0, 0)}
          ragPos={ragRightLegPos}
        >
          <mesh geometry={footGeo} material={bodyMaterial} position={[0, -1.225 - 0.2, 0.18]} castShadow />
        </Limb>

        {/* Left Leg */}
        <Limb
          pivotPos={[-0.42, hipY, 0]}
          meshPos={[0, -1.225, 0]}
          geometry={legGeo}
          material={bodyMaterial}
          rotation={!rag ? new THREE.Euler(swingRef.current * 0.5, 0, 0) : new THREE.Euler(0, 0, 0)}
          ragPos={ragLeftLegPos}
        >
          <mesh geometry={footGeo} material={bodyMaterial} position={[0, -1.225 - 0.2, 0.18]} castShadow />
        </Limb>

        {/* Name tag */}
        <Html position={[0, 3.8, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
