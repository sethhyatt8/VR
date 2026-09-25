import { joinRoom } from 'trystero';

const APP_ID = 'sethhyatt8.brick-room';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function watchCodeFromUrl() {
  const raw = new URLSearchParams(location.search).get('watch');
  if (raw == null) return '';
  return raw.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
}

export function hostRoomCode() {
  const saved = sessionStorage.getItem('brick-room-code');
  if (saved && saved.length === 4) return saved;
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
  sessionStorage.setItem('brick-room-code', code);
  return code;
}

export function openRoom(code, { onSnapshot, onWatchers }) {
  const room = joinRoom({ appId: APP_ID, password: code }, `brick-${code}`);
  const snap = room.makeAction('snap');
  let watchers = 0;
  const note = () => onWatchers?.(watchers);
  snap.onMessage = (data) => onSnapshot?.(data);
  room.onPeerJoin = () => {
    watchers += 1;
    note();
  };
  room.onPeerLeave = () => {
    watchers = Math.max(0, watchers - 1);
    note();
  };
  return {
    send(data) {
      if (watchers < 1) return;
      snap.send(data);
    },
    close() {
      room.leave();
    },
  };
}
