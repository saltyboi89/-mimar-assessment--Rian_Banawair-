import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0f);
scene.fog = new THREE.FogExp2(0x0a0a0f, 0.012);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 28, 28);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 5;
controls.maxDistance = 80;
controls.maxPolarAngle = Math.PI / 2.05;

const COUNT = 500;
const COLS = 25;
const ROWS = Math.ceil(COUNT / COLS);
const SPACING = 2.2;
const BOX_W = 1.6;
const BOX_H = 0.6;

const vertexShader = `
  attribute vec3 aInstanceColor;
  attribute float aInstanceIndex;

  uniform float uTime;
  uniform float uHoveredIndex;

  varying vec3 vColor;
  varying float vHovered;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    float isHovered = step(abs(aInstanceIndex - uHoveredIndex), 0.5);
    vHovered = isHovered;

    vec3 hoverColor = vec3(0.2, 0.9, 1.0);
    vColor = mix(aInstanceColor, hoverColor, isHovered * 0.75);

    float pulse = 1.0 + isHovered * (sin(uTime * 6.0) * 0.5 + 0.5) * 0.12;

    vec3 pos = position;
    pos.xz *= mix(1.0, pulse, isHovered);
    pos.y += isHovered * (sin(uTime * 6.0) * 0.5 + 0.5) * 0.15;

    vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vHovered;
  varying vec2 vUv;
  varying vec3 vNormal;

  uniform float uTime;

  void main() {
    vec3 lightDir = normalize(vec3(1.0, 2.0, 1.5));
    float diff = max(dot(vNormal, lightDir), 0.0);
    float ambient = 0.25;
    float lighting = ambient + diff * 0.75;

    vec3 col = vColor * lighting;

    if (vHovered > 0.5) {
      float edgeDist = min(
        min(vUv.x, 1.0 - vUv.x),
        min(vUv.y, 1.0 - vUv.y)
      );
      float edgeWidth = 0.07;
      float edgeMask = 1.0 - smoothstep(0.0, edgeWidth, edgeDist);

      vec3 edgeColor = vec3(0.3, 1.0, 1.0) * (0.8 + sin(uTime * 8.0) * 0.2);
      col = mix(col, edgeColor, edgeMask * 0.9);
      col += vec3(0.05, 0.12, 0.15);
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

const geometry = new THREE.BoxGeometry(BOX_W, BOX_H, BOX_W);

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  uniforms: {
    uTime: { value: 0 },
    uHoveredIndex: { value: -1 },
  },
});

const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
mesh.castShadow = true;
mesh.receiveShadow = true;
scene.add(mesh);

const dummy = new THREE.Object3D();
const colorArray = new Float32Array(COUNT * 3);
const indexArray = new Float32Array(COUNT);

const palette = [
  new THREE.Color(0x3a5f8a),
  new THREE.Color(0x2e7d6e),
  new THREE.Color(0x6b4f8a),
  new THREE.Color(0x8a5c3a),
  new THREE.Color(0x3a6b5c),
  new THREE.Color(0x5a3a6b),
];

for (let i = 0; i < COUNT; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);

  const x = (col - COLS / 2) * SPACING;
  const z = (row - ROWS / 2) * SPACING;

  const h = 0.4 + Math.random() * 1.2;
  dummy.position.set(x, h / 2, z);
  dummy.scale.set(1, h / BOX_H, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);

  const base = palette[i % palette.length].clone();
  base.multiplyScalar(0.6 + (i / COUNT) * 0.4);
  colorArray[i * 3] = base.r;
  colorArray[i * 3 + 1] = base.g;
  colorArray[i * 3 + 2] = base.b;

  indexArray[i] = i;
}

mesh.instanceMatrix.needsUpdate = true;

geometry.setAttribute('aInstanceColor', new THREE.InstancedBufferAttribute(colorArray, 3));
geometry.setAttribute('aInstanceIndex', new THREE.InstancedBufferAttribute(indexArray, 1));

const groundGeo = new THREE.PlaneGeometry(120, 120);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x0d0d18, roughness: 0.95 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(100, 50, 0x1a1a2e, 0x1a1a2e);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const ambient = new THREE.AmbientLight(0x1a1a2e, 2);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.position.set(20, 40, 20);
sun.castShadow = true;
scene.add(sun);
const fillLight = new THREE.PointLight(0x3a5faa, 2, 60);
fillLight.position.set(-15, 10, -15);
scene.add(fillLight);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredIndex = -1;
const hoveredEl = document.getElementById('hovered');
const boxIdEl = document.getElementById('box-id');

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  material.uniforms.uTime.value = t;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(mesh);

  if (hits.length > 0) {
    const idx = hits[0].instanceId;
    if (idx !== hoveredIndex) {
      hoveredIndex = idx;
      material.uniforms.uHoveredIndex.value = idx;
      boxIdEl.textContent = String(idx).padStart(3, '0');
      hoveredEl.classList.add('visible');
      document.body.style.cursor = 'pointer';
    }
  } else {
    if (hoveredIndex !== -1) {
      hoveredIndex = -1;
      material.uniforms.uHoveredIndex.value = -1;
      hoveredEl.classList.remove('visible');
      document.body.style.cursor = 'default';
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
