import { GRID_X, GRID_Z, HEIGHT, MAX_LAYER, STUD } from './config.js';

export function cellKey(x, z, layer) {
  return `${x},${z},${layer}`;
}

export function createGrid() {
  return new Map();
}

export function footprintOf(brick) {
  const swap = brick.userData.rot % 2 === 1;
  return {
    w: swap ? brick.userData.baseD : brick.userData.baseW,
    d: swap ? brick.userData.baseW : brick.userData.baseD,
  };
}

function rotateXZ(x, z, rot) {
  const turn = ((rot % 4) + 4) % 4;
  if (turn === 1) return { x: z, z: -x };
  if (turn === 2) return { x: -x, z: -z };
  if (turn === 3) return { x: -z, z: x };
  return { x, z };
}

export function layoutOf(brick) {
  const rot = brick.userData.rot || 0;
  const bw = brick.userData.baseW;
  const bd = brick.userData.baseD;
  const kind = brick.userData.kind || 'box';
  const raw = [];
  for (let ix = 0; ix < bw; ix += 1) {
    for (let iz = 0; iz < bd; iz += 1) {
      let x = ix + 0.5 - bw / 2;
      let z = iz + 0.5 - bd / 2;
      ({ x, z } = rotateXZ(x, z, rot));
      raw.push({
        x,
        z,
        stud: kind !== 'slope' || iz === bd - 1,
        foot: kind !== 'wall' || iz === 0,
      });
    }
  }
  const minX = Math.min(...raw.map((cell) => cell.x));
  const minZ = Math.min(...raw.map((cell) => cell.z));
  return raw.map((cell) => ({
    x: Math.round(cell.x - minX - 0.5),
    z: Math.round(cell.z - minZ - 0.5),
    stud: cell.stud,
    foot: cell.foot,
  }));
}

function onPlate(x, z) {
  return x >= 0 && z >= 0 && x < GRID_X && z < GRID_Z;
}

function hasStud(grid, x, z, layer) {
  const below = grid.get(cellKey(x, z, layer));
  if (!below) return false;
  const studs = below.userData.studSet;
  return !studs || studs.has(cellKey(x, z, layer));
}

export function columnTop(grid, gx, gz) {
  for (let layer = MAX_LAYER; layer >= 0; layer -= 1) {
    const brick = grid.get(cellKey(gx, gz, layer));
    if (brick) return { brick, layer };
  }
  return null;
}

export function canPlace(grid, brick, gx, gz, layer) {
  if (layer < 0 || layer > MAX_LAYER) return false;
  const cells = layoutOf(brick);
  for (const cell of cells) {
    if (grid.has(cellKey(gx + cell.x, gz + cell.z, layer))) return false;
  }
  let supported = 0;
  for (const cell of cells) {
    if (!cell.foot) continue;
    const cx = gx + cell.x;
    const cz = gz + cell.z;
    const resting = layer === 0 ? onPlate(cx, cz) : hasStud(grid, cx, cz, layer - 1);
    if (resting) supported += 1;
  }
  return supported > 0;
}

export function occupy(grid, brick, gx, gz, layer) {
  const cells = [];
  const studs = new Set();
  for (const cell of layoutOf(brick)) {
    const key = cellKey(gx + cell.x, gz + cell.z, layer);
    grid.set(key, brick);
    cells.push(key);
    if (cell.stud) studs.add(key);
  }
  brick.userData.cells = cells;
  brick.userData.studSet = studs;
  brick.userData.anchor = { gx, gz, layer };
}

export function release(grid, brick) {
  for (const key of brick.userData.cells || []) grid.delete(key);
  brick.userData.cells = null;
  brick.userData.studSet = null;
  brick.userData.anchor = null;
}

export function connectedBricks(grid, start) {
  const found = [];
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const brick = stack.pop();
    if (!brick || seen.has(brick) || brick.userData.role !== 'placed') continue;
    seen.add(brick);
    found.push(brick);
    for (const key of brick.userData.cells || []) {
      const [x, z, layer] = key.split(',').map(Number);
      const around = [
        [x + 1, z, layer],
        [x - 1, z, layer],
        [x, z + 1, layer],
        [x, z - 1, layer],
        [x, z, layer + 1],
        [x, z, layer - 1],
      ];
      for (const [nx, nz, nl] of around) {
        const other = grid.get(cellKey(nx, nz, nl));
        if (other && !seen.has(other)) stack.push(other);
      }
    }
  }
  return found;
}

export function canPlaceAssembly(grid, pieces, snap) {
  const occupied = new Set();
  const studs = new Set();
  for (const piece of pieces) {
    const layer = snap.layer + piece.dlayer;
    if (layer < 0 || layer > MAX_LAYER) return false;
    for (const cell of layoutOf(piece.brick)) {
      const x = snap.gx + piece.dgx + cell.x;
      const z = snap.gz + piece.dgz + cell.z;
      const key = cellKey(x, z, layer);
      if (occupied.has(key) || grid.has(key)) return false;
      occupied.add(key);
      if (cell.stud) studs.add(key);
    }
  }
  const footed = new Set();
  for (const piece of pieces) {
    const layer = snap.layer + piece.dlayer;
    let supported = 0;
    let feet = 0;
    for (const cell of layoutOf(piece.brick)) {
      if (!cell.foot) continue;
      feet += 1;
      const x = snap.gx + piece.dgx + cell.x;
      const z = snap.gz + piece.dgz + cell.z;
      const key = cellKey(x, z, layer);
      if (footed.has(key)) continue;
      footed.add(key);
      const resting = layer === 0
        ? onPlate(x, z)
        : hasStud(grid, x, z, layer - 1) || studs.has(cellKey(x, z, layer - 1));
      if (resting) supported += 1;
    }
    if (feet > 0 && supported === 0) return false;
  }
  return true;
}

const SNAP_STUDS = 1.6;

function closestSnap(localX, localY, localZ, w, d, aim, accept) {
  const gx0 = Math.round(localX / STUD - w / 2);
  const gz0 = Math.round(localZ / STUD - d / 2);
  const limit = (STUD * SNAP_STUDS) ** 2;
  let best = null;
  let bestDist = limit;
  const span = Math.ceil(SNAP_STUDS);
  for (let layer = Math.max(0, aim - 1); layer <= aim + 1; layer += 1) {
    for (let dx = -span; dx <= span; dx += 1) {
      for (let dz = -span; dz <= span; dz += 1) {
        const gx = gx0 + dx;
        const gz = gz0 + dz;
        if (!accept(gx, gz, layer)) continue;
        const cx = (gx + w / 2) * STUD;
        const cz = (gz + d / 2) * STUD;
        const cy = layer * HEIGHT;
        const dist = (cx - localX) ** 2 + (cz - localZ) ** 2 + (cy - localY) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = { gx, gz, layer, dist };
        }
      }
    }
  }
  return best;
}

export function findSnap(grid, brick, localX, localY, localZ) {
  const { w, d } = footprintOf(brick);
  const aim = Math.max(0, Math.round(localY / HEIGHT));
  return closestSnap(localX, localY, localZ, w, d, aim, (gx, gz, layer) => canPlace(grid, brick, gx, gz, layer));
}

export function findAssemblySnap(grid, pieces, primary, localX, localY, localZ) {
  const { w, d } = footprintOf(primary);
  const aim = Math.max(0, Math.round(localY / HEIGHT));
  return closestSnap(localX, localY, localZ, w, d, aim, (gx, gz, layer) => (
    canPlaceAssembly(grid, pieces, { gx, gz, layer })
  ));
}

export function brickLocalPosition(brick, snap) {
  const { w, d } = footprintOf(brick);
  return {
    x: (snap.gx + w / 2) * STUD,
    y: snap.layer * HEIGHT,
    z: (snap.gz + d / 2) * STUD,
  };
}
