import { GENRES, THEMES, DEFAULT_GENRE, DEFAULT_THEME, RESERVED_NAMES } from './catalog.js';

const tokens = (text) => String(text).toLowerCase().match(/[a-z0-9-]+/g) || [];

// Picks the entry whose keywords best match the text. Ties go to the first entry listed.
function bestMatch(table, text, fallback) {
  const words = tokens(text);
  let best = fallback;
  let bestScore = 0;
  for (const [key, entry] of Object.entries(table)) {
    const score = entry.keywords.reduce(
      (n, k) => n + words.filter((w) => w === k || (k.length > 3 && w.startsWith(k))).length,
      0,
    );
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
}

export const pickGenre = (text) => bestMatch(GENRES, text, DEFAULT_GENRE);
export const pickTheme = (text) => bestMatch(THEMES, text, DEFAULT_THEME);

/** Turns a title into a start.ng game name, following the rules in start.ng/docs.md. */
export function slugify(title) {
  let slug = String(title)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  if (!slug) slug = 'my-game';
  if (RESERVED_NAMES.includes(slug)) slug = `${slug}-game`;
  return slug;
}

export function cleanTitle(raw) {
  return String(raw)
    .replace(/[<>"`{}[\]\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// "a game called Pepper Panic", "named 'Suya Sprint'"
function titleFromIdea(text) {
  const m = text.match(/\b(?:called|named|titled)\s+["'“‘]?([^"'”’.,!?;:]{2,40})/i);
  return m ? cleanTitle(m[1]) : null;
}

/** Builds the first game config from a (validated) idea. */
export function planGame(idea) {
  const genre = pickGenre(idea);
  const theme = pickTheme(idea);
  const fast = /\b(fast|quick|frantic|hard|crazy|intense)\b/i.test(idea);
  const chill = /\b(slow|chill|relax|relaxing|easy|kids|cosy|cozy|calm)\b/i.test(idea);
  const title = titleFromIdea(idea) || THEMES[theme].words[genre];
  return {
    idea,
    title,
    slug: slugify(title),
    genre,
    theme,
    speed: fast ? 4 : chill ? 2 : 3,
    lives: chill ? 5 : 3,
    size: 'normal',
  };
}

/**
 * Everything the plan card shows, derived from a config so it always
 * matches the current version after changes.
 */
export function describePlan(config) {
  const g = GENRES[config.genre];
  const t = THEMES[config.theme];
  const speedWords = ['', 'very relaxed', 'relaxed', 'medium', 'fast', 'frantic'];
  const categories = [...new Set([...t.categories, ...g.categories, 'five-minute-fun'])].slice(0, 5);
  const description = `${config.title}: a ${speedWords[config.speed]} ${g.label.toLowerCase()} game set in a ${t.label.toLowerCase()}. ${g.loop}`.slice(0, 300);
  return {
    genreLabel: g.label,
    themeLabel: t.label,
    loop: g.loop,
    controls: g.controls,
    mechanics: [
      ...g.mechanics,
      `You start with ${config.lives} ${config.lives === 1 ? 'life' : 'lives'}`,
      `Speed: ${speedWords[config.speed]} (${config.speed} of 5)`,
    ],
    look: `You play as ${t.player}. Good things: ${t.good.join(' ')}. Watch out for: ${t.bad.join(' ')}.`,
    categories,
    description,
    steps: [
      { id: 'plan', label: 'Agree on the plan: the loop, controls and look' },
      { id: 'build', label: 'Build a playable prototype in the browser' },
      { id: 'refine', label: 'Playtest it and ask for changes until it feels right' },
      { id: 'standards', label: 'Meet start.ng game standards: back link, start.ng name, Share on X (built in)' },
      { id: 'files', label: 'Download index.html, startng.json and cover.png' },
      { id: 'publish', label: 'Push to a public GitHub repo, run the check, publish, then approve it yourself' },
    ],
  };
}
