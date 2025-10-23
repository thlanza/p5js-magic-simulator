// tests/test-utils/p5-mocks.js

/**
 * Minimal p5 instance mock for unit tests.
 * Each call returns a fresh set of spies.
 */
import { vi } from 'vitest';

export function makeFakeP() {
  return {
    // drawing state
    push: vi.fn(),
    pop: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    strokeWeight: vi.fn(),
    rectMode: vi.fn(),
    rect: vi.fn(),
    imageMode: vi.fn(),
    image: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    noFill: vi.fn(),
    noStroke: vi.fn(),

    // text
    text: vi.fn(),
    textSize: vi.fn(),
    textAlign: vi.fn(),

    // p5 constants you use
    CENTER: 'CENTER',
    HALF_PI: Math.PI / 2,
    LEFT: 'LEFT',
    TOP: 'TOP',
  };
}
