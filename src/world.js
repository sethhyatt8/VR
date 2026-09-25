import * as THREE from 'three';
import { COLORS, GRID_X, GRID_Z, HEIGHTS, SHAPES, STUD } from './config.js';

const TABLE_TOP = 0.76;

export function pedestalSlot(index) {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 0.76 + col * 0.3,
    z: 0.42 - row * 0.32,
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
    ctx.font = `700 ${label.length > 4 ? 46 : 64}px Segoe UI, sans-serif`;
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
  camera.position.set(-0.05, 1.58, 1.22);

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
  const challenge = createChallengeStand(targets);
  scene.add(challenge.group);
  const bin = createBin();
  scene.add(bin);

  return {
    scene,
    camera,
    buildRoot,
    gridGroup,
    plate,
    targets,
    machine,
    challenge,
    bin,
    tableTop: TABLE_TOP,
    layoutTable,
  };
}

function createMachine(targets) {
  const mount = new THREE.Group();

  const openPose = { x: -0.95, y: 1.42, z: -0.55, tilt: -0.12, yaw: 0.28 };
  const closedPose = { x: -1.05, y: 1.7, z: -0.7, tilt: 0.15, yaw: 0.55 };
  const group = new THREE.Group();
  group.position.set(openPose.x, openPose.y, openPose.z);
  group.rotation.x = openPose.tilt;
  mount.add(group);

  const caseMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.55, metalness: 0.18 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x3e4752, roughness: 0.45, metalness: 0.22 });
  addBox(group, [1.04, 1.08, 0.02], [0, 0, 0], caseMat);
  addBox(group, [1.08, 0.02, 0.028], [0, 0.53, 0], trimMat);

  const screen = canvasTexture(512, 256, () => {});
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.16),
    new THREE.MeshBasicMaterial({ map: screen.texture }),
  );
  screenMesh.position.set(0, 0.34, 0.016);
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
    mesh.position.set(-0.27 + col * 0.18, 0.18 - row * 0.1, 0.02);
    mesh.userData = { type: 'ui', action: 'color', value: color.id };
    mesh.castShadow = true;
    group.add(mesh);
    targets.push(mesh);
    return mesh;
  });

  const shapeButtons = SHAPES.map((shape, index) => {
    const col = index % 5;
    const row = Math.floor(index / 5);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.055, 0.016),
      new THREE.MeshStandardMaterial({
        map: buttonTexture(shape.button || shape.name, '#243038', '#f4f7f8'),
        roughness: 0.5,
        emissive: 0x8fd0ff,
        emissiveIntensity: 0,
      }),
    );
    mesh.position.set(-0.36 + col * 0.18, -0.04 - row * 0.09, 0.02);
    mesh.userData = { type: 'ui', action: 'shape', value: shape.id };
    mesh.castShadow = true;
    group.add(mesh);
    targets.push(mesh);
    return mesh;
  });

  const heightButtons = HEIGHTS.map((height, index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.05, 0.016),
      new THREE.MeshStandardMaterial({
        map: buttonTexture(height.label, '#243038', '#f4f7f8'),
        roughness: 0.5,
        emissive: 0x8fd0ff,
        emissiveIntensity: 0,
      }),
    );
    mesh.position.set(-0.36 + index * 0.16, -0.31, 0.02);
    mesh.userData = { type: 'ui', action: 'height', value: height.id };
    mesh.castShadow = true;
    group.add(mesh);
    targets.push(mesh);
    return mesh;
  });

  const flatButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.05, 0.016),
    new THREE.MeshStandardMaterial({
      map: buttonTexture('FLAT', '#243038', '#f4f7f8'),
      roughness: 0.5,
      emissive: 0xf1c40f,
      emissiveIntensity: 0,
    }),
  );
  flatButton.position.set(0.28, -0.31, 0.02);
  flatButton.userData = { type: 'ui', action: 'top' };
  flatButton.castShadow = true;
  group.add(flatButton);
  targets.push(flatButton);

  const orderButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.07, 0.018),
    new THREE.MeshStandardMaterial({
      map: buttonTexture('ORDER', '#1f7a45', '#f4fff7'),
      roughness: 0.45,
      emissive: 0x1f7a45,
      emissiveIntensity: 0.15,
    }),
  );
  orderButton.position.set(-0.22, -0.44, 0.022);
  orderButton.userData = { type: 'ui', action: 'order' };
  orderButton.castShadow = true;
  group.add(orderButton);
  targets.push(orderButton);

  const pegTrack = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.07, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x1c242c, roughness: 0.55 }),
  );
  pegTrack.position.set(0.24, -0.44, 0.02);
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
  pegTag.position.set(0, 0, 0.02);
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
    ctx.font = headline.length > 18 ? '700 36px Segoe UI, sans-serif' : '700 54px Segoe UI, sans-serif';
    ctx.fillText(headline, canvas.width / 2, 128);
    ctx.fillStyle = '#b7c4ce';
    ctx.font = '500 28px Segoe UI, sans-serif';
    ctx.fillText(detail, canvas.width / 2, 190);
    texture.needsUpdate = true;
  }

  const hideButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.05, 0.016),
    new THREE.MeshStandardMaterial({
      map: buttonTexture('HIDE', '#3a4652', '#f4f7f8'),
      roughness: 0.5,
    }),
  );
  hideButton.position.set(0.4, 0.46, 0.02);
  hideButton.userData = { type: 'ui', action: 'screen' };
  group.add(hideButton);
  targets.push(hideButton);

  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.07, 0.02),
    new THREE.MeshStandardMaterial({
      map: buttonTexture('PARTS', '#1f7a45', '#f4fff7'),
      roughness: 0.45,
      emissive: 0x1f7a45,
      emissiveIntensity: 0.2,
    }),
  );
  tab.position.set(-0.95, 1.02, 0.46);
  tab.userData = { type: 'ui', action: 'screen' };
  tab.visible = false;
  mount.add(tab);
  targets.push(tab);

  let openAmount = 1;
  let openTarget = 1;

  function applyScreenPose() {
    group.position.set(
      closedPose.x + (openPose.x - closedPose.x) * openAmount,
      closedPose.y + (openPose.y - closedPose.y) * openAmount,
      closedPose.z + (openPose.z - closedPose.z) * openAmount,
    );
    group.rotation.x = closedPose.tilt + (openPose.tilt - closedPose.tilt) * openAmount;
    group.rotation.y = closedPose.yaw + (openPose.yaw - closedPose.yaw) * openAmount;
    group.visible = openAmount > 0.08;
    tab.visible = openAmount < 0.92;
  }

  function placeScreen(scale) {
    const side = (GRID_X * STUD * scale + 0.16) / 2;
    const x = -(side + 0.36);
    openPose.x = x;
    closedPose.x = x;
    tab.position.set(x + 0.28, 1.02, 0.48);
    applyScreenPose();
  }

  function toggleScreen() {
    openTarget = openTarget > 0.5 ? 0 : 1;
    return openTarget > 0.5;
  }

  function update(dt) {
    const step = Math.min(1, dt * 4);
    openAmount += (openTarget - openAmount) * step;
    if (Math.abs(openTarget - openAmount) < 0.001) openAmount = openTarget;
    applyScreenPose();
  }

  applyScreenPose();

  function refreshSelection(selection) {
    for (const button of colorButtons) {
      const selected = button.userData.value === selection.colorId;
      button.material.emissive.copy(button.material.color);
      button.material.emissiveIntensity = selected ? 0.42 : 0.06;
      button.scale.setScalar(selected ? 1.1 : 1);
    }
    for (const button of shapeButtons) {
      button.material.emissiveIntensity = button.userData.value === selection.shapeId ? 0.22 : 0;
    }
    for (const button of heightButtons) {
      button.material.emissiveIntensity = button.userData.value === selection.heightId ? 0.28 : 0;
    }
    flatButton.material.emissiveIntensity = selection.flat ? 0.35 : 0;
  }

  placeScreen(1);

  return { group: mount, orderButton, pegTrack, colorButtons, shapeButtons, paintScreen, refreshSelection, setPegKnob, toggleScreen, update, placeScreen };
}

export function createChallengeStand(targets) {
  const group = new THREE.Group();
  group.position.set(0, 0, -1.45);

  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.78 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x5c3b22, roughness: 0.8 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.78, 18), woodDark);
  post.position.y = 0.39;
  post.castShadow = true;
  group.add(post);

  const plateSize = 8 * STUD;
  const model = new THREE.Group();
  model.position.y = 0.82;
  group.add(model);

  const topMat = new THREE.MeshStandardMaterial({ color: 0xc5ced8, roughness: 0.82, emissive: 0x000000, emissiveIntensity: 0 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(plateSize, 0.02, plateSize), topMat);
  plate.position.y = -0.01;
  plate.receiveShadow = true;
  model.add(plate);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(plateSize + 0.08, 0.04, plateSize + 0.08), wood);
  deck.position.y = -0.04;
  deck.castShadow = true;
  deck.receiveShadow = true;
  model.add(deck);

  const bricks = new THREE.Group();
  bricks.position.set(-plateSize / 2, 0, -plateSize / 2);
  model.add(bricks);

  const newButton = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.07, 0.02),
    new THREE.MeshStandardMaterial({
      map: buttonTexture('NEW', '#1f7a45', '#f4fff7'),
      roughness: 0.45,
      emissive: 0x1f7a45,
      emissiveIntensity: 0.15,
    }),
  );
  newButton.position.set(0.26, 1.0, 0.36);
  newButton.userData = { type: 'ui', action: 'challenge' };
  newButton.castShadow = true;
  group.add(newButton);
  targets.push(newButton);

  const sign = canvasTexture(512, 160, () => {});
  const signMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.13),
    new THREE.MeshBasicMaterial({ map: sign.texture }),
  );
  signMesh.position.set(-0.22, 1.1, 0.36);
  signMesh.rotation.x = -0.5;
  group.add(signMesh);

  const glow = new THREE.PointLight(0xd6ffe6, 0, 2.4);
  glow.position.set(0, 1.0, 0);
  group.add(glow);
  const sparkGeo = new THREE.SphereGeometry(0.014, 6, 6);
  const sparks = [];
  let glowTime = 0;

  let matched = false;
  let shown = 'ready';

  function paint(headline, detail) {
    const { ctx, texture, canvas } = sign;
    ctx.fillStyle = '#1c242c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = matched ? '#8ee0ad' : '#8fd0ff';
    ctx.font = '700 58px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(headline, canvas.width / 2, 58);
    ctx.fillStyle = '#d5dde4';
    ctx.font = '500 32px Segoe UI, sans-serif';
    ctx.fillText(detail, canvas.width / 2, 112);
    texture.needsUpdate = true;
  }

  const verdictCopy = {
    ready: ['Match this', 'Any turn is fine'],
    match: ['It matches', 'Press NEW'],
    extra: ['Match this', 'Toss the extra bricks'],
    short: ['Match this', 'Still missing some'],
    different: ['Match this', 'Check colors and heights'],
  };

  function setVerdict(verdict) {
    if (verdict === shown) return;
    shown = verdict;
    matched = verdict === 'match';
    const [headline, detail] = verdictCopy[verdict] || verdictCopy.ready;
    topMat.emissive.setHex(matched ? 0x1f7a45 : 0x000000);
    topMat.emissiveIntensity = matched ? 0.45 : 0;
    paint(headline, detail);
  }

  function celebrate() {
    glowTime = 1.6;
    for (let i = 0; i < 22; i += 1) {
      const spark = new THREE.Mesh(
        sparkGeo,
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0xffe08a : 0x8dffc0,
          transparent: true,
          opacity: 1,
        }),
      );
      spark.position.set((Math.random() - 0.5) * 0.28, 0.9 + Math.random() * 0.08, (Math.random() - 0.5) * 0.28);
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.25 + Math.random() * 0.45;
      group.add(spark);
      sparks.push({
        mesh: spark,
        vx: Math.cos(angle) * speed,
        vy: 0.35 + Math.random() * 0.55,
        vz: Math.sin(angle) * speed,
        life: 0.9 + Math.random() * 0.4,
        age: 0,
      });
    }
  }

  function update(dt) {
    model.rotation.y += dt * 0.22;
    if (glowTime > 0) {
      glowTime = Math.max(0, glowTime - dt);
      glow.intensity = glowTime * 3.2;
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const spark = sparks[i];
      spark.age += dt;
      spark.vy -= dt * 0.8;
      spark.mesh.position.x += spark.vx * dt;
      spark.mesh.position.y += spark.vy * dt;
      spark.mesh.position.z += spark.vz * dt;
      spark.mesh.material.opacity = Math.max(0, 1 - spark.age / spark.life);
      if (spark.age >= spark.life) {
        spark.mesh.material.dispose();
        group.remove(spark.mesh);
        sparks.splice(i, 1);
      }
    }
  }

  paint('Match this', 'Any turn is fine');

  return { group, model, bricks, newButton, sign: signMesh, setVerdict, celebrate, update };
}

function createBin() {
  const group = new THREE.Group();
  group.position.set(-0.92, 0, -0.42);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c333a, roughness: 0.72, metalness: 0.08 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.76, 16), mat);
  post.position.y = 0.38;
  post.castShadow = true;
  group.add(post);
  const wall = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const span = 0.34;
  const lip = 0.74;
  wall(span, 0.018, span, 0, lip, 0);
  wall(0.018, 0.16, span, -span / 2, lip + 0.08, 0);
  wall(0.018, 0.16, span, span / 2, lip + 0.08, 0);
  wall(span, 0.16, 0.018, 0, lip + 0.08, -span / 2);
  wall(span + 0.018, 0.16, 0.018, 0, lip + 0.08, span / 2);
  const label = canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1c242c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4f7f8';
    ctx.font = '700 72px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TOSS', w / 2, h / 2);
  }).texture;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.09),
    new THREE.MeshBasicMaterial({ map: label }),
  );
  sign.position.set(0, lip + 0.2, span / 2 + 0.012);
  group.add(sign);
  const sideSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.09),
    new THREE.MeshBasicMaterial({ map: label }),
  );
  sideSign.position.set(span / 2 + 0.012, lip + 0.2, 0);
  sideSign.rotation.y = Math.PI / 2;
  group.add(sideSign);
  return group;
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
    ctx.font = label.length > 16 ? '600 20px Segoe UI, sans-serif' : '600 32px Segoe UI, sans-serif';
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
