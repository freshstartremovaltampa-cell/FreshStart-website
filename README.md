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
  - Pace with nonstop fighting of ordinary mobs: first skill (25) in about 45 min, 150 in about 5 h, 375 in about 12 h, 600 (Dual Wield) in about 21 h. Floor guardians give +8 mastery each.
- **Skill catalogue**: 24 skills, unlocked by mastery plus stats. Examples: Ground Slam (hammer) and Dual Wield (sword 600 mastery, Lv 25, DEX 40, STR 20).
- **Menu**: Status and stat allocation, Skills, Mastery, Journal (lore), Settings.
- **HUD** above the hotbar showing HP bar, level and EXP. Hitting an enemy shows its name, level and HP bar.

## Tower mobs
Custom RPG mobs, no vanilla reskins. They spawn in the overworld for now (plains, forests), and move to their floors once floors exist.

| Mob | Lv | HP | Behavior | Drops |
|---|---|---|---|---|
| Meadow Jelly | 1 | 12 | Hostile, slow, bouncy | Jelly Gel |
| Tusk Boar | 3 | 24 | Neutral: grazes, charges when hit, herd defends | Raw Boar Meat, Boar Hide, Boar Tusk (rare) |

### Floor 1 guardian: Ironhide, the Boar King
Lv 8, 300 HP, 2.5x the size of a Tusk Boar. Tuned for a player around Lv 4-6 with an iron-tier weapon, their first weapon skill and some armor.
- **Summon** with the **Boar King's Call**, crafted from 3 Boar Tusks and 2 Boar Hides (tusk, hide-tusk-tusk, hide pattern). It only works once you've unlocked a weapon skill.
- **Thick Hide**: wood, stone and gold weapons deal only 40% damage.
- **Charge**: a roar and a 1 s warning, then a straight-line charge for 9 damage and heavy knockback. Step sideways to dodge.
- **Call the Herd**: at 70% and 40% HP he summons 2 hostile Tusk Boars.
- **Enrage**: below 30% HP he gets faster, hits for 8, and charges every 6 s instead of 9.
- **Rewards**: Boar King's Crest, meat, hides, tusks, 250 EXP, +8 weapon mastery, 100 Col, and Floor 1 marked as cleared.
- He leaves after 60 s with no player nearby, so a failed attempt doesn't leave him roaming.

Models, textures, loot and spawn rules come from `tools/gen_mobs.py`. Edit it and re-run `python3 tools/gen_mobs.py`.

## Roadmap
2. Combat: skill activation and cooldowns, Dual Wield, weapon level/stat requirements, custom weapons
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
    combat.js         damage, crits, dodges, kills
    skills.js         skill catalogue
    menu.js           menu screens
    lore.js           journal text
resource_pack/        models, textures, animations, sounds, text
tools/gen_mobs.py     generates mob files and placeholder art
tests/                run ./tests/run.sh (needs Node) to simulate gameplay against mock APIs
```

Requires Minecraft Bedrock 1.21.90 or newer (Script API `@minecraft/server` 2.0.0).
