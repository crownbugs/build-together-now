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

  // Materials (original avatar colors)
  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.55, metalness: 0.05 }),
    [player.color]
  );
  const headMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x7a3e19, roughness: 0.6 }),
    []
  );
  const legMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.7 }),
    []
  );

  // ---- Geometries (identical to your HTML) ----
  const torsoGeo = useMemo(() => {
    const torsoTopWidth = 2.4, torsoBottomWidth = 1.45, torsoHeight = 2.75, torsoDepth = 0.95, torsoRadius = 0.48;
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

  const neckGeo = useMemo(() => new THREE.CylinderGeometry(0.32, 0.38, 0.35, 18), []);
  const headGeo = useMemo(() => new THREE.SphereGeometry(0.82, 48, 48), []);

  const armGeo = useMemo(() => {
    const armLength = 2.48, armTopWidth = 0.58, armDepth = 0.62, radius = 0.32;
    const geo = new RoundedBoxGeometry(armTopWidth, armLength, armDepth, 12, radius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
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

  const handGeo = useMemo(() => new RoundedBoxGeometry(0.38, 0.45, 0.45, 8, 0.18), []);
  const hipGeo = useMemo(() => new RoundedBoxGeometry(1.55, 0.68, 0.95, 10, 0.38), []);

  const legGeo = useMemo(() => {
    const legLength = 2.45, legTopWidth = 0.52, legDepth = 0.68, radius = 0.32;
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

  const footGeo = useMemo(() => new RoundedBoxGeometry(0.6, 0.4, 0.95, 8, 0.2), []);

  // ---- Position calculations (exactly as HTML, then scaled) ----
  // Arm: armCenterY = 0.85, armLength = 2.48 => shoulderY = 0.85 + 1.24 = 2.09
  const naturalArmX = 1.15;  // from HTML final computed value
  const shoulderY = 2.09;
  // Hand offset relative to shoulder: In HTML, hand Y = -0.5, shoulder Y = 2.09 => diff = -2.59
  // Arm mesh local Y = -1.24, so hand local Y = -2.59 - (-1.24) = -1.35
  const handLocalY = -1.35;  // places hand exactly at bottom of arm (with slight overlap)
  const handLocalZ = 0.14;

  // Leg: legCenterY = -0.85, legLength = 2.45 => hipY = -0.85 + 1.225 = 0.375
  const hipY = 0.375;
  const legLocalY = -1.225;  // leg mesh center relative to hip
  // Foot: in HTML, foot Y = -2.07, hip Y = 0.375 => diff = -2.445
  // Leg mesh bottom = -1.225 - 1.225 = -2.45, foot height 0.4 => foot center should be at -2.45 - 0.2 = -2.65? But HTML foot is at -2.07 world, which is only 0.025 above leg bottom. Let's use HTML offset: foot world Y = -2.07, hip Y = 0.375 => foot relative to hip = -2.445. Leg mesh center relative to hip = -1.225, so foot local = -2.445 - (-1.225) = -1.22.
  const footLocalY = -1.22;  // matches HTML: foot slightly overlapping leg bottom
  const footLocalZ = 0.18;

  // Torso top: torsoY = 1.05, torsoHeight=2.75 => top at 2.425, neck bottom at 2.18, neck top at 2.53, head center at 3.202
  const torsoY = 1.05;
  const neckY = 2.355;
  const headY = 3.202;
  const hipWorldY = -0.144; // from HTML

  const swingRef = useRef(0);
  useFrame(() => {
    swingRef.current = Math.sin(runtime.time * swingSpeed) * 0.6 * moveAmount;
  });

  const Limb = ({ pivotPos, meshPos, geometry, material, rotation, ragPos, children }) => {
    if (rag && ragPos) {
      return (
        <group position={[ragPos.x, ragPos.y, ragPos.z]}>
          <mesh geometry={geometry} material={material} position={meshPos} castShadow />
          {children}
        </group>
      );
    }
    return (
      <group position={pivotPos} rotation={rotation}>
        <mesh geometry={geometry} material={material} position={meshPos} castShadow />
        {children}
      </group>
    );
  };

  const ragTorsoPos = off("torso") ? new THREE.Vector3(off("torso")!.x, off("torso")!.y, off("torso")!.z) : null;
  const ragHeadPos = off("head") ? new THREE.Vector3(off("head")!.x, off("head")!.y, off("head")!.z) : null;
  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;
  const ragRightLegPos = off("rightLeg") ? new THREE.Vector3(off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z) : null;
  const ragLeftLegPos = off("leftLeg") ? new THREE.Vector3(off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z) : null;

  const SCALE = 0.3; // matches original avatar size

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        <group scale={[SCALE, SCALE, SCALE]}>
          {/* Torso */}
          {!ragTorsoPos ? (
            <mesh geometry={torsoGeo} material={bodyMaterial} position={[0, torsoY, 0]} castShadow receiveShadow />
          ) : (
            <mesh geometry={torsoGeo} material={bodyMaterial} position={[ragTorsoPos.x, ragTorsoPos.y, ragTorsoPos.z]} castShadow receiveShadow />
          )}

          {/* Neck */}
          <mesh geometry={neckGeo} material={bodyMaterial} position={[0, neckY, 0]} castShadow />

          {/* Head (brown) */}
          {!ragHeadPos ? (
            <mesh geometry={headGeo} material={headMaterial} position={[0, headY, 0]} castShadow />
          ) : (
            <mesh geometry={headGeo} material={headMaterial} position={[ragHeadPos.x, ragHeadPos.y, ragHeadPos.z]} castShadow />
          )}

          {/* Hip */}
          <mesh geometry={hipGeo} material={bodyMaterial} position={[0, hipWorldY, 0]} castShadow />

          {/* Right Arm */}
          <Limb
            pivotPos={[naturalArmX, shoulderY, 0.04]}
            meshPos={[0, -1.24, 0]}
            geometry={armGeo}
            material={bodyMaterial}
            rotation={!rag ? new THREE.Euler(swingRef.current, 0, 0.1) : new THREE.Euler(0, 0, 0)}
            ragPos={ragRightArmPos}
          >
            <mesh geometry={handGeo} material={bodyMaterial} position={[0, handLocalY, handLocalZ]} castShadow />
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
            <mesh geometry={handGeo} material={bodyMaterial} position={[0, handLocalY, handLocalZ]} castShadow />
          </Limb>

          {/* Right Leg */}
          <Limb
            pivotPos={[0.42, hipY, 0]}
            meshPos={[0, legLocalY, 0]}
            geometry={legGeo}
            material={legMaterial}
            rotation={!rag ? new THREE.Euler(-swingRef.current * 0.5, 0, 0) : new THREE.Euler(0, 0, 0)}
            ragPos={ragRightLegPos}
          >
            <mesh geometry={footGeo} material={legMaterial} position={[0, footLocalY, footLocalZ]} castShadow />
          </Limb>

          {/* Left Leg */}
          <Limb
            pivotPos={[-0.42, hipY, 0]}
            meshPos={[0, legLocalY, 0]}
            geometry={legGeo}
            material={legMaterial}
            rotation={!rag ? new THREE.Euler(swingRef.current * 0.5, 0, 0) : new THREE.Euler(0, 0, 0)}
            ragPos={ragLeftLegPos}
          >
            <mesh geometry={footGeo} material={legMaterial} position={[0, footLocalY, footLocalZ]} castShadow />
          </Limb>
        </group>

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
