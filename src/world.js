import * as THREE from 'three';
import { COLORS, GRID_X, GRID_Z, SHAPES, STUD } from './config.js';

const TABLE_TOP = 0.76;

export function pedestalSlot(index) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: -0.05 + col * 0.34,
    z: 0.62 + row * 0.4,
  };
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, ctx, texture };
}

function plankTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8d6a45';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#9a754c' : '#7d5d3b';
      ctx.fillRect(0, i * 64, w, 62);
      ctx.strokeStyle = 'rgba(60, 36, 18, 0.35)';
      ctx.strokeRect(0.5, i * 64 + 0.5, w - 1, 61);
    }
  }).texture;
}

function plateTexture() {
  const px = 32;
  return canvasTexture(GRID_X * px, GRID_Z * px, (ctx, w, h) => {
    ctx.fillStyle = '#d5dbe3';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b7c0cb';
    ctx.lineWidth = 2;
    for (let i = 0; i <= GRID_X; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * px, 0);
      ctx.lineTo(i * px, h);
      ctx.stroke();
    }
    for (let j = 0; j <= GRID_Z; j += 1) {
      ctx.beginPath();
      ctx.moveTo(0, j * px);
      ctx.lineTo(w, j * px);
      ctx.stroke();
    }
  }).texture;
}

function buttonTexture(label, fill, textColor) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = textColor;
    ctx.font = '700 64px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2 + 2);
  }).texture;
}

function addBox(parent, size, position, material, targets) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  if (targets) targets.push(mesh);
  return mesh;
}

export function createWorld() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe7e1d6);
  scene.fog = new THREE.Fog(0xe7e1d6, 7, 13);

  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 40);
  camera.position.set(0.15, 1.55, 1.05);

  const targets = [];

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 4.4, 5.4),
    new THREE.MeshStandardMaterial({ color: 0xe4ddd2, side: THREE.BackSide, roughness: 1 }),
  );
  shell.position.y = 2.2;
  scene.add(shell);

  const floorMap = plankTexture();
  floorMap.wrapS = THREE.RepeatWrapping;
  floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set(4, 4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.4),
    new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.92 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  scene.add(floor);

  const hemi = new THREE.HemisphereLight(0xfff7ee, 0x6d5c4c, 0.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfffaf3, 1.45);
  key.position.set(1.8, 3.4, 1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.4;
  key.shadow.camera.far = 8;
  key.shadow.camera.left = -2.2;
  key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.2;
  key.shadow.camera.bottom = -2.2;
  key.shadow.bias = -0.00035;
  scene.add(key);
  scene.add(key.target);
  key.target.position.set(0, 0.6, -0.2);
  const fill = new THREE.DirectionalLight(0xd5e4f5, 0.35);
  fill.position.set(-1.5, 1.6, 1.2);
  scene.add(fill);

  const plateW = GRID_X * STUD;
  const plateD = GRID_Z * STUD;
  const buildRoot = new THREE.Group();
  buildRoot.position.set(0, TABLE_TOP, -0.55);
  scene.add(buildRoot);
  const gridGroup = new THREE.Group();
  gridGroup.position.set(-plateW / 2, 0, -plateD / 2);
  buildRoot.add(gridGroup);

  const plateMap = plateTexture();
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(plateW, 0.02, plateD),
    new THREE.MeshStandardMaterial({ map: plateMap, color: 0xffffff, roughness: 0.86 }),
  );
  plate.position.set(plateW / 2, -0.01, plateD / 2);
  plate.receiveShadow = true;
  plate.userData = { type: 'plate' };
  gridGroup.add(plate);
  targets.push(plate);

  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.78 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.8 });
  const table = new THREE.Group();
  scene.add(table);
  const topW = plateW + 0.16;
  const topD = plateD + 0.16;
  const top = new THREE.Mesh(new THREE.BoxGeometry(topW, 0.045, topD), wood);
  top.position.set(0, TABLE_TOP - 0.034, -0.55);
  top.castShadow = true;
  top.receiveShadow = true;
  table.add(top);
  const legGeo = new THREE.BoxGeometry(0.06, 0.7, 0.06);
  const legs = [];
  for (let i = 0; i < 4; i += 1) {
    const leg = new THREE.Mesh(legGeo, woodDark);
    leg.castShadow = true;
    table.add(leg);
    legs.push(leg);
  }
  function layoutTable(scale) {
    const w = plateW * scale + 0.16;
    const d = plateD * scale + 0.16;
    top.scale.set(w / topW, 1, d / topD);
    const offsets = [
      [-(plateW * scale + 0.08) / 2, -(plateD * scale + 0.08) / 2],
      [(plateW * scale + 0.08) / 2, -(plateD * scale + 0.08) / 2],
      [-(plateW * scale + 0.08) / 2, (plateD * scale + 0.08) / 2],
      [(plateW * scale + 0.08) / 2, (plateD * scale + 0.08) / 2],
    ];
    legs.forEach((leg, index) => {
      leg.position.set(offsets[index][0], 0.35, -0.55 + offsets[index][1]);
    });
  }
  layoutTable(1);

  const machine = createMachine(targets);
  scene.add(machine.group);

  return {
    scene,
    camera,
    buildRoot,
    gridGroup,
    plate,
    targets,
    machine,
    tableTop: TABLE_TOP,
    layoutTable,
  };
}

function createMachine(targets) {
  const group = new THREE.Group();
  group.position.set(-0.78, 0, 0.32);
  group.rotation.y = Math.atan2(0.9, 0.45);

  const caseMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.55, metalness: 0.18 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x3e4752, roughness: 0.45, metalness: 0.22 });
  addBox(group, [0.52, 0.78, 0.36], [0, 0.39, 0], caseMat);
  addBox(group, [0.56, 0.04, 0.4], [0, 0.02, 0], trimMat);
  addBox(group, [0.48, 0.78, 0.03], [0, 0.98, 0.17], trimMat);

  const screen = canvasTexture(512, 256, () => {});
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 0.16),
    new THREE.MeshBasicMaterial({ map: screen.texture }),
  );
  screenMesh.position.set(0, 1.22, 0.205);
  group.add(screenMesh);

  const colorButtons = COLORS.map((color, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.072, 0.016),
      new THREE.MeshStandardMaterial({
        color: color.hex,
        roughness: 0.42,
        emissive: 0x111111,
        emissiveIntensity: 0.18,
      }),
    );
    mesh.position.set(-0.135 + col * 0.09, 1.02 - row * 0.09, 0.21);
    mesh.userData = { type: 'ui', action: 'color', value: color.id };
    mesh.castShadow = true;
    group.add(mesh);
    targets.push(mesh);
    return mesh;
  });

  const shapeButtons = SHAPES.map((shape, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.086, 0.058, 0.016),
      new THREE.MeshStandardMaterial({
        map: buttonTexture(shape.name, '#243038', '#f4f7f8'),
        roughness: 0.5,
        emissive: 0x8fd0ff,
        emissiveIntensity: 0,
      }),
    );
    mesh.position.set(-0.145 + index * 0.096, 0.78, 0.21);
    mesh.userData = { type: 'ui', action: 'shape', value: shape.id };
    mesh.castShadow = true;
    group.add(mesh);
    targets.push(mesh);
    return mesh;
  });

  const orderButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.07, 0.018),
    new THREE.MeshStandardMaterial({
      map: buttonTexture('ORDER', '#1f7a45', '#f4fff7'),
      roughness: 0.45,
      emissive: 0x1f7a45,
      emissiveIntensity: 0.15,
    }),
  );
  orderButton.position.set(0, 0.66, 0.215);
  orderButton.userData = { type: 'ui', action: 'order' };
  orderButton.castShadow = true;
  group.add(orderButton);
  targets.push(orderButton);

  const pegTrack = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.07, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x1c242c, roughness: 0.55 }),
  );
  pegTrack.position.set(0, 0.5, 0.21);
  pegTrack.userData = { type: 'ui', action: 'peg' };
  group.add(pegTrack);
  targets.push(pegTrack);
  const pegKnob = new THREE.Mesh(
    new THREE.BoxGeometry(0.046, 0.055, 0.028),
    new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.35 }),
  );
  pegKnob.position.set(0, 0, 0.012);
  pegTrack.add(pegKnob);
  const pegLabel = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f4f7f8';
    ctx.font = '600 36px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PEG SIZE', w / 2, h / 2);
  }).texture;
  const pegTag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.04),
    new THREE.MeshBasicMaterial({ map: pegLabel, transparent: true }),
  );
  pegTag.position.set(0, 0.055, 0.012);
  pegTrack.add(pegTag);

  function setPegKnob(scale, min, max) {
    const t = Math.min(1, Math.max(0, (scale - min) / (max - min)));
    pegKnob.position.x = -0.15 + t * 0.3;
  }

  function paintScreen(headline, detail) {
    const { ctx, texture, canvas } = screen;
    ctx.fillStyle = '#10161c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#8fd0ff';
    ctx.font = '600 28px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PARTS', canvas.width / 2, 48);
    ctx.fillStyle = '#f7f4ee';
    ctx.font = '700 54px Segoe UI, sans-serif';
    ctx.fillText(headline, canvas.width / 2, 128);
    ctx.fillStyle = '#b7c4ce';
    ctx.font = '500 28px Segoe UI, sans-serif';
    ctx.fillText(detail, canvas.width / 2, 190);
    texture.needsUpdate = true;
  }

  function refreshSelection(colorId, shapeId) {
    for (const button of colorButtons) {
      const selected = button.userData.value === colorId;
      button.material.emissive.copy(button.material.color);
      button.material.emissiveIntensity = selected ? 0.42 : 0.06;
      button.scale.setScalar(selected ? 1.1 : 1);
    }
    for (const button of shapeButtons) {
      button.material.emissiveIntensity = button.userData.value === shapeId ? 0.22 : 0;
    }
  }

  return { group, orderButton, pegTrack, colorButtons, shapeButtons, paintScreen, refreshSelection, setPegKnob };
}

export function createPedestal(index, label) {
  const group = new THREE.Group();
  const slot = pedestalSlot(index);
  group.position.set(slot.x, 0, slot.z);

  const metal = new THREE.MeshStandardMaterial({ color: 0x8d959c, roughness: 0.35, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4046, roughness: 0.5, metalness: 0.3 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0xd7dde3, roughness: 0.4, metalness: 0.25, emissive: 0xfff4d2, emissiveIntensity: 0 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.06, 24), dark);
  base.position.y = 0.03;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.62, 20), metal);
  column.position.y = 0.37;
  column.castShadow = true;
  group.add(column);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.028, 28), topMat);
  top.position.y = 0.694;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const labelTex = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#1c242c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4f7f8';
    ctx.font = '600 32px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h / 2);
  }).texture;
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.04),
    new THREE.MeshBasicMaterial({ map: labelTex }),
  );
  tag.position.set(0, 0.52, 0.058);
  group.add(tag);

  return { group, top };
}
