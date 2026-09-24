import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { createBrick, makeGhost, setBrickRaycast } from './bricks.js';
import { colorById, GRID_X, GRID_Z, HEIGHT, MAX_PEDESTALS, partLabel, PEG_MAX, PEG_MIN, shapeById, STUD } from './config.js';
import { brickLocalPosition, canPlaceAssembly, columnTop, connectedBricks, createGrid, findAssemblySnap, findSnap, footprintOf, occupy, release } from './grid.js';
import { createPedestal, createWorld } from './world.js';

const statusEl = document.getElementById('status');
const hudEl = document.getElementById('hud');
const scalePanel = document.getElementById('scale-panel');
const pegInput = document.getElementById('peg-size');
const pegReadout = document.getElementById('peg-readout');

const world = createWorld();
const { scene, camera, buildRoot, gridGroup, targets, machine } = world;
const grid = createGrid();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
document.body.appendChild(renderer.domElement);
document.body.appendChild(XRButton.createButton(renderer, {
  optionalFeatures: ['local-floor', 'bounded-floor'],
}));

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.12, 1.02, -0.42);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 0.45;
controls.maxDistance = 3.4;
controls.update();

const raycaster = new THREE.Raycaster();
const buildPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -world.tableTop);
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const jobs = [];
const pedestals = [];
const localPoint = new THREE.Vector3();
const worldPoint = new THREE.Vector3();
const tmpDir = new THREE.Vector3();

const selection = { colorId: 'red', shapeId: '2x4' };
let held = null;
let heldFrom = null;
let heldHome = null;
let assembly = null;
let ghost = null;
let hovered = null;
let press = null;
let pegScale = 1;
let pegDrag = false;
let nextPedestalId = 1;
let hasAim = false;
const yawQuat = new THREE.Quaternion();
const yawEuler = new THREE.Euler();
const lastAim = new THREE.Vector3();
let aimLayer = null;

machine.refreshSelection(selection.colorId, selection.shapeId);
paintSelection('Press ORDER to dispense');
setStatus('Red 2×4 is selected. Press ORDER.');

renderer.xr.addEventListener('sessionstart', () => {
  hudEl.style.display = 'none';
  scalePanel.style.display = 'none';
  controls.enabled = false;
});
renderer.xr.addEventListener('sessionend', () => {
  hudEl.style.display = '';
  scalePanel.style.display = '';
  controls.enabled = true;
});

const controllerFactory = new XRControllerModelFactory();
const controllers = [0, 1].map((index) => setupController(index));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerdown', onPointerDown, true);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('keydown', onKeyDown);
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

renderer.setAnimationLoop(frame);

function setupController(index) {
  const controller = renderer.xr.getController(index);
  controller.addEventListener('connected', (event) => {
    controller.userData.inputSource = event.data;
    controller.userData.rotateLatch = false;
  });
  controller.addEventListener('selectstart', () => onXrSelect(controller));
  controller.addEventListener('selectend', () => onXrRelease(controller));
  scene.add(controller);

  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -2),
  ]);
  controller.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xfff4e4 })));

  const grip = renderer.xr.getControllerGrip(index);
  grip.add(controllerFactory.createControllerModel(grip));
  scene.add(grip);
  return controller;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function paintSelection(detail) {
  const color = colorById(selection.colorId);
  const shape = shapeById(selection.shapeId);
  machine.paintScreen(`${color.name} ${shape.name}`, detail);
}

function ownerOf(object) {
  let current = object;
  while (current) {
    if (current.userData?.type) return current;
    current = current.parent;
  }
  return null;
}

function hitTest(origin, direction) {
  raycaster.set(origin, direction);
  const hits = raycaster.intersectObjects(targets, true);
  for (const hit of hits) {
    const owner = ownerOf(hit.object);
    if (!owner || owner === held || owner.userData.type === 'ghost') continue;
    return { owner, point: hit.point };
  }
  return null;
}

function hitFromCamera() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(targets, true);
  for (const hit of hits) {
    const owner = ownerOf(hit.object);
    if (!owner || owner === held || owner.userData.type === 'ghost') continue;
    return { owner, point: hit.point };
  }
  return null;
}

function hitFromController(controller) {
  controller.getWorldPosition(worldPoint);
  tmpDir.set(0, 0, -1).applyQuaternion(controller.quaternion);
  return hitTest(worldPoint, tmpDir);
}

function raiseOnto(point, brick, layer) {
  const base = new THREE.Vector3();
  const scale = new THREE.Vector3();
  brick.getWorldPosition(base);
  brick.getWorldScale(scale);
  point.y = base.y + HEIGHT * scale.y;
  aimLayer = layer + 1;
  return point;
}

function stackAt(point) {
  localPoint.copy(point);
  gridGroup.worldToLocal(localPoint);
  const top = columnTop(grid, Math.floor(localPoint.x / STUD), Math.floor(localPoint.z / STUD));
  if (!top) {
    aimLayer = 0;
    return point;
  }
  return raiseOnto(point, top.brick, top.layer);
}

function placementPoint() {
  aimLayer = null;
  const hits = raycaster.intersectObjects(targets, true);
  for (const hit of hits) {
    const owner = ownerOf(hit.object);
    if (!owner || owner === held || owner.userData.type === 'ghost') continue;
    if (owner.userData.type === 'ui') continue;
    if (owner.userData.type === 'brick' && owner.userData.role === 'placed' && owner.userData.anchor) {
      return raiseOnto(hit.point.clone(), owner, owner.userData.anchor.layer);
    }
    if (owner.userData.type === 'plate') return stackAt(hit.point.clone());
  }
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(buildPlane, point)) return null;
  return stackAt(point);
}

function selectColor(colorId) {
  selection.colorId = colorId;
  machine.refreshSelection(selection.colorId, selection.shapeId);
  paintSelection('Press ORDER to dispense');
  setStatus(`${partLabel(selection.colorId, selection.shapeId)} is selected. Press ORDER.`);
}

function selectShape(shapeId) {
  selection.shapeId = shapeId;
  machine.refreshSelection(selection.colorId, selection.shapeId);
  paintSelection('Press ORDER to dispense');
  setStatus(`${partLabel(selection.colorId, selection.shapeId)} is selected. Press ORDER.`);
}

function activateUi(owner) {
  if (owner.userData.action === 'color') selectColor(owner.userData.value);
  else if (owner.userData.action === 'shape') selectShape(owner.userData.value);
  else if (owner.userData.action === 'order') orderSelection();
  else if (owner.userData.action === 'screen') {
    const open = machine.toggleScreen();
    setStatus(open ? 'Order screen is down.' : 'Order screen is tucked away. Press PARTS to bring it back.');
  }
}

function orderSelection() {
  const existing = pedestals.find((pedestal) => pedestal.colorId === selection.colorId && pedestal.shapeId === selection.shapeId);
  if (existing) {
    flash(existing.top);
    const label = partLabel(selection.colorId, selection.shapeId);
    paintSelection('Already on a pedestal');
    setStatus(`${label} is already out.`);
    return existing;
  }
  if (pedestals.length >= MAX_PEDESTALS) {
    setStatus(`The room already has ${MAX_PEDESTALS} pedestals.`);
    return null;
  }
  const pedestal = spawnPedestal(selection.colorId, selection.shapeId);
  const label = partLabel(selection.colorId, selection.shapeId);
  paintSelection('Dispensed');
  setStatus(`${label} is on a pedestal.`);
  return pedestal;
}

function spawnPedestal(colorId, shapeId) {
  const index = pedestals.length;
  const label = partLabel(colorId, shapeId);
  const visual = createPedestal(index, label);
  scene.add(visual.group);
  const pedestal = {
    id: nextPedestalId,
    colorId,
    shapeId,
    group: visual.group,
    top: visual.top,
    supply: null,
    index,
  };
  nextPedestalId += 1;
  pedestals.push(pedestal);
  refill(pedestal, true);
  return pedestal;
}

function refill(pedestal, animateIn) {
  const brick = createBrick(shapeById(pedestal.shapeId), colorById(pedestal.colorId));
  brick.userData.role = 'supply';
  brick.userData.pedestalId = pedestal.id;
  brick.position.set(0, 0.712, 0);
  pedestal.group.add(brick);
  pedestal.supply = brick;
  targets.push(brick);
  if (animateIn) {
    brick.scale.setScalar(0.2);
    jobs.push({
      t: 0,
      d: 0.22,
      update(k) {
        if (brick.userData.role !== 'supply') return;
        const s = 0.2 + 0.8 * (k * k * (3 - 2 * k));
        brick.scale.setScalar(pegScale * s);
      },
    });
  }
}

function flash(mesh) {
  mesh.material.emissiveIntensity = 0.7;
  jobs.push({
    t: 0,
    d: 0.45,
    update(k) {
      mesh.material.emissiveIntensity = 0.7 * (1 - k);
    },
  });
}

function quarterTurns(object) {
  object.updateWorldMatrix(true, false);
  object.getWorldQuaternion(yawQuat);
  yawEuler.setFromQuaternion(yawQuat, 'YXZ');
  return ((Math.round(yawEuler.y / (Math.PI / 2)) % 4) + 4) % 4;
}

function gripHeld(controller) {
  const button = controller?.userData.inputSource?.gamepad?.buttons?.[1];
  return Boolean(button && (button.pressed || button.value > 0.6));
}

function nearbyBrick(controller) {
  const origin = new THREE.Vector3();
  controller.getWorldPosition(origin);
  let best = null;
  let bestDist = 0.16 * Math.max(pegScale, 0.75);
  for (const item of targets) {
    if (item.userData?.type !== 'brick' || item.userData.role === 'held') continue;
    const point = new THREE.Vector3();
    item.getWorldPosition(point);
    const dist = point.distanceTo(origin);
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}

function captureHome(brick) {
  return {
    role: brick.userData.role,
    pedestalId: brick.userData.pedestalId,
    anchor: brick.userData.anchor ? { ...brick.userData.anchor } : null,
    rot: brick.userData.rot,
  };
}

function grab(brick, holder, whole) {
  const group = whole && brick.userData.role === 'placed' ? connectedBricks(grid, brick) : [brick];
  if (group.length > 1) grabAssembly(group, brick, holder);
  else grabOne(brick, holder);
}

function grabOne(brick, holder) {
  const home = captureHome(brick);
  if (brick.userData.role === 'placed') release(grid, brick);
  const fromSupply = home.role === 'supply';
  const pedestal = pedestals.find((item) => item.id === brick.userData.pedestalId);
  held = brick;
  heldFrom = holder;
  heldHome = home;
  assembly = null;
  brick.userData.role = 'held';
  brick.userData.snap = null;
  brick.userData.yawOffset = 0;
  brick.scale.setScalar(1);
  const index = targets.indexOf(brick);
  if (index >= 0) targets.splice(index, 1);
  setBrickRaycast(brick, false);

  if (holder) {
    holder.attach(brick);
    brick.position.set(0, -0.02, -0.14);
    brick.rotation.set(0, 0, 0);
  } else {
    scene.attach(brick);
    brick.rotation.set(0, brick.userData.rot * Math.PI / 2, 0);
  }
  syncBrickScale(brick);

  discardGhost();
  ghost = makeGhost(brick);
  ghost.visible = false;
  syncBrickScale(ghost);
  scene.add(ghost);

  if (fromSupply && pedestal) pedestal.supply = null;
  setStatus(`Holding ${partLabel(brick.userData.colorId, brick.userData.shapeId)}. Let go to drop it.`);
}

function grabAssembly(bricks, primary, holder) {
  const origin = primary.userData.anchor;
  const pieces = bricks.map((item) => ({
    brick: item,
    home: captureHome(item),
    dgx: item.userData.anchor.gx - origin.gx,
    dgz: item.userData.anchor.gz - origin.gz,
    dlayer: item.userData.anchor.layer - origin.layer,
  }));
  const carry = new THREE.Group();
  gridGroup.add(carry);
  carry.position.set(origin.gx * STUD, origin.layer * HEIGHT, origin.gz * STUD);
  for (const piece of pieces) {
    release(grid, piece.brick);
    const index = targets.indexOf(piece.brick);
    if (index >= 0) targets.splice(index, 1);
    setBrickRaycast(piece.brick, false);
    piece.brick.userData.role = 'held';
    piece.brick.userData.snap = null;
    const { w, d } = footprintOf(piece.brick);
    carry.attach(piece.brick);
    piece.brick.position.set((piece.dgx + w / 2) * STUD, piece.dlayer * HEIGHT, (piece.dgz + d / 2) * STUD);
    piece.brick.rotation.set(0, piece.brick.userData.rot * Math.PI / 2, 0);
    piece.brick.scale.setScalar(1);
  }
  if (holder) {
    holder.attach(carry);
    carry.position.set(0, -0.04, -0.28);
    carry.rotation.set(0, 0, 0);
  }
  held = primary;
  heldFrom = holder;
  heldHome = null;
  assembly = { pieces, carry };
  if (ghost) ghost.visible = false;
  setStatus(`Holding ${pieces.length} connected bricks. Let go to drop them.`);
}

function rotateAssembly() {
  const primary = held;
  const { w: pw, d: pd } = footprintOf(primary);
  const pcx = pw / 2;
  const pcz = pd / 2;
  const next = assembly.pieces.map((piece) => {
    const { w, d } = footprintOf(piece.brick);
    const cx = piece.dgx + w / 2;
    const cz = piece.dgz + d / 2;
    piece.brick.userData.rot = (piece.brick.userData.rot + 1) % 4;
    const turned = footprintOf(piece.brick);
    return {
      piece,
      cx: pcx - (cz - pcz),
      cz: pcz + (cx - pcx),
      w: turned.w,
      d: turned.d,
    };
  });
  const primaryNext = next.find((item) => item.piece.brick === primary);
  const shiftX = primaryNext.cx - primaryNext.w / 2;
  const shiftZ = primaryNext.cz - primaryNext.d / 2;
  for (const item of next) {
    item.piece.dgx = Math.round(item.cx - item.w / 2 - shiftX);
    item.piece.dgz = Math.round(item.cz - item.d / 2 - shiftZ);
    item.piece.brick.position.set(
      (item.piece.dgx + item.w / 2) * STUD,
      item.piece.dlayer * HEIGHT,
      (item.piece.dgz + item.d / 2) * STUD,
    );
    item.piece.brick.rotation.set(0, item.piece.brick.userData.rot * Math.PI / 2, 0);
  }
}

function rotateHeld() {
  if (!held) return;
  if (assembly) rotateAssembly();
  else if (heldFrom) {
    held.userData.yawOffset = ((held.userData.yawOffset || 0) + 1) % 4;
    held.rotation.set(0, held.userData.yawOffset * Math.PI / 2, 0);
  } else {
    held.userData.rot = (held.userData.rot + 1) % 4;
    held.rotation.set(0, held.userData.rot * Math.PI / 2, 0);
  }
  if (hasAim) updateSnapFromPoint(lastAim);
}

function placeAssembly() {
  const snap = held.userData.snap;
  if (!snap || !canPlaceAssembly(grid, assembly.pieces, snap)) return false;
  const { pieces, carry } = assembly;
  const count = pieces.length;
  assembly = null;
  held = null;
  heldFrom = null;
  heldHome = null;
  for (const piece of pieces) {
    const gx = snap.gx + piece.dgx;
    const gz = snap.gz + piece.dgz;
    const layer = snap.layer + piece.dlayer;
    const { w, d } = footprintOf(piece.brick);
    gridGroup.attach(piece.brick);
    piece.brick.position.set((gx + w / 2) * STUD, layer * HEIGHT, (gz + d / 2) * STUD);
    piece.brick.rotation.set(0, piece.brick.userData.rot * Math.PI / 2, 0);
    piece.brick.scale.setScalar(1);
    piece.brick.userData.role = 'placed';
    piece.brick.userData.snap = null;
    occupy(grid, piece.brick, gx, gz, layer);
    setBrickRaycast(piece.brick, true);
    targets.push(piece.brick);
  }
  carry.parent?.remove(carry);
  setStatus(`Placed ${count} bricks.`);
  return true;
}

function placeSingle() {
  const snap = held.userData.snap;
  if (!snap) return false;
  const brick = held;
  const home = heldHome;
  held = null;
  heldFrom = null;
  heldHome = null;
  if (ghost) ghost.visible = false;
  gridGroup.attach(brick);
  const pos = brickLocalPosition(brick, snap);
  brick.position.set(pos.x, pos.y, pos.z);
  brick.rotation.set(0, brick.userData.rot * Math.PI / 2, 0);
  brick.scale.setScalar(1);
  brick.userData.role = 'placed';
  brick.userData.snap = null;
  syncBrickScale(brick);
  occupy(grid, brick, snap.gx, snap.gz, snap.layer);
  setBrickRaycast(brick, true);
  targets.push(brick);
  if (home?.role === 'supply') {
    const pedestal = pedestals.find((item) => item.id === home.pedestalId);
    if (pedestal && !pedestal.supply) refill(pedestal, true);
  }
  setStatus(`Placed ${partLabel(brick.userData.colorId, brick.userData.shapeId)}.`);
  return true;
}

function restoreBrick(brick, home) {
  brick.userData.rot = home.rot;
  brick.userData.snap = null;
  if (home.role === 'supply') {
    const pedestal = pedestals.find((item) => item.id === home.pedestalId);
    if (pedestal) {
      pedestal.group.attach(brick);
      brick.position.set(0, 0.712, 0);
      brick.rotation.set(0, 0, 0);
      brick.userData.role = 'supply';
      brick.userData.pedestalId = home.pedestalId;
      pedestal.supply = brick;
      syncBrickScale(brick);
    }
  } else if (home.role === 'placed' && home.anchor) {
    brick.userData.rot = home.rot;
    gridGroup.attach(brick);
    const pos = brickLocalPosition(brick, { ...home.anchor, dist: 0 });
    brick.position.set(pos.x, pos.y, pos.z);
    brick.rotation.set(0, home.rot * Math.PI / 2, 0);
    brick.scale.setScalar(1);
    brick.userData.role = 'placed';
    occupy(grid, brick, home.anchor.gx, home.anchor.gz, home.anchor.layer);
  }
  setBrickRaycast(brick, true);
  if (!targets.includes(brick)) targets.push(brick);
}

function restoreHeld() {
  if (assembly) {
    const { pieces, carry } = assembly;
    assembly = null;
    held = null;
    heldFrom = null;
    heldHome = null;
    for (const piece of pieces) restoreBrick(piece.brick, piece.home);
    carry.parent?.remove(carry);
    setStatus('Dropped it back where it was.');
    return;
  }
  if (held && heldHome) {
    const brick = held;
    const home = heldHome;
    held = null;
    heldFrom = null;
    heldHome = null;
    restoreBrick(brick, home);
    setStatus('Dropped it back where it was.');
  }
  held = null;
  heldFrom = null;
  heldHome = null;
}

function releaseHeld() {
  if (!held) return;
  const placed = assembly ? placeAssembly() : placeSingle();
  if (!placed) restoreHeld();
  discardGhost();
}

function discardGhost() {
  if (!ghost) return;
  ghost.parent?.remove(ghost);
  ghost = null;
}

function followAim(point) {
  const target = assembly ? assembly.carry : held;
  scene.attach(target);
  target.position.copy(point);
  target.position.y += 0.04;
  if (assembly) {
    target.rotation.set(0, 0, 0);
    target.scale.setScalar(pegScale);
    return;
  }
  target.rotation.set(0, held.userData.rot * Math.PI / 2, 0);
  syncBrickScale(held);
}

function showGhost(snap) {
  if (!ghost || assembly) return;
  if (!snap) {
    ghost.visible = false;
    return;
  }
  const pos = brickLocalPosition(held, snap);
  gridGroup.attach(ghost);
  ghost.position.set(pos.x, pos.y, pos.z);
  ghost.rotation.set(0, held.userData.rot * Math.PI / 2, 0);
  syncBrickScale(ghost);
  ghost.visible = true;
}

function updateSnapFromPoint(point) {
  if (!held) return;
  lastAim.copy(point);
  hasAim = true;
  if (!heldFrom) followAim(point);
  localPoint.copy(point);
  gridGroup.worldToLocal(localPoint);
  const margin = STUD * 2;
  const nearBuild = localPoint.x > -margin && localPoint.z > -margin
    && localPoint.x < GRID_X * STUD + margin && localPoint.z < GRID_Z * STUD + margin;
  if (assembly) {
    held.userData.snap = nearBuild
      ? findAssemblySnap(grid, assembly.pieces, held, localPoint.x, localPoint.y, localPoint.z, aimLayer)
      : null;
    return;
  }
  if (heldFrom) held.userData.rot = quarterTurns(held);
  const snap = nearBuild ? findSnap(grid, held, localPoint.x, localPoint.y, localPoint.z, aimLayer) : null;
  held.userData.snap = snap;
  showGhost(snap);
}

function inBuild(object) {
  let current = object;
  while (current) {
    if (current === buildRoot) return true;
    current = current.parent;
  }
  return false;
}

function syncBrickScale(brick) {
  if (!brick) return;
  if (assembly?.pieces.some((piece) => piece.brick === brick)) {
    brick.scale.setScalar(1);
    return;
  }
  brick.scale.setScalar(inBuild(brick) ? 1 : pegScale);
}

function setPegScale(next) {
  pegScale = THREE.MathUtils.clamp(next, PEG_MIN, PEG_MAX);
  buildRoot.scale.setScalar(pegScale);
  world.layoutTable(pegScale);
  machine.setPegKnob(pegScale, PEG_MIN, PEG_MAX);
  for (const item of targets) {
    if (item.userData?.type === 'brick') syncBrickScale(item);
  }
  syncBrickScale(held);
  syncBrickScale(ghost);
  if (assembly) assembly.carry.scale.setScalar(inBuild(assembly.carry) ? 1 : pegScale);
  pegReadout.textContent = `${(STUD * pegScale * 100).toFixed(1)} cm`;
  if (document.activeElement !== pegInput) pegInput.value = String(pegScale);
}

function setPegFromHit(hit) {
  const local = hit.owner.worldToLocal(hit.point.clone());
  const t = THREE.MathUtils.clamp((local.x + 0.15) / 0.3, 0, 1);
  const next = PEG_MIN + t * (PEG_MAX - PEG_MIN);
  pegInput.value = String(next);
  setPegScale(next);
}

pegInput.addEventListener('input', () => {
  setPegScale(Number(pegInput.value));
});
setPegScale(1);

function hover(owner) {
  if (hovered === owner) return;
  if (hovered?.userData.type === 'ui' && hovered.userData.action !== 'peg') {
    const selectedColor = hovered.userData.action === 'color' && hovered.userData.value === selection.colorId;
    hovered.scale.setScalar(selectedColor ? 1.1 : 1);
  }
  hovered = owner;
  if (owner?.userData.type === 'ui' && owner.userData.action !== 'peg') owner.scale.setScalar(1.12);
  renderer.domElement.style.cursor = owner ? 'pointer' : (held ? 'grabbing' : 'default');
}

function onPointerMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if (renderer.xr.isPresenting) return;
  if (pegDrag) {
    const pegHit = hitFromCamera();
    if (pegHit?.owner?.userData.action === 'peg') setPegFromHit(pegHit);
    return;
  }
  const hit = hitFromCamera();
  hover(hit?.owner ?? null);
  if (held && !heldFrom) {
    raycaster.setFromCamera(pointer, camera);
    const aim = placementPoint();
    if (aim) updateSnapFromPoint(aim);
  }
}

function onPointerDown(event) {
  if (event.button !== 0 || renderer.xr.isPresenting) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const hit = hitFromCamera();
  if (hit?.owner?.userData.action === 'peg') {
    pegDrag = true;
    controls.enabled = false;
    setPegFromHit(hit);
  }
  const owner = hit?.owner ?? null;
  press = {
    x: event.clientX,
    y: event.clientY,
    owner,
    grabbedNow: false,
  };
  if (!held && owner?.userData.type === 'brick') {
    grab(owner, null, event.shiftKey);
    press.grabbedNow = true;
    raycaster.setFromCamera(pointer, camera);
    const aim = placementPoint();
    if (aim) updateSnapFromPoint(aim);
  }
  const interactive = owner && (owner.userData.type === 'ui' || owner.userData.type === 'brick' || held);
  if (interactive || held) controls.enabled = false;
}

function onPointerUp(event) {
  if (pegDrag) {
    pegDrag = false;
    controls.enabled = true;
    press = null;
    return;
  }
  if (!press || renderer.xr.isPresenting) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
  const clicked = moved < 8;
  const { owner } = press;
  press = null;
  controls.enabled = true;
  if (owner?.userData.type === 'ui' && clicked && !held) {
    activateUi(owner);
    return;
  }
  if (!held || heldFrom) {
    if (owner?.userData.type === 'ui' && clicked) activateUi(owner);
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  const aim = placementPoint();
  if (aim) updateSnapFromPoint(aim);
  releaseHeld();
}

function onKeyDown(event) {
  if (event.repeat) return;
  if (event.key === 'r' || event.key === 'R') rotateHeld();
  if (event.key === 'Enter') orderSelection();
}

function onXrSelect(controller) {
  const hit = hitFromController(controller);
  if (hit?.owner?.userData.action === 'peg') {
    controller.userData.pegDrag = true;
    setPegFromHit(hit);
    return;
  }
  if (hit?.owner?.userData.type === 'ui') {
    activateUi(hit.owner);
    return;
  }
  if (held) return;
  const target = hit?.owner?.userData.type === 'brick' ? hit.owner : nearbyBrick(controller);
  if (target) grab(target, controller, gripHeld(controller));
}

function onXrRelease(controller) {
  if (controller.userData.pegDrag) {
    controller.userData.pegDrag = false;
    return;
  }
  if (!held || heldFrom !== controller) return;
  controller.getWorldPosition(worldPoint);
  tmpDir.set(0, 0, -1).applyQuaternion(controller.quaternion);
  raycaster.set(worldPoint, tmpDir);
  const aim = placementPoint();
  if (aim) updateSnapFromPoint(aim);
  else {
    held.getWorldPosition(worldPoint);
    updateSnapFromPoint(worldPoint);
  }
  releaseHeld();
}

function pollRotate(controller) {
  const gamepad = controller.userData.inputSource?.gamepad;
  if (!gamepad || !held || heldFrom !== controller) return;
  const stick = gamepad.axes?.[2] ?? 0;
  const button = gamepad.buttons?.[5]?.pressed;
  const active = button || stick > 0.6;
  if (active && !controller.userData.rotateLatch) {
    controller.userData.rotateLatch = true;
    rotateHeld();
  } else if (!active) controller.userData.rotateLatch = false;
}

function updateHeldXr() {
  if (!held || !heldFrom) return;
  heldFrom.getWorldPosition(worldPoint);
  tmpDir.set(0, 0, -1).applyQuaternion(heldFrom.quaternion);
  raycaster.set(worldPoint, tmpDir);
  const aim = placementPoint();
  if (aim) updateSnapFromPoint(aim);
  else {
    held.getWorldPosition(worldPoint);
    updateSnapFromPoint(worldPoint);
  }
}

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (let i = jobs.length - 1; i >= 0; i -= 1) {
    jobs[i].t += dt;
    const k = Math.min(1, jobs[i].t / jobs[i].d);
    jobs[i].update(k);
    if (k >= 1) jobs.splice(i, 1);
  }
  machine.update(dt);
  if (!renderer.xr.isPresenting) controls.update();
  else {
    for (const controller of controllers) {
      pollRotate(controller);
      if (controller.userData.pegDrag) {
        const hit = hitFromController(controller);
        if (hit?.owner?.userData.action === 'peg') setPegFromHit(hit);
      }
    }
    updateHeldXr();
  }
  const pulse = 0.12 + Math.sin(performance.now() * 0.004) * 0.08;
  if (!held) machine.orderButton.material.emissiveIntensity = pulse;
  renderer.render(scene, camera);
}
