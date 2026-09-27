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
    piece('1x4', 'white', 0, 5, 1, 1),
    piece('1x4', 'white', 4, 5, 1, 1),
    piece('1x1', 'white', 0, 1, 1),
    piece('1x2', 'yellow', 0, 2, 1),
    piece('1x1', 'white', 0, 4, 1),
    piece('1x1', 'white', 7, 1, 1),
    piece('1x2', 'yellow', 7, 2, 1),
    piece('1x1', 'white', 7, 4, 1),
    piece('1x4', 'white', 0, 0, 2, 1),
    piece('1x4', 'white', 4, 0, 2, 1),
    piece('1x4', 'white', 0, 5, 2, 1),
    piece('1x4', 'white', 4, 5, 2, 1),
    piece('1x4', 'white', 0, 1, 2),
    piece('1x4', 'white', 7, 1, 2),
    piece('2x4', 'red', 0, 0, 3, 1),
    piece('2x4', 'red', 4, 0, 3, 1),
    piece('2x4', 'red', 0, 2, 3, 1),
    piece('2x4', 'red', 4, 2, 3, 1),
    piece('2x4', 'red', 0, 4, 3, 1),
    piece('2x4', 'red', 4, 4, 3, 1),
    piece('2x4', 'red', 1, 2, 4, 1),
    piece('2x2', 'red', 5, 2, 4),
    piece('1x2', 'black', 6, 2, 5),
    piece('1x2', 'black', 6, 2, 6),
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

const PUZZLES = [
  { id: 'dragon', name: 'Dragon', bricks: dragon },
  { id: 'house', name: 'House', bricks: house },
  { id: 'mermaid', name: 'Mermaid', bricks: mermaid },
  { id: 'horse', name: 'Horse', bricks: horse },
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
