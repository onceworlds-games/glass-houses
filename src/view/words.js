// The street's words: the Gazette's front page for each twist, and what its chip says during the round.

export const GAZETTE = {
  quiet: { head: 'All Quiet on the Street', line: 'No twist today. Break theirs, keep yours.', chip: 'Quiet day', tip: '' },
  gale: { head: 'Gale Warning!', line: 'Wind from the first throw, twice as strong. Aim off.', chip: 'Gale', tip: 'Wind ×2' },
  hail: { head: 'Hail on the Way', line: 'Three showers crack every house. Fix cracks first.', chip: 'Hail', tip: 'Fix cracks' },
  bricks: { head: 'Brickyard Spill!', line: 'A brick on the lawns every 15 seconds. Each one breaks 3.', chip: 'Brick day', tip: 'Every 15s' },
  gnomes: { head: 'Gnomes Half Price', line: 'A gnome on the lawns every 15 seconds. Each one breaks 2.', chip: 'Gnome day', tip: 'Every 15s' },
  double: { head: 'Double Glazing Fitted', line: 'Ground-floor panes crack first. Hot stones go straight through.', chip: 'Double glazing', tip: 'Ground floor' },
  golden: { head: 'Gold Leaf Windows', line: 'Three golden panes each. Break one: full stones, and a hot one.', chip: 'Golden panes', tip: 'Break gold' },
  sale: { head: 'Hardware Sale!', line: 'Repairs are quicker. The store stays open till 1:00.', chip: 'Sale', tip: 'Repair ×1.7' },
  heatwave: { head: 'Heatwave', line: 'Two hits in a row make a hot stone.', chip: 'Heatwave', tip: '2 hits = hot' },
};

export const gazetteOf = (twist) => GAZETTE[twist] ?? GAZETTE.quiet;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A dateline in the paper's style from a UTC day number. */
export function dateline(day) {
  if (!(day >= 0)) return 'Today';
  const d = new Date(day * 86400000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, 1962`;
}

/** Thousands with commas. */
export const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
