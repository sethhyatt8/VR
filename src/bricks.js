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

function pushFace(positions, normals, a, b, c) {
  positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  let nx = uy * vz - uz * vy;
  let ny = uz * vx - ux * vz;
  let nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
}

function pushQuad(positions, normals, a, b, c, d) {
  pushFace(positions, normals, a, b, c);
  pushFace(positions, normals, a, c, d);
}

function geometryFrom(positions, normals) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function slopeGeometry(w, d) {
  const key = `slope${w}x${d}`;
  let geometry = bodyGeometry.get(key);
  if (geometry) return geometry;
  const x0 = -(w * STUD - GAP) / 2;
  const x1 = -x0;
  const z0 = -(d * STUD - GAP) / 2;
  const z1 = -z0;
  const hy = HEIGHT - STUD_H;
  const knee = Math.max(z0, z1 - hy);
  const positions = [];
  const normals = [];
  pushQuad(positions, normals, [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0]);
  pushQuad(positions, normals, [x0, 0, z1], [x0, hy, z1], [x1, hy, z1], [x1, 0, z1]);
  pushQuad(positions, normals, [x0, hy, knee], [x0, hy, z1], [x1, hy, z1], [x1, hy, knee]);
  pushQuad(positions, normals, [x0, 0, z0], [x1, 0, z0], [x1, hy, knee], [x0, hy, knee]);
  pushQuad(positions, normals, [x0, 0, z0], [x0, hy, knee], [x0, hy, z1], [x0, 0, z1]);
  pushQuad(positions, normals, [x1, 0, z1], [x1, hy, z1], [x1, hy, knee], [x1, 0, z0]);
  geometry = geometryFrom(positions, normals);
  bodyGeometry.set(key, geometry);
  return geometry;
}

function wallGeometry(w, d) {
  const key = `wall${w}x${d}`;
  let geometry = bodyGeometry.get(key);
  if (geometry) return geometry;
  const x0 = -(w * STUD - GAP) / 2;
  const x1 = -x0;
  const z0 = -(d * STUD - GAP) / 2;
  const z1 = -z0;
  const hy = HEIGHT - STUD_H;
  const knee = Math.max(z0, z1 - hy);
  const positions = [];
  const normals = [];
  pushQuad(positions, normals, [x0, 0, knee], [x1, 0, knee], [x1, 0, z0], [x0, 0, z0]);
  pushQuad(positions, normals, [x0, hy, z0], [x1, hy, z0], [x1, hy, z1], [x0, hy, z1]);
  pushQuad(positions, normals, [x0, 0, z0], [x1, 0, z0], [x1, hy, z0], [x0, hy, z0]);
  pushQuad(positions, normals, [x0, 0, knee], [x0, hy, z1], [x1, hy, z1], [x1, 0, knee]);
  pushQuad(positions, normals, [x0, 0, z0], [x0, hy, z0], [x0, hy, z1], [x0, 0, knee]);
  pushQuad(positions, normals, [x1, 0, knee], [x1, hy, z1], [x1, hy, z0], [x1, 0, z0]);
  geometry = geometryFrom(positions, normals);
  bodyGeometry.set(key, geometry);
  return geometry;
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
