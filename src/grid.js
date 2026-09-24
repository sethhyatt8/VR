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

function onPlate(x, z) {
  return x >= 0 && z >= 0 && x < GRID_X && z < GRID_Z;
}

export function canPlace(grid, gx, gz, w, d, layer) {
  if (layer < 0 || layer > MAX_LAYER) return false;
  let supported = 0;
  for (let x = 0; x < w; x += 1) {
    for (let z = 0; z < d; z += 1) {
      const cx = gx + x;
      const cz = gz + z;
      if (grid.has(cellKey(cx, cz, layer))) return false;
      const resting = layer === 0 ? onPlate(cx, cz) : grid.has(cellKey(cx, cz, layer - 1));
      if (resting) supported += 1;
    }
  }
  return supported > 0;
}

export function occupy(grid, brick, gx, gz, layer) {
  const { w, d } = footprintOf(brick);
  const cells = [];
  for (let x = 0; x < w; x += 1) {
    for (let z = 0; z < d; z += 1) {
      const key = cellKey(gx + x, gz + z, layer);
      grid.set(key, brick);
      cells.push(key);
    }
  }
  brick.userData.cells = cells;
  brick.userData.anchor = { gx, gz, layer };
}

export function release(grid, brick) {
  for (const key of brick.userData.cells || []) grid.delete(key);
  brick.userData.cells = null;
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

function assemblyCells(pieces, snap) {
  const cells = [];
  for (const piece of pieces) {
    const { w, d } = footprintOf(piece.brick);
    for (let x = 0; x < w; x += 1) {
      for (let z = 0; z < d; z += 1) {
        cells.push({
          x: snap.gx + piece.dgx + x,
          z: snap.gz + piece.dgz + z,
          layer: snap.layer + piece.dlayer,
          brick: piece.brick,
        });
      }
    }
  }
  return cells;
}

export function canPlaceAssembly(grid, pieces, snap) {
  const cells = assemblyCells(pieces, snap);
  const occupied = new Set();
  for (const cell of cells) {
    if (cell.layer < 0 || cell.layer > MAX_LAYER) return false;
    const key = cellKey(cell.x, cell.z, cell.layer);
    if (occupied.has(key) || grid.has(key)) return false;
    occupied.add(key);
  }
  for (const piece of pieces) {
    const { w, d } = footprintOf(piece.brick);
    const layer = snap.layer + piece.dlayer;
    let supported = 0;
    for (let x = 0; x < w; x += 1) {
      for (let z = 0; z < d; z += 1) {
        const cx = snap.gx + piece.dgx + x;
        const cz = snap.gz + piece.dgz + z;
        if (layer === 0) {
          if (onPlate(cx, cz)) supported += 1;
        } else if (grid.has(cellKey(cx, cz, layer - 1)) || occupied.has(cellKey(cx, cz, layer - 1))) {
          supported += 1;
        }
      }
    }
    if (supported === 0) return false;
  }
  return true;
}

export function findAssemblySnap(grid, pieces, primary, localX, localY, localZ) {
  const { w, d } = footprintOf(primary);
  const gx0 = Math.round(localX / STUD - w / 2);
  const gz0 = Math.round(localZ / STUD - d / 2);
  const layer0 = Math.round(localY / HEIGHT);
  for (const layer of [layer0, layer0 + 1, layer0 - 1]) {
    let best = null;
    let bestDist = Infinity;
    for (let dx = -5; dx <= 5; dx += 1) {
      for (let dz = -5; dz <= 5; dz += 1) {
        const snap = { gx: gx0 + dx, gz: gz0 + dz, layer };
        if (!canPlaceAssembly(grid, pieces, snap)) continue;
        const cx = (snap.gx + w / 2) * STUD;
        const cz = (snap.gz + d / 2) * STUD;
        const dist = (cx - localX) ** 2 + (cz - localZ) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = { ...snap, dist };
        }
      }
    }
    if (best && best.dist <= (STUD * 5) ** 2) return best;
  }
  return null;
}

function searchLayer(grid, gx0, gz0, w, d, layer, localX, localZ) {
  let best = null;
  let bestDist = Infinity;
  for (let dx = -5; dx <= 5; dx += 1) {
    for (let dz = -5; dz <= 5; dz += 1) {
      const gx = gx0 + dx;
      const gz = gz0 + dz;
      if (!canPlace(grid, gx, gz, w, d, layer)) continue;
      const cx = (gx + w / 2) * STUD;
      const cz = (gz + d / 2) * STUD;
      const dist = (cx - localX) ** 2 + (cz - localZ) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = { gx, gz, layer, dist };
      }
    }
  }
  if (!best || best.dist > (STUD * 5) ** 2) return null;
  return best;
}

export function findSnap(grid, brick, localX, localY, localZ) {
  const { w, d } = footprintOf(brick);
  const gx0 = Math.round(localX / STUD - w / 2);
  const gz0 = Math.round(localZ / STUD - d / 2);
  const layer0 = Math.round(localY / HEIGHT);
  const layers = [layer0, layer0 + 1, layer0 - 1];
  for (const layer of layers) {
    const snap = searchLayer(grid, gx0, gz0, w, d, layer, localX, localZ);
    if (snap) return snap;
  }
  return null;
}

export function brickLocalPosition(brick, snap) {
  const { w, d } = footprintOf(brick);
  return {
    x: (snap.gx + w / 2) * STUD,
    y: snap.layer * HEIGHT,
    z: (snap.gz + d / 2) * STUD,
  };
}
