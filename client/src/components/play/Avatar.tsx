import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ----- geometry helpers -----
function createTaperedCylinder(topRad, bottomRad, height, radialSegs = 32, heightSegs = 28, bulge = 0.03) {
  const geometry = new THREE.CylinderGeometry(topRad, bottomRad, height, radialSegs, heightSegs);
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i + 1];
    let z = positions[i + 2];
    const t = (y + height / 2) / height;
    const curve = 1 + Math.sin(t * Math.PI) * bulge;
    positions[i] = x * curve;
    positions[i + 2] = z * curve;
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedTorso(width, height, depth, segments, radius) {
  return new RoundedBoxGeometry(width, height, depth, segments, radius);
}

function createSmoothNeck(height, topRad, bottomRad) {
  const geometry = new THREE.CylinderGeometry(topRad, bottomRad, height, 32, 24);
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i + 1];
    let z = positions[i + 2];
    const t = (y + height / 2) / height;
    const curve = 1 + Math.sin(t * Math.PI) * 0.02;
    positions[i] = x * curve;
    positions[i + 2] = z * curve;
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createSmoothHead() {
  const geometry = new THREE.SphereGeometry(0.68, 40, 40);
  const positions = geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    let x = positions[i];
    let y = positions[i + 1];
    let z = positions[i + 2];
    if (y > 0) positions[i + 1] *= 1.08;
    if (y < -0.3) {
      const taper = 1 - (-0.3 - y) * 0.3;
      const t = Math.max(0.88, taper);
      positions[i] *= t;
      positions[i + 2] *= t;
    }
    if (z < 0) positions[i + 2] *= 0.94;
  }
  geometry.computeVertexNormals();
  return geometry;
}

// ----- Full Character Class -----
class FullCharacter {
  constructor() {
    this.mesh = new THREE.Group();
    this.parts = {};
    this.materials = {};
    this.joints = {};
    this.currentAnim = 'idle';
    this.animTime = 0;
    this.speed = 1;
    this.skinColor = 0xffdbac;
    this.shirtColor = 0x2b7a6e;
    this.pantsColor = 0x2c3e50;
    this.mouseTarget = new THREE.Vector2(0, 0);
    this.headRotation = new THREE.Vector2(0, 0);
    this.build();
  }

  addMesh(geometry, color, name, parent, pos, roughnessVal = 0.42) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: roughnessVal, metalness: 0.03 });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(pos);
    this.materials[name] = mesh.material;
    this.parts[name] = mesh;
    if (parent) parent.add(mesh);
    return mesh;
  }

  build() {
    const skin = this.skinColor;
    const shirt = this.shirtColor;
    const pants = this.pantsColor;

    const torsoHeight = 2.38;
    const torsoCenterY = 3.20;
    const torsoTopY = torsoCenterY + torsoHeight / 2;
    const torsoBottomY = torsoCenterY - torsoHeight / 2;

    const torsoGeo = createRoundedTorso(1.6, 2.38, 1.0, 8, 0.5);
    this.addMesh(torsoGeo, shirt, 'torso', this.mesh, new THREE.Vector3(0, torsoCenterY, 0), 0.48);

    const neckHeight = 0.52;
    const neckEmbed = 0.16;
    const neckTopY = torsoTopY + neckHeight - neckEmbed;
    const neckGeo = createSmoothNeck(neckHeight, 0.16, 0.17);
    this.addMesh(neckGeo, skin, 'neck', this.mesh, new THREE.Vector3(0, torsoTopY + neckHeight / 2 - neckEmbed, 0), 0.40);

    const headGeo = createSmoothHead();
    const head = this.addMesh(headGeo, skin, 'head', this.mesh, new THREE.Vector3(0, neckTopY + 0.48, 0.02), 0.38);
    this.joints.head = head;

    const upperArmLen = 1.22;
    const lowerArmLen = 1.10;
    const upperRad = 0.28;
    const lowerRad = 0.22;
    const shoulderY = torsoTopY - 0.08;
    const armOffsetX = 0.95;

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-armOffsetX, shoulderY, 0);
    const upperArmGeo = createTaperedCylinder(upperRad, upperRad - 0.03, upperArmLen, 28, 24, 0.04);
    this.addMesh(upperArmGeo, skin, 'leftArm', leftArmGroup, new THREE.Vector3(0, -upperArmLen / 2, 0), 0.42);
    const leftElbowGroup = new THREE.Group();
    leftElbowGroup.position.set(0, -upperArmLen, 0);
    const lowerArmGeo = createTaperedCylinder(lowerRad, lowerRad - 0.03, lowerArmLen, 26, 22, 0.03);
    const leftLower = this.addMesh(lowerArmGeo, skin, 'leftForearm', leftElbowGroup, new THREE.Vector3(0, -lowerArmLen / 2, 0), 0.42);
    leftArmGroup.add(leftElbowGroup);
    this.mesh.add(leftArmGroup);
    this.joints.leftArm = leftArmGroup;
    this.joints.leftElbow = leftElbowGroup;

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(armOffsetX, shoulderY, 0);
    this.addMesh(upperArmGeo, skin, 'rightArm', rightArmGroup, new THREE.Vector3(0, -upperArmLen / 2, 0), 0.42);
    const rightElbowGroup = new THREE.Group();
    rightElbowGroup.position.set(0, -upperArmLen, 0);
    const rightLower = this.addMesh(lowerArmGeo, skin, 'rightForearm', rightElbowGroup, new THREE.Vector3(0, -lowerArmLen / 2, 0), 0.42);
    rightArmGroup.add(rightElbowGroup);
    this.mesh.add(rightArmGroup);
    this.joints.rightArm = rightArmGroup;
    this.joints.rightElbow = rightElbowGroup;

    const legEmbed = 0.18;
    const thighLen = 1.42;
    const calfLen = 1.22;
    const thighRad = 0.36;
    const calfRad = 0.27;
    const hipY = torsoBottomY + legEmbed;
    const legOffsetX = 0.44;

    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-legOffsetX, hipY, 0);
    const thighGeo = createTaperedCylinder(thighRad, thighRad - 0.05, thighLen, 30, 26, 0.05);
    this.addMesh(thighGeo, pants, 'leftLeg', leftLegGroup, new THREE.Vector3(0, -thighLen / 2, 0), 0.5);
    const leftKneeGroup = new THREE.Group();
    leftKneeGroup.position.set(0, -thighLen, 0);
    const calfGeo = createTaperedCylinder(calfRad, calfRad - 0.04, calfLen, 28, 24, 0.03);
    const leftCalf = this.addMesh(calfGeo, pants, 'leftCalf', leftKneeGroup, new THREE.Vector3(0, -calfLen / 2, 0), 0.5);
    leftLegGroup.add(leftKneeGroup);
    this.mesh.add(leftLegGroup);
    this.joints.leftLeg = leftLegGroup;
    this.joints.leftKnee = leftKneeGroup;

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(legOffsetX, hipY, 0);
    this.addMesh(thighGeo, pants, 'rightLeg', rightLegGroup, new THREE.Vector3(0, -thighLen / 2, 0), 0.5);
    const rightKneeGroup = new THREE.Group();
    rightKneeGroup.position.set(0, -thighLen, 0);
    const rightCalf = this.addMesh(calfGeo, pants, 'rightCalf', rightKneeGroup, new THREE.Vector3(0, -calfLen / 2, 0), 0.5);
    rightLegGroup.add(rightKneeGroup);
    this.mesh.add(rightLegGroup);
    this.joints.rightLeg = rightLegGroup;
    this.joints.rightKnee = rightKneeGroup;

    this.materials.leftForearm = leftLower.material;
    this.materials.rightForearm = rightLower.material;
    this.materials.leftCalf = leftCalf.material;
    this.materials.rightCalf = rightCalf.material;
  }

  setPartColor(partName, hexColor) {
    const col = new THREE.Color(hexColor);
    const map = {
      torso: ['torso'],
      head: ['head'],
      neck: ['neck'],
      leftArm: ['leftArm', 'leftForearm'],
      rightArm: ['rightArm', 'rightForearm'],
      leftLeg: ['leftLeg', 'leftCalf'],
      rightLeg: ['rightLeg', 'rightCalf']
    };
    (map[partName] || [partName]).forEach(key => {
      if (this.materials[key]) this.materials[key].color.copy(col);
    });
  }

  setAnimation(type) {
    this.currentAnim = type;
    this.animTime = 0;
    Object.values(this.joints).forEach(j => j && j.rotation.set(0, 0, 0));
    this.mesh.position.y = 0;
  }

  update(delta) {
    this.animTime += delta * this.speed;
    const t = this.animTime;

    const targetX = this.mouseTarget.x * 0.5;
    const targetY = this.mouseTarget.y * 0.35;
    this.headRotation.x += (targetX - this.headRotation.x) * 5 * delta;
    this.headRotation.y += (targetY - this.headRotation.y) * 5 * delta;

    if (this.joints.head) {
      this.joints.head.rotation.y = this.headRotation.x;
      this.joints.head.rotation.x = -this.headRotation.y;
    }

    const breath = Math.sin(t * 1.5) * 0.015;
    const torsoBaseY = 3.20;
    const torsoTopY = torsoBaseY + 2.38 / 2;
    const neckHeight = 0.52;
    const neckEmbed = 0.16;
    const neckTopY = torsoTopY + neckHeight - neckEmbed;

    if (this.parts.torso) this.parts.torso.position.y = torsoBaseY + breath;
    if (this.parts.neck) this.parts.neck.position.y = torsoTopY + neckHeight / 2 - neckEmbed + breath * 0.6;
    if (this.joints.head) this.joints.head.position.y = neckTopY + 0.48 + breath * 0.4;

    if (this.currentAnim === 'idle') {
      if (this.joints.leftArm) {
        this.joints.leftArm.rotation.z = Math.sin(t * 1.3) * 0.04;
        this.joints.leftArm.rotation.x = Math.sin(t * 0.7) * 0.02;
      }
      if (this.joints.rightArm) {
        this.joints.rightArm.rotation.z = -Math.sin(t * 1.3) * 0.04;
        this.joints.rightArm.rotation.x = Math.sin(t * 0.7 + 1) * 0.02;
      }
    } else if (this.currentAnim === 'walk') {
      const ws = 5.2;
      this.joints.leftArm.rotation.x = Math.sin(t * ws) * 0.95;
      this.joints.rightArm.rotation.x = Math.sin(t * ws + Math.PI) * 0.95;
      this.joints.leftLeg.rotation.x = Math.sin(t * ws + Math.PI) * 0.68;
      this.joints.rightLeg.rotation.x = Math.sin(t * ws) * 0.68;
      this.joints.leftElbow.rotation.x = -Math.max(0, Math.sin(t * ws + Math.PI)) * 0.6;
      this.joints.rightElbow.rotation.x = -Math.max(0, Math.sin(t * ws)) * 0.6;
      this.joints.leftKnee.rotation.x = Math.max(0, Math.sin(t * ws + Math.PI)) * 0.5;
      this.joints.rightKnee.rotation.x = Math.max(0, Math.sin(t * ws)) * 0.5;
      this.mesh.position.y = Math.abs(Math.sin(t * ws * 2)) * 0.065;
    } else if (this.currentAnim === 'dance') {
      const ds = 5.3;
      this.joints.leftArm.rotation.x = Math.sin(t * ds) * 0.65 - 2.15;
      this.joints.rightArm.rotation.x = Math.sin(t * ds + 2.3) * 0.65 - 2.15;
      this.joints.leftElbow.rotation.x = -0.8 - Math.sin(t * ds * 2) * 0.2;
      this.joints.rightElbow.rotation.x = -0.8 - Math.sin(t * ds * 2 + Math.PI) * 0.2;
      this.mesh.position.y = Math.abs(Math.sin(t * ds * 1.4)) * 0.18;
      this.joints.leftLeg.rotation.x = Math.sin(t * ds) * 0.45;
      this.joints.rightLeg.rotation.x = Math.sin(t * ds + Math.PI) * 0.45;
      this.joints.leftKnee.rotation.x = 0.5 + Math.sin(t * ds * 1.5) * 0.3;
      this.joints.rightKnee.rotation.x = 0.5 + Math.sin(t * ds * 1.5 + Math.PI) * 0.3;
    }
  }

  setScale(s) {
    this.mesh.scale.setScalar(s);
  }
}

// ----- React Component -----
export default function AvatarViewer() {
  const canvasRef = useRef(null);
  const characterRef = useRef(null);
  const rendererRef = useRef(null);
  const frameRef = useRef(null);
  
  const [panelOpen, setPanelOpen] = useState(true);
  const [selectedPart, setSelectedPart] = useState('torso');
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState(1);
  const [animation, setAnimation] = useState('idle');
  const [loading, setLoading] = useState(true);

  const colors = [
    { hex: '#ffdbac', val: 0xffdbac },
    { hex: '#f1c27d', val: 0xf1c27d },
    { hex: '#e0ac69', val: 0xe0ac69 },
    { hex: '#c68642', val: 0xc68642 },
    { hex: '#8d5524', val: 0x8d5524 },
    { hex: '#ff6b6b', val: 0xff6b6b },
    { hex: '#4ecdc4', val: 0x4ecdc4 },
    { hex: '#45b7d1', val: 0x45b7d1 },
    { hex: '#96ceb4', val: 0x96ceb4 },
    { hex: '#2d3436', val: 0x2d3436 },
    { hex: '#fd79a8', val: 0xfd79a8 },
  ];

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // transparent

    // Camera
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(5.2, 5.5, 7.5);
    camera.lookAt(0, 3.5, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.minDistance = 2.5;
    controls.maxDistance = 15;
    controls.target.set(0, 3.5, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0x5a5a8a, 0.55);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xfff0e0, 1.05);
    keyLight.position.set(4, 9, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x6688ee, 0.45);
    fillLight.position.set(-3, 5, 3.5);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0xffaa77, 0.5);
    rimLight.position.set(2, 4.5, -5.5);
    scene.add(rimLight);

    // Character
    const character = new FullCharacter();
    scene.add(character.mesh);
    characterRef.current = character;

    // Mouse tracking
    const onMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      character.mouseTarget.set(x, -y);
    };
    document.addEventListener('mousemove', onMouseMove);

    // Resize
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.033);
      character.update(delta);
      controls.update();
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Loading screen
    const timer = setTimeout(() => setLoading(false), 1100);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(timer);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync animation state
  useEffect(() => {
    if (characterRef.current) {
      characterRef.current.setAnimation(animation);
    }
  }, [animation]);

  // Sync speed
  useEffect(() => {
    if (characterRef.current) {
      characterRef.current.speed = speed;
    }
  }, [speed]);

  // Sync scale
  useEffect(() => {
    if (characterRef.current) {
      characterRef.current.setScale(scale);
    }
  }, [scale]);

  const handleColorClick = (colorVal) => {
    if (characterRef.current) {
      characterRef.current.setPartColor(selectedPart, colorVal);
    }
  };

  return (
    <div style={{ margin: 0, overflow: 'hidden', fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif", position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />

      {/* Toggle Button */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        title="Toggle Panel"
        style={{
          position: 'absolute', top: 20, left: 20, width: 52, height: 52,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(14px)',
          border: '1px solid #00d4ff', borderRadius: 28,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00d4ff', transition: 'all 0.3s', zIndex: 20,
          boxShadow: '0 8px 22px rgba(0,0,0,0.7)'
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          style={{ transform: panelOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)' }}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* UI Panel */}
      <div style={{
        position: 'absolute', top: 20, left: 20,
        background: 'rgba(8, 8, 18, 0.94)', backdropFilter: 'blur(18px)',
        border: '1px solid rgba(0, 212, 255, 0.4)', borderRadius: 32,
        padding: 22, color: 'white', minWidth: 320,
        boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
        transition: 'transform 0.4s cubic-bezier(0.2,0.9,0.4,1), opacity 0.3s',
        transformOrigin: 'top left',
        maxHeight: '85vh', overflowY: 'auto',
        transform: panelOpen ? 'scale(1) translateX(0)' : 'scale(0.85) translateX(-140%)',
        opacity: panelOpen ? 1 : 0,
        pointerEvents: panelOpen ? 'auto' : 'none',
        visibility: panelOpen ? 'visible' : 'hidden'
      }}>
        <h2 style={{
          marginBottom: 18, fontSize: '1.5rem',
          background: 'linear-gradient(135deg, #00d4ff, #b0f0ff)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          ✨ FULL AVATAR
        </h2>

        {/* Body Part Selector */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#c0c8e6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            🧍 BODY PART
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['torso', 'head', 'neck', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'].map(part => (
              <button
                key={part}
                onClick={() => setSelectedPart(part)}
                style={{
                  padding: '6px 12px', border: '1px solid rgba(0,212,255,0.5)',
                  background: selectedPart === part ? '#00d4ff40' : 'rgba(0,0,0,0.6)',
                  color: selectedPart === part ? 'white' : '#eef',
                  borderRadius: 40, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  transition: 'all 0.2s', backdropFilter: 'blur(4px)',
                  borderColor: selectedPart === part ? '#00d4ff' : 'rgba(0,212,255,0.5)',
                  boxShadow: selectedPart === part ? '0 0 10px #00d4ffaa' : 'none'
                }}
              >
                {part === 'leftArm' ? 'L Arm' : part === 'rightArm' ? 'R Arm' : part === 'leftLeg' ? 'L Leg' : part === 'rightLeg' ? 'R Leg' : part.charAt(0).toUpperCase() + part.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Color Palette */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#c0c8e6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            🎨 COLOR
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {colors.map((c, i) => (
              <button
                key={i}
                onClick={() => handleColorClick(c.val)}
                style={{
                  width: 40, height: 40, border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: 16, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  background: c.hex
                }}
                onMouseEnter={e => { e.target.style.transform = 'scale(1.08)'; e.target.style.borderColor = 'white'; }}
                onMouseLeave={e => { e.target.style.transform = 'scale(1)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              />
            ))}
          </div>
        </div>

        {/* Speed Slider */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#c0c8e6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            ⚡ ANIM SPEED
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="range" min="0" max="2" step="0.05" value={speed}
              onChange={e => setSpeed(parseFloat(e.target.value))}
              style={{ flex: 1, height: 5, WebkitAppearance: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: 5 }}
            />
            <span style={{ minWidth: 48, textAlign: 'right', fontFamily: 'monospace', color: '#00d4ff', fontWeight: 'bold', background: '#00000066', padding: '4px 12px', borderRadius: 30, fontSize: 13 }}>
              {speed.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Scale Slider */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: '#c0c8e6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
            📏 SCALE
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="range" min="0.5" max="1.4" step="0.02" value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              style={{ flex: 1, height: 5, WebkitAppearance: 'none', background: 'rgba(255,255,255,0.2)', borderRadius: 5 }}
            />
            <span style={{ minWidth: 48, textAlign: 'right', fontFamily: 'monospace', color: '#00d4ff', fontWeight: 'bold', background: '#00000066', padding: '4px 12px', borderRadius: 30, fontSize: 13 }}>
              {scale.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Animation Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 25 }}>
          {[
            { id: 'idle', label: 'Idle', gradient: 'linear-gradient(135deg, #2c3e66, #1a2a44)' },
            { id: 'walk', label: 'Walk', gradient: 'linear-gradient(135deg, #e65c00, #f9a602)' },
            { id: 'dance', label: 'Dance', gradient: 'linear-gradient(135deg, #ff3b6f, #ff9a5c)' }
          ].map(btn => (
            <button
              key={btn.id}
              onClick={() => setAnimation(btn.id)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', borderRadius: 44,
                background: btn.gradient, color: 'white', fontWeight: 'bold',
                cursor: 'pointer', transition: '0.2s', textTransform: 'uppercase',
                fontSize: 12, letterSpacing: 1.2, boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
              }}
              onMouseEnter={e => { e.target.style.transform = 'translateY(-3px)'; e.target.style.filter = 'brightness(1.1)'; }}
              onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.filter = 'brightness(1)'; }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Info Badge */}
      <div style={{
        position: 'absolute', bottom: 20, right: 20,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)',
        padding: '8px 20px', borderRadius: 40, fontSize: 12, color: '#ddd',
        borderLeft: '3px solid #00d4ff', pointerEvents: 'none', fontWeight: 500
      }}>
        🖱️ Drag Rotate | Right Pan | Scroll Zoom | 👀 Mouse tracks head
      </div>

      {/* Loading Screen */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0, background: '#020210',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, transition: 'opacity 0.6s ease'
        }}>
          <div style={{
            width: 64, height: 64, border: '4px solid #00d4ff30',
            borderTopColor: '#00d4ff', borderRadius: '50%',
            animation: 'spin 0.9s linear infinite', marginBottom: 22
          }} />
          <div style={{ color: '#00d4ff', fontSize: 18, letterSpacing: 5, fontWeight: 700, textShadow: '0 0 12px #00d4ff' }}>
            LOADING AVATAR
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none; width: 18px; height: 18px;
          background: #00d4ff; border-radius: 50%; cursor: pointer;
          box-shadow: 0 0 10px #00d4ff;
        }
      `}</style>
    </div>
  );
}
