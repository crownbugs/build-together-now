import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * 3rd-person character mesh. Pill-shaped torso using a scaled capsule:
 * squashed horizontally to be wider than it is tall, giving flat sides
 * with rounded top/bottom edges — exactly like the reference drawing.
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

  // PILL TORSO: Use a capsule but scale it to be wide and not too tall
  // This creates flat-ish sides with rounded top/bottom edges
  const torsoRadius = 0.18;     // thickness (controls how "round" the edges are)
  const torsoWidth = 0.52;      // total width of the pill
  const torsoHeight = 0.62;     // total height
  
  // The capsule length is the straight cylinder part
  // We want the pill to be wide, so we rotate the capsule 90° and scale
  const capsuleLength = torsoWidth - torsoRadius * 2; // straight part width
  
  const torsoYCenter = 0.12;

  // Shoulders - positioned on the flat side area of the pill
  const shoulderY = torsoYCenter + 0.12;
  const shoulderX = torsoWidth * 0.5 + 0.06;
  const rightShoulderPos = new THREE.Vector3(shoulderX, shoulderY, 0);
  const leftShoulderPos = new THREE.Vector3(-shoulderX, shoulderY, 0);

  // Arms
  const armLength = 0.5;
  const rightArmPos = new THREE.Vector3(shoulderX, shoulderY - armLength * 0.5, 0);
  const leftArmPos = new THREE.Vector3(-shoulderX, shoulderY - armLength * 0.5, 0);

  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;

  // Legs
  const legWidth = 0.2;
  const legY = -0.38;
  const legLength = 0.52;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* PILL-SHAPED TORSO 
            Rotate capsule 90° on Z so it lays horizontal, then scale Y up 
            to make it tall enough. Result: wide pill with flat-ish sides 
            and rounded top/bottom edges */}
        <group position={off("torso") ? [off("torso")!.x, off("torso")!.y, off("torso")!.z] : [0, torsoYCenter, 0]}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]} scale={[1, torsoHeight / (capsuleLength + torsoRadius * 2), 1]}>
            <capsuleGeometry args={[torsoRadius, capsuleLength, 12, 24]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
        </group>

        {/* BELT */}
        {!rag && (
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[torsoWidth + 0.02, 0.08, torsoRadius * 2 + 0.02]} />
            <meshStandardMaterial color="#1f2733" roughness={0.7} />
          </mesh>
        )}

        {/* RIGHT SHOULDER & ARM */}
        {!rag ? (
          <group position={rightShoulderPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            <group position={[0, -0.06, 0]} rotation={[swing, 0, 0]}>
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

        {/* LEGS */}
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
        <group position={off("leftLeg") ? [off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z] : [-legWidth, legY, 0]} rotation={rag ? [0, 0, 0] : [swing, 0, 0]}>
          <mesh position={[0, -legLength * 0.4, 0]} castShadow>
            <capsuleGeometry args={[0.12, legLength, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
          <mesh position={[0, -legLength - 0.05, 0.06]} castShadow>
            THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;

  // Legs
  const legWidth = 0.2;
  const legY = -0.38;
  const legLength = 0.52;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* PILL-SHAPED TORSO 
            Rotate capsule 90° on Z so it lays horizontal, then scale Y up 
            to make it tall enough. Result: wide pill with flat-ish sides 
            and rounded top/bottom edges */}
        <group position={off("torso") ? [off("torso")!.x, off("torso")!.y, off("torso")!.z] : [0, torsoYCenter, 0]}>
          <mesh castShadow rotation={[0, 0, Math.PI / 2]} scale={[1, torsoHeight / (capsuleLength + torsoRadius * 2), 1]}>
            <capsuleGeometry args={[torsoRadius, capsuleLength, 12, 24]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
        </group>

        {/* BELT */}
        {!rag && (
          <mesh position={[0, -0.22, 0]} castShadow>
            <boxGeometry args={[torsoWidth + 0.02, 0.08, torsoRadius * 2 + 0.02]} />
            <meshStandardMaterial color="#1f2733" roughness={0.7} />
          </mesh>
        )}

        {/* RIGHT SHOULDER & ARM */}
        {!rag ? (
          <group position={rightShoulderPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            <group position={[0, -0.06, 0]} rotation={[swing, 0, 0]}>
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

        {/* LEGS */}
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
        <mesh position={off("head") ? [off("head")!.x, off("head")!.y, off("head")!.z] : [0, torsoYCenter + torsoHeight * 0.5 + 0.22, 0]} castShadow>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color="#7a3e19" roughness={0.6} />
        </mesh>
        
        {/* FACE */}
        {!rag && (
          <>
            <mesh position={[0, torsoYCenter + torsoHeight * 0.5 + 0.36, -0.02]} castShadow>
              <sphereGeometry args={[0.27, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#000000" roughness={0.85} />
            </mesh>
            <mesh position={[0.09, torsoYCenter + torsoHeight * 0.5 + 0.24, 0.24]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[-0.09, torsoYCenter + torsoHeight * 0.5 + 0.24, 0.24]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[0, torsoYCenter + torsoHeight * 0.5 + 0.12, 0.25]}>
              <torusGeometry args={[0.06, 0.01, 8, 16, Math.PI]} />
              <meshBasicMaterial color="#252525" />
            </mesh>
          </>
        )}

        {/* NAME TAG */}
        <Html position={[0, torsoYCenter + torsoHeight * 0.5 + 0.58, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
