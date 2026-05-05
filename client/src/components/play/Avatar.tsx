import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * 3rd-person character mesh. Orientation is built from the player's "up"
 * vector (so feet point at gravity) plus a Y rotation managed by the
 * runtime's autoFaceMovement / script logic.
 *
 * Walk/run animation cycles are driven by `player.motors.animation` so
 * scripts can override (e.g. set "shoot", "wave"). When the player ragdolls,
 * limbs render at offsets read from `runtime._ragdollPos`.
 * 
 * The torso is a cylinder with rounded top/bottom (pill shape) – a clean
 * cylinder plus hemispherical caps, distinct from a capsule. Head sits on the
 * upper cap, legs on the lower cap.
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

  // Shoulder positions (torso-relative)
  const rightShoulderPos = new THREE.Vector3(0.42, 0.38, 0);
  const leftShoulderPos = new THREE.Vector3(-0.42, 0.38, 0);
  
  const defaultRightArmPos = new THREE.Vector3(0.42, 0.18, 0);
  const defaultLeftArmPos = new THREE.Vector3(-0.42, 0.18, 0);
  const rightArmLocalPos = defaultRightArmPos.clone().sub(rightShoulderPos);
  const leftArmLocalPos = defaultLeftArmPos.clone().sub(leftShoulderPos);

  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;

  // Torso pill dimensions
  const torsoRadius = 0.32;
  const torsoHeight = 0.7;      // cylinder part height (not including caps)
  const torsoTotalHeight = torsoHeight + torsoRadius * 2; // ≈ 1.34
  const torsoYOffset = 0.05;    // center of the pill relative to character origin

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* PILL-SHAPED TORSO */}
        <group position={off("torso") ? [off("torso")!.x, off("torso")!.y, off("torso")!.z] : [0, torsoYOffset, 0]}>
          {/* Middle cylinder */}
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[torsoRadius, torsoRadius, torsoHeight, 24, 16]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Top hemisphere (rounded top) */}
          <mesh castShadow position={[0, torsoHeight / 2, 0]}>
            <sphereGeometry args={[torsoRadius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Bottom hemisphere (rounded bottom) */}
          <mesh castShadow position={[0, -torsoHeight / 2, 0]}>
            <sphereGeometry args={[torsoRadius, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
        </group>

        {/* BELT (only when not ragdoll) */}
        {!rag && (
          <mesh position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
            <meshStandardMaterial color="#1f2733" roughness={0.7} />
          </mesh>
        )}

        {/* RIGHT SHOULDER & ARM */}
        {!rag ? (
          <group position={rightShoulderPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            <group position={rightArmLocalPos} rotation={[swing, 0, 0.05]}>
              <mesh position={[0, -0.25, 0]} castShadow>
                <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
                <meshStandardMaterial color={player.color} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.55, 0]} castShadow>
                <sphereGeometry args={[0.11, 16, 16]} />
                <meshStandardMaterial color="#7a3e19" roughness={0.7} />
              </mesh>
            </group>
          </group>
        ) : (
          <group position={ragRightArmPos || defaultRightArmPos} rotation={[0, 0, 0]}>
            <mesh position={[0, -0.25, 0]} castShadow>
              <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
              <meshStandardMaterial color={player.color} roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.55, 0]} castShadow>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color="#7a3e19" roughness={0.7} />
            </mesh>
          </group>
        )}

        {/* LEFT SHOULDER & ARM */}
        {!rag ? (
          <group position={leftShoulderPos}>
            <mesh castShadow>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color={player.color} roughness={0.5} />
            </mesh>
            <group position={leftArmLocalPos} rotation={[-swing, 0, -0.05]}>
              <mesh position={[0, -0.25, 0]} castShadow>
                <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
                <meshStandardMaterial color={player.color} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.55, 0]} castShadow>
                <sphereGeometry args={[0.11, 16, 16]} />
                <meshStandardMaterial color="#7a3e19" roughness={0.7} />
              </mesh>
            </group>
          </group>
        ) : (
          <group position={ragLeftArmPos || defaultLeftArmPos} rotation={[0, 0, 0]}>
            <mesh position={[0, -0.25, 0]} castShadow>
              <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
              <meshStandardMaterial color={player.color} roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.55, 0]} castShadow>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color="#7a3e19" roughness={0.7} />
            </mesh>
          </group>
        )}

        {/* LEGS */}
        <group position={off("rightLeg") ? [off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z] : [0.18, -0.45, 0]} rotation={rag ? [0, 0, 0] : [-swing, 0, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
        </group>
        <group position={off("leftLeg") ? [off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z] : [-0.18, -0.45, 0]} rotation={rag ? [0, 0, 0] : [swing, 0, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
        </group>

        {/* HEAD */}
        <mesh position={off("head") ? [off("head")!.x, off("head")!.y, off("head")!.z] : [0, 0.7, 0]} castShadow>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial color="#7a3e19" roughness={0.6} />
        </mesh>
        
        {/* FACE (only when not ragdoll) */}
        {!rag && (
          <>
            <mesh position={[0, 0.86, -0.02]} castShadow>
              <sphereGeometry args={[0.31, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#000000" roughness={0.85} />
            </mesh>
            <mesh position={[0.1, 0.72, 0.27]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[-0.1, 0.72, 0.27]}>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshBasicMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[0, 0.6, 0.28]}>
              <torusGeometry args={[0.07, 0.012, 8, 16, Math.PI]} />
              <meshBasicMaterial color="#252525" />
            </mesh>
          </>
        )}

        {/* NAME TAG */}
        <Html position={[0, 1.25, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
