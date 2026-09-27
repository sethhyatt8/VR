export const ARTISTS = [
  { id: 'seth', name: 'Seth', color: '#c45c26', file: 'seth.png' },
  { id: 'emily', name: 'Emily', color: '#d7b56d', file: 'emily.png' },
  { id: 'harper', name: 'Harper', color: '#3dbf8c', file: 'harper.png' },
  { id: 'jaxon', name: 'Jaxon', color: '#3d6ea8', file: 'jaxon.png' },
  { id: 'eloise', name: 'Eloise', color: '#7a4ea3', file: 'eloise.png' },
  { id: 'julia', name: 'Julia', color: '#d4483a', file: 'julia.png' },
];

export function findArtist(id) {
  return ARTISTS.find((artist) => artist.id === id) || null;
}
