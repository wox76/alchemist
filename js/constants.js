export const ELEMENTS = {
    FIRE: 'fire',
    WATER: 'water',
    EARTH: 'earth',
    AIR: 'air'
};

export const ELEMENT_ICONS = {
    [ELEMENTS.FIRE]: 'assets/fuoco.png',
    [ELEMENTS.WATER]: 'assets/acqua.png',
    [ELEMENTS.EARTH]: 'assets/terra.png',
    [ELEMENTS.AIR]: 'assets/aria.png',
    JOLLY: 'assets/jolly.png'
};

export const SPELLS = [
    { id: 'fireball', name: 'Palla di Fuoco', element: ELEMENTS.FIRE, image: 'assets/palla_di_fuoco.png', description: 'Infligge 5 danni diretti. Si attiva AUTOMATICAMENTE quando la prendi dall\'Altare!', effect: (g, target) => { target.hp -= 5; } },
    { id: 'poison_dart', name: 'Dardo Velenoso', element: ELEMENTS.EARTH, image: 'assets/dardo_velenoso.png', description: 'Infligge 2 danni subito, e aggiunge un segnalino "Veleno" all\'avversario.', effect: (g, target) => { target.hp -= 2; target.poison += 1; } },
    { id: 'quartz_wall', name: 'Muro di Quarzo', element: ELEMENTS.EARTH, image: 'assets/muro_di_quarzo.png', description: 'Ti fornisce 5 Punti Scudo. I danni fisici e magici colpiscono lo scudo prima dei tuoi PV.', effect: (g, caster) => { caster.shield += 5; } },
    { id: 'counterspell', name: 'Controincantesimo', element: ELEMENTS.AIR, image: 'assets/controincantesimo.png', description: 'DIFESA AUTOMATICA: Se l\'avversario usa una magia mentre hai questa carta, viene annullata e la carta consumata.', reaction: true },
    { id: 'vital_essence', name: 'Essenza Vitale', element: ELEMENTS.WATER, image: 'assets/essenza_vitale.png', description: 'Ti cura istantaneamente di 5 Punti Vita.', effect: (g, caster) => { caster.hp = Math.min(caster.maxHp, caster.hp + 5); } },
    { id: 'leech', name: 'Sanguisuga', element: ELEMENTS.WATER, image: 'assets/leech.png', description: 'Ruba 2 Punti Vita all\'avversario e ti cura esattamente di 2 Punti Vita.', effect: (g, target, caster) => { target.hp -= 2; caster.hp = Math.min(caster.maxHp, caster.hp + 2); } },
    { id: 'ice_seal', name: 'Sigillo di Ghiaccio', element: ELEMENTS.WATER, image: 'assets/sigillo_di_ghiaccio.png', description: 'GELA una magia a caso nel Grimorio avversario e la ELIMINA. Si attiva AUTOMATICAMENTE!', effect: (g, target) => { /* logic */ } },
    { id: 'rusty_scrap', name: 'Rottame Arrugginito', element: ELEMENTS.FIRE, image: 'assets/rottame_arrugginito.png', description: 'Non fa nulla, ma occupa spazio (rischio Backfire). L\'avversario deve usare un\'Azione per liberarsene.', effect: (g, target) => { /* logic */ } },
    { id: 'cyclone_breath', name: 'Soffio del Ciclone', element: ELEMENTS.AIR, image: 'assets/soffio_del_ciclone.png', description: 'Scarta tutte e 5 le magie visibili sull\'Altare. Rimpiazzale pescando 5 nuove carte.', effect: (g) => { g.resetAltar(); } },
    { id: 'disintegration', name: 'Disintegrazione', element: ELEMENTS.FIRE, image: 'assets/disintegrazione.png', description: 'Distrugge una magia a caso nel Grimorio avversario. Si attiva AUTOMATICAMENTE quando la prendi!', effect: (g, target) => { /* logic */ } },
    { id: 'thieving_hand', name: 'Mano Ladra', element: ELEMENTS.AIR, image: 'assets/mano_ladra.png', description: 'Sposta una magia a caso dal Grimorio avversario nel tuo. Si attiva AUTOMATICAMENTE quando la prendi!', effect: (g, target, caster) => { /* logic */ } },
    { id: 'equivalent_exchange', name: 'Scambio Equivalente', element: ELEMENTS.AIR, image: 'assets/scambio_equivalente.png', description: 'Scambia questa magia con una a caso dell\'avversario. Si attiva AUTOMATICAMENTE!', effect: (g, target, caster) => { /* logic */ } },
    { id: 'lava_golem', name: 'Golem di Lava', element: ELEMENTS.FIRE, image: 'assets/golem_di_lava.png', description: 'Alla fine di ogni tuo turno, il Golem sputa fuoco e infligge 2 danni automatici all\'avversario.', type: 'monster' },
    { id: 'mind_parasite', name: 'Parassita Mentale', element: ELEMENTS.WATER, image: 'assets/parassita_mentale.png', description: 'Posizionalo su un nemico. Ogni volta che pesca una magia, subisce 1 danno.', type: 'monster' },
    { id: 'rock_guardian', name: 'Guardiano di Roccia', element: ELEMENTS.EARTH, image: 'assets/guardiano_di_roccia.png', description: 'Finché è attivo, l\'avversario non può usare carte che rubano, spostano o distruggono tue magie.', type: 'monster' }
];
