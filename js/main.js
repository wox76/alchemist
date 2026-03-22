import { GameState } from './gameState.js';
import { ELEMENT_ICONS, ELEMENTS } from './constants.js';
import { doCpuTurn } from './cpu.js';

// Game mode: '1p' = two players local, 'cpu' = player vs CPU
let gameMode = '1p';

// --- TOOLTIP SETUP ---
const tooltipEl = document.createElement('div');
tooltipEl.id = 'magic-tooltip';
tooltipEl.className = 'hidden';
tooltipEl.innerHTML = `
    <div class="tooltip-inner">
        <div id="tooltip-icon"></div>
        <h4 id="tooltip-name"></h4>
        <div class="tooltip-header-row">
            <div id="tooltip-element"></div>
            <div id="tooltip-type-badge"></div>
        </div>
        <p id="tooltip-desc"></p>
    </div>
`;
document.body.appendChild(tooltipEl);
// Click backdrop to dismiss
tooltipEl.addEventListener('click', hideTooltip);

let tooltipTimeout;

function showTooltip(spell) {
    if (!spell) return;
    document.getElementById('tooltip-name').textContent = spell.name;
    document.getElementById('tooltip-desc').textContent = spell.description;
    document.getElementById('tooltip-icon').style.backgroundImage = `url('${spell.image}')`;
    document.getElementById('tooltip-element').style.backgroundImage = `url('${ELEMENT_ICONS[spell.element]}')`;

    // Type Badge Logic
    const autoCastSpells = ['fireball', 'disintegration', 'thieving_hand', 'equivalent_exchange', 'ice_seal'];
    const ttb = document.getElementById('tooltip-type-badge');
    if (ttb) {
        if (autoCastSpells.includes(spell.id)) {
            ttb.className = 'magic-type-badge immediato';
            ttb.innerHTML = '⚡ Immediato';
        } else {
            ttb.className = 'magic-type-badge attivazione';
            ttb.innerHTML = '✋ Attivazione';
        }
    }

    tooltipEl.classList.remove('hidden');
    void tooltipEl.offsetWidth;
    tooltipEl.classList.add('visible');
}

function positionTooltip(x, y) {
    if (x === undefined || y === undefined) return;
    const rect = tooltipEl.getBoundingClientRect();
    let left = x + 20;
    let top = y + 20;
    if (left + rect.width > window.innerWidth) left = x - rect.width - 20;
    if (top + rect.height > window.innerHeight) top = y - rect.height - 20;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
}

function hideTooltip() {
    tooltipEl.classList.remove('visible');
    setTimeout(() => {
        if (!tooltipEl.classList.contains('visible')) {
            tooltipEl.classList.add('hidden');
        }
    }, 200);
}

function setupLongPressTooltip(element, getSpellFn) {
    let pressTimer;
    let isLongPress = false;

    const startPress = (e) => {
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
            showTooltip(getSpellFn());
        }, 400);
    };

    const cancelPress = () => {
        clearTimeout(pressTimer);
        hideTooltip();
    };

    element.onmousedown = startPress;
    element.onmouseup = cancelPress;
    element.onmouseleave = cancelPress;
    element.ontouchstart = startPress;
    element.ontouchend = cancelPress;
}

// ---------------------

const gameState = new GameState();

// Add interceptor for turnPhase to handle UI dimming during CALLING phase
let _phase = gameState.turnPhase;
Object.defineProperty(gameState, 'turnPhase', {
    get() { return _phase; },
    set(v) {
        _phase = v;
        const isCalling = (v === 'CALLING');
        const cru = document.getElementById('crucible-container');
        const p1 = document.getElementById('player-1');
        const p2 = document.getElementById('player-2');
        if (cru) cru.classList.toggle('dimmed', isCalling);
        if (p1) p1.classList.toggle('dimmed', isCalling);
        if (p2) p2.classList.toggle('dimmed', isCalling);
    }
});

const crucibleEl = document.getElementById('crucible');
const altarEl = document.getElementById('altar');
const p1GrimoireEl = document.querySelector('#player-1 .grimoire');
const p2GrimoireEl = document.querySelector('#player-2 .grimoire');
const logEl = document.getElementById('game-log');

// --- AUDIO SETTINGS ---
let bgMusic = null;
let sfxVolume = 0.5;

function playSFX(path) {
    const audio = new Audio(path);
    audio.volume = sfxVolume;
    audio.play().catch(() => {});
}


let selectedTile = null;

async function initUI() {
    renderCrucible();
    renderAltar();
    renderGrimoires();
    updateStats();
    renderAll();

    // Add click listeners to grimoire slots
    document.querySelectorAll('.slot').forEach(slot => {
        slot.onclick = () => {
            const pZone = slot.closest('.player-zone');
            const pIdx = pZone.id === 'player-1' ? 0 : 1;
            if (pIdx === gameState.currentPlayerIndex) {
                useSpell(parseInt(slot.dataset.index));
            }
        };
    });

    // Removed playStartAnimation() and init log from here
}

function initTitleScreen() {
    const startBtn = document.getElementById('start-button');
    const titleScreen = document.getElementById('title-screen');
    const gameContainer = document.getElementById('game-container');
    const particlesContainer = document.querySelector('.particles-container');

    // Create background particles (Dust Effect)
    for (let i = 0; i < 150; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const size = Math.random() * 4 + 2;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const duration = Math.random() * 8 + 6; // Faster dust
        const dx = (Math.random() - 0.5) * 600;
        const dy = (Math.random() - 0.5) * 600;

        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${x}%`;
        p.style.top = `${y}%`;
        p.style.setProperty('--dx', `${dx}px`);
        p.style.setProperty('--dy', `${dy}px`);
        p.style.animationDuration = `${duration}s`;
        p.style.animationDelay = `${-Math.random() * 20}s`;
        particlesContainer.appendChild(p);
    }

    // --- MUSIC AUTO-START ---
    let musicStarted = false;
    const startMusic = () => {
        if (musicStarted) return;
        bgMusic = new Audio('assets/audio.mp3');
        bgMusic.loop = true;
        bgMusic.volume = parseFloat(document.getElementById('music-volume').value) / 100;
        bgMusic.play().then(() => {
            musicStarted = true;
            // Cleanup: remove listeners after starting
            window.removeEventListener('click', startMusic);
            window.removeEventListener('touchstart', startMusic);
            window.removeEventListener('keydown', startMusic);
        }).catch(e => console.log("Audio play blocked:", e));
    };
    window.addEventListener('click', startMusic);
    window.addEventListener('touchstart', startMusic);
    window.addEventListener('keydown', startMusic);

    // --- SETTINGS LOGIC ---
    window.openSettings = () => {
        document.getElementById('settings-modal').classList.remove('hidden');
    };
    window.closeSettings = () => {
        document.getElementById('settings-modal').classList.add('hidden');
    };

    const musicSlider = document.getElementById('music-volume');
    const sfxSlider = document.getElementById('sfx-volume');
    
    if (musicSlider) {
        musicSlider.oninput = () => {
            const val = musicSlider.value;
            const volDisplay = document.getElementById('music-vol-value');
            if (volDisplay) volDisplay.textContent = `${val}%`;
            if (bgMusic) bgMusic.volume = val / 100;
        };
    }

    if (sfxSlider) {
        sfxSlider.oninput = () => {
            const val = sfxSlider.value;
            const volDisplay = document.getElementById('sfx-vol-value');
            if (volDisplay) volDisplay.textContent = `${val}%`;
            sfxVolume = val / 100;
            // Test sound
            playSFX('assets/prendi.mp3');
        };
    }

    // Store startMusic so startGame can call it from outside
    startMusicFn = startMusic;

    // Wire the two mode buttons
    document.getElementById('btn-1p').onclick = () => startGame('1p');
    document.getElementById('btn-cpu').onclick = () => startGame('cpu');
}

let startMusicFn = () => {};

function startGame(mode) {
    gameMode = mode;
    const titleScreen = document.getElementById('title-screen');
    const gameContainer = document.getElementById('game-container');

    // Just in case music hasn't started
    startMusicFn();

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
    }

    // Show CPU badge on player-2 zone if in cpu mode
    const p2name = document.querySelector('#player-2 .player-name');
    if (p2name) {
        if (mode === 'cpu') {
            p2name.innerHTML = 'Mago 2 <span id="cpu-badge">🤖 CPU</span>';
        } else {
            p2name.textContent = 'Mago 2';
        }
    }

    titleScreen.classList.add('fade-out');
    setTimeout(() => {
        titleScreen.style.display = 'none';
        gameContainer.classList.remove('hidden');
        initUI();
        playStartAnimation();
    }, 1000);
}

initTitleScreen();
async function playStartAnimation() {
    const el = document.getElementById('turn-announcement');
    if (!el) return;

    gameState.turnPhase = 'ANIMATING'; // Block clicks

    // ROUND 1
    el.innerHTML = '<img src="assets/round1.png" style="max-width: 1000px; height: auto; filter: drop-shadow(0 0 30px rgba(255,204,0,0.5));">';
    el.classList.remove('hidden');
    el.classList.add('sf-animate-in');
    await new Promise(r => setTimeout(r, 1200));

    el.classList.remove('sf-animate-in');
    el.classList.add('sf-animate-out');
    await new Promise(r => setTimeout(r, 300));

    // INITIATIVE!
    const startingPlayerIdx = gameState.currentPlayerIndex;
    
    el.classList.remove('sf-animate-out');
    if (startingPlayerIdx === 0) {
        el.innerHTML = '<img src="assets/wizard1_start.png" style="max-width: 1000px; height: auto;">';
    } else {
        el.innerHTML = '<img src="assets/wizard2_start.png" style="max-width: 1000px; height: auto;">';
    }
    el.style.color = '';
    el.style.textShadow = '';
    el.classList.add('sf-animate-fight');
    
    await new Promise(r => setTimeout(r, 1500));

    el.classList.add('sf-animate-out');
    await new Promise(r => setTimeout(r, 300));

    el.classList.add('hidden');
    el.classList.remove('sf-animate-fight', 'sf-animate-out');
    el.style.color = ''; // Reset color
    el.style.textShadow = '';

    gameState.turnPhase = 'ACTIVATION';
    renderAll();
    
    // Make sure we only log start once
    if (logEntryCount === 0) {
        addLog(`Benvenuti in Alchemist! Inizia il Mago ${startingPlayerIdx + 1}. (Puoi attivare le magie nei tuoi slot)`, startingPlayerIdx);
    }

    // If it's CPU turn at the start, trigger it
    if (gameMode === 'cpu' && startingPlayerIdx === 1) {
        await doCpuTurn(gameState, useSpell, handleTileClick, claimSpell);
    }
}

function renderCrucible() {
    // Keep existing elements if possible to animate them
    const currentTiles = Array.from(crucibleEl.querySelectorAll('.element-tile'));
    const tileMap = new Map();
    currentTiles.forEach(t => tileMap.set(`${t.dataset.row},${t.dataset.col}`, t));

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
            const type = gameState.crucible[r][c];
            if (!type) continue;

            let tile = tileMap.get(`${r},${c}`);
            if (!tile) {
                tile = document.createElement('div');
                tile.onclick = () => handleTileClick(parseInt(tile.dataset.row), parseInt(tile.dataset.col));
                crucibleEl.appendChild(tile);
            }

            tile.className = `element-tile ${type}`;
            tile.dataset.row = r;
            tile.dataset.col = c;
            tile.style.left = `${20 + c * 150}px`;
            tile.style.top = `${20 + r * 150}px`;

            tileMap.delete(`${r},${c}`);
        }
    }

    // Remove tiles that are no longer in the grid (matched)
    tileMap.forEach(t => {
        t.style.transform = 'scale(0)';
        setTimeout(() => t.remove(), 400);
    });
}

function handleTileClick(row, col) {
    const tileEl = crucibleEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);

    if (gameState.turnPhase === 'ACTIVATION') {
        gameState.turnPhase = 'MANIPULATION';
        // addLog("Fase di Manipolazione iniziata.", gameState.currentPlayerIndex); // Commented out
    }
    if (gameState.turnPhase !== 'MANIPULATION') return;

    if (!selectedTile) {
        selectedTile = { r: row, c: col, el: tileEl };
        tileEl.classList.add('selected');
    } else {
        const dRow = Math.abs(row - selectedTile.r);
        const dCol = Math.abs(col - selectedTile.c);

        if ((dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)) {
            swapTiles(selectedTile.r, selectedTile.c, row, col);
        }

        selectedTile.el.classList.remove('selected');
        selectedTile = null;
    }
}

async function swapTiles(r1, c1, r2, c2) {
    gameState.turnPhase = 'ANIMATING';
    // Snapshot the active player NOW before any awaits — async-safe
    const casterPlayer = gameState.getCurrentPlayer();

    const el1 = crucibleEl.querySelector(`[data-row="${r1}"][data-col="${c1}"]`);
    const el2 = crucibleEl.querySelector(`[data-row="${r2}"][data-col="${c2}"]`);

    // Visually swap them
    if (el1 && el2) {
        const tempLeft = el1.style.left;
        const tempTop = el1.style.top;

        el1.style.left = el2.style.left;
        el1.style.top = el2.style.top;

        el2.style.left = tempLeft;
        el2.style.top = tempTop;

        el1.dataset.row = r2;
        el1.dataset.col = c2;
        el2.dataset.row = r1;
        el2.dataset.col = c1;
    }

    // Wait for CSS movement transition to finish
    await new Promise(r => setTimeout(r, 400));

    // Logically swap them
    const temp = gameState.crucible[r1][c1];
    gameState.crucible[r1][c1] = gameState.crucible[r2][c2];
    gameState.crucible[r2][c2] = temp;

    const matches = findMatches();
    // Log the swap
    const el1Type = gameState.crucible[r2][c2]; // after swap
    const el2Type = gameState.crucible[r1][c1];
    if (matches.length > 0) {
        addLog(`🔄 Swap: <strong>${el1Type}</strong> ↔ <strong>${el2Type}</strong>`, gameState.currentPlayerIndex);
    }
    if (matches.length > 0) {
        await processMatches(matches, casterPlayer);
    } else {
        // Swap back with shake
        if (el1) el1.classList.add('shake');
        if (el2) el2.classList.add('shake');

        await new Promise(r => setTimeout(r, 400));

        if (el1 && el2) {
            const tempLeft = el1.style.left;
            const tempTop = el1.style.top;

            el1.style.left = el2.style.left;
            el1.style.top = el2.style.top;

            el2.style.left = tempLeft;
            el2.style.top = tempTop;

            el1.dataset.row = r1;
            el1.dataset.col = c1;
            el2.dataset.row = r2;
            el2.dataset.col = c2;
        }

        await new Promise(r => setTimeout(r, 400));

        gameState.crucible[r2][c2] = gameState.crucible[r1][c1];
        gameState.crucible[r1][c1] = temp;

        if (el1) el1.classList.remove('shake');
        if (el2) el2.classList.remove('shake');
        gameState.turnPhase = 'MANIPULATION';
    }
}

function findMatches() {
    const matches = [];
    // Horizontal
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
            const type = gameState.crucible[r][c];
            if (type && type === gameState.crucible[r][c + 1] && type === gameState.crucible[r][c + 2]) {
                matches.push({ r, c }, { r, c: c + 1 }, { r, c: c + 2 });
            }
        }
    }
    // Vertical
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 5; c++) {
            const type = gameState.crucible[r][c];
            if (type && type === gameState.crucible[r + 1][c] && type === gameState.crucible[r + 2][c]) {
                matches.push({ r, c }, { r: r + 1, c }, { r: r + 2, c });
            }
        }
    }
    return [...new Set(matches.map(m => `${m.r},${m.c}`))].map(s => {
        const [r, c] = s.split(',').map(Number);
        return { r, c };
    });
}

async function processMatches(matches, casterPlayer) {
    if (matches.length === 0) return;
    // If casterPlayer wasn't passed (e.g. direct call), snapshot now
    if (!casterPlayer) casterPlayer = gameState.getCurrentPlayer();

    gameState.pendingCalls++;
    gameState.turnPhase = 'ANIMATING'; // Block altar clicks while cascading
    const element = gameState.crucible[matches[0].r][matches[0].c];
    gameState.lastComboElement = element;

    addSubLog(`✨ Combo da <strong>${matches.length}</strong> <em>${element}</em>!`);

    // Bonus damage: every tile beyond 3 deals 1 extra damage
    const bonus = Math.max(0, matches.length - 3);
    if (bonus > 0) {
        gameState.turnBonusDamage = (gameState.turnBonusDamage || 0) + bonus;
        addSubLog(`⚡ +${bonus} danno bonus (combo ${matches.length})`);
    }

    // SCREEN SHAKE
    document.getElementById('game-container').classList.add('earthquake');
    playSFX('assets/crack.mp3');
    setTimeout(() => {
        document.getElementById('game-container').classList.remove('earthquake');
    }, 500);

    // Animate matching and particles
    matches.forEach(m => {
        const el = crucibleEl.querySelector(`[data-row="${m.r}"][data-col="${m.c}"]`);
        if (el) {
            const rect = el.getBoundingClientRect();
            createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, element);

            // DISSOLVE EFFECT EXAGGERATED
            el.style.transform = `scale(2.5) rotate(${Math.random() * 60 - 30}deg)`;
            el.style.filter = 'brightness(10) blur(20px) contrast(2)';
            el.style.boxShadow = `0 0 50px var(--${element})`;
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';

            // Double particles
            createParticles(rect.left + rect.width / 2, rect.top + rect.height / 2, element);
        }
        gameState.crucible[m.r][m.c] = null;
    });

    await new Promise(r => setTimeout(r, 400));
    renderCrucible(); // Remove matched elements

    // Gravity with sequential falling
    let maxDelay = 0;
    for (let c = 0; c < 5; c++) {
        let emptyRow = 4;
        for (let r = 4; r >= 0; r--) {
            if (gameState.crucible[r][c] !== null) {
                if (emptyRow !== r) {
                    gameState.crucible[emptyRow][c] = gameState.crucible[r][c];
                    gameState.crucible[r][c] = null;

                    // Visual feedback for falling
                    const tileEl = crucibleEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (tileEl) {
                        tileEl.dataset.row = emptyRow;
                        tileEl.style.top = `${20 + emptyRow * 150}px`;
                    }
                }
                emptyRow--;
            }
        }

        // Refill from top
        for (let r = emptyRow; r >= 0; r--) {
            const types = Object.values(ELEMENTS);
            const newType = types[Math.floor(Math.random() * types.length)];
            gameState.crucible[r][c] = newType;

            // Create new tile above the grid for falling animation
            const tile = document.createElement('div');
            tile.className = `element-tile ${newType}`;
            tile.dataset.row = r;
            tile.dataset.col = c;
            tile.style.left = `${20 + c * 150}px`;
            tile.style.top = `${-150 - (emptyRow - r) * 150}px`; // Start above
            tile.onclick = () => handleTileClick(parseInt(tile.dataset.row), parseInt(tile.dataset.col));
            crucibleEl.appendChild(tile);

            // Trigger fall after a small delay
            setTimeout(() => {
                tile.style.top = `${20 + r * 150}px`;
            }, 50);

            maxDelay = Math.max(maxDelay, (emptyRow - r + 1) * 100);
        }
    }

    await new Promise(r => setTimeout(r, 500 + maxDelay));

    // Collect the matched element into the queue (once per unique element)
    if (!gameState.pendingElements.includes(element)) {
        gameState.pendingElements.push(element);
    }

    // Check for cascade matches
    const newMatches = findMatches();
    if (newMatches.length > 0) {
        await processMatches(newMatches, casterPlayer); // Pass casterPlayer through cascades
    } else {
        // All cascades done — apply accumulated bonus damage
        const bonusDmg = gameState.turnBonusDamage || 0;
        if (bonusDmg > 0) {
            // Use getOpponentOf(casterPlayer) — safe even if currentPlayerIndex drifted
            const opponent = gameState.getOpponentOf(casterPlayer);
            damagePlayer(opponent, bonusDmg, '⚡');
            addLog(`💥 Combo bonus! <strong>${bonusDmg} danni extra</strong> a Mago ${opponent.id}!`, casterPlayer.id - 1);
            addSubLog(`Totale bonus: ${bonusDmg} (da combo fuori misura)`);
            gameState.turnBonusDamage = 0;
            updateStats();
        }

        // All cascades done — now show CALLING phase with full element queue
        if (gameState.pendingElements.length > 0) {
            gameState.pendingCalls = gameState.pendingElements.length;
            gameState.lastComboElement = gameState.pendingElements[0];
            gameState.turnPhase = 'CALLING';
            logPendingPicks();
            renderAltar();
        } else {
            endTurn();
        }
    }
}

function renderAltar() {
    altarEl.innerHTML = '';
    gameState.altar.forEach((spell, i) => {
        const slot = document.createElement('div');
        slot.className = 'altar-slot';
        if (spell) {
            slot.classList.add(`element-bg-${spell.element}`);
            const icon = document.createElement('div');
            icon.className = 'magic-icon-square';
            icon.style.backgroundImage = `url('${spell.image}')`;

            const info = document.createElement('div');
            info.className = 'magic-info';

            const name = document.createElement('span');
            name.className = 'magic-name-text';
            name.textContent = spell.name;

            const header = document.createElement('div');
            header.className = 'magic-header';

            const elem = document.createElement('div');
            elem.className = 'magic-element-icon';
            elem.style.backgroundImage = `url('${ELEMENT_ICONS[spell.element]}')`;
            header.appendChild(elem);

            const autoCastSpells = ['fireball', 'disintegration', 'thieving_hand', 'equivalent_exchange', 'ice_seal'];
            const typeBadge = document.createElement('div');
            if (autoCastSpells.includes(spell.id)) {
                typeBadge.className = 'magic-type-badge immediato';
                typeBadge.innerHTML = '⚡ Immediato';
            } else {
                typeBadge.className = 'magic-type-badge attivazione';
                typeBadge.innerHTML = '✋ Attivazione';
            }
            header.appendChild(typeBadge);

            const desc = document.createElement('span');
            desc.className = 'magic-desc-text';
            desc.textContent = spell.description;

            info.appendChild(name);
            info.appendChild(header);
            info.appendChild(desc);

            slot.appendChild(icon);
            slot.appendChild(info);

            slot.onclick = () => claimSpell(i);
            setupLongPressTooltip(slot, () => gameState.altar[i]);
        }

        altarEl.appendChild(slot);
    });
}

async function claimSpell(index) {
    if (gameState.turnPhase !== 'CALLING') return;

    const requiredElement = gameState.lastComboElement;
    const spell = gameState.altar[index];
    if (!spell) return;

    // Chaos Rule: If required element not on Altar, must take first from left (index 0)
    const elementAvailable = gameState.altar.some(s => s && s.element === requiredElement);
    if (elementAvailable && spell.element !== requiredElement && spell.element !== ELEMENTS.JOLLY) {
        addLog(`Devi scegliere una magia di elemento ${requiredElement} (o Jolly)!`, gameState.currentPlayerIndex);
        return;
    }

    const firstValidSlot = gameState.altar.findIndex(s => s !== null);
    if (!elementAvailable && index !== firstValidSlot) {
        addLog(`REGOLA DEL CAOS: Elemento ${requiredElement} non presente, devi prendere la prima disponibile (posizione ${firstValidSlot + 1})!`, gameState.currentPlayerIndex);
        return;
    }

    const player = gameState.getCurrentPlayer();

    // Find empty slot or matching spell for fusion
    let slotIndex = player.grimoire.findIndex(s => s && s.id === spell.id);
    let targetType = 'fusion';
    if (slotIndex === -1) {
        slotIndex = player.grimoire.findIndex(s => s === null);
        targetType = 'empty';
    }

    if (slotIndex !== -1 || spell.id === 'mind_parasite') {
        playSFX('assets/prendi.mp3');
        gameState.turnPhase = 'ANIMATING'; // Block clicks

        let targetPlayer = player;
        let recipientName = `Mago ${player.id}`;

        // === MIND PARASITE TARGETING FIX ===
        if (spell.id === 'mind_parasite') {
            targetPlayer = gameState.getOpponent();
            recipientName = `Mago ${targetPlayer.id}`;
            slotIndex = targetPlayer.grimoire.findIndex(s => s && s.id === spell.id);
            targetType = 'fusion';
            if (slotIndex === -1) {
                slotIndex = targetPlayer.grimoire.findIndex(s => s === null);
                targetType = 'empty';
            }
        }

        if (slotIndex !== -1) {
            await animateSpellTransfer(index, slotIndex, targetPlayer.id - 1, spell, targetType);

            if (targetPlayer !== player) {
                if (targetType === 'fusion') {
                    targetPlayer.grimoire[slotIndex].level++;
                    addSubLog(`🦠 Mago ${player.id} infligge e potenzia <strong>${spell.name}</strong> a ${recipientName}! (Lv.${targetPlayer.grimoire[slotIndex].level})`);
                } else {
                    targetPlayer.grimoire[slotIndex] = { ...spell, level: 1 };
                    addSubLog(`🦠 Mago ${player.id} assegna <strong>${spell.name}</strong> a ${recipientName}!`);
                }
            } else {
                if (targetType === 'fusion') {
                    targetPlayer.grimoire[slotIndex].level++;
                    addSubLog(`💫 ${recipientName} sceglie e potenzia <strong>${spell.name}</strong> (Lv.${targetPlayer.grimoire[slotIndex].level})`);
                } else {
                    targetPlayer.grimoire[slotIndex] = { ...spell, level: 1 };
                    addSubLog(`💫 ${recipientName} sceglie <strong>${spell.name}</strong>`);
                }
            }
            gameState.altar[index] = null;

            // === AUTO-CAST Spells (Fireball, Disintegration, Thieving Hand, etc.) ===
            const autoCastSpells = ['fireball', 'disintegration', 'thieving_hand', 'equivalent_exchange', 'ice_seal'];
            if (autoCastSpells.includes(spell.id) && targetPlayer === player) {
                const opponent = gameState.getOpponent();
                const counterIndex = opponent.grimoire.findIndex(s => s && s.id === 'counterspell');

                if (counterIndex !== -1) {
                    opponent.grimoire[counterIndex] = null;
                    addSubLog(`🛡️ CONTROINCANTESIMO! La magia (${spell.name}) è stata annullata!`);
                    renderGrimoires();
                } else {
                    applySpellEffect(spell, player, opponent, slotIndex);
                }
                
                // Only clear if the slot hasn't been replaced by a stolen/swapped spell
                if (player.grimoire[slotIndex] && player.grimoire[slotIndex].id === spell.id) {
                    player.grimoire[slotIndex] = null;
                }
                renderGrimoires();
            }
        } else {

            addSubLog(`💥 BACKFIRE! Grimorio di ${recipientName} pieno.`);
            applySpellEffect(spell, player, player); // Self-damage
            gameState.altar[index] = null;
        }

        // === MIND PARASITE DAMAGE CHECK (on draw) ===
        player.grimoire.forEach(s => {
            if (s && s.id === 'mind_parasite') {
                const dmg = 1 * s.level;
                damagePlayer(player, dmg, '🦠');
                updateStats();
                checkGameOver();
                if (gameState.turnPhase === 'GAME_OVER') return; // Stop picking if dead
                addSubLog(`🦠 Il Parassita Mentale si attiva! ☠️ Mago ${player.id} subisce <strong>${dmg} danno</strong>`);
            }
        });
    } else {
        addSubLog(`💥 BACKFIRE! Grimorio pieno.`);
        applySpellEffect(spell, player, player); // Self-damage
        gameState.altar[index] = null;
    }

    gameState.refillAltar();

    // Consume from the queue
    gameState.pendingElements.shift();
    gameState.pendingCalls = gameState.pendingElements.length;

    if (gameState.pendingElements.length > 0) {
        gameState.lastComboElement = gameState.pendingElements[0];
        gameState.turnPhase = 'CALLING'; // Stay in CALLING
        logPendingPicks();
        renderAltar();
        renderGrimoires();
    } else {
        endTurn();
    }
}

async function animateSpellTransfer(altarIdx, grimoireIdx, playerIdx, spell, targetType) {
    const altarSlotEls = document.querySelectorAll('.altar-slot');
    if (!altarSlotEls[altarIdx]) return;

    const iconEl = altarSlotEls[altarIdx].querySelector('.magic-icon-square');
    if (!iconEl) return;

    const sourceRect = iconEl.getBoundingClientRect();

    const grimoireEls = playerIdx === 0 ? p1GrimoireEl : p2GrimoireEl;
    const targetSlot = grimoireEls.querySelectorAll('.slot')[grimoireIdx];
    const targetRect = targetSlot.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.style.backgroundImage = `url('${spell.image}')`;
    ghost.style.backgroundSize = 'cover';
    ghost.style.backgroundPosition = 'center';
    ghost.style.position = 'fixed';
    ghost.style.width = `${sourceRect.width}px`;
    ghost.style.height = `${sourceRect.height}px`;
    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.borderRadius = '10px';
    ghost.style.boxShadow = '0 0 30px var(--gold)';
    document.body.appendChild(ghost);

    iconEl.style.opacity = '0';

    const midX = (sourceRect.left + targetRect.left) / 2;
    const midY = (sourceRect.top + targetRect.top) / 2 - window.innerHeight * 0.2;

    const anim = ghost.animate([
        { left: `${sourceRect.left}px`, top: `${sourceRect.top}px`, transform: `scale(1) rotate(0deg)` },
        { left: `${midX}px`, top: `${midY}px`, transform: `scale(1.5) rotate(180deg)`, offset: 0.4, easing: 'ease-in-out' },
        { left: `${targetRect.left}px`, top: `${targetRect.top}px`, transform: `scale(1) rotate(360deg)` }
    ], { duration: 700, fill: 'forwards' });

    await anim.finished;

    createParticles(targetRect.left + targetRect.width / 2, targetRect.top + targetRect.height / 2, spell.element);
    targetSlot.classList.add('pulse-glow');
    setTimeout(() => targetSlot.classList.remove('pulse-glow'), 500);

    ghost.remove();
}

function useSpell(slotIndex) {
    const currentPlayerIndex = gameState.currentPlayerIndex;
    const clickPlayerIndex = (slotIndex < 5) ? 0 : 1; // Assuming 0-4 is P1, 5-9 is P2

    // ONLY the current player can click their own grimoire
    if (currentPlayerIndex !== clickPlayerIndex) return;

    // Allow spell usage in ACTIVATION phase
    if (gameState.turnPhase !== 'ACTIVATION') return;
    hideTooltip();

    const player = gameState.getCurrentPlayer();
    const opponent = gameState.getOpponent();
    const spell = player.grimoire[slotIndex % 5]; // Use modulo to get player-specific slot index
    if (!spell) return;

    // --- COUNTERSPELL CHECK ---
    const counterIndex = opponent.grimoire.findIndex(s => s && s.id === 'counterspell');
    addLog(`Attivazione: ${spell.name}!`, gameState.currentPlayerIndex);
    
    if (counterIndex !== -1) {
        opponent.grimoire[counterIndex] = null;
        addSubLog(`🛡️ CONTROINCANTESIMO! La magia di Mago ${player.id} è stata annullata!`);
        player.grimoire[slotIndex % 5] = null; // Spell is consumed
        renderGrimoires();
        checkGameOver();
        return;
    }

    gameState.turnPhase = 'ANIMATING'; // Block clicks during spell animation/effect
    applySpellEffect(spell, player, opponent, slotIndex % 5);


    // Only clear the slot if it still contains the EXACT SAME spell object
    // (Fixes Equivalent Exchange bug)
    if (player.grimoire[slotIndex % 5] === spell) {
        player.grimoire[slotIndex % 5] = null;
    }
    
    renderGrimoires();
    updateStats();
    
    // Unlock and stay in ACTIVATION (to allow multiple spells) or move to MANIPULATION?
    // Let's go to ACTIVATION so they can use more if they want.
    gameState.turnPhase = 'ACTIVATION'; 
    
    checkGameOver();
}

function applySpellEffect(spell, caster, target, sourceSlotIndex = -1) {
    const power = spell.level || 1;
    const g = {
        resetAltar: () => {
            // === CYCLONE EFFECT ===
            const altarEl2 = document.getElementById('altar-container');
            playSFX('assets/wind.mp3');
            const altarRect = altarEl2 ? altarEl2.getBoundingClientRect() : { left: 0, top: 0, width: 400, height: 600 };
            const cx = altarRect.left + altarRect.width / 2;
            const cy = altarRect.top + altarRect.height / 2;

            // Random blue/cyan particles spinning inward
            for (let i = 0; i < 80; i++) {
                setTimeout(() => {
                    const p = document.createElement('div');
                    p.style.cssText = `position:fixed; width:${Math.random() * 12 + 4}px; height:${Math.random() * 12 + 4}px;
                        background:${['#00cfff', '#80ddff', '#b0eeff', '#fff'][Math.floor(Math.random() * 4)]};
                        border-radius:50%; pointer-events:none; z-index:99998;
                        left:${cx + (Math.random() - 0.5) * altarRect.width * 1.5}px;
                        top:${cy + (Math.random() - 0.5) * altarRect.height * 1.5}px;
                        box-shadow:0 0 8px #00cfff;`;
                    document.body.appendChild(p);
                    p.animate([
                        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
                        { transform: `translate(${-(p.style.left.replace('px', '') - cx) * 0.9}px, ${-(p.style.top.replace('px', '') - cy) * 0.9}px) scale(0) rotate(${(Math.random() > 0.5 ? 1 : -1) * 720}deg)`, opacity: 0 }
                    ], { duration: 800 + Math.random() * 400, easing: 'ease-in', fill: 'forwards' })
                        .finished.then(() => p.remove());
                }, Math.random() * 400);
            }

            // Flash the altar container
            if (altarEl2) {
                altarEl2.animate([
                    { filter: 'brightness(1)' },
                    { filter: 'brightness(6) hue-rotate(180deg)' },
                    { filter: 'brightness(1)' }
                ], { duration: 800, easing: 'ease-out' });
            }

            setTimeout(() => {
                gameState.altar = [null, null, null, null, null];
                gameState.refillAltar();
                renderAltar();
                addSubLog("🌪️ L'Altare è stato spazzato via dal Soffio del Ciclone!");
            }, 500);
        }
    };

    switch (spell.id) {
        case 'fireball':
            damagePlayer(target, 5 * power, '🔥');
            addSubLog(`🔥 Infligge <strong>${5 * power} danni</strong> a Mago ${target.id}!`);
            break;
        case 'poison_dart':
            damagePlayer(target, 2 * power, '🎯');
            target.poison += 1 * power;
            addSubLog(`☠️ <strong>${2 * power} danni</strong> + +${1 * power} veleno a Mago ${target.id}`);
            break;
        case 'quartz_wall':
            caster.shield += 5 * power;
            addSubLog(`🛡️ Scudo +<strong>${5 * power}</strong> per Mago ${caster.id}`);
            break;
        case 'vital_essence':
            healPlayer(caster, 5 * power, '💚');
            addSubLog(`💚 Cura <strong>${5 * power} HP</strong> a Mago ${caster.id}`);
            break;
        case 'leech':
            damagePlayer(target, 2 * power, '🩸');
            healPlayer(caster, 2 * power, '💚');
            addSubLog(`🩸 <strong>${2 * power}</strong> danni a Mago ${target.id}, cura Mago ${caster.id}`);
            break;
        case 'cyclone_breath':
            g.resetAltar();
            break;
        case 'disintegration':
            if (hasRockGuardian(target)) {
                triggerRockGuardianEffect(target);
                addSubLog(`🛡️ Il Guardiano di Roccia di Mago ${target.id} blocca la Disintegrazione!`);
                break;
            }
            const activeIndices = [];
            target.grimoire.forEach((s, idx) => { if (s) activeIndices.push(idx); });

            if (activeIndices.length > 0) {
                const randIdx = activeIndices[Math.floor(Math.random() * activeIndices.length)];
                const destroyedSpell = target.grimoire[randIdx];
                target.grimoire[randIdx] = null;
                addSubLog(`💥 Una magia a caso di Mago ${target.id} (${destroyedSpell.name}) è stata disintegrata!`);
            } else {
                addSubLog(`💨 Mago ${target.id} non ha magie da disintegrare.`);
            }
            break;
        case 'thieving_hand':
            if (hasRockGuardian(target)) {
                triggerRockGuardianEffect(target);
                addSubLog(`🛡️ Il Guardiano di Roccia di Mago ${target.id} blocca la Mano Ladra!`);
                break;
            }
            const opponentActiveIndices = [];
            target.grimoire.forEach((s, idx) => { if (s) opponentActiveIndices.push(idx); });

            if (opponentActiveIndices.length > 0) {
                const randOppIdx = opponentActiveIndices[Math.floor(Math.random() * opponentActiveIndices.length)];
                const stolenSpell = target.grimoire[randOppIdx];
                
                // Try to use the source slot if it's currently holding the Thieving Hand itself
                let targetSlotIdx = sourceSlotIndex;
                if (targetSlotIdx === -1 || caster.grimoire[targetSlotIdx]?.id !== 'thieving_hand') {
                    targetSlotIdx = caster.grimoire.findIndex(s => s === null);
                }

                if (targetSlotIdx !== -1) {
                    caster.grimoire[targetSlotIdx] = { ...stolenSpell, level: 1 };
                    target.grimoire[randOppIdx] = null;
                    addSubLog(`✋ Una magia a caso di Mago ${target.id} (${stolenSpell.name}) è stata rubata!`);
                } else {
                    addSubLog("🚫 Non hai spazio per rubare la magia!");
                }
            } else {
                addSubLog(`💨 Mago ${target.id} non ha magie da rubare.`);
            }
            break;

        case 'equivalent_exchange':
            if (hasRockGuardian(target)) {
                triggerRockGuardianEffect(target);
                addSubLog(`🛡️ Il Guardiano di Roccia di Mago ${target.id} blocca lo Scambio Equivalente!`);
                break;
            }
            {
                const opponentSpells = target.grimoire.map((s, i) => ({ s, i })).filter(x => x.s !== null);
                if (opponentSpells.length === 0) {
                    addSubLog(`💨 L'avversario non ha magie da scambiare.`);
                    break;
                }
                // Pick a random opponent spell
                const { s: oppSpell, i: oppIdx } = opponentSpells[Math.floor(Math.random() * opponentSpells.length)];

                // Find the slot to place the stolen spell in caster's grimoire
                // Priority: sourceSlotIndex (if valid and holds this spell), then any empty slot
                let mySlotIdx = -1;
                if (sourceSlotIndex !== -1 && caster.grimoire[sourceSlotIndex] === spell) {
                    mySlotIdx = sourceSlotIndex;
                } else {
                    mySlotIdx = caster.grimoire.findIndex(s => s === null);
                }

                if (mySlotIdx === -1) {
                    addSubLog(`🚫 Non hai spazio nel Grimorio per lo Scambio!`);
                    break;
                }

                // Do the swap: give stolen spell to caster, give our spell (equivalent_exchange) to target
                caster.grimoire[mySlotIdx] = oppSpell;
                target.grimoire[oppIdx] = { ...spell, level: spell.level || 1 };
                addSubLog(`⚖️ Scambio effettuato: ${spell.name} per ${oppSpell.name} di Mago ${target.id}!`);
            }
            break;

        case 'ice_seal':
            if (hasRockGuardian(target)) {
                triggerRockGuardianEffect(target);
                addSubLog(`🛡️ Il Guardiano di Roccia di Mago ${target.id} blocca il Sigillo di Ghiaccio!`);
                break;
            }
            const iceIndices = [];
            target.grimoire.forEach((s, idx) => { if (s) iceIndices.push(idx); });

            if (iceIndices.length > 0) {
                const randIdx = iceIndices[Math.floor(Math.random() * iceIndices.length)];
                const frozenSpell = target.grimoire[randIdx];
                target.grimoire[randIdx] = null;
                addSubLog(`❄️ Una magia a caso di Mago ${target.id} (${frozenSpell.name}) è stata CONGELATA e rimossa!`);
            } else {
                addSubLog(`💨 Mago ${target.id} non ha magie da congelare!`);
            }
            break;

        case 'lava_golem':
            addSubLog("🌋 Golem di Lava evocato! Infliggerà danni ogni turno.");
            caster.grimoire[caster.grimoire.findIndex(s => s === null)] = { ...spell, level: 1 }; // Actually happens in claim, but for safety
            break;
        case 'mind_parasite':
            const oppEmptySlot = target.grimoire.findIndex(s => s === null);
            if (oppEmptySlot !== -1) {
                target.grimoire[oppEmptySlot] = { ...spell, level: power };
                addSubLog(`🦠 ${spell.name} si è attaccato al Grimorio di Mago ${target.id}!`);
            } else {
                addSubLog(`🚫 Non c'è spazio nel Grimorio di Mago ${target.id} per il ${spell.name}!`);
            }
            break;
        case 'rock_guardian':
            addSubLog(`🪨 ${spell.name} attivo! Protegge il tuo Grimorio da Mago ${target.id}.`);
            break;
        case 'rusty_scrap':
            if (spell.isClogging) {
                addSubLog(`🔧 Mago ${caster.id} si è liberato del Rottame Arrugginito!`);
            } else {
                const emptySlot = target.grimoire.findIndex(s => s === null);
                if (emptySlot !== -1) {
                    target.grimoire[emptySlot] = { ...spell, level: power, isClogging: true };
                    addSubLog(`⚙️ Hai lanciato un Rottame Arrugginito nel Grimorio di Mago ${target.id}!`);
                } else {
                    addSubLog(`⚙️ Il Grimorio di Mago ${target.id} è pieno, il rottame viene scartato!`);
                }
            }
            break;

        default:
            addSubLog(`❓ Effetto di ${spell.name} non ancora implementato.`);
    }
    updateStats();
    renderGrimoires();
}

function hasRockGuardian(player) {
    return player.grimoire.some(s => s && s.id === 'rock_guardian');
}

function triggerRockGuardianEffect(player) {
    const playerIdx = gameState.players.indexOf(player);
    const grimoireEl = playerIdx === 0 ? p1GrimoireEl : p2GrimoireEl;
    const slotIdx = player.grimoire.findIndex(s => s && s.id === 'rock_guardian');
    if (slotIdx !== -1) {
        const slots = grimoireEl.querySelectorAll('.slot');
        const slotEl = slots[slotIdx];
        if (slotEl) {
            slotEl.classList.remove('rock-guardian-block');
            void slotEl.offsetWidth; // Trigger reflow
            slotEl.classList.add('rock-guardian-block');
            playSFX('assets/wind.mp3');
            setTimeout(() => slotEl.classList.remove('rock-guardian-block'), 1000);
        }
    }
}

function damagePlayer(player, amount, customEmoji = '❤️') {
    const playerIdx = gameState.players.indexOf(player);
    const zoneId = playerIdx === 0 ? 'player-1' : 'player-2';
    const playerZoneEl = document.getElementById(zoneId);

    if (player.shield >= amount) {
        player.shield -= amount;
    } else {
        const remaining = amount - player.shield;
        player.shield = 0;
        player.hp -= remaining;
    }

    // === DAMAGE FLASH VFX ===
    if (playerZoneEl) {
        playerZoneEl.animate([
            { boxShadow: 'inset 0 0 0px red', background: 'rgba(0,0,0,0.3)' },
            { boxShadow: 'inset 0 0 80px red', background: 'rgba(180,0,0,0.5)' },
            { boxShadow: 'inset 0 0 0px red', background: 'rgba(0,0,0,0.3)' }
        ], { duration: 600, easing: 'ease-out' });
    }

    // === FLOATING DAMAGE NUMBER ===
    if (playerZoneEl) {
        const dmgEl = document.createElement('div');
        dmgEl.textContent = `-${amount} ${customEmoji}`;
        const rect = playerZoneEl.getBoundingClientRect();
        dmgEl.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top + rect.height / 2}px;
            color: #ff4444;
            font-size: 48px;
            font-weight: bold;
            font-family: Roboto, sans-serif;
            text-shadow: 0 0 20px red, 2px 2px 4px black;
            pointer-events: none;
            z-index: 99999;
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(dmgEl);
        dmgEl.animate([
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
            { opacity: 0, transform: 'translate(-50%, -200%) scale(1.5)' }
        ], { duration: 1200, easing: 'ease-out', fill: 'forwards' })
            .finished.then(() => dmgEl.remove());
    }
    updateStats();
}

function healPlayer(player, amount, customEmoji = '💚') {
    const playerIdx = gameState.players.indexOf(player);
    const zoneId = playerIdx === 0 ? 'player-1' : 'player-2';
    const playerZoneEl = document.getElementById(zoneId);

    player.hp = Math.min(player.maxHp, player.hp + amount);

    // === HEAL FLASH VFX ===
    if (playerZoneEl) {
        playerZoneEl.animate([
            { boxShadow: 'inset 0 0 0px green', background: 'rgba(0,0,0,0.3)' },
            { boxShadow: 'inset 0 0 80px green', background: 'rgba(0,180,0,0.5)' },
            { boxShadow: 'inset 0 0 0px green', background: 'rgba(0,0,0,0.3)' }
        ], { duration: 600, easing: 'ease-out' });
    }

    // === FLOATING HEAL NUMBER ===
    if (playerZoneEl) {
        const healEl = document.createElement('div');
        healEl.textContent = `+${amount} ${customEmoji}`;
        const rect = playerZoneEl.getBoundingClientRect();
        healEl.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top + rect.height / 2}px;
            color: #44ff44;
            font-size: 48px;
            font-weight: bold;
            font-family: Roboto, sans-serif;
            text-shadow: 0 0 20px green, 2px 2px 4px black;
            pointer-events: none;
            z-index: 99999;
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(healEl);
        healEl.animate([
            { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
            { opacity: 0, transform: 'translate(-50%, -200%) scale(1.5)' }
        ], { duration: 1200, easing: 'ease-out', fill: 'forwards' })
            .finished.then(() => healEl.remove());
    }
    updateStats();
}

function logPendingPicks() {
    if (gameState.pendingElements.length === 0) return;
    const requiredElement = gameState.pendingElements[0];
    const icons = gameState.pendingElements
        .map(el => `<img src="${ELEMENT_ICONS[el]}" title="${el}" style="width:22px; height:22px; vertical-align:middle; margin:0 2px;">`)
        .join('');
    const n = gameState.pendingElements.length;
    addLog(`⚗️ Devi ancora scegliere <strong>${n}</strong> magia${n > 1 ? 'e' : ''} — Elementi: ${icons}`, gameState.currentPlayerIndex);

    const elementAvailable = gameState.altar.some(s => s && s.element === requiredElement);
    if (!elementAvailable) {
        addSubLog(`⚠️ Prendi la prima in alto se non c'è una magia che corrisponde all'elemento <strong>${requiredElement}</strong>!`);
    } else {
        addSubLog(`➡️ Ora scegli una magia di elemento: <strong>${requiredElement}</strong> <img src="${ELEMENT_ICONS[requiredElement]}" style="width:22px;vertical-align:middle;">`);
    }
}

function endTurn() {
    const activePlayer = gameState.getCurrentPlayer();
    const opponent = gameState.getOpponent();

    // 1. Process Monsters for the player ending their turn
    activePlayer.grimoire.forEach(spell => {
        if (spell && spell.id === 'lava_golem') {
            const damage = 2 * spell.level;
            damagePlayer(opponent, damage, '🌋');
            addLog(`🌋 Il Golem di Lava (Mago ${activePlayer.id}) si attiva!`, gameState.currentPlayerIndex);
            addSubLog(`🔥 Infligge ${damage} danni a Mago ${opponent.id}!`);
        }
    });

    gameState.pendingElements = []; // Reset queue
    gameState.pendingCalls = 0;
    gameState.turnBonusDamage = 0; // Reset bonus damage accumulator
    gameState.switchTurn();
    gameState.turnPhase = 'ACTIVATION';

    // 2. Process poison for the NEXT player
    const nextPlayer = gameState.getCurrentPlayer();
    if (nextPlayer.poison > 0) {
        damagePlayer(nextPlayer, nextPlayer.poison, '☠️');
        addLog(`☠️ Veleno attivo su Mago ${nextPlayer.id}`, gameState.currentPlayerIndex);
        addSubLog(`💥 Subisce ${nextPlayer.poison} danni da veleno`);
    }

    renderAll();
    addLog(`È il turno del Mago ${gameState.currentPlayerIndex + 1}. (Puoi attivare le magie nei tuoi slot)`, gameState.currentPlayerIndex);

    // Check game over after end-of-turn effects
    setTimeout(async () => {
        checkGameOver();
        // If it's now the CPU's turn, trigger AI
        if (gameMode === 'cpu' && gameState.currentPlayerIndex === 1 && gameState.turnPhase !== 'GAME_OVER') {
            await doCpuTurn(gameState, useSpell, handleTileClick, claimSpell);
        }
    }, 1000);
}

function renderAll() {
    renderCrucible();
    renderAltar();
    renderGrimoires();
    updateStats();

    // Highlight active player
    document.getElementById('player-1').classList.toggle('active-turn', gameState.currentPlayerIndex === 0);
    document.getElementById('player-2').classList.toggle('active-turn', gameState.currentPlayerIndex === 1);
}

function checkGameOver() {
    let winnerIdx = -1;
    gameState.players.forEach((p, i) => {
        if (p.hp <= 0) winnerIdx = 1 - i;
    });

    if (winnerIdx !== -1) {
        const announcement = document.getElementById('turn-announcement');
        
        if (winnerIdx === 0) {
            announcement.innerHTML = `<img src="assets/wizard1_wins.png" style="max-width: 1000px; height: auto; filter: drop-shadow(0 0 30px rgba(255,204,0,0.5));"><br><span class="replay-hint">Clicca per rigiocare</span>`;
        } else {
            announcement.innerHTML = `<img src="assets/wizard2_wins.png" style="max-width: 1000px; height: auto; filter: drop-shadow(0 0 30px rgba(255,204,0,0.5));"><br><span class="replay-hint">Clicca per rigiocare</span>`;
        }
        announcement.className = 'victory'; // Applying the new style
        announcement.style.display = 'flex';
        announcement.style.cursor = 'pointer';
        
        // Disable interactions
        gameState.turnPhase = 'GAME_OVER';
        
        announcement.onclick = () => location.reload();
    }
}


function renderGrimoires() {
    [p1GrimoireEl, p2GrimoireEl].forEach((el, pIdx) => {
        const slots = el.querySelectorAll('.slot');
        gameState.players[pIdx].grimoire.forEach((item, i) => {
            const absoluteIdx = pIdx * 5 + i; // Added absoluteIdx

            // Clean up element border classes and equipped
            slots[i].classList.remove('equipped', 'element-border-fire', 'element-border-water', 'element-border-earth', 'element-border-air', 'element-border-jolly');

            if (item) {
                slots[i].style.backgroundImage = `url('${item.image}')`;
                slots[i].style.backgroundSize = 'cover';
                slots[i].style.backgroundPosition = 'center';
                slots[i].classList.add('equipped');
                slots[i].classList.add(`element-border-${item.element}`);
                slots[i].innerHTML = `
                    <div class="magic-card-overlay">
                        <span class="card-level">Lv.${item.level}</span>
                    </div>
                `;
                setupLongPressTooltip(slots[i], () => gameState.players[pIdx].grimoire[i]);

                let isLongPress = false;
                let pressTimer;

                const startPress = (e) => {
                    isLongPress = false;
                    pressTimer = setTimeout(() => {
                        isLongPress = true;
                        showTooltip(item);
                    }, 400);
                };

                const cancelPress = () => {
                    clearTimeout(pressTimer);
                    hideTooltip();
                };

                slots[i].onmousedown = startPress;
                slots[i].onmouseup = cancelPress;
                slots[i].onmouseleave = cancelPress;

                slots[i].ontouchstart = startPress;
                slots[i].ontouchend = cancelPress;
                slots[i].ontouchcancel = cancelPress;

                slots[i].oncontextmenu = (e) => {
                    e.preventDefault();
                    return false;
                };

                slots[i].onclick = () => useSpell(absoluteIdx);
            } else {
                slots[i].style.backgroundImage = 'none';
                slots[i].innerHTML = '';
                // Clear events
                slots[i].onmousedown = null;
                slots[i].onmouseup = null;
                slots[i].onmouseleave = null;
                slots[i].ontouchstart = null;
                slots[i].ontouchend = null;
                slots[i].ontouchcancel = null;
                slots[i].onclick = null;
                slots[i].oncontextmenu = null;
            }
        });
    });
}

function updateStats() {
    gameState.players.forEach((p, i) => {
        const bar = document.getElementById(`p${i + 1}-hp-bar`);
        const text = document.getElementById(`p${i + 1}-hp-text`);
        const hpPercent = (p.hp / 40) * 100;
        bar.style.width = `${hpPercent}%`;
        text.textContent = `${p.hp} / 40`;

        const shieldContainer = document.getElementById(`p${i + 1}-shield-container`);
        const shieldText = document.getElementById(`p${i + 1}-shield-text`);
        if (p.shield > 0) {
            shieldContainer.classList.remove('hidden');
            shieldText.textContent = p.shield;
        } else {
            shieldContainer.classList.add('hidden');
        }
    });
}

let logEntryCount = 0;

/** Main log entry (player action or system) */
function addLog(msg, playerIdx = null) {
    logEntryCount++;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    let dotClass = 'log-dot log-dot-system';
    let labelHtml = '';

    if (playerIdx === 0) {
        dotClass = 'log-dot log-dot-p1';
        labelHtml = `<span class="log-label log-label-p1">MAGO 1</span>`;
        entry.classList.add('log-entry-p1');
    } else if (playerIdx === 1) {
        dotClass = 'log-dot log-dot-p2';
        labelHtml = `<span class="log-label log-label-p2">MAGO 2</span>`;
        entry.classList.add('log-entry-p2');
    } else {
        entry.classList.add('log-entry-system');
    }

    entry.innerHTML = `
        <div class="log-timeline-col">
            <div class="${dotClass}"></div>
            <div class="log-line"></div>
        </div>
        <div class="log-content">
            <div class="log-header">
                ${labelHtml}
                <span class="log-time">${timeStr}</span>
            </div>
            <div class="log-msg">${msg}</div>
            <ul class="log-subitems"></ul>
        </div>
    `;

    logEl.prepend(entry);

    // Keep only last 40 entries to avoid overflow
    const entries = logEl.querySelectorAll('.log-entry');
    if (entries.length > 40) {
        entries[entries.length - 1].remove();
    }
}

/** Sub-event: attaches to the most recent log entry */
function addSubLog(msg) {
    const lastEntry = logEl.querySelector('.log-entry');
    if (!lastEntry) { addLog(msg); return; }
    const subList = lastEntry.querySelector('.log-subitems');
    if (!subList) return;
    const li = document.createElement('li');
    li.className = 'log-subitem';
    li.innerHTML = msg;
    subList.prepend(li);
}

function createParticles(x, y, element) {
    const colors = {
        fire: '#ff4d4d',
        water: '#3498db',
        earth: '#2ecc71',
        air: '#ecf0f1'
    };
    const color = colors[element] || '#ffffff';

    for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        document.body.appendChild(p);

        const size = Math.random() * 15 + 5;
        const destX = (Math.random() - 0.5) * 400;
        const destY = (Math.random() - 0.5) * 400;

        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.backgroundColor = color;
        p.style.borderRadius = '50%';
        p.style.position = 'fixed';
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;
        p.style.pointerEvents = 'none';
        p.style.boxShadow = `0 0 10px ${color}`;
        p.style.zIndex = '1000';

        const anim = p.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${destX}px, ${destY}px) scale(0)`, opacity: 0 }
        ], {
            duration: 500 + Math.random() * 500,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        });

        anim.onfinish = () => p.remove();
    }
}

initUI();

function resizeGame() {
    const container = document.getElementById('game-container');
    if (!container) return;
    const scaleX = window.innerWidth / 1960; // 40px safe margin
    const scaleY = window.innerHeight / 1320; // 40px safe margin
    const scale = Math.min(scaleX, scaleY);
    container.style.scale = scale;
}

window.addEventListener('resize', resizeGame);
// Call once to set initial scale
resizeGame();
