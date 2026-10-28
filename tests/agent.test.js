import { describe, it, expect, beforeAll } from 'vitest';
import { validateIdea, validateRequest } from '../src/agent/validate.js';
import { planGame, slugify, describePlan } from '../src/agent/planner.js';
import { proposeRevision } from '../src/agent/reviser.js';
import { checkGame, validateRepoUrl } from '../src/agent/checks.js';
import { buildGameHtml, buildStartngJson } from '../src/game/buildGame.js';
import { createPlan, requestChange, configureAgent } from '../src/agent/index.js';

beforeAll(() => configureAgent({ stepMs: 0 }));

describe('validateIdea', () => {
  it('rejects empty, short, long and unreadable input', () => {
    expect(validateIdea('   ').code).toBe('empty');
    expect(validateIdea('a game').code).toBe('too_short');
    expect(validateIdea('x'.repeat(501)).code).toBe('too_long');
    expect(validateIdea('asdfgh zxcvb qwrtp !!!!').code).toBe('unclear');
    expect(validateIdea('1234567890123456').code).toBe('unclear');
  });
  it('accepts a real idea and adds notes for sign-in requests', () => {
    const r = validateIdea('Catch jollof in a kitchen, with a login screen');
    expect(r.ok).toBe(true);
    expect(r.notes.join(' ')).toMatch(/sign-in/);
  });
  it('validates change requests', () => {
    expect(validateRequest('').code).toBe('empty');
    expect(validateRequest('!!!').code).toBe('unclear');
    expect(validateRequest('make it faster').ok).toBe(true);
  });
});

describe('planGame', () => {
  it('is deterministic and picks genre and theme from keywords', () => {
    const idea = 'An okada rider dodging Lagos traffic';
    expect(planGame(idea)).toEqual(planGame(idea));
    const c = planGame(idea);
    expect(c.genre).toBe('dodge');
    expect(c.theme).toBe('road');
  });
  it('uses a title the user gave', () => {
    expect(planGame('A space shooter called Star Pepper Blast').title).toBe('Star Pepper Blast');
  });
  it('makes valid start.ng names', () => {
    expect(slugify('Tower Stack!')).toBe('tower-stack');
    expect(slugify('API')).toBe('api-game');
    expect(slugify('???')).toBe('my-game');
    expect(slugify('a'.repeat(60)).length).toBeLessThanOrEqual(40);
  });
  it('keeps categories within the 5 start.ng allows', () => {
    expect(describePlan(planGame('Catch jollof in a Lagos market kitchen')).categories.length).toBeLessThanOrEqual(5);
  });
});

describe('proposeRevision', () => {
  const base = planGame('Catch falling mangoes in a Lagos market');
  it('proposes changes without touching the original', () => {
    const r = proposeRevision(base, 'make it faster and give me 5 lives');
    expect(r.understood).toBe(true);
    expect(r.next.speed).toBe(base.speed + 1);
    expect(r.next.lives).toBe(5);
    expect(base.lives).toBe(3);
    expect(r.changes.map((c) => c.field)).toEqual(['speed', 'lives']);
  });
  it('renames, switches theme and genre', () => {
    expect(proposeRevision(base, 'call it Pepper Panic').next).toMatchObject({ title: 'Pepper Panic', slug: 'pepper-panic' });
    expect(proposeRevision(base, 'switch to a space theme').next.theme).toBe('space');
    expect(proposeRevision(base, 'make it a runner where I jump').next.genre).toBe('runner');
  });
  it('clamps values and explains requests it cannot do', () => {
    expect(proposeRevision(base, 'give me 99 lives').next.lives).toBe(9);
    const r = proposeRevision(base, 'add a boss fight with dragons');
    expect(r.understood).toBe(false);
    expect(r.changes).toEqual([]);
  });
});

describe('generated game and checks', () => {
  const c = planGame('A rocket that blasts aliens called <script>alert(1)</script>');
  const html = buildGameHtml(c);
  it('escapes user text', () => {
    expect(html).not.toContain('<script>alert(1)');
  });
  it('passes the start.ng standards', () => {
    const r = checkGame({ html, startngJson: buildStartngJson(c), slug: c.slug, hasCover: true });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(['no_start_ng_player']);
  });
  it('reports missing standards and a password field', () => {
    const r = checkGame({ html: '<html><input type="password"></html>', startngJson: {}, slug: 'x', hasCover: false });
    expect(r.errors.map((e) => e.code)).toEqual(['password_field', 'missing_back_link', 'missing_branding', 'missing_share']);
  });
  it('validates repo links', () => {
    expect(validateRepoUrl('https://github.com/you/game').ok).toBe(true);
    expect(validateRepoUrl('https://github.com/you/game/tree/main').branch).toBe('main');
    expect(validateRepoUrl('https://gitlab.com/you/game').code).toBe('bad_link');
    expect(validateRepoUrl('').code).toBe('empty');
  });
});

describe('agent wrapper', () => {
  it('rejects bad input without retry and can simulate a failure', async () => {
    await expect(createPlan('')).rejects.toMatchObject({ retryable: false });
    configureAgent({ failNext: true });
    await expect(createPlan('Catch jollof in a busy kitchen')).rejects.toMatchObject({ retryable: true });
    const { config } = await createPlan('Catch jollof in a busy kitchen');
    const r = await requestChange(config, 'slower please');
    expect(r.next.speed).toBe(config.speed - 1);
  });
});
