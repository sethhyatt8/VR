import mqtt from 'mqtt';
import { ARTISTS, findArtist } from './artists.js';

const BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC = 'sethhyatt8/brick-room/scores';
const PUZZLES = ['dragon', 'house', 'mermaid', 'horse', 'flower', 'peacock', 'car'];

export function emptyBoards() {
  return Object.fromEntries(PUZZLES.map((id) => [id, []]));
}

function cleanList(list) {
  const best = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    const artist = findArtist(item?.id);
    const ms = Number(item?.ms);
    const at = Number(item?.at) || 0;
    if (!artist || !Number.isFinite(ms) || ms < 0 || ms >= 1000 * 60 * 60) continue;
    const prev = best.get(artist.id);
    const entry = { id: artist.id, name: artist.name, ms, at };
    if (!prev || entry.ms < prev.ms || (entry.ms === prev.ms && entry.at > prev.at)) best.set(artist.id, entry);
  }
  return [...best.values()].sort((a, b) => a.ms - b.ms || b.at - a.at).slice(0, 5);
}

function sanitize(data) {
  const boards = emptyBoards();
  for (const id of PUZZLES) boards[id] = cleanList(data?.[id]);
  return boards;
}

export function wouldAccept(list, artistId, ms) {
  if (!findArtist(artistId)) return false;
  const next = cleanList([...(list || []), { id: artistId, ms, at: Date.now() }]);
  return next.some((item) => item.id === artistId && item.ms === ms);
}

export function canClaim(list, ms) {
  return ARTISTS.some((artist) => wouldAccept(list, artist.id, ms));
}

export function insertScore(list, entry) {
  return cleanList([...(list || []), entry]);
}

function sameEntry(list, entry) {
  return (list || []).some((item) => item.id === entry.id && item.ms === entry.ms && item.at === entry.at);
}

export function openScores(onBoards) {
  let boards = emptyBoards();
  let pending = null;
  let client = null;
  try {
    client = mqtt.connect(BROKER, {
      clientId: `brick-scores-${Math.random().toString(16).slice(2)}`,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      protocolVersion: 4,
    });
  } catch {
    onBoards(boards, 'offline');
    return { submit() {}, close() {} };
  }

  client.on('connect', () => {
    client.subscribe(TOPIC, { qos: 1 });
    onBoards(boards, 'ready');
    setTimeout(() => {
      if (pending && !sameEntry(boards[pending.puzzleId], pending)) publish(pending);
    }, 1200);
  });
  client.on('error', () => onBoards(boards, 'offline'));
  client.on('offline', () => onBoards(boards, 'offline'));
  client.on('message', (topic, payload) => {
    if (topic !== TOPIC) return;
    try {
      boards = sanitize(JSON.parse(payload.toString()));
    } catch {
      return;
    }
    if (pending && !sameEntry(boards[pending.puzzleId], pending)) publish(pending);
    else pending = null;
    onBoards(boards, 'message');
  });

  function publish(entry) {
    const next = { ...boards, [entry.puzzleId]: insertScore(boards[entry.puzzleId], entry) };
    if (!client?.connected) return;
    client.publish(TOPIC, JSON.stringify(next), { qos: 1, retain: true });
  }

  return {
    submit(puzzleId, artistId, ms) {
      const artist = findArtist(artistId);
      if (!artist || !PUZZLES.includes(puzzleId) || !wouldAccept(boards[puzzleId], artistId, ms)) return false;
      const entry = { puzzleId, id: artist.id, name: artist.name, ms, at: Date.now() };
      pending = entry;
      boards = { ...boards, [puzzleId]: insertScore(boards[puzzleId], entry) };
      onBoards(boards, 'ready');
      publish(entry);
      return true;
    },
    close() {
      client?.end(true);
    },
  };
}
