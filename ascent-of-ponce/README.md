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
- **Summon** with the **Boar King's Call**, crafted from 3 Boar Tusks and 2 Boar Hides (tusk, hide-tusk-tusk, hide pattern). It only works once you've unlocked a weapon skill.
- **Thick Hide**: wood, stone and gold weapons deal only 40% damage.
- **Charge**: a roar and a 1 s warning, then a straight-line charge for 9 damage and heavy knockback. Step sideways to dodge.
- **Call the Herd**: at 80%, 60%, 40% and 20% HP he summons 2 hostile Tusk Boars (max 6 at once).
- **Earthshaker** (below 60%): stay in melee range and he rears up (1.25 s warning) and slams the ground for 7 damage to everyone within 5 blocks. Back off.
- **Enrage**: below 30% HP he gets faster, hits for 8, and charges every 6 s instead of 9.
- **Rewards**: Boar King's Crest, meat, hides, tusks, 600 EXP, +12 weapon mastery, 100 Col, and Floor 1 marked as cleared.
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
- **24 Ponce weapons** across 8 types:
  - **Starter**: one Wayfarer's weapon per type, chosen once on first login (see below).
  - **Tier I** (Lv 3) and **Tier II** (Lv 5-8): **forged**, not crafted (see Phase 3).

  The Armory page in the menu lists them with your requirements shown in green or red.
- **Starter weapon**: shortly after the welcome on first login, you choose a weapon type and get its **Wayfarer's** weapon. Players on older saves without one are offered it too, and it's also on the menu until chosen.
  - Starters deal 3-4 damage and have 300 durability, weaker than every forged weapon (5+ damage, 450+ durability).
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

## Roadmap
4. Quests: NPCs, quest log, rewards, Col shop
5. Floors 1–3 with guardians and stair gates

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
tests/                run ./tests/run.sh (needs Node) to simulate gameplay against mock APIs
```

Requires Minecraft Bedrock 1.21.90 or newer (Script API `@minecraft/server` 2.0.0).
