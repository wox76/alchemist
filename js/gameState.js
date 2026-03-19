import { ELEMENTS, ELEMENT_ICONS, SPELLS } from './constants.js';

export class GameState {
    constructor() {
        this.players = [
            { id: 1, hp: 40, maxHp: 40, shield: 0, poison: 0, grimoire: [null, null, null, null, null] },
            { id: 2, hp: 40, maxHp: 40, shield: 0, poison: 0, grimoire: [null, null, null, null, null] }
        ];
        this.currentPlayerIndex = 0;
        this.turnPhase = 'ACTIVATION'; // ACTIVATION, MANIPULATION, ANIMATING, CALLING
        this.pendingCalls = 0;
        this.lastComboElement = null;
        this.pendingElements = []; // Queue of elements the player must pick from Altar
        this.altar = [null, null, null, null, null];
        this.crucible = Array(5).fill(null).map(() => Array(5).fill(null));
        this.deck = [...SPELLS, ...SPELLS, ...SPELLS]; // Basic deck
        this.shuffle(this.deck);

        this.initCrucible();
        this.refillAltar();
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    initCrucible() {
        const types = Object.values(ELEMENTS);
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                let type;
                do {
                    type = types[Math.floor(Math.random() * types.length)];
                } while (this.isInitialMatch(r, c, type));
                this.crucible[r][c] = type;
            }
        }
    }

    isInitialMatch(r, c, type) {
        if (c >= 2 && this.crucible[r][c - 1] === type && this.crucible[r][c - 2] === type) return true;
        if (r >= 2 && this.crucible[r - 1][c] === type && this.crucible[r - 2][c] === type) return true;
        return false;
    }

    refillAltar() {
        for (let i = 0; i < 5; i++) {
            if (!this.altar[i]) {
                if (this.deck.length === 0) {
                    this.deck = [...SPELLS, ...SPELLS, ...SPELLS];
                    this.shuffle(this.deck);
                }
                this.altar[i] = this.deck.pop();
            }
        }
    }

    getCurrentPlayer() { return this.players[this.currentPlayerIndex]; }
    getOpponent()        { return this.players[1 - this.currentPlayerIndex]; }
    getOpponentOf(player) {
        // Safe: doesn't rely on currentPlayerIndex, works even mid-async
        const idx = this.players.indexOf(player);
        return this.players[1 - idx];
    }

    switchTurn() {
        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        // Process poison/etc.
    }
}
