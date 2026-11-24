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
- **16 Ponce weapons**, 2 tiers for each of the 8 types. Tier I is crafted from iron (Lv 3). Tier II upgrades a Tier I weapon with Floor 1 drops (Lv 5-8). The Armory page in the menu lists them with your requirements shown in green or red.
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

## Roadmap
3. Jobs: regenerating ore nodes, forging minigame, cooking
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
    mobs.js           mole ambush, golemite weaknesses
    bosses.js         floor guardian fights
    skills.js         skill catalogue
    menu.js           menu screens
    lore.js           journal text
resource_pack/        models, textures, animations, sounds, text
tools/gen_mobs.py     generates mob files and placeholder art
tools/gen_weapons.py  generates weapon items, icons, recipes and weapon_data.js
tests/                run ./tests/run.sh (needs Node) to simulate gameplay against mock APIs
```

Requires Minecraft Bedrock 1.21.90 or newer (Script API `@minecraft/server` 2.0.0).
