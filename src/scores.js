import mqtt from 'mqtt';

const BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const TOPIC = 'sethhyatt8/brick-room/scores';
const IDS = ['dragon', 'house', 'mermaid', 'horse', 'flower'];

export function emptyBoards() {
  return Object.fromEntries(IDS.map((id) => [id, []]));
}

function cleanName(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
}

function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .map((item) => ({
      name: cleanName(item?.name),
      ms: Number(item?.ms),
      at: Number(item?.at) || 0,
    }))
    .filter((item) => item.name && Number.isFinite(item.ms) && item.ms >= 0 && item.ms < 1000 * 60 * 60)
    .sort((a, b) => a.ms - b.ms || b.at - a.at)
    .slice(0, 5);
}

function sanitize(data) {
  const boards = emptyBoards();
  for (const id of IDS) boards[id] = cleanList(data?.[id]);
  return boards;
}

export function qualifies(list, ms) {
  const scores = cleanList(list);
  if (scores.length < 5) return true;
  return ms <= scores[4].ms;
}

export function insertScore(list, entry) {
  return cleanList([...(list || []), entry]);
}

function sameEntry(list, entry) {
  return (list || []).some((item) => item.name === entry.name && item.ms === entry.ms && item.at === entry.at);
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
      if (pending && !sameEntry(boards[pending.id], pending)) publish(pending);
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
    if (pending && !sameEntry(boards[pending.id], pending)) publish(pending);
    else pending = null;
    onBoards(boards, 'message');
  });

  function publish(entry) {
    const next = { ...boards, [entry.id]: insertScore(boards[entry.id], entry) };
    if (!client?.connected) return;
    client.publish(TOPIC, JSON.stringify(next), { qos: 1, retain: true });
  }

  return {
    submit(id, name, ms) {
      const entry = { id, name: cleanName(name), ms, at: Date.now() };
      if (!entry.name || !IDS.includes(id)) return false;
      pending = entry;
      boards = { ...boards, [id]: insertScore(boards[id], entry) };
      onBoards(boards, 'ready');
      publish(entry);
      return true;
    },
    close() {
      client?.end(true);
    },
  };
}
