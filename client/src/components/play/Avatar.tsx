import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * TRUE Fall Guys Bean Character.
 * - Bean shape: taller, wider at bottom, tapered top.
 * - Two little feet (half-spheres)
 * - Two floating hand nubs
 * - Squash/stretch run cycle
 * - Cute face with big eyes and smile
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  const anim = player.motors.animation;
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(1, horiz / Math.max(1, player.runSpeed || player.speed));
  
  const time = runtime.time;
  const bobY = Math.sin(time * 12) * 0.02 * moveAmount;
  
  // Bean squash/stretch when running
  const squashX = moveAmount > 0.1 ? 1 + Math.sin(time * 20) * 0.06 : 1;
  const squashZ = moveAmount > 0.1 ? 1 + Math.sin(time * 20) * 0.06 : 1;
  const stretchY = moveAmount > 0.1 ? 1 - Math.sin(time * 20) * 0.05 : 1;
  
  const size = player.size || 1;
  const beanColor = player.color || "#f7d44a"; // Fall Guys default yellow

  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  const rag = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const off = (k: string) => (rag && rag[k] ? rag[k] : null);

  return (
    <group position={[player.position.x, player.position.y + bobY, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* === MAIN BEAN BODY (proper bean shape) === */}
        <group scale={[squashX, stretchY, squashZ]}>
          <mesh position={off("body") ? [off("body")!.x, off("body")!.y, off("body")!.z] : [0, 0, 0]} castShadow receiveShadow>
            {/* Custom bean geometry: stretched sphere with bottom bulge */}
            <bufferGeometry attach="geometry" {...createBeanGeometry()} />
            <meshStandardMaterial color={beanColor} roughness={0.3} metalness={0.02} />
          </mesh>
        </group>

        {/* === LEFT FOOT (tiny half-sphere) === */}
        <mesh position={[-0.2, -0.65, 0.15]} castShadow>
          <sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={beanColor} roughness={0.3} />
        </mesh>

        {/* === RIGHT FOOT === */}
        <mesh position={[0.2, -0.65, 0.15]} castShadow>
          <sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={beanColor} roughness={0.3} />
        </mesh>

        {/* === LEFT HAND NUB (floating, swings when running) === */}
        <group position={[-0.48, 0.1, 0]} rotation={[0, 0, moveAmount > 0.1 ? Math.sin(time * 16) * 0.8 : 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={beanColor} roughness={0.3} />
          </mesh>
        </group>

        {/* === RIGHT HAND NUB === */}
        <group position={[0.48, 0.1, 0]} rotation={[0, 0, moveAmount > 0.1 ? -Math.sin(time * 16) * 0.8 : 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={beanColor} roughness={0.3} />
          </mesh>
        </group>

        {/* === FACE (on the front of the bean) === */}
        {!rag && (
          <group position={[0, 0.2, 0.52]}>
            {/* White eye bases */}
            <mesh position={[-0.17, 0.08, 0]}>
              <sphereGeometry args={[0.085, 24, 24]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.17, 0.08, 0]}>
              <sphereGeometry args={[0.085, 24, 24]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Pupils */}
            <mesh position={[-0.17, 0.06, 0.07]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            <mesh position={[0.17, 0.06, 0.07]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#111" />
            </mesh>
            {/* Eye shine */}
            <mesh position={[-0.185, 0.095, 0.09]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.155, 0.095, 0.09]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Mouth (cute smile) */}
            <mesh position={[0, -0.08, 0.04]} rotation={[0, 0, 0.1]}>
              <torusGeometry args={[0.075, 0.014, 16, 32, Math.PI]} />
              <meshStandardMaterial color="#4a2a1a" />
            </mesh>
            {/* Blush */}
            <mesh position={[-0.27, -0.02, 0.02]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshStandardMaterial color="#e8a0a0" transparent opacity={0.5} />
            </mesh>
            <mesh position={[0.27, -0.02, 0.02]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshStandardMaterial color="#e8a0a0" transparent opacity={0.5} />
            </mesh>
          </group>
        )}

        {/* Nameplate */}
        <Html position={[0, 0.95, 0]} center distanceFactor={10} zIndexRange={[100, 0]} sprite>
          <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/30 text-white text-xs font-bold whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}

/**
 * Creates a geometry that matches the Fall Guys bean shape:
 * - Height ~1.2 units
 * - Width at top ~0.7 units
 * - Width at bottom ~0.9 units
 * - Smooth curves using a stretched sphere with vertex offsets
 */
function createBeanGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(0.5, 32, 32);
  const positions = geometry.attributes.position.array;
  
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i+1];
    let z = positions[i+2];
    
    // Stretch vertically (bean is taller)
    y *= 1.2;
    
    // Make bottom wider, top narrower
    const t = (y + 0.6) / 1.2; // remap y from [-0.6, 0.6] to [0,1]
    let widthFactor = 0.8 + t * 0.5; // 0.8 at top, 1.3 at bottom
    x *= widthFactor;
    z *= widthFactor;
    
    // Slight forward bulge for belly
    if (y > -0.2 && y < 0.4) {
      z += 0.05 * Math.sin((y + 0.2) * Math.PI);
    }
    
    positions[i] = x;
    positions[i+1] = y;
    positions[i+2] = z;
  }
  
  geometry.computeVertexNormals();
  return geometry;
}
