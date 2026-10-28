export const IDEA_MIN = 12;
export const IDEA_MAX = 500;
export const REQUEST_MAX = 200;

const WORD = /[a-zà-ÿ]{2,}/gi;
const VOWEL = /[aeiouyà-ÿ]/i;

// Real-looking words: at least two letters and a vowel, so "asdfgh zxcv" doesn't pass.
function realWords(text) {
  return (text.match(WORD) || []).filter((w) => VOWEL.test(w));
}

/**
 * Checks a game idea before the copilot plans it.
 * Returns { ok: true, text, notes } or { ok: false, code, message }.
 */
export function validateIdea(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { ok: false, code: 'empty', message: 'Tell me your idea first: one or two sentences is plenty.' };
  }
  if (text.length < IDEA_MIN) {
    return {
      ok: false,
      code: 'too_short',
      message: `That's a bit short to plan from. Add a few more words: who's the hero, and what do they do? (at least ${IDEA_MIN} characters)`,
    };
  }
  if (text.length > IDEA_MAX) {
    return {
      ok: false,
      code: 'too_long',
      message: `Keep it under ${IDEA_MAX} characters (you have ${text.length}). Start with the core idea; we can add details as changes later.`,
    };
  }
  if (realWords(text).length < 3) {
    return {
      ok: false,
      code: 'unclear',
      message: "I couldn't read a game idea in that. Try something like: “Catch falling jollof in a Lagos kitchen”.",
    };
  }

  const notes = [];
  if (/\b(password|log ?in|sign ?up|sign ?in|account)\b/i.test(text)) {
    notes.push("start.ng handles sign-in for every game, so I won't add a password screen (start.ng refuses games that ask for one).");
  }
  if (/\b(multiplayer|online|friends|pvp|versus)\b/i.test(text)) {
    notes.push('I\'ll start you with a single-player version. start.ng has rooms for multiplayer, which you can add later.');
  }
  if (/\b(bet|betting|gamble|gambling|casino|real money|crypto)\b/i.test(text)) {
    notes.push("I'll keep it to points only: no real money or betting in the game.");
  }
  return { ok: true, text, notes };
}

/** Checks a change request typed while refining. */
export function validateRequest(raw) {
  const text = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { ok: false, code: 'empty', message: 'Type the change you want, or pick one of the suggestions.' };
  }
  if (text.length > REQUEST_MAX) {
    return { ok: false, code: 'too_long', message: `Keep change requests under ${REQUEST_MAX} characters. Ask for one change at a time.` };
  }
  if (realWords(text).length < 1) {
    return { ok: false, code: 'unclear', message: "I couldn't read a change in that. Try “make it faster” or “give me 5 lives”." };
  }
  return { ok: true, text };
}
