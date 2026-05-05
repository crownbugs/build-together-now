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

  // Original avatar colors
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

  // --- Geometries (exactly as your HTML) ---
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

  // --- Exact world positions from your HTML (before scaling) ---
  const torsoPos = [0, 1.05, 0];
  const neckPos = [0, 2.355, 0];
  const headPos = [0, 3.202, 0];
  const hipPos = [0, -0.144, 0];

  const naturalArmX = 1.15;        // from HTML calculation
  const armCenterY = 0.85;
  const shoulderY = 2.09;          // armCenterY + armLength/2 = 0.85 + 1.24
  const rightArmPos = [naturalArmX, armCenterY, 0.04];
  const leftArmPos = [-naturalArmX, armCenterY, 0.04];
  const rightHandPos = [naturalArmX + 0.02, -0.5, 0.18];
  const leftHandPos = [-naturalArmX - 0.02, -0.5, 0.18];

  const legCenterY = -0.85;
  const hipY = 0.375;              // legCenterY + legLength/2 = -0.85 + 1.225
  const rightLegPos = [0.42, legCenterY, 0];
  const leftLegPos = [-0.42, legCenterY, 0];
  const rightFootPos = [0.42, -2.07, 0.18];
  const leftFootPos = [-0.42, -2.07, 0.18];

  // --- Swing rotation helper (pivot at shoulder/hip) ---
  const swingRef = useRef(0);
  useFrame(() => {
    swingRef.current = Math.sin(runtime.time * swingSpeed) * 0.6 * moveAmount;
  });

  // Simple component to rotate a group around a pivot point
  const PivotGroup = ({ pivot, rot, children }) => {
    const groupRef = useRef<THREE.Group>(null);
    useFrame(() => {
      if (groupRef.current && !rag) {
        groupRef.current.rotation.set(rot.x, rot.y, rot.z);
      }
    });
    return <group ref={groupRef} position={pivot}>{children}</group>;
  };

  // Ragdoll overrides
  const ragTorso = off("torso");
  const ragHead = off("head");
  const ragRightArm = off("rightArm");
  const ragLeftArm = off("leftArm");
  const ragRightLeg = off("rightLeg");
  const ragLeftLeg = off("leftLeg");

  // Scale to match original avatar size (your original ~1.6 units, HTML ~5.45 => scale 0.294)
  const SCALE = 0.294;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        <group scale={[SCALE, SCALE, SCALE]}>
          {/* Torso */}
          <mesh geometry={torsoGeo} material={bodyMaterial} position={ragTorso || torsoPos} castShadow receiveShadow />
          {/* Neck */}
          <mesh geometry={neckGeo} material={bodyMaterial} position={neckPos} castShadow />
          {/* Head */}
          <mesh geometry={headGeo} material={headMaterial} position={ragHead || headPos} castShadow />
          {/* Hip */}
          <mesh geometry={hipGeo} material={bodyMaterial} position={hipPos} castShadow />

          {/* Right Arm + Hand with swing around shoulder */}
          {!rag ? (
            <PivotGroup pivot={[rightArmPos[0], shoulderY, rightArmPos[2]]} rot={new THREE.Vector3(swingRef.current, 0, 0.1)}>
              <mesh geometry={armGeo} material={bodyMaterial} position={[0, armCenterY - shoulderY, 0]} castShadow />
              <mesh geometry={handGeo} material={bodyMaterial} position={[0.02, -0.5 - shoulderY, 0.14]} castShadow />
            </PivotGroup>
          ) : (
            <group position={ragRightArm || rightArmPos}>
              <mesh geometry={armGeo} material={bodyMaterial} position={[0, 0, 0]} castShadow />
              <mesh geometry={handGeo} material={bodyMaterial} position={[0.02, -1.35, 0.14]} castShadow />
            </group>
          )}

          {/* Left Arm + Hand */}
          {!rag ? (
            <PivotGroup pivot={[leftArmPos[0], shoulderY, leftArmPos[2]]} rot={new THREE.Vector3(-swingRef.current, 0, -0.1)}>
              <mesh geometry={armGeo} material={bodyMaterial} position={[0, armCenterY - shoulderY, 0]} castShadow />
              <mesh geometry={handGeo} material={bodyMaterial} position={[-0.02, -0.5 - shoulderY, 0.14]} castShadow />
            </PivotGroup>
          ) : (
            <group position={ragLeftArm || leftArmPos}>
              <mesh geometry={armGeo} material={bodyMaterial} position={[0, 0, 0]} castShadow />
              <mesh geometry={handGeo} material={bodyMaterial} position={[-0.02, -1.35, 0.14]} castShadow />
            </group>
          )}

          {/* Right Leg + Foot with swing around hip */}
          {!rag ? (
            <PivotGroup pivot={[rightLegPos[0], hipY, rightLegPos[2]]} rot={new THREE.Vector3(-swingRef.current * 0.5, 0, 0)}>
              <mesh geometry={legGeo} material={legMaterial} position={[0, legCenterY - hipY, 0]} castShadow />
              <mesh geometry={footGeo} material={legMaterial} position={[0, -2.07 - hipY, 0.18]} castShadow />
            </PivotGroup>
          ) : (
            <group position={ragRightLeg || rightLegPos}>
              <mesh geometry={legGeo} material={legMaterial} position={[0, 0, 0]} castShadow />
              <mesh geometry={footGeo} material={legMaterial} position={[0, -1.22, 0.18]} castShadow />
            </group>
          )}

          {/* Left Leg + Foot */}
          {!rag ? (
            <PivotGroup pivot={[leftLegPos[0], hipY, leftLegPos[2]]} rot={new THREE.Vector3(swingRef.current * 0.5, 0, 0)}>
              <mesh geometry={legGeo} material={legMaterial} position={[0, legCenterY - hipY, 0]} castShadow />
              <mesh geometry={footGeo} material={legMaterial} position={[0, -2.07 - hipY, 0.18]} castShadow />
            </PivotGroup>
          ) : (
            <group position={ragLeftLeg || leftLegPos}>
              <mesh geometry={legGeo} material={legMaterial} position={[0, 0, 0]} castShadow />
              <mesh geometry={footGeo} material={legMaterial} position={[0, -1.22, 0.18]} castShadow />
            </group>
          )}
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
