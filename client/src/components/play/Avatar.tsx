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
  const isRunning = anim === "run";
  const isWalking = anim === "walk";
  const speedFactor = isRunning ? 1.4 : isWalking ? 0.7 : 0;
  const swingSpeed = isRunning ? 13 : isWalking ? 8.5 : 0;
  const intensity = moveAmount * (isRunning ? 1.2 : 0.9);

  // Orientation
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

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
  const bodyMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.55, metalness: 0.05 }),
    [player.color]
  );
  const headMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x7a3e19, roughness: 0.6 }), []);
  const limbMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.7 }), []);

  // ---------- Geometries (segmented for articulation) ----------
  // Torso, neck, head, hips (unchanged from original)
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
  const hipGeo = useMemo(() => new RoundedBoxGeometry(1.55, 0.68, 0.95, 10, 0.38), []);

  // Upper arm (from shoulder to elbow)
  const upperArmGeo = useMemo(() => {
    const length = 1.25, width = 0.58, depth = 0.62, radius = 0.32;
    const geo = new RoundedBoxGeometry(width, length, depth, 10, radius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = (y + length / 2) / length;
      const widthScale = 1.0 - t * 0.3;
      positions.setX(i, positions.getX(i) * widthScale);
      positions.setZ(i, positions.getZ(i) - 0.05 * Math.sin(Math.PI * t));
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Lower arm (elbow to hand)
  const lowerArmGeo = useMemo(() => {
    const length = 1.15, width = 0.48, depth = 0.55, radius = 0.28;
    const geo = new RoundedBoxGeometry(width, length, depth, 8, radius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = (y + length / 2) / length;
      positions.setX(i, positions.getX(i) * (1 - t * 0.4));
      positions.setZ(i, positions.getZ(i) * (1 - t * 0.2));
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  const handGeo = useMemo(() => new RoundedBoxGeometry(0.38, 0.45, 0.45, 8, 0.18), []);

  // Upper leg (hip to knee)
  const upperLegGeo = useMemo(() => {
    const length = 1.35, width = 0.52, depth = 0.68, radius = 0.32;
    const geo = new RoundedBoxGeometry(width, length, depth, 10, radius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = (y + length / 2) / length;
      const scale = 1.0 - t * 0.3;
      positions.setX(i, positions.getX(i) * scale);
      positions.setZ(i, positions.getZ(i) * scale);
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Lower leg (knee to ankle)
  const lowerLegGeo = useMemo(() => {
    const length = 1.1, width = 0.44, depth = 0.58, radius = 0.28;
    const geo = new RoundedBoxGeometry(width, length, depth, 8, radius);
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const t = (y + length / 2) / length;
      const scale = 1.0 - t * 0.25;
      positions.setX(i, positions.getX(i) * scale);
      positions.setZ(i, positions.getZ(i) * scale);
    }
    positions.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  const footGeo = useMemo(() => new RoundedBoxGeometry(0.6, 0.4, 0.95, 8, 0.2), []);

  // ---------- Reference positions (original layout, scaled later) ----------
  const torsoPos = [0, 1.05, 0];
  const neckPos = [0, 2.355, 0];
  const headPos = [0, 3.202, 0];
  const hipPos = [0, -0.144, 0];
  const shoulderY = 2.09;
  const hipY = 0.375;

  // Arm pivots
  const rightShoulderPos = [1.15, shoulderY, 0.04];
  const leftShoulderPos = [-1.15, shoulderY, 0.04];
  const rightElbowPos = [1.25, shoulderY - 1.25, 0.08];
  const leftElbowPos = [-1.25, shoulderY - 1.25, 0.08];

  // Leg pivots
  const rightHipPos = [0.42, hipY, 0];
  const leftHipPos = [-0.42, hipY, 0];
  const rightKneePos = [0.44, hipY - 1.35, 0];
  const leftKneePos = [-0.44, hipY - 1.35, 0];

  //--------- Animation state ----------
  const phase = useRef(0);
  const lastVelocity = useRef(0);

  useFrame((_, delta) => {
    if (!rag && swingSpeed > 0) {
      // Increment phase based on speed, more natural stepping
      const stepDelta = swingSpeed * delta * (isRunning ? 1.2 : 1);
      phase.current += stepDelta;
      // Smooth transition when stopping / starting
      if (moveAmount < 0.05 && lastVelocity.current > 0.1) phase.current = 0;
      lastVelocity.current = moveAmount;
    } else if (moveAmount < 0.05) {
      phase.current = 0;
    }
  });

  // Helper to compute limb angles (radians)
  const getArmAngles = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    const swing = Math.sin(phase.current) * intensity * 1.1;
    // Elbow bend: bends when arm swings forward, straightens when back
    const elbowBend = 0.4 + Math.sin(phase.current + Math.PI) * 0.35 * intensity;
    // Slight lateral swing
    const lateral = Math.sin(phase.current * 1.6) * 0.15 * intensity;
    return {
      shoulder: new THREE.Vector3(swing * sign, lateral, 0.1 * intensity),
      elbow: new THREE.Vector3(elbowBend * -sign, 0, 0),
    };
  };

  const getLegAngles = (side: 'right' | 'left') => {
    const sign = side === 'right' ? 1 : -1;
    // Opposite phase to arms for natural walk
    const legSwing = Math.sin(phase.current + Math.PI) * intensity * 0.9;
    // Knee lift increases with speed, higher during swing phase
    const kneeLift = 0.3 + Math.abs(Math.sin(phase.current + Math.PI)) * 0.45 * intensity;
    // Slight abduction
    const abduction = Math.sin(phase.current * 1.8) * 0.12 * intensity;
    return {
      hip: new THREE.Vector3(legSwing * sign, abduction, 0),
      knee: new THREE.Vector3(-kneeLift * sign, 0, 0),
    };
  };

  // Torso twist + head bob
  const torsoTwist = Math.sin(phase.current) * 0.2 * intensity;
  const headBobY = Math.abs(Math.sin(phase.current * 2)) * 0.04 * intensity;

  // ----- Component for articulated arms -----
  const ArticulatedArm = ({
    side,
    shoulderPos,
    elbowPos,
    upperArmLength = 1.25,
    lowerArmLength = 1.15,
  }: {
    side: 'right' | 'left';
    shoulderPos: [number, number, number];
    elbowPos: [number, number, number];
    upperArmLength: number;
    lowerArmLength: number;
  }) => {
    const groupRef = useRef<THREE.Group>(null);
    const upperRef = useRef<THREE.Mesh>(null);
    const lowerRef = useRef<THREE.Mesh>(null);
    const handRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
      if (groupRef.current && !rag) {
        const { shoulder, elbow } = getArmAngles(side);
        // Shoulder rotation (upper arm rotates from shoulder pivot)
        groupRef.current.rotation.set(shoulder.x, shoulder.y, shoulder.z);
        // Elbow rotation relative to upper arm
        if (upperRef.current && lowerRef.current) {
          lowerRef.current.rotation.set(elbow.x, elbow.y, elbow.z);
        }
      }
    });

    // Position helper: elbow at local (0, -upperArmLength/2, 0) relative to shoulder group
    return (
      <group ref={groupRef} position={shoulderPos}>
        {/* Upper arm extends downward */}
        <mesh ref={upperRef} geometry={upperArmGeo} material={bodyMaterial} position={[0, -upperArmLength / 2, 0]} castShadow />
        {/* Elbow joint group: rotates for lower arm */}
        <group position={[0, -upperArmLength, 0]}>
          <mesh ref={lowerRef} geometry={lowerArmGeo} material={bodyMaterial} position={[0, -lowerArmLength / 2, 0]} castShadow />
          {/* Hand attached at end of lower arm */}
          <mesh ref={handRef} geometry={handGeo} material={bodyMaterial} position={[0.02, -lowerArmLength, 0.14]} castShadow />
        </group>
      </group>
    );
  };

  // ----- Articulated Leg -----
  const ArticulatedLeg = ({
    side,
    hipPos,
    kneePos,
    upperLegLength = 1.35,
    lowerLegLength = 1.1,
  }: {
    side: 'right' | 'left';
    hipPos: [number, number, number];
    kneePos: [number, number, number];
    upperLegLength: number;
    lowerLegLength: number;
  }) => {
    const groupRef = useRef<THREE.Group>(null);
    const upperRef = useRef<THREE.Mesh>(null);
    const lowerRef = useRef<THREE.Mesh>(null);
    const footRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
      if (groupRef.current && !rag) {
        const { hip, knee } = getLegAngles(side);
        groupRef.current.rotation.set(hip.x, hip.y, hip.z);
        if (upperRef.current && lowerRef.current) {
          lowerRef.current.rotation.set(knee.x, knee.y, knee.z);
        }
      }
    });

    return (
      <group ref={groupRef} position={hipPos}>
        <mesh ref={upperRef} geometry={upperLegGeo} material={limbMaterial} position={[0, -upperLegLength / 2, 0]} castShadow />
        <group position={[0, -upperLegLength, 0]}>
          <mesh ref={lowerRef} geometry={lowerLegGeo} material={limbMaterial} position={[0, -lowerLegLength / 2, 0]} castShadow />
          <mesh ref={footRef} geometry={footGeo} material={limbMaterial} position={[0, -lowerLegLength, 0.18]} castShadow />
        </group>
      </group>
    );
  };

  // Scale factor (original to world)
  const SCALE = 0.294;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[player.size || 1, player.size || 1, player.size || 1]}>
        <group scale={[SCALE, SCALE, SCALE]}>
          {/* Torso with twist */}
          <group rotation={rag ? undefined : [0, torsoTwist, 0]}>
            <mesh geometry={torsoGeo} material={bodyMaterial} position={ragTorso || torsoPos} castShadow receiveShadow />
          </group>

          <mesh geometry={neckGeo} material={bodyMaterial} position={neckPos} castShadow />

          {/* Head bob */}
          <group position={ragHead || headPos}>
            <mesh geometry={headGeo} material={headMaterial} position={[0, headBobY, 0]} castShadow />
          </group>

          <mesh geometry={hipGeo} material={bodyMaterial} position={hipPos} castShadow />

          {/* Arms - replace old pivot groups with articulated versions */}
          {!rag ? (
            <>
              <ArticulatedArm side="right" shoulderPos={rightShoulderPos} elbowPos={rightElbowPos} upperArmLength={1.25} lowerArmLength={1.15} />
              <ArticulatedArm side="left" shoulderPos={leftShoulderPos} elbowPos={leftElbowPos} upperArmLength={1.25} lowerArmLength={1.15} />
            </>
          ) : (
            // Ragdoll fallback: simple static limbs
            <>
              <group position={ragRightArm || rightShoulderPos}>
                <mesh geometry={upperArmGeo} material={bodyMaterial} position={[0, -0.6, 0]} castShadow />
                <mesh geometry={handGeo} material={bodyMaterial} position={[0.02, -1.8, 0.14]} castShadow />
              </group>
              <group position={ragLeftArm || leftShoulderPos}>
                <mesh geometry={upperArmGeo} material={bodyMaterial} position={[0, -0.6, 0]} castShadow />
                <mesh geometry={handGeo} material={bodyMaterial} position={[0.02, -1.8, 0.14]} castShadow />
              </group>
            </>
          )}

          {/* Legs - articulated */}
          {!rag ? (
            <>
              <ArticulatedLeg side="right" hipPos={rightHipPos} kneePos={rightKneePos} upperLegLength={1.35} lowerLegLength={1.1} />
              <ArticulatedLeg side="left" hipPos={leftHipPos} kneePos={leftKneePos} upperLegLength={1.35} lowerLegLength={1.1} />
            </>
          ) : (
            // Ragdoll fallback
            <>
              <group position={ragRightLeg || rightHipPos}>
                <mesh geometry={upperLegGeo} material={limbMaterial} position={[0, -0.68, 0]} castShadow />
                <mesh geometry={footGeo} material={limbMaterial} position={[0, -1.8, 0.18]} castShadow />
              </group>
              <group position={ragLeftLeg || leftHipPos}>
                <mesh geometry={upperLegGeo} material={limbMaterial} position={[0, -0.68, 0]} castShadow />
                <mesh geometry={footGeo} material={limbMaterial} position={[0, -1.8, 0.18]} castShadow />
              </group>
            </>
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
