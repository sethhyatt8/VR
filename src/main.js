import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { createBrick, makeGhost, setBrickRaycast } from './bricks.js';
import { colorById, GRID_X, GRID_Z, HEIGHT, MAX_PEDESTALS, partLabel, PEG_MAX, PEG_MIN, shapeById, STUD } from './config.js';
import { brickLocalPosition, createGrid, findSnap, occupy, release } from './grid.js';
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
controls.target.set(0.05, 0.86, -0.35);
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
let ghost = null;
let hovered = null;
let press = null;
let pegScale = 1;
let pegDrag = false;
let nextPedestalId = 1;

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
  controller.addEventListener('squeezestart', () => {
    if (held && heldFrom === controller) rotateHeld();
  });
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

function placementPoint() {
  const hits = raycaster.intersectObjects(targets, true);
  for (const hit of hits) {
    const owner = ownerOf(hit.object);
    if (!owner || owner === held || owner.userData.type === 'ghost') continue;
    if (owner.userData.type === 'ui') return null;
    if (owner.userData.type === 'plate' || owner.userData.type === 'brick') return hit.point.clone();
  }
  const point = new THREE.Vector3();
  return raycaster.ray.intersectPlane(buildPlane, point) ? point : null;
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

function grab(brick, holder) {
  if (brick.userData.role === 'placed') release(grid, brick);
  const fromSupply = brick.userData.role === 'supply';
  const pedestal = pedestals.find((item) => item.id === brick.userData.pedestalId);
  held = brick;
  heldFrom = holder;
  brick.userData.role = 'held';
  brick.userData.snap = null;
  brick.scale.setScalar(1);
  const index = targets.indexOf(brick);
  if (index >= 0) targets.splice(index, 1);
  setBrickRaycast(brick, false);

  if (holder) {
    holder.attach(brick);
    brick.position.set(0, -0.02, -0.14);
    brick.rotation.set(0, brick.userData.rot * Math.PI / 2, 0);
  } else {
    scene.attach(brick);
  }
  syncBrickScale(brick);

  if (ghost) scene.remove(ghost);
  ghost = makeGhost(brick);
  syncBrickScale(ghost);
  scene.add(ghost);

  if (fromSupply && pedestal) {
    pedestal.supply = null;
    refill(pedestal, true);
    setStatus(`Picked up ${partLabel(brick.userData.colorId, brick.userData.shapeId)}. Another is on the pedestal.`);
  } else {
    setStatus(`Holding ${partLabel(brick.userData.colorId, brick.userData.shapeId)}. It can hang past an edge.`);
  }
}

function rotateHeld() {
  if (!held) return;
  held.userData.rot = (held.userData.rot + 1) % 4;
  held.rotation.y = held.userData.rot * Math.PI / 2;
  if (ghost) ghost.rotation.y = held.rotation.y;
  if (heldFrom) syncGhostMesh();
}

function syncGhostMesh() {
  if (!held) return;
  scene.remove(ghost);
  ghost = makeGhost(held);
  ghost.rotation.y = held.userData.rot * Math.PI / 2;
  syncBrickScale(ghost);
  scene.add(ghost);
}

function placeHeld() {
  if (!held) return false;
  const snap = held.userData.snap;
  if (!snap) {
    setStatus('Aim over the plate, or just past a brick so this one can hang.');
    return false;
  }
  const brick = held;
  held = null;
  heldFrom = null;
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
  setStatus(`Placed ${partLabel(brick.userData.colorId, brick.userData.shapeId)}.`);
  return true;
}

function dropLoose() {
  if (!held) return;
  const brick = held;
  held = null;
  heldFrom = null;
  if (ghost) ghost.visible = false;
  scene.attach(brick);
  brick.userData.role = 'loose';
  brick.userData.snap = null;
  brick.scale.setScalar(1);
  if (brick.position.y < 0.02) brick.position.y = 0.02;
  syncBrickScale(brick);
  setBrickRaycast(brick, true);
  targets.push(brick);
  setStatus('Set that brick down. Pick it up to try another spot.');
}

function updateSnapFromPoint(point, moveDesktopBrick) {
  if (!held) return;
  localPoint.copy(point);
  gridGroup.worldToLocal(localPoint);
  const margin = STUD * 4;
  const nearBuild = localPoint.x > -margin && localPoint.z > -margin
    && localPoint.x < GRID_X * STUD + margin && localPoint.z < GRID_Z * STUD + margin;
  const snap = nearBuild ? findSnap(grid, held, localPoint.x, localPoint.y, localPoint.z) : null;
  held.userData.snap = snap;
  if (!snap) {
    if (ghost) ghost.visible = false;
    if (moveDesktopBrick) {
      scene.attach(held);
      held.position.copy(point);
      held.position.y = Math.max(point.y + HEIGHT, world.tableTop);
      held.rotation.y = held.userData.rot * Math.PI / 2;
      syncBrickScale(held);
    }
    return;
  }
  const pos = brickLocalPosition(held, snap);
  if (moveDesktopBrick) {
    gridGroup.attach(held);
    held.position.set(pos.x, pos.y, pos.z);
    held.rotation.y = held.userData.rot * Math.PI / 2;
    syncBrickScale(held);
    if (ghost) ghost.visible = false;
    return;
  }
  if (ghost) {
    gridGroup.attach(ghost);
    ghost.position.set(pos.x, pos.y, pos.z);
    ghost.rotation.y = held.userData.rot * Math.PI / 2;
    syncBrickScale(ghost);
    ghost.visible = true;
  }
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
    if (aim) updateSnapFromPoint(aim, true);
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
  const interactive = hit && (hit.owner.userData.type === 'ui' || hit.owner.userData.type === 'brick' || (held && hit.owner.userData.type === 'plate'));
  if (interactive || held) controls.enabled = false;
  press = {
    x: event.clientX,
    y: event.clientY,
    owner: hit?.owner ?? null,
    point: hit?.point?.clone() ?? null,
  };
}

function onPointerUp(event) {
  if (pegDrag) {
    pegDrag = false;
    controls.enabled = true;
    press = null;
    return;
  }
  if (!press || renderer.xr.isPresenting) return;
  const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
  const clicked = moved < 6;
  const { owner, point } = press;
  press = null;
  controls.enabled = true;
  if (!clicked) return;
  if (owner?.userData.type === 'ui') {
    activateUi(owner);
    return;
  }
  if (!held && owner?.userData.type === 'brick') {
    grab(owner, null);
    if (point) updateSnapFromPoint(point, true);
    return;
  }
  if (held && !heldFrom) {
    raycaster.setFromCamera(pointer, camera);
    const aim = placementPoint();
    if (aim) updateSnapFromPoint(aim, true);
    placeHeld();
  }
}

function onKeyDown(event) {
  if (event.repeat) return;
  if (event.key === 'r' || event.key === 'R') rotateHeld();
  if (event.key === 'Enter') orderSelection();
}

function onXrSelect(controller) {
  const hit = hitFromController(controller);
  if (!hit) return;
  if (hit.owner.userData.action === 'peg') {
    controller.userData.pegDrag = true;
    setPegFromHit(hit);
    return;
  }
  if (hit.owner.userData.type === 'ui') {
    activateUi(hit.owner);
    return;
  }
  if (!held && hit.owner.userData.type === 'brick') grab(hit.owner, controller);
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
  if (aim) updateSnapFromPoint(aim, false);
  else {
    held.getWorldPosition(worldPoint);
    updateSnapFromPoint(worldPoint, false);
  }
  if (!placeHeld()) dropLoose();
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
  if (aim) updateSnapFromPoint(aim, false);
  else {
    held.getWorldPosition(worldPoint);
    updateSnapFromPoint(worldPoint, false);
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
