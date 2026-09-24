import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HEIGHT, STUD, STUD_H } from './config.js';

const GAP = 0.0016;
const studGeometry = new THREE.CylinderGeometry(STUD * 0.29, STUD * 0.29, STUD_H, 16);
const materials = new Map();

function materialFor(hex) {
  let material = materials.get(hex);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.38,
      metalness: 0.02,
    });
    materials.set(hex, material);
  }
  return material;
}

const bodyGeometry = new Map();

function geometryFor(w, d) {
  const key = `box${w}x${d}`;
  let geometry = bodyGeometry.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(w * STUD - GAP, HEIGHT - STUD_H, d * STUD - GAP, 2, 0.0035);
    bodyGeometry.set(key, geometry);
  }
  return geometry;
}

function extrudedProfile(key, width, build) {
  let geometry = bodyGeometry.get(key);
  if (geometry) return geometry;
  const shape = new THREE.Shape();
  build(shape);
  geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  geometry.computeVertexNormals();
  bodyGeometry.set(key, geometry);
  return geometry;
}

function slopeGeometry(w, d) {
  const width = w * STUD - GAP;
  const depth = d * STUD - GAP;
  const hy = HEIGHT - STUD_H;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const knee = Math.max(z0 + 0.004, z1 - hy);
  return extrudedProfile(`slope${w}x${d}`, width, (shape) => {
    shape.moveTo(z0, 0);
    shape.lineTo(z1, 0);
    shape.lineTo(z1, hy);
    shape.lineTo(knee, hy);
    shape.lineTo(z0, 0);
  });
}

function wallGeometry(w, d) {
  const width = w * STUD - GAP;
  const depth = d * STUD - GAP;
  const hy = HEIGHT - STUD_H;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const knee = Math.max(z0 + 0.004, z1 - hy);
  return extrudedProfile(`wall${w}x${d}`, width, (shape) => {
    shape.moveTo(z0, 0);
    shape.lineTo(knee, 0);
    shape.lineTo(z1, hy);
    shape.lineTo(z0, hy);
    shape.closePath();
  });
}

export function createBrick(shape, color) {
  const group = new THREE.Group();
  const material = materialFor(color.hex);
  const kind = shape.kind || 'box';
  const bodyGeo = kind === 'slope' ? slopeGeometry(shape.w, shape.d) : kind === 'wall' ? wallGeometry(shape.w, shape.d) : geometryFor(shape.w, shape.d);
  const body = new THREE.Mesh(bodyGeo, material);
  if (kind === 'box') body.position.y = (HEIGHT - STUD_H) / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  for (let x = 0; x < shape.w; x += 1) {
    for (let z = 0; z < shape.d; z += 1) {
      if (kind === 'slope' && z !== shape.d - 1) continue;
      const stud = new THREE.Mesh(studGeometry, material);
      stud.position.set(
        (x - (shape.w - 1) / 2) * STUD,
        HEIGHT - STUD_H / 2,
        (z - (shape.d - 1) / 2) * STUD,
      );
      stud.castShadow = true;
      group.add(stud);
    }
  }

  group.userData = {
    type: 'brick',
    role: 'supply',
    shapeId: shape.id,
    colorId: color.id,
    baseW: shape.w,
    baseD: shape.d,
    kind,
    rot: 0,
    pedestalId: null,
    cells: null,
    anchor: null,
    snap: null,
  };
  return group;
}

export function setBrickRaycast(brick, enabled) {
  const raycast = enabled ? THREE.Mesh.prototype.raycast : () => {};
  brick.traverse((child) => {
    if (child.isMesh) child.raycast = raycast;
  });
}

export function makeGhost(source) {
  const ghost = source.clone(true);
  ghost.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0.38;
      child.material.depthWrite = false;
      child.castShadow = false;
      child.raycast = () => {};
    }
  });
  ghost.visible = false;
  ghost.userData.type = 'ghost';
  return ghost;
}
