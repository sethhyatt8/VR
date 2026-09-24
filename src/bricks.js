import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HEIGHT, STUD, STUD_H } from './config.js';

const GAP = 0.0016;
const STUD_RISE = STUD_H * 0.9;
const HOLE_R = STUD * 0.34;
const studGeometry = new THREE.CylinderGeometry(STUD * 0.29, STUD * 0.29, STUD_RISE, 16);
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

function roundedRect(shape, x, y, w, h, r) {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
}

function extrudeUp(shape, height) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function geometryFor(w, d) {
  const key = `box${w}x${d}`;
  let geometry = bodyGeometry.get(key);
  if (geometry) return geometry;

  const width = w * STUD - GAP;
  const depth = d * STUD - GAP;
  const outline = new THREE.Shape();
  roundedRect(outline, -width / 2, -depth / 2, width, depth, 0.003);
  for (let x = 0; x < w; x += 1) {
    for (let z = 0; z < d; z += 1) {
      const hole = new THREE.Path();
      hole.absarc(
        (x - (w - 1) / 2) * STUD,
        -((z - (d - 1) / 2) * STUD),
        HOLE_R,
        0,
        Math.PI * 2,
        true,
      );
      outline.holes.push(hole);
    }
  }

  const capOutline = new THREE.Shape();
  roundedRect(capOutline, -width / 2, -depth / 2, width, depth, 0.003);
  const socket = extrudeUp(outline, STUD_H);
  const cap = extrudeUp(capOutline, HEIGHT - STUD_H + 0.0004);
  cap.translate(0, STUD_H - 0.0004, 0);
  geometry = mergeGeometries([socket, cap]);
  geometry.computeVertexNormals();
  bodyGeometry.set(key, geometry);
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
  geometry.computeVertexNormals();
  bodyGeometry.set(key, geometry);
  return geometry;
}

function slopeGeometry(w, d) {
  const width = w * STUD - GAP;
  const depth = d * STUD - GAP;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const knee = Math.max(z0 + 0.004, z1 - HEIGHT);
  const lip = 0.0035;
  const span = Math.max(knee - z0, 0.001);
  const zA = z0 + ((STUD_H + 0.003) / HEIGHT) * span;
  const zB = z1 - lip;
  return extrudedProfile(`slope${w}x${d}`, width, (shape) => {
    shape.moveTo(z0, 0);
    if (zB > zA + 0.004) {
      shape.lineTo(zA, 0);
      shape.lineTo(zA, STUD_H);
      shape.lineTo(zB, STUD_H);
      shape.lineTo(zB, 0);
    }
    shape.lineTo(z1, 0);
    shape.lineTo(z1, HEIGHT);
    shape.lineTo(knee, HEIGHT);
    shape.lineTo(z0, 0);
  });
}

function wallGeometry(w, d) {
  const width = w * STUD - GAP;
  const depth = d * STUD - GAP;
  const z0 = -depth / 2;
  const z1 = depth / 2;
  const knee = Math.max(z0 + 0.004, z1 - HEIGHT);
  const lip = 0.0035;
  const notch0 = z0 + lip;
  const notch1 = knee - lip;
  return extrudedProfile(`wall${w}x${d}`, width, (shape) => {
    shape.moveTo(z0, 0);
    if (notch1 > notch0 + 0.004) {
      shape.lineTo(notch0, 0);
      shape.lineTo(notch0, STUD_H);
      shape.lineTo(notch1, STUD_H);
      shape.lineTo(notch1, 0);
    }
    shape.lineTo(knee, 0);
    shape.lineTo(z1, HEIGHT);
    shape.lineTo(z0, HEIGHT);
    shape.closePath();
  });
}

export function createBrick(shape, color) {
  const group = new THREE.Group();
  const material = materialFor(color.hex);
  const kind = shape.kind || 'box';
  const bodyGeo = kind === 'slope' ? slopeGeometry(shape.w, shape.d) : kind === 'wall' ? wallGeometry(shape.w, shape.d) : geometryFor(shape.w, shape.d);
  const body = new THREE.Mesh(bodyGeo, material);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  for (let x = 0; x < shape.w; x += 1) {
    for (let z = 0; z < shape.d; z += 1) {
      if (kind === 'slope' && z !== shape.d - 1) continue;
      const stud = new THREE.Mesh(studGeometry, material);
      stud.position.set(
        (x - (shape.w - 1) / 2) * STUD,
        HEIGHT + STUD_RISE / 2,
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
