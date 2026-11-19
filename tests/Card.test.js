import { describe, it, expect, vi } from "vitest";
import { Card } from "../js/Models/Card.js";
import { makeFakeP } from "./test-utils/p5-mocks.js";

// Creates a card that is already on the battlefield.
// onBattlefieldClick is a spy: it records every time the card reports a click
// (in the game, sketch.js uses it to send 'attack' when a creature is tapped).
function makeBattlefieldCard({ rotated = false } = {}) {
    const onBattlefieldClick = vi.fn();
    const card = new Card(100, 100, 50, 70, "grizzly_bear", "Player1", {}, false, {
        p: makeFakeP(),
        imgBack: {},
        onBattlefieldClick
    });
    card.enteredBattlefield = true;
    card.rotated = rotated;
    return { card, onBattlefieldClick };
};

describe("Card: clicking a card on the battlefield", () => {
    it("taps an untapped card and reports the click", () => {
        const { card, onBattlefieldClick } = makeBattlefieldCard({ rotated: false });

        card.moveUp();

        expect(card.rotated).toBe(true);
        expect(onBattlefieldClick).toHaveBeenCalledTimes(1);
        expect(onBattlefieldClick).toHaveBeenCalledWith(expect.objectContaining({ rotated: true }));
    });

    it("does not untap a tapped card (only the start of the turn untaps)", () => {
        const { card, onBattlefieldClick } = makeBattlefieldCard({ rotated: true });

        card.moveUp();

        expect(card.rotated).toBe(true);
        expect(onBattlefieldClick).not.toHaveBeenCalled();
    });

    it("reports only the first click: clicking repeatedly cannot attack again", () => {
        const { card, onBattlefieldClick } = makeBattlefieldCard({ rotated: false });

        card.moveUp();
        card.moveUp();
        card.moveUp();

        expect(card.rotated).toBe(true);
        expect(onBattlefieldClick).toHaveBeenCalledTimes(1);
    })
});