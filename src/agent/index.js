// The demo copilot. It answers from deterministic rules (no AI model, no
// network), but behaves like a real agent call: it takes time, reports
// progress and can fail, so the UI handles all of that properly.
// To plug in a real agent later, keep these function signatures and swap the bodies.

import { validateIdea, validateRequest } from './validate.js';
import { planGame } from './planner.js';
import { proposeRevision } from './reviser.js';
import { checkGame } from './checks.js';

export const AGENT_MODE = 'demo';

export class AgentError extends Error {
  constructor(message, { retryable = true } = {}) {
    super(message);
    this.name = 'AgentError';
    this.retryable = retryable;
  }
}

const settings = { stepMs: 450, failNext: false };

export function configureAgent(opts) {
  Object.assign(settings, opts);
}

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AgentError('Cancelled', { retryable: false }));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new AgentError('Cancelled', { retryable: false }));
    });
  });

async function run(steps, onProgress, signal, work) {
  for (let i = 0; i < steps.length; i++) {
    onProgress?.({ step: i + 1, total: steps.length, label: steps[i] });
    await wait(settings.stepMs, signal);
    if (settings.failNext && i === steps.length - 1) {
      settings.failNext = false;
      throw new AgentError("The copilot didn't answer in time (simulated error). Your work is safe. Try again.");
    }
  }
  return work();
}

export async function createPlan(idea, { onProgress, signal } = {}) {
  const check = validateIdea(idea);
  if (!check.ok) throw new AgentError(check.message, { retryable: false });
  return run(['Reading your idea', 'Picking a game type and theme', 'Writing the plan'], onProgress, signal, () => ({
    config: planGame(check.text),
    notes: check.notes,
  }));
}

export async function buildPrototype(config, { onProgress, signal } = {}) {
  return run(['Setting up the canvas', 'Adding your hero and the items', 'Adding start.ng standards', 'Testing it once'], onProgress, signal, () => ({ config }));
}

export async function requestChange(config, request, { onProgress, signal } = {}) {
  const check = validateRequest(request);
  if (!check.ok) throw new AgentError(check.message, { retryable: false });
  return run(['Reading your request', 'Working out the change'], onProgress, signal, () => proposeRevision(config, check.text));
}

export async function runChecks(files, { onProgress, signal } = {}) {
  return run(['Reading index.html', 'Checking start.ng game standards'], onProgress, signal, () => checkGame(files));
}
