import { Html } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime, type RuntimePlayer } from "@/lib/gameRuntime";

/**
 * Cartoon human avatar.
 * Torso tapers slightly, arms attach at rounded shoulders, head has cartoon features.
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

  // Shoulder joint positions (where arms pivot)
  const rightShoulderPos = new THREE.Vector3(0.48, 0.48, 0);
  const leftShoulderPos = new THREE.Vector3(-0.48, 0.48, 0);
  // Arm default positions (hand area for reference, but arm is built as a group)
  const defaultRightArmPos = new THREE.Vector3(0.48, 0.18, 0);
  const defaultLeftArmPos = new THREE.Vector3(-0.48, 0.18, 0);
  const rightArmLocalPos = defaultRightArmPos.clone().sub(rightShoulderPos);
  const leftArmLocalPos = defaultLeftArmPos.clone().sub(leftShoulderPos);

  const ragRightArmPos = off("rightArm") ? new THREE.Vector3(off("rightArm")!.x, off("rightArm")!.y, off("rightArm")!.z) : null;
  const ragLeftArmPos = off("leftArm") ? new THREE.Vector3(off("leftArm")!.x, off("leftArm")!.y, off("leftArm")!.z) : null;
  const ragHeadPos = off("head") ? new THREE.Vector3(off("head")!.x, off("head")!.y, off("head")!.z) : null;
  const ragTorsoPos = off("torso") ? new THREE.Vector3(off("torso")!.x, off("torso")!.y, off("torso")!.z) : null;

  // Torso dimensions (tapered: wider at top, narrower at waist)
  const torsoTopRadius = 0.42;
  const torsoBottomRadius = 0.34;
  const torsoHeight = 0.75;
  const torsoCenterY = 0.05; // centered a bit above origin

  // Colors
  const skinColor = "#f5c6a0";
  const shirtColor = player.color; // use player's color for shirt
  const pantsColor = "#2a3142";
  const shoeColor = "#4a2e1e";

  return (
    <group position={[player.position.x, player.position.y, player.position.z]} quaternion={orientQuat}>
      <group rotation={[0, player.rotation.y, 0]} scale={[size, size, size]}>
        
        {/* TORSO – tapered cylinder (chest wider, waist narrower) */}
        <group position={ragTorsoPos || [0, torsoCenterY, 0]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[torsoTopRadius, torsoBottomRadius, torsoHeight, 16, 16]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} metalness={0.1} />
          </mesh>
          
          {/* Simple chest line / belt suggestion */}
          <mesh position={[0, -0.2, torsoBottomRadius + 0.02]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[torsoBottomRadius + 0.02, 0.04, 8, 40]} />
            <meshStandardMaterial color="#1f2733" roughness={0.6} />
          </mesh>
          
          {/* Collar / neck base */}
          <mesh position={[0, torsoHeight/2 - 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.32, 0.08, 12]} />
            <meshStandardMaterial color={shirtColor} roughness={0.5} />
          </mesh>
        </group>

        {/* PANTS (simple boxy shape) */}
        <mesh position={[0, -0.35, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.36, 0.32, 0.25, 12]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>

        {/* RIGHT ARM – with shoulder rounding and hand */}
        {!rag ? (
          <group position={rightShoulderPos}>
            <group position={rightArmLocalPos} rotation={[swing, 0, 0.15]}>
              {/* Upper arm */}
              <mesh position={[0, -0.22, 0]} castShadow>
                <capsuleGeometry args={[0.11, 0.4, 8, 12]} />
                <meshStandardMaterial color={shirtColor} roughness={0.6} />
              </mesh>
              {/* Forearm */}
              <mesh position={[0, -0.48, 0]} castShadow>
                <capsuleGeometry args={[0.09, 0.35, 8, 12]} />
                <meshStandardMaterial color={shirtColor} roughness={0.6} />
              </mesh>
              {/* Hand */}
              <mesh position={[0, -0.68, 0]} castShadow>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color={skinColor} roughness={0.3} />
              </mesh>
            </group>
          </group>
        ) : (
          <group position={ragRightArmPos || defaultRightArmPos} rotation={[0, 0, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.11, 0.4, 8, 12]} />
              <meshStandardMaterial color={shirtColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.68, 0]} castShadow>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial color={skinColor} roughness={0.3} />
            </mesh>
          </group>
        )}

        {/* LEFT ARM */}
        {!rag ? (
          <group position={leftShoulderPos}>
            <group position={leftArmLocalPos} rotation={[-swing, 0, -0.15]}>
              <mesh position={[0, -0.22, 0]} castShadow>
                <capsuleGeometry args={[0.11, 0.4, 8, 12]} />
                <meshStandardMaterial color={shirtColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.48, 0]} castShadow>
                <capsuleGeometry args={[0.09, 0.35, 8, 12]} />
                <meshStandardMaterial color={shirtColor} roughness={0.6} />
              </mesh>
              <mesh position={[0, -0.68, 0]} castShadow>
                <sphereGeometry args={[0.09, 8, 8]} />
                <meshStandardMaterial color={skinColor} roughness={0.3} />
              </mesh>
            </group>
          </group>
        ) : (
          <group position={ragLeftArmPos || defaultLeftArmPos} rotation={[0, 0, 0]}>
            <mesh position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.11, 0.4, 8, 12]} />
              <meshStandardMaterial color={shirtColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, -0.68, 0]} castShadow>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial color={skinColor} roughness={0.3} />
            </mesh>
          </group>
        )}

        {/* LEGS – more human-like, with thighs and calves */}
        <group position={rag && off("rightLeg") ? [off("rightLeg")!.x, off("rightLeg")!.y, off("rightLeg")!.z] : [0.22, -0.55, 0]} rotation={rag ? [0, 0, 0] : [-swing * 0.5, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.45, 8, 12]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.52, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.35, 8, 12]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          {/* Shoe */}
          <mesh position={[0, -0.75, 0.05]} castShadow>
            <boxGeometry args={[0.22, 0.12, 0.28]} />
            <meshStandardMaterial color={shoeColor} roughness={0.8} />
          </mesh>
        </group>
        
        <group position={rag && off("leftLeg") ? [off("leftLeg")!.x, off("leftLeg")!.y, off("leftLeg")!.z] : [-0.22, -0.55, 0]} rotation={rag ? [0, 0, 0] : [swing * 0.5, 0, 0]}>
          <mesh position={[0, -0.2, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.45, 8, 12]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.52, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.35, 8, 12]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.75, 0.05]} castShadow>
            <boxGeometry args={[0.22, 0.12, 0.28]} />
            <meshStandardMaterial color={shoeColor} roughness={0.8} />
          </mesh>
        </group>

        {/* HEAD – larger, cartoon proportions */}
        <mesh position={ragHeadPos || [0, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.38, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.25} />
        </mesh>
        
        {/* HAIR – simple rounded hat/hair blob */}
        <mesh position={[0, 1.05, 0.05]} castShadow>
          <sphereGeometry args={[0.4, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2.5]} />
          <meshStandardMaterial color="#2c1e0f" roughness={0.8} />
        </mesh>

        {/* FACE – cartoon style, only when not ragdoll */}
        {!rag && (
          <>
            {/* Eye whites */}
            <mesh position={[0.14, 0.92, 0.36]}>
              <sphereGeometry args={[0.07, 24, 24]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[-0.14, 0.92, 0.36]}>
              <sphereGeometry args={[0.07, 24, 24]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Pupils */}
            <mesh position={[0.16, 0.91, 0.43]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            <mesh position={[-0.12, 0.91, 0.43]}>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshStandardMaterial color="#000000" />
            </mesh>
            {/* Eyebrows */}
            <mesh position={[0.14, 1.0, 0.38]}>
              <boxGeometry args={[0.12, 0.05, 0.05]} />
              <meshStandardMaterial color="#2c1e0f" />
            </mesh>
            <mesh position={[-0.14, 1.0, 0.38]}>
              <boxGeometry args={[0.12, 0.05, 0.05]} />
              <meshStandardMaterial color="#2c1e0f" />
            </mesh>
            {/* Mouth (simple smile) */}
            <mesh position={[0, 0.78, 0.42]}>
              <torusGeometry args={[0.08, 0.02, 8, 20, Math.PI]} />
              <meshStandardMaterial color="#884422" />
            </mesh>
            {/* Nose (tiny sphere) */}
            <mesh position={[0, 0.87, 0.48]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color="#e0a878" />
            </mesh>
          </>
        )}

        {/* NAME TAG (always visible) */}
        <Html position={[0, 1.4, 0]} center distanceFactor={8} zIndexRange={[100, 0]} sprite>
          <div className="px-2 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium whitespace-nowrap pointer-events-none backdrop-blur-sm">
            {player.username}
          </div>
        </Html>
      </group>
    </group>
  );
}
