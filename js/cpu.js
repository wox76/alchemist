/**
 * cpu.js - CPU AI for Alchemist
 *
 * The CPU plays as Player 2 (index 1).
 * Strategy (simple but solid):
 * 1. ACTIVATION phase: use a spell from its grimoire if it has one worth using.
 * 2. MANIPULATION phase: attempt to create a 3-in-a-row match by swapping two adjacent tiles.
 *    If no match found nearby, swap two random adjacent tiles.
 * 3. CALLING phase: pick the best available altar spell (offensive > defensive > any).
 */

const CPU_THINK_DELAY = 800; // ms between CPU actions to feel "alive"

// Helper: sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main entry point. Called by main.js when it's the CPU's turn.
 * @param {GameState} gameState
 * @param {Function} useSpell - main.js's useSpell(absoluteSlotIndex)
 * @param {Function} handleTileClick - main.js's handleTileClick(row, col)
 * @param {Function} claimSpell - main.js's claimSpell(altarIndex)
 * @param {Function} endTurn - main.js's endTurn()
 */
export async function doCpuTurn(gameState, useSpellFn, handleTileClickFn, claimSpellFn) {
    const CPU_PLAYER_INDEX = 1;

    await sleep(CPU_THINK_DELAY);

    // === PHASE 1: ACTIVATION — optionally use a spell ===
    if (gameState.turnPhase === 'ACTIVATION') {
        const cpu = gameState.players[CPU_PLAYER_INDEX];
        const opponent = gameState.players[0];

        // Priority: use spells that are beneficial now
        const spellPriority = ['fireball', 'poison_dart', 'leech', 'vital_essence', 'quartz_wall',
                               'disintegration', 'thieving_hand', 'ice_seal', 'equivalent_exchange',
                               'cyclone_breath'];

        let usedSpell = false;
        for (const spellId of spellPriority) {
            const slotIdx = cpu.grimoire.findIndex(s => s && s.id === spellId);
            if (slotIdx !== -1) {
                // Don't use vital_essence if already at full HP
                if (spellId === 'vital_essence' && cpu.hp >= cpu.maxHp) continue;
                // Don't use quartz_wall if already have a huge shield
                if (spellId === 'quartz_wall' && cpu.shield >= 10) continue;

                await sleep(CPU_THINK_DELAY);
                // Absolute slot index: CPU is player 1, slots are 5-9
                useSpellFn(CPU_PLAYER_INDEX * 5 + slotIdx);
                usedSpell = true;
                await sleep(CPU_THINK_DELAY);
                break;
            }
        }
    }

    await sleep(CPU_THINK_DELAY);

    // === PHASE 2: MANIPULATION — pick a tile swap to try to match ===
    if (gameState.turnPhase === 'ACTIVATION' || gameState.turnPhase === 'MANIPULATION') {
        const bestSwap = findBestSwap(gameState.crucible);
        if (bestSwap) {
            // Click first tile
            handleTileClickFn(bestSwap.r1, bestSwap.c1);
            await sleep(400);
            // Click second tile
            handleTileClickFn(bestSwap.r2, bestSwap.c2);
            await sleep(CPU_THINK_DELAY);
        } else {
            // Fallback: random adjacent swap
            const r = Math.floor(Math.random() * 4);
            const c = Math.floor(Math.random() * 5);
            handleTileClickFn(r, c);
            await sleep(400);
            handleTileClickFn(r + 1, c);
            await sleep(CPU_THINK_DELAY);
        }
    }

    // === PHASE 3: CALLING — after a match, pick from altar ===
    // We wait and poll until the turnPhase becomes 'CALLING'
    let waitCycles = 0;
    while (gameState.turnPhase !== 'CALLING' && waitCycles < 30) {
        await sleep(300);
        waitCycles++;
    }

    while (gameState.turnPhase === 'CALLING') {
        await sleep(CPU_THINK_DELAY);
        const chosenIdx = pickBestAltarSpell(gameState);
        if (chosenIdx !== -1) {
            claimSpellFn(chosenIdx);
        } else {
            // Nothing available matching required element: pick index 0 (chaos rule)
            claimSpellFn(0);
        }
        await sleep(CPU_THINK_DELAY);
    }
}

/**
 * Scans the crucible for any adjacent swap that would create a 3-in-a-row match.
 * Returns { r1, c1, r2, c2 } or null.
 */
function findBestSwap(crucible) {
    const size = 5;

    // Try every adjacent pair (horizontal and vertical)
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            // Horizontal swap
            if (c + 1 < size) {
                const sim = simulateSwap(crucible, r, c, r, c + 1);
                if (sim) return { r1: r, c1: c, r2: r, c2: c + 1 };
            }
            // Vertical swap
            if (r + 1 < size) {
                const sim = simulateSwap(crucible, r, c, r + 1, c);
                if (sim) return { r1: r, c1: c, r2: r + 1, c2: c };
            }
        }
    }
    return null;
}

/**
 * Simulates a swap and checks if 3-in-a-row forms.
 */
function simulateSwap(crucible, r1, c1, r2, c2) {
    // Deep copy
    const grid = crucible.map(row => [...row]);
    [grid[r1][c1], grid[r2][c2]] = [grid[r2][c2], grid[r1][c1]];

    const size = 5;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size - 2; c++) {
            if (grid[r][c] && grid[r][c] === grid[r][c + 1] && grid[r][c] === grid[r][c + 2]) return true;
        }
    }
    for (let c = 0; c < size; c++) {
        for (let r = 0; r < size - 2; r++) {
            if (grid[r][c] && grid[r][c] === grid[r + 1][c] && grid[r][c] === grid[r + 2][c]) return true;
        }
    }
    return false;
}

/**
 * Picks the best altar spell for the CPU to claim.
 * Prefers offensive spells, then anything matching the required element.
 */
function pickBestAltarSpell(gameState) {
    const requiredElement = gameState.lastComboElement;
    const elementAvailable = gameState.altar.some(s => s && s.element === requiredElement);

    if (!elementAvailable) {
        // Pick first available slot
        return gameState.altar.findIndex(s => s !== null);
    }

    const offensiveSpells = ['fireball', 'poison_dart', 'disintegration', 'thieving_hand', 'ice_seal', 'leech'];
    const altarWithIndex = gameState.altar.map((s, i) => ({ s, i }));

    // First try: offensive spell matching element
    for (const { s, i } of altarWithIndex) {
        if (s && s.element === requiredElement && offensiveSpells.includes(s.id)) return i;
    }
    // Second try: any matching element
    for (const { s, i } of altarWithIndex) {
        if (s && s.element === requiredElement) return i;
    }
    // Fallback
    return gameState.altar.findIndex(s => s !== null);
}
