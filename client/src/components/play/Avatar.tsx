import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * 3rd-person character mesh. Pill-shaped torso: flat sides with rounded top/bottom edges.
 * Distinct shoulders, straight arms/legs, matching the reference drawing structure.
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

  // Torso dimensions - pill shape: wide, not too tall, rounded edges
  const torsoWidth = 0.48;   // how wide the body is
  const torsoHeight = 0.68;  // total height including rounded ends
  const torsoDepth = 0.32;   // thickness front-to-back
  const cornerRadius = 0.16; // how rounded the top/bottom edges are
  
  const torsoYCenter = 0.12;

  // Shoulder positions - stick out from the flat sides of the pill
  const shoulderY = torsoYCenter + torsoHeight * 0.25; // upper-mid section where flat sides are
  const shoulderX = torsoWidth * 0.5 + 0.08; // clearly past the torso edge
  const rightShoulderPos = new THREE.Vector3(shoulderX, shoulderY, 0);
  const leftShoulderPos = new THREE.Vector3(-shoulderX, shoulderY, 0);

  // Arm positions - hang straight down from shoulders
  const armLength = 0.5;
  const rightArmPos = new THREE.Vector3(shoulderX, shoulderY - armLength * 0.5, 0);
  const leftArmPos = new THREE.Vector3(-shoulderX, shoulderY - armLength * 0.5, 0);

  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;

  // Leg positions - wider apart, straight down
  const legWidth = 0.2;
  const legY = -0.38;
  const legLength = 0.52;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* PILL-SHAPED TORSO - rounded box: flat sides, rounded top/bottom edges */}
        <group position={off("torso") ? [off("torso")!.x, off("torso")!.y, off("torso")!.z] : [0, torsoYCenter, 0]}>
          {/* Main flat body */}
          <mesh castShadow>
            <boxGeometry args={[torsoWidth, torsoHeight - cornerRadius * 2, torsoDepth]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Top rounded edge */}
          <mesh position={[0, (torsoHeight - cornerRadius * 2) * 0.5, 0]} castShadow>
            <cylinderGeometry args={[torsoDepth * 0.5, torsoDepth * 0.5, torsoWidth, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[0, (torsoHeight - cornerRadius * 2) * 0.5, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <cylinderGeometry args={[torsoDepth * 0.5, torsoDepth * 0.5, torsoWidth, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Bottom rounded edge */}
          <mesh position={[0, -(torsoHeight - cornerRadius * 2) * 0.5, 0]} castShadow>
            <cylinderGeometry args={[torsoDepth * 0.5, torsoDepth * 0.5, torsoWidth, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[0, -(torsoHeight - cornerRadius * 2) * 0.5, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
            <cylinderGeometry args={[torsoDepth * 0.5, torsoDepth * 0.5, torsoWidth, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Top cap sphere quarters for smooth corners */}
          <mesh position={[torsoWidth * 0.5 - cornerRadius, (torsoHeight - cornerRadius * 2) * 0.5, 0]} castShadow>
            <sphereGeometry args={[cornerRadius, 12, 12, 0, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[-(torsoWidth * 0.5 - cornerRadius), (torsoHeight - cornerRadius * 2) * 0.5, 0]} castShadow>
            <sphereGeometry args={[cornerRadius, 12, 12, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Bottom cap sphere quarters */}
          <mesh position={[torsoWidth * 0.5 - cornerRadius, -(torsoHeight - cornerRadius * 2) * 0.5, 0]} castShadow>
            <sphereGeometry args={[cornerRadius, 12, 12, 0, Math.PI / 2, Math.PI, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[-(torsoWidth * 0.5 - cornerRadius), -(torsoHeight - cornerRadius * 2) * 0.5, 0]} castShadow>
            <sphereGeometry args={[cornerRadius, 12, 12, Math.PI / 2, Math.PI / 2, Math.PI, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
        </group>

        {/* BELT (only when not ragdoll) */}
        {!rag && (
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[torsoWidth + 0.02, 0.08, torsoDepth + 0.02]} />
            <meshStandardMaterial color="#1f2733" roughness={0.7} />
          </mesh>
        )}

        {/* RIGHT SHOULDER & ARM */}
        {!rag ? (
          <group position={rightShoulderPos}>
            {/* Shoulder joint */}
            <mesh castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            {/* Arm - straight down */}
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

        {/* LEFT SHOULDER & ARM */}
        {!rag ? (
          <group position={leftShoulderPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            <group position={[0, -0.06, 0]} rotation={[-swing, 0, 0]}>
              <mesh position={[0, -armLength * 0.4, 0]} castShadow>
                <capsuleGeometry args={[0.1, armLength, 6, 12]} />
                <meshStandardMaterial color={player.color} roughness={0.6} />
              </mesh>
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

        {/* RIGHT LEG */}
        <group position={off("rightLeg") ? [off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z] : [legWidth, legY, 0]} rotation={rag ? [0, 0, 0] : [-swing, 0, 0]}>
          <mesh position={[0, -legLength * 0.4, 0]} castShadow>
            <capsuleGeometry args={[0.12, legLength, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
          <mesh position={[0, -legLength - 0.05, 0.06]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.22]} />
            <meshStandardMaterial color="#1a1f2a" roughness={0.8} />
          </mesh>
        </group>

        {/* LEFT LEG */}
        <group position={off("leftLeg") ? [off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z] : [-legWidth, legY, 0]} rotation={rag ? [0, 0, 0] : [swing, 0, 0]}>
          <mesh position={[0, -legLength * 0.4, 0]} castShadow>
            <capsuleGeometry args={[0.12, legLength, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
          <mesh position={[0, -legLength - 0.05, 0.06]} castShadow>
            <boxGeometry args={[0.14, 0.08, 0.22]} />
            <meshStandardMaterial color="#1a1f2a" roughness={0.8} />
          </mesh>
        </group>

        {/* HEAD */}
        <mesh position={off("head") ? [off("head")!.x, off("head")!.y, off("head")!.z] : [0, torsoYCenter + torsoHeight * 0.5 + 0.24, 0]} castShadow>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color="#7a3e19" roughness={0.6} />
        </mesh>
        
        {/* FACE */}
        {!rag && (
          <>
            <mesh position={[0, torsoYCenter + torsoHeight * 0.5 + 0.38, -0.02]} castShadow>
              <sphereGeometry args={[0.27, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#000000" roughness={0.85} />
            </mesh>
            <mesh position={[0.09, torsoYCenter + torsoHeight * 0.5 + 0.26, 0.24]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[-0.09, torsoYCenter + torsoHeight * 0.5 + 0.26, 0.24]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[0, torsoYCenter + torsoHeight * 0.5 + 0.14, 0.25]}>
              <torusGeometry args={[0.06, 0.01, 8, 16, Math.PI]} />
              <meshBasicMaterial color="#252525" />
            </mesh>
          </>
        )}

        {/* NAME TAG */}
        <Html position={[0, torsoYCenter + torsoHeight * 0.5 + 0.6, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
