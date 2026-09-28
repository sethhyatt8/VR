import { shapeById } from './config.js';
import { canPlace, createGrid, occupy } from './grid.js';

function piece(shapeId, colorId, x, z, y, rot = 0) {
  return { shapeId, colorId, x, z, layer: y * 4, rot, units: 4, heightId: '1' };
}

function dragon() {
  return [
    piece('2x4', 'green', 0, 2, 0, 1),
    piece('2x2', 'green', 4, 2, 0),
    piece('1x2', 'black', 6, 2, 0),
    piece('2x2', 'yellow', 7, 2, 0),
    piece('1x2', 'black', 9, 2, 0),
    piece('2x2', 'green', 0, 2, 1),
    piece('2x4', 'green', 2, 2, 1, 1),
    piece('2x3', 'green', 6, 2, 1, 1),
    piece('2x4', 'green', 9, 2, 1, 1),
    piece('1x2', 'lime', 0, 2, 2),
    piece('1x2', 'green', 4, 2, 2),
    piece('2x3', 'lime', 5, 0, 2),
    piece('2x3', 'lime', 5, 3, 2),
    piece('2x3', 'lime', 7, 0, 2),
    piece('2x3', 'lime', 7, 3, 2),
    piece('1x2', 'green', 9, 2, 2),
    piece('1x2', 'red', 10, 2, 2),
    piece('1x1', 'yellow', 11, 2, 2),
    piece('1x1', 'yellow', 11, 3, 2),
    piece('1x2', 'red', 12, 2, 2),
    piece('1x2', 'red', 9, 2, 3),
    piece('1x1', 'red', 10, 2, 3),
    piece('1x1', 'red', 10, 3, 3),
    piece('1x2', 'red', 11, 2, 3),
    piece('1x1', 'red', 6, 2, 3),
    piece('1x1', 'red', 6, 3, 3),
    piece('1x1', 'red', 8, 2, 3),
    piece('1x1', 'red', 8, 3, 3),
    piece('1x1', 'black', 5, 0, 3),
    piece('1x1', 'black', 7, 0, 3),
    piece('1x1', 'black', 5, 5, 3),
    piece('1x1', 'black', 7, 5, 3),
    piece('1x2', 'orange', 12, 2, 3, 1),
    piece('1x2', 'orange', 12, 3, 3, 1),
  ];
}

function mosaic(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const mask = rows.map((row) => row.split(''));
  const names = {
    y: 'yellow',
    k: 'black',
    r: 'red',
    o: 'orange',
    p: 'pink',
    u: 'purple',
    b: 'blue',
    g: 'green',
    l: 'lime',
    t: 'tan',
    w: 'white',
  };
  const rects = [
    ['2x4', 4, 2, 1],
    ['2x4', 2, 4, 0],
    ['2x3', 3, 2, 1],
    ['2x3', 2, 3, 0],
    ['1x4', 4, 1, 1],
    ['1x4', 1, 4, 0],
    ['2x2', 2, 2, 0],
    ['1x3', 3, 1, 1],
    ['1x3', 1, 3, 0],
    ['1x2', 2, 1, 1],
    ['1x2', 1, 2, 0],
    ['1x1', 1, 1, 0],
  ];
  const pieces = [];
  for (let guard = 0; guard < 400; guard += 1) {
    let placed = false;
    for (let z = 0; z < height && !placed; z += 1) {
      for (let x = 0; x < width && !placed; x += 1) {
        const cell = mask[z][x];
        if (!names[cell]) continue;
        for (const [id, w, d, rot] of rects) {
          if (x + w > width || z + d > height) continue;
          let fits = true;
          for (let iz = 0; iz < d && fits; iz += 1) {
            for (let ix = 0; ix < w; ix += 1) {
              if (mask[z + iz][x + ix] !== cell) fits = false;
            }
          }
          if (!fits) continue;
          for (let iz = 0; iz < d; iz += 1) {
            for (let ix = 0; ix < w; ix += 1) mask[z + iz][x + ix] = '.';
          }
          pieces.push(piece(id, names[cell], x, z, 0, rot));
          placed = true;
          break;
        }
      }
    }
    if (!placed) break;
  }
  return pieces;
}

function flower() {
  const size = 12;
  const center = (size - 1) / 2;
  const petals = ['pink', 'red', 'orange', 'tan', 'lime', 'green', 'blue', 'purple'];
  const letters = {
    yellow: 'y',
    black: 'k',
    red: 'r',
    orange: 'o',
    pink: 'p',
    purple: 'u',
    blue: 'b',
    green: 'g',
    lime: 'l',
    tan: 't',
    white: 'w',
  };
  const rows = Array.from({ length: size }, () => Array(size).fill('.'));
  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dz = z - center;
      const dist = Math.hypot(dx, dz);
      if (dist > 5.65) continue;
      if (dist <= 3.15) {
        rows[z][x] = 'y';
        continue;
      }
      if (dist <= 3.85) {
        rows[z][x] = 'k';
        continue;
      }
      let turned = Math.atan2(dz, dx) + Math.PI / 2;
      if (turned < 0) turned += Math.PI * 2;
      const petal = petals[Math.floor((turned / (Math.PI * 2)) * petals.length) % petals.length];
      rows[z][x] = letters[petal];
    }
  }
  const paint = (x, z, letter) => {
    if (rows[z] && rows[z][x] && rows[z][x] !== '.') rows[z][x] = letter;
  };
  [[4, 4], [4, 5], [7, 4], [7, 5]].forEach(([x, z]) => paint(x, z, 'k'));
  [[4, 6], [5, 6], [6, 6], [7, 6], [5, 7], [6, 7]].forEach(([x, z]) => paint(x, z, 'r'));
  return mosaic(rows.map((row) => row.join('')));
}

function house() {
  return [
    piece('2x4', 'tan', 0, 0, 0, 1),
    piece('2x4', 'tan', 4, 0, 0, 1),
    piece('2x4', 'tan', 0, 2, 0, 1),
    piece('2x4', 'tan', 4, 2, 0, 1),
    piece('2x4', 'tan', 0, 4, 0, 1),
    piece('2x4', 'tan', 4, 4, 0, 1),
    piece('1x1', 'white', 0, 0, 1),
    piece('1x1', 'yellow', 1, 0, 1),
    piece('1x1', 'white', 2, 0, 1),
    piece('1x2', 'black', 3, 0, 1, 1),
    piece('1x1', 'yellow', 5, 0, 1),
    piece('1x1', 'white', 6, 0, 1),
    piece('1x1', 'white', 7, 0, 1),
    piece('1x1', 'white', 0, 1, 1),
    piece('1x2', 'yellow', 0, 2, 1),
    piece('1x1', 'white', 0, 4, 1),
    piece('1x1', 'white', 7, 1, 1),
    piece('1x2', 'yellow', 7, 2, 1),
    piece('1x1', 'white', 7, 4, 1),
    piece('2x4', 'red', 0, 0, 2, 1),
    piece('2x4', 'red', 4, 0, 2, 1),
    piece('2x4', 'red', 1, 0, 3, 1),
    piece('2x2', 'red', 5, 0, 3),
    piece('1x2', 'black', 6, 0, 4),
    piece('1x2', 'black', 6, 0, 5),
  ];
}

function mermaid() {
  return [
    piece('2x2', 'lime', 1, 2, 0),
    piece('2x2', 'lime', 3, 2, 0),
    piece('2x2', 'lime', 5, 2, 0),
    piece('2x2', 'lime', 7, 2, 0),
    piece('1x2', 'green', 3, 2, 1),
    piece('1x2', 'lime', 4, 2, 1),
    piece('1x2', 'green', 5, 2, 1),
    piece('1x2', 'lime', 6, 2, 1),
    piece('1x2', 'green', 4, 2, 2),
    piece('1x2', 'green', 5, 2, 2),
    piece('1x2', 'pink', 4, 2, 3),
    piece('1x2', 'pink', 5, 2, 3),
    piece('1x2', 'blue', 4, 2, 4),
    piece('1x2', 'blue', 5, 2, 4),
    piece('1x3', 'tan', 2, 2, 5, 1),
    piece('1x3', 'tan', 2, 3, 5, 1),
    piece('1x3', 'tan', 5, 2, 5, 1),
    piece('1x3', 'tan', 5, 3, 5, 1),
    piece('1x1', 'black', 4, 2, 6),
    piece('1x1', 'tan', 4, 3, 6),
    piece('1x1', 'tan', 5, 2, 6),
    piece('1x1', 'black', 5, 3, 6),
    piece('1x2', 'purple', 3, 2, 6),
    piece('1x2', 'purple', 6, 2, 6),
    piece('1x1', 'pink', 2, 2, 6),
    piece('1x1', 'pink', 7, 2, 6),
    piece('2x4', 'purple', 3, 2, 7, 1),
    piece('2x2', 'purple', 4, 2, 8),
    piece('1x2', 'purple', 6, 2, 8),
    piece('1x1', 'orange', 3, 2, 8),
  ];
}

function peacock() {
  const rows = [
    [3, 6, 10],
    [4, 4, 12],
    [5, 2, 14],
    [6, 0, 16],
    [7, 0, 16],
    [8, 0, 16],
    [9, 0, 16],
    [10, 0, 16],
    [11, 0, 16],
    [12, 0, 16],
    [13, 0, 16],
    [14, 0, 16],
    [15, 1, 15],
    [16, 2, 14],
    [17, 4, 12],
    [18, 6, 10],
    [19, 7, 9],
  ];
  const columnTop = Array(16).fill(0);
  for (const [y, x0, x1] of rows) {
    for (let x = x0; x < x1; x += 1) columnTop[x] = y;
  }
  const bricks = [];
  bricks.push(
    piece('2x3', 'green', 7, 3, 0),
    piece('2x2', 'green', 7, 4, 1),
    piece('1x2', 'lime', 5, 6, 0),
    piece('1x2', 'lime', 10, 6, 0),
    piece('2x4', 'blue', 6, 6, 0, 1),
    piece('1x2', 'black', 6, 8, 0, 1),
    piece('1x2', 'black', 8, 8, 0, 1),
    piece('1x1', 'orange', 7, 9, 0),
    piece('1x1', 'orange', 8, 9, 0),
    piece('1x2', 'lime', 5, 6, 1),
    piece('2x4', 'blue', 6, 6, 1, 1),
    piece('1x2', 'lime', 10, 6, 1),
    piece('2x2', 'lime', 7, 6, 2),
    piece('1x2', 'blue', 7, 7, 3, 1),
    piece('1x2', 'blue', 7, 7, 4, 1),
    piece('2x3', 'blue', 7, 7, 5),
    piece('1x1', 'black', 7, 8, 6),
    piece('1x1', 'black', 8, 8, 6),
    piece('1x2', 'yellow', 7, 9, 6, 1),
    piece('1x2', 'lime', 7, 8, 7, 1),
  );
  for (const [y, x0, x1] of rows) {
    let cursor = x0;
    while (cursor < x1) {
      const remain = x1 - cursor;
      const span = remain >= 4 ? 4 : remain >= 2 ? 2 : 1;
      const id = span === 4 ? '1x4' : span === 2 ? '1x2' : '1x1';
      const mid = cursor + Math.floor((span - 1) / 2);
      const belowTop = columnTop[mid] - y;
      const ring = mid < 8 ? 'blue' : 'purple';
      let color = mid % 4 < 2 ? 'green' : 'lime';
      if (belowTop === 0) color = 'yellow';
      else if (belowTop === 1) color = ring;
      else if (belowTop === 4 && columnTop[mid] >= 10) color = 'yellow';
      else if ((belowTop === 3 || belowTop === 5) && columnTop[mid] >= 10) color = ring;
      bricks.push(piece(id, color, cursor, 6, y, span === 1 ? 0 : 1));
      cursor += span;
    }
  }
  return bricks;
}

function horse() {
  return [
    piece('1x2', 'black', 2, 2, 0),
    piece('1x2', 'black', 3, 2, 0),
    piece('1x2', 'black', 7, 2, 0),
    piece('1x2', 'black', 8, 2, 0),
    piece('1x2', 'black', 0, 2, 0),
    piece('1x2', 'black', 2, 2, 1),
    piece('1x2', 'black', 3, 2, 1),
    piece('1x2', 'black', 7, 2, 1),
    piece('1x2', 'black', 8, 2, 1),
    piece('1x2', 'black', 0, 2, 1),
    piece('1x2', 'black', 0, 2, 2),
    piece('2x4', 'tan', 1, 2, 2, 1),
    piece('2x3', 'tan', 5, 2, 2, 1),
    piece('2x3', 'tan', 8, 2, 2, 1),
    piece('2x4', 'tan', 2, 2, 3, 1),
    piece('2x4', 'tan', 6, 2, 3, 1),
    piece('1x2', 'tan', 10, 2, 3),
    piece('2x2', 'blue', 2, 2, 4),
    piece('2x2', 'black', 4, 2, 4),
    piece('2x2', 'tan', 6, 2, 4),
    piece('2x2', 'tan', 8, 2, 4),
    piece('1x1', 'white', 10, 2, 4),
    piece('1x1', 'tan', 10, 3, 4),
    piece('2x2', 'red', 2, 2, 5),
    piece('1x2', 'black', 5, 2, 5),
    piece('1x1', 'tan', 8, 2, 5),
    piece('1x1', 'tan', 8, 3, 5),
    piece('1x1', 'black', 9, 2, 5),
    piece('1x1', 'black', 9, 3, 5),
    piece('1x2', 'black', 10, 2, 5),
  ];
}

function car() {
  return [
    piece('2x2', 'black', 2, 2, 0),
    piece('2x2', 'black', 2, 6, 0),
    piece('2x2', 'black', 8, 2, 0),
    piece('2x2', 'black', 8, 6, 0),
    piece('2x4', 'red', 1, 3, 1, 1),
    piece('2x4', 'red', 1, 5, 1, 1),
    piece('2x4', 'red', 5, 3, 1, 1),
    piece('2x4', 'red', 5, 5, 1, 1),
    piece('2x2', 'red', 9, 3, 1),
    piece('2x2', 'red', 9, 5, 1),
    piece('1x1', 'orange', 1, 3, 2),
    piece('1x1', 'orange', 1, 6, 2),
    piece('2x2', 'red', 2, 3, 2),
    piece('2x2', 'red', 2, 5, 2),
    piece('2x4', 'red', 4, 3, 2, 1),
    piece('2x4', 'red', 4, 5, 2, 1),
    piece('2x2', 'red', 8, 3, 2),
    piece('2x2', 'red', 8, 5, 2),
    piece('1x1', 'yellow', 10, 3, 2),
    piece('1x1', 'yellow', 10, 6, 2),
    piece('1x2', 'black', 10, 4, 2),
    piece('2x2', 'blue', 4, 3, 3),
    piece('2x2', 'blue', 4, 5, 3),
    piece('2x2', 'white', 6, 3, 3),
    piece('2x2', 'white', 6, 5, 3),
    piece('2x4', 'red', 4, 3, 4, 1),
    piece('2x4', 'red', 4, 5, 4, 1),
  ];
}

const PUZZLES = [
  { id: 'dragon', name: 'Dragon', bricks: dragon },
  { id: 'house', name: 'House', bricks: house },
  { id: 'mermaid', name: 'Mermaid', bricks: mermaid },
  { id: 'horse', name: 'Horse', bricks: horse },
  { id: 'flower', name: 'Flower', bricks: flower },
  { id: 'peacock', name: 'Peacock', bricks: peacock },
  { id: 'car', name: 'Car', bricks: car },
];

function specBrick(entry) {
  const shape = shapeById(entry.shapeId);
  return {
    userData: {
      baseW: shape.w,
      baseD: shape.d,
      kind: 'box',
      rot: entry.rot,
      units: entry.units,
      flat: false,
      colorId: entry.colorId,
      shapeId: entry.shapeId,
      heightId: entry.heightId,
    },
  };
}

export function puzzleIds() {
  return PUZZLES.map((puzzle) => puzzle.id);
}

export function buildPuzzle(id) {
  const puzzle = PUZZLES.find((item) => item.id === id);
  if (!puzzle) return null;
  const grid = createGrid();
  const pieces = [];
  for (const entry of puzzle.bricks()) {
    const brick = specBrick(entry);
    if (!canPlace(grid, brick, entry.x, entry.z, entry.layer)) {
      throw new Error(`${puzzle.name} cannot place ${entry.colorId} ${entry.shapeId} at ${entry.x},${entry.z} layer ${entry.layer}`);
    }
    occupy(grid, brick, entry.x, entry.z, entry.layer);
    pieces.push({
      shapeId: entry.shapeId,
      colorId: entry.colorId,
      heightId: entry.heightId,
      units: entry.units,
      rot: entry.rot,
      gx: entry.x,
      gz: entry.z,
      layer: entry.layer,
    });
  }
  const cells = [];
  for (const [key, brick] of grid) {
    const [x, z, layer] = key.split(',').map(Number);
    cells.push({ x, z, layer, color: brick.userData.colorId });
  }
  return { id: puzzle.id, name: puzzle.name, pieces, cells };
}
