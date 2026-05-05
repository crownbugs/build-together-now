import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * 3rd-person character mesh. Clean blocky rig with distinct shoulders,
 * straight arms/legs, and proper proportions matching the reference drawing.
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  const anim = player.motors.animation;
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(1, horiz / Math.max(1, player.runSpeed || player.speed));
  const swingSpeed = anim === "run" ? 14 : anim === "walk" ? 9 : 0;
  const swing = Math.sin(runtime.time * swingSpeed) * 0.6 * moveAmount;
  const size = player.size || 1;

  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  const rag = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const off = (k: string) => (rag && rag[k] ? rag[k] : null);

  // Torso dimensions
  const torsoWidth = 0.52;
  const torsoHeight = 0.75;
  const torsoDepth = 0.32;
  const torsoYCenter = 0.15;

  // Shoulder positions – clearly protruding from sides of torso
  const shoulderY = torsoYCenter + torsoHeight * 0.35; // upper part of torso
  const shoulderX = torsoWidth * 0.5 + 0.06; // stick out past torso edge
  const rightShoulderPos = new THREE.Vector3(shoulderX, shoulderY, 0);
  const leftShoulderPos = new THREE.Vector3(-shoulderX, shoulderY, 0);

  // Arm positions – hang straight down from shoulders
  const armLength = 0.52;
  const rightArmPos = new THREE.Vector3(shoulderX, shoulderY - armLength * 0.5, 0);
  const leftArmPos = new THREE.Vector3(-shoulderX, shoulderY - armLength * 0.5, 0);

  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;

  // Leg positions – wider apart, straight down
  const legWidth = 0.22; // distance from center
  const legY = -0.35;
  const legLength = 0.55;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* TORSO – rounded box/capsule shape, clean and simple */}
        <group position={off("torso") ? [off("torso")!.x, off("torso")!.y, off("torso")!.z] : [0, torsoYCenter, 0]}>
          <mesh castShadow>
            <boxGeometry args={[torsoWidth, torsoHeight, torsoDepth]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Subtle rounding via slightly larger capsule overlay, or just use box for blocky look */}
        </group>

        {/* BELT (only when not ragdoll) */}
        {!rag && (
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[torsoWidth + 0.04, 0.08, torsoDepth + 0.04]} />
            <meshStandardMaterial color="#1f2733" roughness={0.7} />
          </mesh>
        )}

        {/* RIGHT SHOULDER – distinct joint sphere */}
        {!rag ? (
          <group position={rightShoulderPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            {/* RIGHT ARM – straight down from shoulder */}
            <group position={[0, -0.06, 0]} rotation={[swing, 0, 0]}>
              <mesh position={[0, -armLength * 0.4, 0]} castShadow>
                <capsuleGeometry args={[0.1, armLength, 6, 12]} />
                <meshStandardMaterial color={player.color} roughness={0.6} />
              </mesh>
              {/* Hand */}
              <mesh position={[0, -armLength - 0.02, 0]} castShadow>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshStandardMaterial color="#7a3e19" roughness={0.7} />
              </mesh>
            </group>
          </group>
        ) : (
          <group position={ragRightArmPos || rightArmPos} rotation={[0, 0, 0]}>
            <mesh position={[0, -armLength * 0.4, 0]} castShadow>
              <capsuleGeometry args={[0.1, armLength, 6, 12]} />
              <meshStandardMaterial color={player.color} roughness={0.6} />
            </mesh>
            <mesh position={[0, -armLength - 0.02, 0]} castShadow>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#7a3e19" roughness={0.7} />
            </mesh>
          </group>
        )}

        {/* LEFT SHOULDER – distinct joint sphere */}
        {!rag ? (
          <group position={leftShoulderPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            {/* LEFT ARM – straight down from shoulder */}
            <group position={[0, -0.06, 0]} rotation={[-swing, 0, 0]}>
              <mesh position={[0, -armLength * 0.4, 0]} castShadow>
                <capsuleGeometry args={[0.1, armLength, 6, 12]} />
                <meshStandardMaterial color={player.color} roughness={0.6} />
              </mesh>
              {/* Hand */}
              <mesh position={[0, -armLength - 0.02, 0]} castShadow>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshStandardMaterial color="#7a3e19" roughness={0.7} />
              </mesh>
            </group>
          </group>
        ) : (
          <group position={ragLeftArmPos || leftArmPos} rotation={[0, 0, 0]}>
            <mesh position={[0, -armLength * 0.4, 0]} castShadow>
              <capsuleGeometry args={[0.1, armLength, 6, 12]} />
              <meshStandardMaterial color={player.color} roughness={0.6} />
            </mesh>
            <mesh position={[0, -armLength - 0.02, 0]} castShadow>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#7a3e19" roughness={0.7} />
            </mesh>
          </group>
        )}

        {/* RIGHT LEG – wider apart, straight down */}
        <group position={off("rightLeg") ? [off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z] : [legWidth, legY, 0]} rotation={rag ? [0, 0, 0] : [-swing, 0, 0]}>
          <mesh position={[0, -legLength * 0.4, 0]} castShadow>
            <capsuleGeometry args={[0.12, legLength, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
          {/* Foot */}
          <mesh position={[0, -legLength - 0.05, 0.06]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.22]} />
            <meshStandardMaterial color="#1a1f2a" roughness={0.8} />
          </mesh>
        </group>

        {/* LEFT LEG – wider apart, straight down */}
        <group position={off("leftLeg") ? [off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z] : [-legWidth, legY, 0]} rotation={rag ? [0, 0, 0] : [swing, 0, 0]}>
          <mesh position={[0, -legLength * 0.4, 0]} castShadow>
            <capsuleGeometry args={[0.12, legLength, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
          {/* Foot */}
          <mesh position={[0, -legLength - 0.05, 0.06]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.22]} />
            <meshStandardMaterial color="#1a1f2a" roughness={0.8} />
          </mesh>
        </group>

        {/* HEAD – sits cleanly on top of torso */}
        <mesh position={off("head") ? [off("head")!.x, off("head")!.y, off("head")!.z] : [0, torsoYCenter + torsoHeight * 0.5 + 0.28, 0]} castShadow>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color="#7a3e19" roughness={0.6} />
        </mesh>
        
        {/* FACE */}
        {!rag && (
          <>
            <mesh position={[0, torsoYCenter + torsoHeight * 0.5 + 0.42, -0.02]} castShadow>
              <sphereGeometry args={[0.27, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#000000" roughness={0.85} />
            </mesh>
            <mesh position={[0.09, torsoYCenter + torsoHeight * 0.5 + 0.3, 0.24]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[-0.09, torsoYCenter + torsoHeight * 0.5 + 0.3, 0.24]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[0, torsoYCenter + torsoHeight * 0.5 + 0.18, 0.25]}>
              <torusGeometry args={[0.06, 0.01, 8, 16, Math.PI]} />
              <meshBasicMaterial color="#252525" />
            </mesh>
          </>
        )}

        {/* NAME TAG */}
        <Html position={[0, torsoYCenter + torsoHeight * 0.5 + 0.65, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
