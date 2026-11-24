# The Ascent of Ponce

A Minecraft Bedrock add-on. Explorers climb a floating tower, floor by floor, searching for the Fountain of Youth said to wait at the top. It runs fully offline in single-player worlds, and all progress is saved in the world.

## Install
1. Run `./build.sh`. It creates `dist/AscentOfPonce.mcaddon`.
2. Open that file on your device. Minecraft imports both packs.
3. Create a world, then under **Add-Ons** turn on the behavior pack. The resource pack is added with it.
4. Spawn in. You get a **Wayfarer's Compass**. Use it to open the menu.

For testing, run `/tag @s add ponce_dev` (cheats on) to show **Dev Tools** in the menu.

## Phase 1 (done)
- **Levels and EXP** from kills. Level cap 100, 3 stat points per level.
- **Stats**
  - STR: +2% melee damage per point
  - DEX: +1% crit chance per point
  - AGI: dodge chance; Speed I at 15, Speed II at 30
  - VIT: +2 hearts per 5 points
- **Weapon mastery** for 8 weapon types: sword, dagger, rapier, hammer, axe, spear, katana, greatsword. It grows slowly from kills (scaled by how tough the mob is), hits and minutes spent actively fighting with that weapon. Gains shrink as mastery rises, and it adds up to +25% damage. Vanilla swords, axes, mace and trident already count.
  - Pace with nonstop fighting of ordinary mobs: first skill (25) in about 45 min, 150 in about 5 h, 375 in about 12 h, 600 (Dual Wield) in about 21 h. Floor guardians give +12 mastery each.
- **Skill catalogue**: 24 skills, unlocked by mastery plus stats. Examples: Ground Slam (hammer) and Dual Wield (sword 600 mastery, Lv 25, DEX 40, STR 20).
- **Menu**: Status and stat allocation, Skills, Mastery, Journal (lore), Settings.
- **HUD** above the hotbar showing HP bar, level and EXP. Hitting an enemy shows its name, level and HP bar.

## Tower mobs
Custom RPG mobs, no vanilla reskins. They spawn in the overworld for now, and move to their floors once floors exist.

### Floor 1
| Mob | Lv | HP | Behavior | Drops |
|---|---|---|---|---|
| Meadow Jelly | 1 | 12 | Hostile, slow, bouncy | Jelly Gel |
| Thornback Hare | 2 | 8 | Fast and skittish: flees players, kicks back hard once hit | Raw Hare, Thorn Quill |
| Field Wasp | 2 | 6 | Flying, hostile, poison sting | Wasp Stinger, Wasp Wing |
| Tusk Boar | 3 | 24 | Neutral: grazes, charges when hit, herd defends | Raw Boar Meat, Boar Hide, Boar Tusk (10%) |
| Burrow Mole | 3 | 16 | Hides under a dirt mound, untouchable; bursts out when you get within 4 blocks | Mole Claw, Raw Copper (30%) |
| Moss Golemite | 4 | 40 | Slow, heavy hitter. Hammers deal +50%, blades only 60% | Moss Clump, Cobblestone, Golemite Core (15%) |

### Floor 1 guardian: Ironhide, the Boar King
Lv 8, 1800 HP, 2.5x the size of a Tusk Boar. Tuned for a fight of about 5 minutes for a player around Lv 5-7 with an iron-tier weapon, their first weapon skill and some armor. The time is estimated, not yet measured in-game.
- **Summon** with the **Boar King's Call**, crafted from 3 Boar Tusks and 2 Boar Hides (tusk, hide-tusk-tusk, hide pattern). It only works once you've unlocked a weapon skill, and only inside the **Guardian's Arena** on Floor 1. Used anywhere else, it tells you the arena's direction and distance. He appears on the dais, and if he's dragged out of the arena he's pulled back.
- **Thick Hide**: wood, stone and gold weapons deal only 40% damage.
- **Charge**: a roar and a 1 s warning, then a straight-line charge for 9 damage and heavy knockback. Step sideways to dodge.
- **Call the Herd**: at 80%, 60%, 40% and 20% HP he summons 2 hostile Tusk Boars (max 6 at once).
- **Earthshaker** (below 60%): stay in melee range and he rears up (1.25 s warning) and slams the ground for 7 damage to everyone within 5 blocks. Back off.
- **Enrage**: below 30% HP he gets faster, hits for 8, and charges every 6 s instead of 9.
- **Rewards**: Boar King's Crest, meat, hides, tusks, 600 EXP, +12 weapon mastery, 100 Col, and Floor 1 marked as cleared. That opens the Stair Gate for you.
- He leaves after 60 s with no player nearby, so a failed attempt doesn't leave him roaming.

Models, textures, loot and spawn rules come from `tools/gen_mobs.py`. Edit it and re-run `python3 tools/gen_mobs.py`.

## Phase 2 (done): skills and weapons
- **Using skills**: hold a Ponce weapon and press **use** (right-click, or long-press on mobile). **Sneak + use** cycles the equipped skill, or pick one under Menu > Skills. Vanilla weapons build mastery but can't use skills.
- **25 skills**: 19 active, with cooldowns, plus 6 passive. Every active skill is implemented:
  - Dash Slash, Triple Arc, Twin Tempest (sword)
  - Venom Edge, Shadow Step (dagger)
  - Flurry, Comet Lunge, Riposte (rapier)
  - Ground Slam, Concussion, Armor Break (hammer)
  - Cleave, Whirlwind (axe)
  - Piercing Line, Pole Vault, Keep-Away Sweep (spear)
  - Still Water (katana)
  - Titan Overhead, Gale Arc (greatsword)

  The passives are Backstab, Rend (bleed), Iaido Draw, Crimson Chain, Bulwark and Dual Wield.
- **Dual Wield**: with a Ponce sword in your offhand, each hit is followed by an offhand strike, and it unlocks **Twin Tempest** (six alternating strikes).
- **32 Ponce weapons** across 8 types:
  - **Starter**: one Wayfarer's weapon per type, chosen once on first login (see below).
  - **Tier I** (Lv 3) and **Tier II** (Lv 5-8): **forged**, not crafted (see Phase 3).
  - **Relic** (Lv 25; usable at half strength below that): Legendary quest rewards (see Phase 4).
  - **Hydra Relic** (Lv 30): dropped by the Mire Hydra (see Floor 2).

  The Armory page in the menu lists them with your requirements shown in green or red.
- **Starter weapon**: shortly after the welcome on first login, you choose a weapon type and get its **Wayfarer's** weapon. Players on older saves without one are offered it too, and it's also on the menu until chosen.
  - Starters deal 3-4 damage, weaker than every forged weapon (5+ damage), and are **unbreakable**.
  - They can't be forged or crafted, are only given once, and don't count as iron-tier against Ironhide.
  - They can use skills, so your first skill unlock is usable right away.
- **Requirements**: below a weapon's level or stats it deals 25% damage and can't use skills. The tooltip shows the requirements.
- **Each type handles differently**:

  | Type | Swing time | Trait |
  |---|---|---|
  | Sword | 0.5 s | Balanced |
  | Dagger | 0.3 s | Speed I while held |
  | Rapier | 0.4 s | 25% chance of a follow-up thrust |
  | Hammer | 0.9 s | Hits stagger the target |
  | Axe | 0.7 s | 30% splash to a nearby enemy |
  | Spear | 0.6 s | +25% damage from 2.5+ blocks |
  | Katana | 0.5 s | +10% crit chance |
  | Greatsword | 1.0 s | Knockback, but Slowness I while held |

  Swinging faster than the swing time scales damage down, to a minimum of 20%.
- **Durability**: Ponce weapons wear down per hit and per skill, can be repaired with iron ingots, and respect Unbreaking.
- **Dev Tools** (tag `ponce_dev`): give all weapons, and unlock all skills with high stats.

## Phase 3 (done): jobs
**Mining**, **Smithing** and **Cooking** each have their own level (1-50), shown under Menu > Jobs.

### Mining: regenerating ore nodes
| Ore | Mining Lv | Pickaxe | Regrows | Found at |
|---|---|---|---|---|
| Ember Copper | 1 | any | 30 s | y 0 to 80 |
| Ironheart | 5 | stone+ | 60 s | y -32 to 48 |
| Glimmer Silver | 12 | iron+ | 120 s | y -64 to 16 |

- A mined node turns into a **Depleted Node**, which can't be mined, then regrows. Timers use world time and are saved, so they survive restarts. Creative mode breaks nodes normally, for building.
- Mining above a node's level gives up to a 30% chance of double ore.
- Raw ore smelts into ingots in a furnace or blast furnace.

### Smithing: forging minigame
- Craft a **Smithing Forge** from 3 Ember Copper Ingots, 5 Bricks blocks and 1 Iron Block.
- Use it (right-click / long-press), pick a weapon, and the materials go in. Then **punch the forge** whenever the sweeping marker is in the **green** zone (yellow counts as good). Finish before the metal cools (20 s). Stay within 6 blocks or the job is lost.
- **Recipes**: Tier I is Ironheart plus 1 Ember Copper (Smithing 1). Tier II is Ironheart plus 1 Glimmer Silver plus Floor 1 drops (Smithing 8).
- **Quality** comes from your average accuracy:

  | Quality | Damage | Durability |
  |---|---|---|
  | Crude | 90% | starts 25% worn, wears faster |
  | Standard | 100% | normal |
  | Fine | 110% | 20% less wear |
  | Masterwork | 120% | 33% less wear |

  Running out of heat always gives Crude. Smithing level widens the green zone and slows the marker.
- **Infusions (optional)**: after picking a weapon, add Floor 1 monster drops to change its stats. Tier I has 1 slot and Tier II has 2. The cost is on top of the recipe. Infusions change stats only, never abilities, and they show in the weapon's name and tooltip:

  | Infusion | Cost | Effect |
  |---|---|---|
  | Tusk Edge | 1 Boar Tusk | +1 damage, -10% durability |
  | Hide Grip | 2 Boar Hide | +30% durability |
  | Quill Barbs | 3 Thorn Quill | +5% crit chance |
  | Stinger Point | 2 Wasp Stinger | +0.5 damage, +3% crit chance |
  | Claw Serration | 2 Mole Claw | +0.5 damage, 10% faster swing |
  | Gel Temper | 4 Jelly Gel | -0.5 damage, 20% faster swing |
  | Wing Balance | 2 Wasp Wing | 15% faster swing |
  | Moss Binding | 3 Moss Clump | +20% durability |
  | Core Weight | 1 Golemite Core | +2 damage, 15% slower swing |
  | King's Crest | 1 Boar King's Crest | +1.5 damage, +25% durability |

### Cooking: timing minigame and meal buffs
- Craft a **Cooking Pot** from 7 Ember Copper Ingots and 1 Campfire.
- Use it, pick a recipe, then **punch the pot** to take the dish off the heat. Green gives 2 servings, yellow gives 1, and waiting too long gives a Burnt Mess. Cooking level widens the green window.

| Meal | Ingredients | Buff | Cooking Lv |
|---|---|---|---|
| Boar Skewer | Raw Boar, Stick | +3 STR, 3 min | 1 |
| Hare Stew | Raw Hare, Carrot, Bowl | +3 AGI, 3 min | 3 |
| Jelly Tart | 2 Jelly Gel, Wheat, Sugar | +3 DEX, 3 min | 5 |
| Hearty Roast | 2 Raw Boar, 2 Potato | +3 VIT, 5 min | 8 |

- One meal buff at a time; eating another replaces it. Buffs count in combat but **not** toward weapon or skill requirements.
- **Dev Tools**: a job kit (ingots, forge, pot, ingredients, pickaxe) and all jobs set to level 20.

## Phase 4 (done): quests
- **Quest givers** (player-shaped NPCs; invulnerable, stay put, always named). Use one to talk:
  - **Marla, the Guildmistress**: hunting and guardian quests, including the Legendary quest.
  - **Old Bram, the Smith**: mining and forging quests.
  - **Pip, the Cook**: cooking and ingredient quests.

  They live in Wayfarer's Rest on Floor 1 (see below). You can also place extra ones with spawn eggs or Dev Tools > "Spawn the quest givers here".
- **20 Floor 1 quests** across five difficulties, including three repeatables that pay steady Col. Objectives can be:
  - kill mobs, defeat a guardian, or bring items (handed over at turn-in)
  - mine nodes or forge weapons (optionally of a minimum quality)
  - cook dishes or perfect dishes
  - reach a combat or job level

  Quests can require a level and earlier quests. You can have 8 active at once and abandon any.
- **Rewards scale with difficulty** (average EXP and Col rise with every tier):

  | Difficulty | Typical rewards |
  |---|---|
  | Easy | 30-80 EXP, 20-50 Col, meals or ingots |
  | Normal | 150-220 EXP, 60-80 Col, ingots and drops |
  | Hard | 400-450 EXP, 150-200 Col, silver or a **Fine Tier I weapon** |
  | Elite | 800 EXP, 350-400 Col, a **Masterwork Tier II weapon with 2 infusions** |
  | Legendary | 2000 EXP, 1000 Col, a **Relic weapon** |

  Weapon rewards let you pick the weapon type at turn-in. Closing the picker keeps the quest ready.
- **Relic weapons**, one per type: **unbreakable**, **3 built-in infusions**, and they can't be forged. The relics are Boarbane, Wasp's Kiss, Thornwhisper, Golemheart Maul, Tuskreaver, Molefang Pike, Verdant Moon and Kingsfall.
  - **Semi-high requirements**: Lv 25 and 40-46 stat points in the weapon's two stats (a Lv 25 player has 72), for example Kingsfall needs 34 STR and 12 VIT. Boarbane only needs Lv 12, so players carry their Relic at half strength for a long stretch (still a little better than the best forged weapon, plus 3 infusions) before growing into it at 25.
  - **Below the requirements a Relic works at half strength**, with skills still usable. Other weapons drop to 25% and lose their skills.
  - **Even at half strength it beats a Masterwork Tier II** of its type, so at full strength it's about 2.5x a Tier II. Base damage: Boarbane 18, Wasp's Kiss 15, Thornwhisper 18, Golemheart Maul 22, Tuskreaver 21, Molefang Pike 19, Verdant Moon 21, Kingsfall 26, plus each Relic's infusions.
- **Quest log** in the menu: progress, details, abandon. Progress also shows above the hotbar as it happens.
- **Shops**: each NPC sells useful goods for Col and buys monster drops, raw ore or ingredients.

## Floor 1: Wayfarer's Rest (Phase 5, part 1)
Floor 1 is a **floating island** about 500 blocks across at y 200, centered on x 10000, z 10000 in the overworld. Bedrock add-ons can't add dimensions, so each floor is an island in the sky.

- **It builds itself.** A script builds it chunk by chunk (up to 4 chunks around each nearby player) from a fixed design, so it's the same in every world. Built chunks are saved, so nothing is rebuilt. It works in existing worlds too.
- **The town of Wayfarer's Rest** sits in the middle:
  - a fountain plaza (a replica of the Fountain of Youth) with lantern posts and flowers
  - Marla's Guild Hall, Bram's Smithy (with a Smithing Forge, furnaces and an anvil) and Pip's Kitchen (with a Cooking Pot)
  - six houses, three market stalls, garden trees, four streets, and a log palisade with lit gates
  - the quest givers move into their buildings automatically
- **The forest** fills the rest of the island:
  - oak, birch and spruce, with more spruce to the north
  - meadow clearings with flowers, ponds and gentle hills
  - winding dirt trails leaving each gate
  - mossy boulders holding ore nodes (mostly Ember Copper, some Ironheart, rare Glimmer Silver)
- **Getting there**:
  - New players start in town.
  - Menu > **Travel** goes to Wayfarer's Rest or back to world spawn.
  - Your spawn point is set to the town.
- **Guardian's Arena**: at the end of the north trail, 185 blocks from town. It's a flat ring of stone with lantern pillars, a chiseled dais where Ironhide appears, and an entrance from the trail on the south side.
- **Stair Gate**: a glowing, unbreakable gate in the arena's north wall, with a stairway climbing away behind it. It's sealed until you've beaten Ironhide, and it opens per player. Floor 2 is still being built, so for now the open gate tells you that. Once Floor 2 exists, it will take you there.
- **Map & Travel** (menu):
  - shows whether you're on Floor 1
  - gives the direction and distance to the town and the arena
  - shows whether the gate is open for you
  - travels to town or world spawn, and gives you a locator map
- **Floor 1 mobs** spawn in the forest around players (8 nearby at most), never inside town or the arena. Hares and wasps come out by day; moles and golemites come out more at night.
- **No Minecraft mobs**: vanilla mobs that spawn on the floor are removed.
- **Falling off the edge** brings you back to town.
- Preview a floor with `node tools/preview_floor.mjs <floor> <dir>`, which writes a top-down map and the town's and arena's blocks.

## Floor 2: the Misty Marsh
Floor 2 is a second floating island (centered on x 10000, z -10000, water level y 200), reached through Floor 1's Stair Gate or from Map & Travel once Floor 1 is cleared.

- **The marsh**:
  - shallow water over mud, deeper channels, and mossy hummocks with reeds, moss, grass and blue orchids
  - mangroves with arching roots, dead snags, and lily pads
  - wooden boardwalks with railing posts for trails
  - **fog** that rolls in when you arrive on the floor and lifts when you leave
- **Stiltwater**: a town on a mangrove-plank deck raised on stilts above the water, with a small twin of the Fountain of Youth, huts, lanterns and railings. It has:
  - **Ysolde, the Marsh Warden** (new quest giver and shop)
  - branches of Bram's smithy (forge, furnace, anvil) and Pip's kitchen (cooking pot)
- **Hydra Pool**: the guardian arena at the end of the north boardwalk, a ring of mossy stone with a flooded center, lantern pillars, and the next Stair Gate (Floor 3 comes later).
- **Creatures** (spawned by the floor, never in town or the pool; each has a habitat: land, water, either, or air):

  | Creature | Lv | HP | Behavior | Drops |
  |---|---|---|---|---|
  | Bog Frog | 8 | 40 | Hostile, leaps at you, swims | Raw Frog Legs, Frog Skin |
  | Will-o'-Wisp | 10 | 30 | Glowing, hovers, slows you; flickers away when hit; mostly at night | Wisp Essence |
  | Mire Shambler | 11 | 60 | Slow walking mound of moss and mud; poisons; more at night | Bog Moss |
  | Marsh Gator | 12 | 80 | Lurks in the shallows, notices you late, lunges hard | Gator Hide, Gator Tooth |

- **New infusions**:

  | Infusion | Cost | Effect |
  |---|---|---|
  | Frogskin Wrap | 3 Frog Skin | +20% durability, 5% faster swing |
  | Wisp Spark | 2 Wisp Essence | +8% crit |
  | Gator Fang | 2 Gator Tooth | +2 damage, -10% durability |
  | Gator Scale | 2 Gator Hide | +40% durability, 5% slower swing |
  | Hydra Fang | 1 Hydra Fang | +2.5 damage, +5% crit |
  | Hydra Scale | 2 Hydra Scale | +0.5 damage, +50% durability |

- **New meal**: Marsh Gumbo (2 Raw Frog Legs, Bog Moss, Bowl; Cooking 12) gives +4 AGI and +2 DEX for 5 minutes.
- **Quests** (Ysolde): six of them, all needing Floor 2 reached. They include Fine **Tier II** weapons for Hard quests, a Masterwork Tier II with Gator Fang and Wisp Spark for the Elite quest "Heads Will Roll", and a repeatable Marsh Patrol.

### Floor 2 guardian: the Mire Hydra (multi-head creatures)
The hydra introduces **multi-head creatures** (`scripts/multihead.js`, data-driven `SPECIES`). Floor 2 is the gentle introduction: heads have modest health, so the challenge is the timing, not the damage. Around **Floor 15**, hydra-kind return as **regular floor mobs**: a species entry without `guardian` spawns with all its heads, roams freely, follows the same head and regrowth rules, and just drops loot and EXP.
- **Summoning**: craft a **Mire Lure** (gator teeth, wisp essence, frog skin) and use it inside the Hydra Pool. Used elsewhere, it points the way.
- **Separate heads**: the body carries **three heads as riders**. **Each head has its own health pool, a modest 250** (750 in total). The body can't be hurt, and its boss bar shows the heads' combined health. The on-screen display shows each head's health or regrowth countdown.
- **Regrowth**: a slain head is **severed** and **regrows at full health after 35 seconds**, with a warning 8 seconds before.
- **Winning**: the hydra only falls when **all three heads are dead at the same time**. Wear every head down, then finish them in quick succession.
- **Attacks**:
  - Heads rear back (warning) and **bite** for 9 damage what's in front of them.
  - The middle **acid head** spits a pool that poisons anyone standing in it.
  - The **last surviving head goes into a frenzy** and attacks twice as often.
- **Leash**: the hydra is held to its pool.
- **Victory**: Floor 2 is cleared (opening its Stair Gate) and you get +250 Col. The final blow earns 900 EXP and +15 mastery. Drops are Hydra Fangs, Hydra Scales and Gator Hide.
- **Hydra Relics**: whoever fells the last head receives a Hydra Relic matching the weapon type they're holding (random if none). It's **guaranteed on your first Hydra kill, then a 15% chance**.
  - Eight weapons, one per type: Mireblade, Fenfang, Venom Needle, Headsplitter, Neckcleaver, Hydra Lance, Severance and Threefold Ruin.
  - **Unbreakable**, with **base damage 1 above the quest Relic** of the same type.
  - **Lv 30** and about 52 stat points (a Lv 30 player has 87), for example Threefold Ruin needs 42 STR and 12 VIT. Like all Relics, they work at half strength below their requirements.
  - Built-in infusions:
    - **Hydra Fang** (+2.5 damage, +5% crit)
    - **Hydra's Eye** (+10% crit)
    - **Hydra's Thirst** (heals you for 4% of the damage you deal, on every hit)

    Hydra's Eye and Hydra's Thirst exist only on these weapons and can't be forged. Hydra's Thirst is the one deliberate exception to "weapons never grant abilities".

## Roadmap
5. Floors (part 3): Floor 3 and beyond; hydra-kind return as regular floor mobs around Floor 15

## Layout
```
behavior_pack/
  manifest.json
  items/              custom items
  scripts/
    main.js           events and loops
    config.js         all balance numbers
    data.js           save data
    progression.js    XP, mastery, skills, stat effects
    combat.js         hit pipeline: stats, pacing, traits, passives, crits, stances, kills
    abilities.js      active skills: activation, cooldowns, effects
    weapons.js        weapon requirements, durability, tooltips
    weapon_data.js    generated weapon table (from tools/gen_weapons.py)
    effects.js        short-lived combat state (cooldowns, stances, bleeds)
    jobs.js           Mining / Smithing / Cooking levels
    mining.js         ore node gating, drops, regrowth
    forging.js        Smithing Forge menu and minigame
    cooking.js        Cooking Pot menu, minigame, meal buffs
    jobs_data.js      generated ore / food / recipe table (from tools/gen_jobs.py)
    starter.js        first-login starter weapon choice
    quests.js         quest engine, NPC dialogue, rewards, shops
    quests_data.js    quest givers, quests, shops (hand-edited)
    floor1_gen.js     Floor 1 layout: island, town, forest, arena (pure code, no game API)
    floor2_gen.js     Floor 2 layout: marsh, Stiltwater, Hydra Pool (pure code)
    floors.js         builds every floor in the game; travel, gates, fog, spawners
    multihead.js      multi-head creatures (the Mire Hydra): heads, regrowth, attacks
    inventory.js, ui.js  shared helpers
    mobs.js           mole ambush, golemite weaknesses
    bosses.js         floor guardian fights
    skills.js         skill catalogue
    menu.js           menu screens
    lore.js           journal text
resource_pack/        models, textures, animations, sounds, text
tools/gen_mobs.py     generates mob files and placeholder art
tools/gen_weapons.py  generates weapon items, icons and weapon_data.js (incl. forge recipes)
tools/gen_jobs.py     generates ore nodes, forge, pot, ingots, meals, world gen and jobs_data.js
tools/gen_npcs.py     generates the quest-giver NPC entities and skins
tools/gen_floor2_mobs.py  generates the Floor 2 creatures, the hydra, drops, lure and marsh fog
tools/preview_floor.mjs   renders a floor's data from the real generator for previews
tests/                run ./tests/run.sh (needs Node) to simulate gameplay against mock APIs
```

Requires Minecraft Bedrock 1.21.90 or newer (Script API `@minecraft/server` 2.0.0).
