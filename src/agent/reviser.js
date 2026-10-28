import { GENRES, THEMES, LIMITS } from './catalog.js';
import { pickGenre, pickTheme, slugify, cleanTitle } from './planner.js';

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const clamp = (n, { min, max }) => Math.min(max, Math.max(min, n));
const toNumber = (s) => (/^\d+$/.test(s) ? Number(s) : NUMBER_WORDS[s.toLowerCase()]);

const SPEED_WORDS = ['', 'very relaxed', 'relaxed', 'medium', 'fast', 'frantic'];
const FIELD_LABELS = { title: 'Title', genre: 'Game type', theme: 'Theme', speed: 'Speed', lives: 'Lives', size: 'Player size' };

/** Human-readable value for the before/after table. */
export function displayValue(field, value) {
  if (field === 'genre') return GENRES[value].label;
  if (field === 'theme') return `${THEMES[value].label} ${THEMES[value].player}`;
  if (field === 'speed') return `${SPEED_WORDS[value]} (${value}/5)`;
  if (field === 'size') return value;
  return String(value);
}

export const SUGGESTED_CHANGES = [
  'Make it faster',
  'Give me 5 lives',
  'Switch to a space theme',
  'Make it a runner where I jump',
  'Make the player bigger',
  'Call it Pepper Panic',
];

/**
 * Reads a change request and proposes a new config. Nothing is applied here:
 * the person accepts or rejects the proposal.
 * Returns { understood, changes: [{ field, label, from, to }], next, notes }.
 */
export function proposeRevision(config, request) {
  const text = request.toLowerCase();
  const next = { ...config };
  const notes = [];

  // Rename first, and keep the new name out of the other checks ("call it Space Run" isn't a theme change).
  let rest = text;
  const rename = request.match(/\b(?:call it|rename it(?: to)?|rename to|name it|title it|change the (?:name|title) to)\s+["'“‘]?([^"'”’.!?;]{2,40})/i);
  if (rename) {
    const title = cleanTitle(rename[1]);
    if (title) {
      next.title = title;
      next.slug = slugify(title);
    }
    rest = text.replace(rename[0].toLowerCase(), ' ');
  }

  // Difficulty and speed.
  const much = /\b(much|way|a lot|lot|super|really)\b/.test(rest) ? 2 : 1;
  if (/\b(harder|more difficult|more challenging)\b/.test(rest)) {
    next.speed = clamp(next.speed + 1, LIMITS.speed);
    next.lives = clamp(next.lives - 1, LIMITS.lives);
  } else if (/\b(easier|less difficult|simpler)\b/.test(rest)) {
    next.speed = clamp(next.speed - 1, LIMITS.speed);
    next.lives = clamp(next.lives + 1, LIMITS.lives);
  }
  if (/\b(faster|quicker|speed (?:it )?up|more speed)\b/.test(rest)) next.speed = clamp(next.speed + much, LIMITS.speed);
  if (/\b(slower|slow (?:it )?down|less speed)\b/.test(rest)) next.speed = clamp(next.speed - much, LIMITS.speed);

  // Lives: "5 lives", "five lives", "one life", "more lives", "fewer lives".
  const livesCount = rest.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:lives|life|hearts?)\b/);
  if (livesCount) {
    const n = toNumber(livesCount[1]);
    next.lives = clamp(n, LIMITS.lives);
    if (n !== next.lives) notes.push(`Lives can be ${LIMITS.lives.min} to ${LIMITS.lives.max}, so I used ${next.lives}.`);
  } else if (/\b(more|extra) (lives|hearts|life)\b/.test(rest)) {
    next.lives = clamp(next.lives + 2, LIMITS.lives);
  } else if (/\b(fewer|less) (lives|hearts)\b/.test(rest)) {
    next.lives = clamp(next.lives - 1, LIMITS.lives);
  }

  // Player size.
  if (/\b(bigger|larger) (player|hero|character|basket)|\b(player|hero|character) (bigger|larger)\b/.test(rest)) {
    next.size = next.size === 'small' ? 'normal' : 'big';
  } else if (/\b(smaller|tinier) (player|hero|character|basket)|\b(player|hero|character) (smaller|tinier)\b/.test(rest)) {
    next.size = next.size === 'big' ? 'normal' : 'small';
  }

  // Theme and game type only change when the request mentions them.
  const themeAsked = Object.values(THEMES).some((t) => t.keywords.some((k) => new RegExp(`\\b${k}\\b`).test(rest)));
  if (themeAsked) next.theme = pickTheme(rest);
  const genreAsked =
    /\b(make it|turn it into|switch to|change (?:it )?to|instead)\b/.test(rest) &&
    Object.values(GENRES).some((g) => g.keywords.some((k) => new RegExp(`\\b${k}`).test(rest)));
  if (genreAsked) next.genre = pickGenre(rest);
  else if (/\bjump/.test(rest) && next.genre !== 'runner') {
    next.genre = 'runner';
  } else if (/\b(shoot|blast|laser)/.test(rest) && next.genre !== 'shooter') {
    next.genre = 'shooter';
  }

  const changes = Object.keys(FIELD_LABELS)
    .filter((field) => next[field] !== config[field])
    .map((field) => ({
      field,
      label: FIELD_LABELS[field],
      from: displayValue(field, config[field]),
      to: displayValue(field, next[field]),
    }));

  if (!changes.length) {
    const limitHit =
      (/\b(faster|harder)\b/.test(rest) && config.speed === LIMITS.speed.max) ||
      (/\b(slower|easier)\b/.test(rest) && config.speed === LIMITS.speed.min);
    return {
      understood: false,
      changes,
      next: config,
      notes: limitHit
        ? ["The speed is already at its limit, so there's nothing to change."]
        : [`I can't do that one in demo mode yet. I can change the speed, lives, player size, theme, game type or title. Try: “${SUGGESTED_CHANGES[0]}”.`],
    };
  }
  return { understood: true, changes, next, notes };
}
