import { RESERVED_NAMES } from './catalog.js';

// A local, simplified copy of the checks start.ng describes in docs.md.
// It reads the generated files only. The real check is POST https://api.start.ng/games/check.

const KNOWN_CDNS = ['start.ng', 'cdn.jsdelivr.net', 'unpkg.com', 'cdnjs.cloudflare.com', 'esm.sh'];

export function checkGame({ html, startngJson, slug, hasCover }) {
  const errors = [];
  const warnings = [];
  const passed = [];
  const add = (list, code, message) => list.push({ code, message });

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 40) {
    add(errors, 'bad_name', `“${slug}” can't be a start.ng address. Use lowercase letters, numbers and hyphens.`);
  } else if (RESERVED_NAMES.includes(slug)) {
    add(errors, 'reserved_name', `“${slug}” is reserved on start.ng. Pick another title.`);
  } else passed.push({ code: 'name', message: `Address looks good: ${slug}.start.ng` });

  if (!/<html[\s>]/i.test(html)) add(errors, 'no_index', 'There is no ready-to-play index.html.');
  else passed.push({ code: 'index', message: 'index.html is ready to play, with no build step' });

  if (/type\s*=\s*["']?password/i.test(html)) add(errors, 'password_field', 'The game asks for a password. start.ng handles sign-in.');
  else passed.push({ code: 'password', message: 'No password fields' });

  if (!/href\s*=\s*["']https:\/\/start\.ng\/?["']/i.test(html)) add(errors, 'missing_back_link', 'No link back to https://start.ng.');
  else passed.push({ code: 'back_link', message: 'Has a link back to start.ng' });

  if (!/start\.ng/i.test(html.replace(/<[^>]+>/g, ' '))) add(errors, 'missing_branding', 'The name “start.ng” isn\'t shown in the game.');
  else passed.push({ code: 'branding', message: 'Shows the start.ng name' });

  if (!/twitter\.com\/intent\/tweet|x\.com\/intent\/post/i.test(html)) add(errors, 'missing_share', 'No Share-on-X button.');
  else passed.push({ code: 'share', message: 'Has a Share on X button at the end of a round' });

  if (!/name\s*=\s*["']viewport["']/i.test(html)) add(warnings, 'no_viewport', 'No viewport tag, so phones will draw it at desktop width.');
  else passed.push({ code: 'viewport', message: 'Has a viewport tag for small phones' });

  for (const [, src] of html.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)) {
    if (/^https?:\/\//i.test(src) && !KNOWN_CDNS.some((h) => new URL(src).hostname.endsWith(h))) {
      add(warnings, 'external_script', `${src} comes from another site. Copy it into your repo.`);
    }
  }
  if (/(?:src|href)\s*=\s*["']http:\/\//i.test(html)) add(warnings, 'insecure_link', 'Something loads over http://.');

  if (!hasCover) add(warnings, 'no_cover', 'No cover.png yet, so your card will show a letter.');
  else passed.push({ code: 'cover', message: 'Has a 16:10 cover.png' });

  if (!startngJson?.description) add(warnings, 'thin_page', 'Add a description to startng.json so your game page has something to say.');
  else passed.push({ code: 'description', message: 'startng.json has a description and how to play' });

  if (!/startng:whoami|start\.ng\/kit\.js/i.test(html)) {
    add(warnings, 'no_start_ng_player', "The prototype doesn't show the player's start.ng character yet. Add the start.ng Kit (one script tag) before you publish.");
  }

  return { ok: errors.length === 0, errors, warnings, passed };
}

const REPO = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})(?:\/tree\/([A-Za-z0-9._/-]+))?\/?$/;

/** Checks the GitHub link the same way start.ng's bad_link error does. */
export function validateRepoUrl(raw) {
  const url = String(raw ?? '').trim();
  if (!url) return { ok: false, code: 'empty', message: 'Paste the link to your public GitHub repo.' };
  const m = url.match(REPO);
  if (!m) {
    return { ok: false, code: 'bad_link', message: 'That isn\'t a GitHub repo link. It should look like https://github.com/you/your-game' };
  }
  return { ok: true, url: url.replace(/\/$/, ''), owner: m[1], repo: m[2].replace(/\.git$/, ''), branch: m[3] || null };
}
