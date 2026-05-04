import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * 3rd-person character mesh. Orientation is built from the player's "up"
 * vector (so feet point at gravity) plus a Y rotation managed by the
 * runtime's autoFaceMovement / script logic.
 */
export default function Avatar({ player, runtime }: { player: RuntimePlayer; runtime: GameRuntime }) {
  const moveAmount = Math.min(
    1,
    Math.hypot(player.velocity.x, player.velocity.z) / Math.max(1, player.speed)
  );
  const swing = Math.sin(runtime.time * 9) * 0.6 * moveAmount;
  const size = player.size || 1;

  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        <mesh position={[0, 0.05, 0]} castShadow>
          <capsuleGeometry args={[0.32, 0.7, 8, 16]} />
          <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0, -0.18, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
          <meshStandardMaterial color="#1f2733" roughness={0.7} />
        </mesh>
        <group position={[0.42, 0.18, 0]} rotation={[swing, 0, 0.05]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
            <meshStandardMaterial color={player.color} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.55, 0]} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color={"#7a3e19"} roughness={0.7} />
          </mesh>
        </group>
        <group position={[-0.42, 0.18, 0]} rotation={[-swing, 0, -0.05]}>
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
            <meshStandardMaterial color={player.color} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.55, 0]} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color={"#7a3e19"} roughness={0.7} />
          </mesh>
        </group>
        <group position={[0.18, -0.45, 0]} rotation={[-swing, 0, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
        </group>
        <group position={[-0.18, -0.45, 0]} rotation={[swing, 0, 0]}>
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
        </group>
        <mesh position={[0, 0.7, 0]} castShadow>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial color={"#7a3e19"} roughness={0.6} />
        </mesh>
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
        <Html position={[0, 1.25, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
