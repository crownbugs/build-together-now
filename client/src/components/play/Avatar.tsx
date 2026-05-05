import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

export default function Avatar({
  player,
  runtime,
}: {
  player: RuntimePlayer;
  runtime: GameRuntime;
}) {
  const anim = player.motors.animation;
  const horiz = Math.hypot(player.velocity.x, player.velocity.z);
  const moveAmount = Math.min(
    1,
    horiz / Math.max(1, player.runSpeed || player.speed)
  );

  const swingSpeed = anim === "run" ? 14 : anim === "walk" ? 9 : 0;
  const swing = Math.sin(runtime.time * swingSpeed) * 0.6 * moveAmount;
  const size = player.size || 1;

  const up = new THREE.Vector3(player.up.x, player.up.y, player.up.z).normalize();
  const orientQuat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    up
  );

  const rag = player.ragdoll && runtime._ragdollPos ? runtime._ragdollPos : null;
  const off = (k: string) => (rag && rag[k] ? rag[k] : null);

  return (
    <group
      position={[player.position.x, player.position.y, player.position.z]}
      quaternion={orientQuat}
    >
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>

        {/* 🟡 CARTOON JELLY BEAN BODY (single organic mesh) */}
        <mesh
          position={
            off("torso")
              ? [off("torso")!.x, off("torso")!.y, off("torso")!.z]
              : [0, 0.05, 0]
          }
          castShadow
        >
          {/* base sphere */}
          <sphereGeometry args={[0.45, 32, 32]} />

          {/* bean-like squash: wider middle, tapered ends */}
          <meshStandardMaterial
            color={player.color}
            roughness={0.55}
            metalness={0.05}
          />

          {/* shape distortion via scale */}
          <group scale={[0.75, 1.15, 0.75]} />
        </mesh>

        {/* feet base */}
        {!rag && (
          <mesh position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
            <meshStandardMaterial color="#1f2733" roughness={0.7} />
          </mesh>
        )}

        {/* right arm */}
        <group
          position={
            off("rightArm")
              ? [off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z]
              : [0.42, 0.18, 0]
          }
          rotation={rag ? [0, 0, 0] : [swing, 0, 0.05]}
        >
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
            <meshStandardMaterial color={player.color} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.55, 0]} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color={"#7a3e19"} roughness={0.7} />
          </mesh>
        </group>

        {/* left arm */}
        <group
          position={
            off("leftArm")
              ? [off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z]
              : [-0.42, 0.18, 0]
          }
          rotation={rag ? [0, 0, 0] : [-swing, 0, -0.05]}
        >
          <mesh position={[0, -0.25, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.42, 6, 12]} />
            <meshStandardMaterial color={player.color} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.55, 0]} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color={"#7a3e19"} roughness={0.7} />
          </mesh>
        </group>

        {/* right leg */}
        <group
          position={
            off("rightLeg")
              ? [off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z]
              : [0.18, -0.45, 0]
          }
          rotation={rag ? [0, 0, 0] : [-swing, 0, 0]}
        >
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
        </group>

        {/* left leg */}
        <group
          position={
            off("leftLeg")
              ? [off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z]
              : [-0.18, -0.45, 0]
          }
          rotation={rag ? [0, 0, 0] : [swing, 0, 0]}
        >
          <mesh position={[0, -0.18, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
            <meshStandardMaterial color="#2a3142" roughness={0.7} />
          </mesh>
        </group>

        {/* head */}
        <mesh
          position={
            off("head")
              ? [off("head")!.x, off("head")!.y, off("head")!.z]
              : [0, 0.7, 0]
          }
          castShadow
        >
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial color={"#7a3e19"} roughness={0.6} />
        </mesh>

        {/* face */}
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

        {/* name tag */}
        <Html
          position={[0, 1.25, 0]}
          center
          distanceFactor={8}
          zIndexRange={[100, 0]}
          sprite
        >
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none">
            {player.username}
          </div>
        </Html>

      </group>
    </group>
  );
}
