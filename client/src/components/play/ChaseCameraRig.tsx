import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GameRuntime } from "@/lib/gameRuntime";

/**
 * Follows the player and writes the camera's forward vector back into the
 * runtime so input becomes camera-relative. Track the player's "up" so the
 * camera tumbles with planetary gravity instead of floating off into world-up.
 */
export default function ChaseCameraRig({ runtime }: { runtime: GameRuntime }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const lastPlayerPos = useRef(new THREE.Vector3());
  const lastUp = useRef(new THREE.Vector3(0, 1, 0));
  const initialized = useRef(false);

  useFrame(() => {
    const p = runtime.player;
    const pos = new THREE.Vector3(p.position.x, p.position.y + 0.7, p.position.z);
    const up = new THREE.Vector3(p.up.x, p.up.y, p.up.z).normalize();

    if (!initialized.current) {
      lastPlayerPos.current.copy(pos);
      lastUp.current.copy(up);
      initialized.current = true;
    }

    const delta = pos.clone().sub(lastPlayerPos.current);
    camera.position.add(delta);
    lastPlayerPos.current.copy(pos);

    if (!up.equals(lastUp.current)) {
      const q = new THREE.Quaternion().setFromUnitVectors(lastUp.current, up);
      const offset = camera.position.clone().sub(pos).applyQuaternion(q);
      camera.position.copy(pos).add(offset);
      lastUp.current.copy(up);
    }

    camera.up.lerp(up, 0.15).normalize();

    if (controlsRef.current) {
      controlsRef.current.target.set(pos.x, pos.y, pos.z);
      controlsRef.current.update();
    }

    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    runtime.cameraForward.x = fwd.x;
    runtime.cameraForward.y = fwd.y;
    runtime.cameraForward.z = fwd.z;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.18}
      enablePan={false}
      minDistance={3}
      maxDistance={10}
    />
  );
}
