import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Card } from '../js/models/Card.js';
import { makeFakeP } from './test-utils/p5-mocks.js';

describe('Card', () => {
    let p, imgBack;

    beforeEach(() => {
        p = makeFakeP();
        imgBack = { width: 100, height: 150 }
    });

    it('contains() detects hit correctly', () => {
        const card = new Card(100, 200, 60, 90, 'mountain', 'Player1', {}, true, { p, imgBack });
        expect(card.contains(100, 200)).toBe(true);
        expect(card.contains(100 + 40, 200)).toBe(false);
    });

    it('moveUp() flips enteredBattlefield and reveals card + calls onPlay', () => {
        const onPlay = vi.fn();
        const card = new Card(100, 200, 60, 90, 'mountain', 'Player1', {}, true, { p, imgBack, onPlay });

        expect(card.enteredBattlefield).toBe(false);
        expect(card.hidden).toBe(true);

        card.moveUp();

        expect(card.enteredBattlefield).toBe(true);
        expect(card.hidden).toBe(false);
        expect(onPlay).toHaveBeenCalled({ owner: 'Player11', name: 'mountain'});
    });

    it('display() uses back image if hidden', () => {
        const face = { width: 100, height: 150 };
        const card = new Card(100, 200, 60, 90, 'mountain', 'Player1', face, false, { p, imgBack });

        card.display();

        const [imgArg] = p.image.mock.calls.at(-1);
        expect(imgArg).toBe(face);
    })
})