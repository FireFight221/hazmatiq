import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync(new URL('../server/public/script.js', import.meta.url), 'utf8');
const helper = script.slice(script.indexOf('function scrollToGuidedGoal('), script.indexOf('function createGuidedPhaseCard('));

describe('Guided goal status navigation', () => {
  it.each([false, true])('returns to the edited or next unfinished goal (advance=%s)', (advance) => {
    const cards = ['identify', 'zones', 'recon'].map((phaseId) => ({
      dataset: { phaseId }, open: false, style: { scrollMarginTop: '' },
      classList: { contains: () => phaseId === 'zones' },
      querySelector: () => ({ focus: vi.fn() }), scrollIntoView: vi.fn(),
    }));
    const context = {
      window: { requestAnimationFrame: (callback: () => void) => callback() },
      document: { querySelectorAll: () => cards, querySelector: () => ({ getBoundingClientRect: () => ({ height: 84 }) }) },
    };
    runInNewContext(`${helper}\nscrollToGuidedGoal('identify', ${advance});`, context);
    const target = cards[advance ? 2 : 0];
    expect(target.open).toBe(true);
    expect(target.style.scrollMarginTop).toBe('96px');
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    expect(cards[1].scrollIntoView).not.toHaveBeenCalled();
  });
});
