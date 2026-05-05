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
 * The torso is a cylinder with slightly rounded top and bottom edges.
 * Shoulders are simple L‑shaped bars: horizontal from torso side, then vertical down to the arm.
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

  // Shoulder attachment points
  const torsoRightSide = new THREE.Vector3(0.32, 0.33, 0);
  const shoulderCorner = new THREE.Vector3(0.42, 0.33, 0);
  const rightArmTop = new THREE.Vector3(0.42, 0.18, 0);
  
  const torsoLeftSide = new THREE.Vector3(-0.32, 0.33, 0);
  const leftShoulderCorner = new THREE.Vector3(-0.42, 0.33, 0);
  const leftArmTop = new THREE.Vector3(-0.42, 0.18, 0);

  const defaultRightArmPos = rightArmTop;
  const defaultLeftArmPos = leftArmTop;
  
  const rightShoulderPos = new THREE.Vector3(0.42, 0.38, 0);
  const leftShoulderPos = new THREE.Vector3(-0.42, 0.38, 0);
  const rightArmLocalPos = defaultRightArmPos.clone().sub(rightShoulderPos);
  const leftArmLocalPos = defaultLeftArmPos.clone().sub(leftShoulderPos);

  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;

  const torsoRadius = 0.32;
  const torsoHeight = 0.7;
  const capHeight = 0.135;
  const torsoTotalYCenter = 0.05;

  // Helper: create a cylinder between two points
  const createCylBetween = (p1: THREE.Vector3, p2: THREE.Vector3, radius: number, material: THREE.Material) => {
    const start = new THREE.Vector3(p1.x, p1.y, p1.z);
    const end = new THREE.Vector3(p2.x, p2.y, p2.z);
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const center = start.clone().add(dir.clone().multiplyScalar(0.5));
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize()
    );
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);
    return (
      <mesh geometry={geometry} position={center} quaternion={quaternion} material={material} castShadow receiveShadow />
    );
  };

  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.55, metalness: 0.05 });

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* TORSO */}
        <group position={off("torso") ? [off("torso")!.x, off("torso")!.y, off("torso")!.z] : [0, torsoTotalYCenter, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[torsoRadius, torsoRadius, torsoHeight, 24, 16]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh castShadow position={[0, torsoHeight / 2, 0]} scale={[1, capHeight / torsoRadius, 1]}>
            <sphereGeometry args={[torsoRadius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh castShadow position={[0, -torsoHeight / 2, 0]} scale={[1, capHeight / torsoRadius, 1]}>
            <sphereGeometry args={[torsoRadius, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={player.color} roughness={0.55} metalness={0.05} />
          </mesh>
        </group>

        {/* BELT */}
        {!rag && (
          <mesh position={[0, -0.18, 0]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.08, 24]} />
            <meshStandardMaterial color="#1f2733" roughness={0.7} />
          </mesh>
        )}

        {/* RIGHT SHOULDER – horizontal then vertical lines */}
        {!rag && (
          <>
            {createCylBetween(torsoRightSide, shoulderCorner, 0.1, shoulderMaterial)}
            {createCylBetween(shoulderCorner, rightArmTop, 0.1, shoulderMaterial)}
          </>
        )}

        {/* RIGHT ARM */}
        {!rag ? (
          <group position={rightShoulderPos}>
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

        {/* LEFT SHOULDER – horizontal then vertical lines */}
        {!rag && (
          <>
            {createCylBetween(torsoLeftSide, leftShoulderCorner, 0.1, shoulderMaterial)}
            {createCylBetween(leftShoulderCorner, leftArmTop, 0.1, shoulderMaterial)}
          </>
        )}

        {/* LEFT ARM */}
        {!rag ? (
          <group position={leftShoulderPos}>
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
        
        {/* FACE */}
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
