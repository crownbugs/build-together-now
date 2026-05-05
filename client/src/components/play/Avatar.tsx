import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * Fall Guys bean character.
 * - Soft, round body (stretchable when moving)
 * - Simple face with two eyes and a mouth
 * - Optional costume/pattern based on player color
 * - Bobbing idle and wobbly run cycle
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  const anim = player.motors.animation;
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(1, horiz / Math.max(1, player.runSpeed || player.speed));
  
  // Fall Guys wobble: body squashes and stretches
  const time = runtime.time;
  const bobY = Math.sin(time * 12) * 0.02 * moveAmount;
  const squash = moveAmount > 0.1 ? 1 + Math.sin(time * 20) * 0.05 : 1;
  const stretchY = moveAmount > 0.1 ? 1 - Math.sin(time * 20) * 0.04 : 1;
  
  const size = player.size || 1;
  
  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  const rag = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const off = (k: string) => (rag && rag[k] ? rag[k] : null);
  
  // Bean body color (bright, cartoony)
  const beanColor = player.color || "#f7d44a"; // default yellow/gold

  return (
    <group position={[player.position.x, player.position.y + bobY, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* Main bean body (squash/stretch based on movement) */}
        <group position={off("body") ? [off("body")!.x, off("body")!.y, off("body")!.z] : [0, 0, 0]} scale={[squash, stretchY, squash]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.55, 32, 32]} />
            <meshStandardMaterial color={beanColor} roughness={0.25} metalness={0.05} emissive={player.isHolding ? 0x333333 : 0x000000} />
          </mesh>
        </group>
        
        {/* Slight chin/cheek indent for character (optional) */}
        <mesh position={[0, -0.2, 0.52]} scale={[0.7, 0.2, 0.1]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={beanColor} roughness={0.25} />
        </mesh>
        
        {/* === FACE === */}
        {!rag && (
          <group position={[0, 0.15, 0.55]}>
            {/* Eyes (large, round, cute) */}
            <mesh position={[-0.18, 0.08, 0]} castShadow>
              <sphereGeometry args={[0.09, 24, 24]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.18, 0.08, 0]} castShadow>
              <sphereGeometry args={[0.09, 24, 24]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Pupils (follow movement maybe?) */}
            <mesh position={[-0.18, 0.06, 0.08]} castShadow>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
            <mesh position={[0.18, 0.06, 0.08]} castShadow>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
            {/* Eye highlights */}
            <mesh position={[-0.205, 0.095, 0.1]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.155, 0.095, 0.1]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            
            {/* Mouth (happy default, changes with emotion) */}
            <mesh position={[0, -0.08, 0.05]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.08, 0.015, 16, 32, Math.PI]} />
              <meshStandardMaterial color="#4a2a1a" />
            </mesh>
            {/* Slight tongue when happy */}
            {anim !== "scared" && (
              <mesh position={[0, -0.12, 0.12]}>
                <sphereGeometry args={[0.025, 8, 8]} />
                <meshStandardMaterial color="#e88b8b" />
              </mesh>
            )}
            
            {/* Blush cheeks */}
            <mesh position={[-0.28, -0.04, 0.04]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color="#e8a0a0" transparent opacity={0.6} />
            </mesh>
            <mesh position={[0.28, -0.04, 0.04]}>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshStandardMaterial color="#e8a0a0" transparent opacity={0.6} />
            </mesh>
          </group>
        )}
        
        {/* Optional: simple costume / pattern based on player data */}
        {/* Example: racing stripes if player has a certain attribute */}
        {player.hasPattern && (
          <mesh position={[0, -0.3, 0.55]} rotation={[0.2, 0, 0]}>
            <torusGeometry args={[0.45, 0.03, 16, 64, Math.PI * 2]} />
            <meshStandardMaterial color="#ff6b6b" />
          </mesh>
        )}
        
        {/* Nameplate floating above */}
        <Html position={[0, 0.9, 0]} center distanceFactor={12} zIndexRange={[100, 0]} sprite>
          <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/30 text-white text-xs font-bold whitespace-nowrap pointer-events-none shadow-md">
            {player.username}
          </div>
        </Html>
        
        {/* Idle particles (optional, little floating dots) */}
        {!rag && moveAmount < 0.1 && (
          <group>
            {[...Array(3)].map((_, i) => (
              <mesh key={i} position={[Math.sin(time * 2 + i) * 0.5, 0.7 + Math.sin(time * 3 + i) * 0.05, 0.4]}>
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshStandardMaterial color="#ffffff" transparent opacity={0.5} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    </group>
  );
}
