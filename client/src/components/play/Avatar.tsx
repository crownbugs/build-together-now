import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * Fallout character with full humanoid body (boxes/cylinders, no capsules).
 * Includes support for ragdoll overrides, arm swing, and build variations.
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

  // Fallout vault suit colors
  const suitColor = player.color || "#2c5f8a";
  const leatherColor = "#5c3a21";
  const armorColor = "#8b7d6b";

  // Body build (can be extended: "slim", "muscular", "heavy")
  const build = player.build || "muscular";
  const torsoWidth = build === "heavy" ? 0.52 : build === "muscular" ? 0.48 : 0.42;
  const shoulderWidth = build === "heavy" ? 0.65 : build === "muscular" ? 0.6 : 0.52;

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* === TORSO (Tapered box for V-shape) === */}
        <group position={off("torso") ? [off("torso")!.x, off("torso")!.y, off("torso")!.z] : [0, 0.05, 0]}>
          <mesh castShadow>
            <boxGeometry args={[torsoWidth, 0.9, 0.28]} />
            <meshStandardMaterial color={suitColor} roughness={0.45} metalness={0.1} />
          </mesh>
          {/* Chest armor plate */}
          {!rag && (
            <mesh position={[0, 0.1, 0.15]} castShadow>
              <boxGeometry args={[torsoWidth - 0.06, 0.55, 0.06]} />
              <meshStandardMaterial color={armorColor} roughness={0.6} metalness={0.4} />
            </mesh>
          )}
          {/* Leather belt */}
          <mesh position={[0, -0.32, 0.12]} castShadow>
            <boxGeometry args={[torsoWidth + 0.04, 0.08, 0.1]} />
            <meshStandardMaterial color={leatherColor} roughness={0.7} />
          </mesh>
        </group>

        {/* === RIGHT ARM (Upper arm + forearm, no capsules) === */}
        <group position={off("rightArm") ? [off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z] : [shoulderWidth / 2, 0.35, 0]} 
               rotation={rag ? [0, 0, 0] : [swing, 0, 0.05]}>
          {/* Upper arm */}
          <mesh position={[0, -0.28, 0]} castShadow>
            <boxGeometry args={[0.18, 0.48, 0.18]} />
            <meshStandardMaterial color={suitColor} roughness={0.55} />
          </mesh>
          {/* Elbow pad */}
          {!rag && (
            <mesh position={[0, -0.48, 0.12]} castShadow>
              <boxGeometry args={[0.16, 0.08, 0.08]} />
              <meshStandardMaterial color={leatherColor} roughness={0.6} />
            </mesh>
          )}
          {/* Forearm */}
          <mesh position={[0, -0.68, 0]} castShadow>
            <boxGeometry args={[0.14, 0.38, 0.14]} />
            <meshStandardMaterial color={suitColor} roughness={0.55} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.88, 0]} castShadow>
            <boxGeometry args={[0.13, 0.18, 0.12]} />
            <meshStandardMaterial color={"#d4a574"} roughness={0.65} />
          </mesh>
        </group>

        {/* === LEFT ARM (with Pip-Boy) === */}
        <group position={off("leftArm") ? [off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z] : [-shoulderWidth / 2, 0.35, 0]} 
               rotation={rag ? [0, 0, 0] : [-swing, 0, -0.05]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <boxGeometry args={[0.18, 0.48, 0.18]} />
            <meshStandardMaterial color={suitColor} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.68, 0]} castShadow>
            <boxGeometry args={[0.14, 0.38, 0.14]} />
            <meshStandardMaterial color={suitColor} roughness={0.55} />
          </mesh>
          {/* Pip-Boy on forearm */}
          {!rag && (
            <group position={[-0.02, -0.65, 0.13]} rotation={[0, 0.4, 0]}>
              <boxGeometry args={[0.16, 0.22, 0.1]} />
              <meshStandardMaterial color="#3a6ea5" metalness={0.7} roughness={0.3} />
              <mesh position={[0, 0, 0.06]}>
                <boxGeometry args={[0.12, 0.16, 0.02]} />
                <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.4} />
              </mesh>
            </group>
          )}
          <mesh position={[0, -0.88, 0]} castShadow>
            <boxGeometry args={[0.13, 0.18, 0.12]} />
            <meshStandardMaterial color={"#d4a574"} roughness={0.65} />
          </mesh>
        </group>

        {/* === RIGHT LEG === */}
        <group position={off("rightLeg") ? [off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z] : [0.18, -0.5, 0]} 
               rotation={rag ? [0, 0, 0] : [-swing * 0.7, 0, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <boxGeometry args={[0.22, 0.48, 0.22]} />
            <meshStandardMaterial color={suitColor} roughness={0.65} />
          </mesh>
          {/* Knee pad */}
          {!rag && (
            <mesh position={[0, -0.48, 0.14]} castShadow>
              <boxGeometry args={[0.2, 0.1, 0.08]} />
              <meshStandardMaterial color={armorColor} roughness={0.55} metalness={0.3} />
            </mesh>
          )}
          <mesh position={[0, -0.65, 0]} castShadow>
            <boxGeometry args={[0.18, 0.36, 0.2]} />
            <meshStandardMaterial color={suitColor} roughness={0.65} />
          </mesh>
          {/* Boot */}
          <mesh position={[0, -0.85, 0.03]} castShadow>
            <boxGeometry args={[0.2, 0.18, 0.28]} />
            <meshStandardMaterial color={leatherColor} roughness={0.8} />
          </mesh>
        </group>

        {/* === LEFT LEG === */}
        <group position={off("leftLeg") ? [off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z] : [-0.18, -0.5, 0]} 
               rotation={rag ? [0, 0, 0] : [swing * 0.7, 0, 0]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <boxGeometry args={[0.22, 0.48, 0.22]} />
            <meshStandardMaterial color={suitColor} roughness={0.65} />
          </mesh>
          {!rag && (
            <mesh position={[0, -0.48, 0.14]} castShadow>
              <boxGeometry args={[0.2, 0.1, 0.08]} />
              <meshStandardMaterial color={armorColor} roughness={0.55} metalness={0.3} />
            </mesh>
          )}
          <mesh position={[0, -0.65, 0]} castShadow>
            <boxGeometry args={[0.18, 0.36, 0.2]} />
            <meshStandardMaterial color={suitColor} roughness={0.65} />
          </mesh>
          <mesh position={[0, -0.85, 0.03]} castShadow>
            <boxGeometry args={[0.2, 0.18, 0.28]} />
            <meshStandardMaterial color={leatherColor} roughness={0.8} />
          </mesh>
        </group>

        {/* === HEAD (still a sphere, but that's fine for humanoid) === */}
        <mesh position={off("head") ? [off("head")!.x, off("head")!.y, off("head")!.z] : [0, 0.68, 0]} castShadow>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshStandardMaterial color={"#d4a574"} roughness={0.55} />
        </mesh>

        {/* === HAIR (wasteland style) === */}
        {!rag && (
          <mesh position={[0, 0.92, -0.08]} castShadow>
            <sphereGeometry args={[0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
            <meshStandardMaterial color="#3a2518" roughness={0.8} />
          </mesh>
        )}

        {/* === FACE === */}
        {!rag && (
          <>
            <mesh position={[0.11, 0.73, 0.3]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[-0.11, 0.73, 0.3]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#0a0a0a" />
            </mesh>
            <mesh position={[0, 0.58, 0.3]}>
              <torusGeometry args={[0.07, 0.012, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#555" />
            </mesh>
            {/* Scar */}
            <mesh position={[0.15, 0.68, 0.31]}>
              <boxGeometry args={[0.03, 0.07, 0.01]} />
              <meshStandardMaterial color="#b87c5a" />
            </mesh>
          </>
        )}

        {/* === NAME LABEL === */}
        <Html position={[0, 1.25, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-amber-900/80 border border-amber-600/50 text-amber-200 text-xs font-mono font-bold whitespace-nowrap pointer-events-none shadow-lg">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
