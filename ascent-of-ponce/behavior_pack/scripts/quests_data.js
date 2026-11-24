// Quest givers, Floor 1 quests and shops. Hand-edited: add quests here.
//
// Objective types:
//   kill    { target: id or [ids], count }   kill these mobs
//   boss    { target, count }                 take part in defeating a guardian
//   collect { item, count }                   have the items at turn-in (they're handed over)
//   mine    { target: node id, count }        mine ore nodes
//   forge   { minQuality?, count }            forge weapons (optionally Fine or better, etc.)
//   cook    { target?: food id, count }       cook dishes (any dish if no target)
//   cook_perfect { count }                    perfectly timed dishes
//   level   { count }                         reach this combat level
// requires: { level, quests: [ids], floor }     floor = must have reached that floor
//   job     { job, count }                    reach this job level
//
// Rewards scale with difficulty. Weapon rewards let the player pick the weapon type:
//   fine_t1        Fine-quality Tier I weapon (Hard, Floor 1)
//   fine_t2        Fine-quality Tier II weapon (Hard, Floor 2)
//   masterwork_t2 with no infusions          (Hard, Floor 3)
//   masterwork_t2  Masterwork Tier II weapon with the listed infusions (Elite)
//   relic          Relic: unbreakable, 3 built-in infusions, highest stats (Legendary)

export const DIFFICULTY = {
  1: { name: "Easy", color: "§a" },
  2: { name: "Normal", color: "§e" },
  3: { name: "Hard", color: "§6" },
  4: { name: "Elite", color: "§c" },
  5: { name: "Legendary", color: "§d" },
};

export const FLOOR2_MOBS = ["ponce:bog_frog", "ponce:will_o_wisp", "ponce:mire_shambler", "ponce:marsh_gator"];

export const FLOOR3_MOBS = ["ponce:highland_bull", "ponce:rock_lizard", "ponce:wind_sprite", "ponce:crag_hawk"];

export const FLOOR1_MOBS = [
  "ponce:meadow_jelly", "ponce:thornback_hare", "ponce:field_wasp",
  "ponce:tusk_boar", "ponce:burrow_mole", "ponce:moss_golemite",
];

export const NPCS = {
  "ponce:npc_guild": {
    key: "guild", name: "Marla, the Guildmistress",
    greeting: "Another climber, eh? The guild pays for every beast you put down on this floor. Prove yourself, and the guild's vault opens to you.",
  },
  "ponce:npc_smith": {
    key: "smith", name: "Old Bram, the Smith",
    greeting: "Hmph. Steel doesn't care how brave you are, only how true you strike. Bring me ore and I'll teach you to make something worth swinging.",
  },
  "ponce:npc_warden": {
    key: "warden", name: "Ysolde, the Marsh Warden",
    greeting: "You climbed the stair, then. Welcome to the marsh. Keep to the boardwalks, mind the water, and never trust a light in the fog.",
  },
  "ponce:npc_ranger": {
    key: "ranger", name: "Corra, the Highland Ranger",
    greeting: "Up here the wind tells you everything, if you listen. Right now it says the herds are restless and their king is watching from the Crown.",
  },
  "ponce:npc_cook": {
    key: "cook", name: "Pip, the Cook",
    greeting: "Oh! Hungry? Everyone's hungry up here. A good meal before a hard fight is half the battle. The other half is the fighting, I suppose.",
  },
};

export const QUESTS = [
  // ---------------- Marla: hunting and guardians ----------------
  { id: "jelly_cull", giver: "guild", difficulty: 1, name: "Jelly Cull",
    desc: "Meadow Jellies are clogging the paths. Thin them out.",
    objectives: [{ type: "kill", target: "ponce:meadow_jelly", count: 10 }],
    rewards: { xp: 60, col: 25, items: [["ponce:boar_skewer", 2]] } },
  { id: "hare_hunt", giver: "guild", difficulty: 1, name: "Quick as a Hare",
    desc: "Thornback Hares run from everyone. Catch a few and you'll learn to strike fast.",
    objectives: [{ type: "kill", target: "ponce:thornback_hare", count: 6 }],
    rewards: { xp: 60, col: 25, items: [["ponce:hare_stew", 2]] } },
  { id: "boar_trouble", giver: "guild", difficulty: 2, name: "Boar Trouble",
    desc: "Tusk Boars have been charging travelers. Put a dozen of them down.",
    requires: { level: 3, quests: ["jelly_cull"] },
    objectives: [{ type: "kill", target: "ponce:tusk_boar", count: 12 }],
    rewards: { xp: 200, col: 70, items: [["ponce:ironheart_ingot", 3]] } },
  { id: "wasp_nest", giver: "guild", difficulty: 2, name: "Smoke Out the Nest",
    desc: "Field Wasps are swarming the meadow. Kill them and bring proof.",
    requires: { level: 3 },
    objectives: [{ type: "kill", target: "ponce:field_wasp", count: 10 }, { type: "collect", item: "ponce:wasp_stinger", count: 5 }],
    rewards: { xp: 220, col: 80, items: [["ponce:wasp_wing", 2], ["ponce:jelly_tart", 1]] } },
  { id: "mole_menace", giver: "guild", difficulty: 3, name: "Mole Menace",
    desc: "Something keeps ambushing the miners from under the dirt. Find the moles and end it.",
    requires: { level: 5, quests: ["boar_trouble"] },
    objectives: [{ type: "kill", target: "ponce:burrow_mole", count: 8 }, { type: "collect", item: "ponce:mole_claw", count: 3 }],
    rewards: { xp: 400, col: 150, weapon: { kind: "fine_t1" } } },
  { id: "stone_hearts", giver: "guild", difficulty: 3, name: "Hearts of Stone",
    desc: "The Moss Golemites guard something in their chests. The guild wants their cores.",
    requires: { level: 6 },
    objectives: [{ type: "kill", target: "ponce:moss_golemite", count: 6 }, { type: "collect", item: "ponce:golemite_core", count: 2 }],
    rewards: { xp: 450, col: 170, items: [["ponce:glimmer_silver_ingot", 2], ["ponce:hearty_roast", 2]] } },
  { id: "king_of_boars", giver: "guild", difficulty: 4, name: "The King of Boars",
    desc: "Ironhide, the Boar King, guards the way up. Craft his Call from tusks and hides, blow it in the Guardian's Arena at the end of the north trail, and bring him down.",
    requires: { level: 6, quests: ["boar_trouble", "mole_menace"] },
    objectives: [{ type: "boss", target: "ponce:ironhide", count: 1 }],
    rewards: { xp: 800, col: 350, weapon: { kind: "masterwork_t2", infusions: ["ponce:boar_tusk", "ponce:boar_hide"] } } },
  { id: "boarbane", giver: "guild", difficulty: 5, name: "Boarbane",
    desc: "Legends say a climber who breaks the Boar King's line three times earns a weapon from the guild vault. " +
      "No one has managed it. Become strong, cull his herd, beat him again and again, and bring his crests.",
    requires: { level: 10, quests: ["king_of_boars", "stone_hearts"] },
    objectives: [
      { type: "level", count: 12 },
      { type: "kill", target: "ponce:tusk_boar", count: 30 },
      { type: "boss", target: "ponce:ironhide", count: 3 },
      { type: "collect", item: "ponce:boar_king_crest", count: 2 },
    ],
    rewards: { xp: 2000, col: 1000, weapon: { kind: "relic" } } },
  { id: "pest_control", giver: "guild", difficulty: 1, repeatable: true, name: "Pest Control (repeatable)",
    desc: "The guild always pays for fewer monsters.",
    objectives: [{ type: "kill", target: FLOOR1_MOBS, count: 20, label: "Floor 1 monsters" }],
    rewards: { xp: 80, col: 40 } },

  // ---------------- Ysolde: the Misty Marsh (Floor 2) ----------------
  { id: "frog_chorus", giver: "warden", difficulty: 2, name: "The Frog Chorus",
    desc: "The Bog Frogs never stop croaking, and they've started leaping at travelers. Quiet them down.",
    requires: { floor: 2 },
    objectives: [{ type: "kill", target: "ponce:bog_frog", count: 12 }],
    rewards: { xp: 300, col: 120, items: [["ponce:frog_legs", 4], ["ponce:marsh_gumbo", 1]] } },
  { id: "wisp_lights", giver: "warden", difficulty: 2, name: "Lights in the Fog",
    desc: "Climbers follow the lights off the boardwalks and never come back. Snuff them out and bring me their essence.",
    requires: { floor: 2 },
    objectives: [{ type: "kill", target: "ponce:will_o_wisp", count: 8 }, { type: "collect", item: "ponce:wisp_essence", count: 4 }],
    rewards: { xp: 320, col: 130, items: [["ponce:glimmer_silver_ingot", 2]] } },
  { id: "shambling_dead", giver: "warden", difficulty: 3, name: "What Walks in the Reeds",
    desc: "Mounds of moss and mud that walk like men. Whatever they are, there are too many of them.",
    requires: { floor: 2, level: 10, quests: ["frog_chorus"] },
    objectives: [{ type: "kill", target: "ponce:mire_shambler", count: 12 }],
    rewards: { xp: 600, col: 250, weapon: { kind: "fine_t2" } } },
  { id: "gator_hunt", giver: "warden", difficulty: 3, name: "Gator Season",
    desc: "The Marsh Gators lie still in the shallows until you're close enough to bite. Hunt them, and bring their teeth.",
    requires: { floor: 2, level: 11 },
    objectives: [{ type: "kill", target: "ponce:marsh_gator", count: 8 }, { type: "collect", item: "ponce:gator_tooth", count: 4 }],
    rewards: { xp: 650, col: 260, items: [["ponce:gator_hide", 3], ["ponce:glimmer_silver_ingot", 3]] } },
  { id: "heads_will_roll", giver: "warden", difficulty: 4, name: "Heads Will Roll",
    desc: "The Mire Hydra guards the stair in the Hydra Pool at the end of the north boardwalk. Cut off one head and it grows back. " +
      "Craft a Mire Lure, call it up, and fell every head before the first one regrows.",
    requires: { floor: 2, level: 12, quests: ["shambling_dead", "gator_hunt"] },
    objectives: [{ type: "boss", target: "ponce:mire_hydra", count: 1 }],
    rewards: { xp: 1200, col: 600, weapon: { kind: "masterwork_t2", infusions: ["ponce:gator_tooth", "ponce:wisp_essence"] } } },
  { id: "marsh_patrol", giver: "warden", difficulty: 1, repeatable: true, name: "Marsh Patrol (repeatable)",
    desc: "The marsh never runs out of things that want to eat you. I pay for every one that doesn't.",
    requires: { floor: 2 },
    objectives: [{ type: "kill", target: FLOOR2_MOBS, count: 20, label: "Floor 2 creatures" }],
    rewards: { xp: 150, col: 70 } },

  // ---------------- Corra: the Rolling Highlands (Floor 3) ----------------
  { id: "bull_run", giver: "ranger", difficulty: 2, name: "Bull Run",
    desc: "The herds have turned mean. When one charges, they all charge. Thin them out before someone gets trampled.",
    requires: { floor: 3 },
    objectives: [{ type: "kill", target: "ponce:highland_bull", count: 10 }],
    rewards: { xp: 500, col: 200, items: [["ponce:highland_stew", 1], ["minecraft:beef", 6]] } },
  { id: "lizard_lurk", giver: "ranger", difficulty: 2, name: "Rocks That Bite",
    desc: "Some of those rocks have teeth. Learn to tell them apart, and bring me their scales.",
    requires: { floor: 3 },
    objectives: [{ type: "kill", target: "ponce:rock_lizard", count: 10 }, { type: "collect", item: "ponce:lizard_scale", count: 4 }],
    rewards: { xp: 520, col: 210, items: [["ponce:glimmer_silver_ingot", 3]] } },
  { id: "sprite_storm", giver: "ranger", difficulty: 3, name: "Catch the Wind",
    desc: "Wind Sprites knock climbers clean off the ridges. Ground a few of them.",
    requires: { floor: 3, level: 16, quests: ["bull_run"] },
    objectives: [{ type: "kill", target: "ponce:wind_sprite", count: 10 }],
    rewards: { xp: 900, col: 360, weapon: { kind: "masterwork_t2" } } },
  { id: "hawk_eyes", giver: "ranger", difficulty: 3, name: "Hawk Eyes",
    desc: "The Crag Hawks dive out of the sun. Bring down enough of them and I'll fletch something special.",
    requires: { floor: 3, level: 17 },
    objectives: [{ type: "kill", target: "ponce:crag_hawk", count: 10 }, { type: "collect", item: "ponce:hawk_feather", count: 5 }],
    rewards: { xp: 950, col: 380, items: [["ponce:wind_essence", 3], ["ponce:glimmer_silver_ingot", 4]] } },
  { id: "king_of_the_hills", giver: "ranger", difficulty: 4, name: "King of the Hills",
    desc: "Thunderhoof rules the herds from the Crown of Stones at the end of the north trail. Craft a Thunder Call and face him: " +
      "watch his horns, jump his quakes, and never stand where the herd will run.",
    requires: { floor: 3, level: 18, quests: ["sprite_storm", "hawk_eyes"] },
    objectives: [{ type: "boss", target: "ponce:thunderhoof", count: 1 }],
    rewards: { xp: 2000, col: 900, weapon: { kind: "masterwork_t2", infusions: ["ponce:wind_essence", "ponce:hawk_feather"] } } },
  { id: "highland_patrol", giver: "ranger", difficulty: 1, repeatable: true, name: "Highland Patrol (repeatable)",
    desc: "Walk the hills and keep the beasts off the trails.",
    requires: { floor: 3 },
    objectives: [{ type: "kill", target: FLOOR3_MOBS, count: 20, label: "Floor 3 creatures" }],
    rewards: { xp: 250, col: 110 } },

  // ---------------- Bram: mining and smithing ----------------
  { id: "first_ore", giver: "smith", difficulty: 1, name: "Copper First",
    desc: "Every smith starts with copper. Mine some Ember Copper and bring yourself back in one piece.",
    objectives: [{ type: "mine", target: "ponce:ember_copper_node", count: 10 }],
    rewards: { xp: 50, col: 20, items: [["ponce:ember_copper_ingot", 3]], jobXp: { mining: 40 } } },
  { id: "heart_of_iron", giver: "smith", difficulty: 2, name: "Heart of Iron",
    desc: "Ironheart is what real blades are made of. Dig deeper.",
    requires: { quests: ["first_ore"] },
    objectives: [{ type: "mine", target: "ponce:ironheart_node", count: 15 }],
    rewards: { xp: 180, col: 70, items: [["ponce:ironheart_ingot", 4]], jobXp: { mining: 100 } } },
  { id: "first_blade", giver: "smith", difficulty: 2, name: "Your First Blade",
    desc: "Build a forge and make a weapon. Any weapon. I'll judge it later.",
    requires: { quests: ["first_ore"] },
    objectives: [{ type: "forge", count: 1 }],
    rewards: { xp: 150, col: 60, items: [["ponce:ironheart_ingot", 3]], jobXp: { smithing: 60 } } },
  { id: "fine_work", giver: "smith", difficulty: 3, name: "Fine Work",
    desc: "Anyone can bang metal. Show me two weapons of Fine quality or better.",
    requires: { quests: ["first_blade"] },
    objectives: [{ type: "forge", minQuality: "fine", count: 2 }],
    rewards: { xp: 400, col: 150, weapon: { kind: "fine_t1" }, jobXp: { smithing: 150 } } },
  { id: "silver_vein", giver: "smith", difficulty: 3, name: "The Silver Vein",
    desc: "Glimmer Silver hides deep and fights back. Bring some up.",
    requires: { quests: ["heart_of_iron"] },
    objectives: [{ type: "mine", target: "ponce:glimmer_silver_node", count: 10 }],
    rewards: { xp: 450, col: 180, items: [["ponce:glimmer_silver_ingot", 3]], jobXp: { mining: 250 } } },
  { id: "masters_test", giver: "smith", difficulty: 4, name: "The Master's Test",
    desc: "Two masterworks. Then you can call yourself a smith.",
    requires: { quests: ["fine_work"] },
    objectives: [{ type: "job", job: "smithing", count: 10 }, { type: "forge", minQuality: "masterwork", count: 2 }],
    rewards: { xp: 800, col: 400, weapon: { kind: "masterwork_t2", infusions: ["ponce:boar_hide", "ponce:wasp_stinger"] }, jobXp: { smithing: 300 } } },
  { id: "storm_forged", giver: "smith", difficulty: 3, name: "Storm-Forged",
    desc: "There's a metal in the highland rock that rings like thunder when you strike it. Stormsteel. " +
      "Dig some out of the quarry past Cairnhold, then forge me a Tier III blade from it.",
    requires: { floor: 3, quests: ["fine_work"] },
    objectives: [{ type: "mine", target: "ponce:stormsteel_node", count: 15 }, { type: "job", job: "smithing", count: 15 }, { type: "forge", minQuality: "standard", count: 1 }],
    rewards: { xp: 1100, col: 420, items: [["ponce:stormsteel_ingot", 5], ["ponce:glimmer_silver_ingot", 2]], jobXp: { smithing: 400, mining: 300 } } },
  { id: "ore_delivery", giver: "smith", difficulty: 1, repeatable: true, name: "Ore Delivery (repeatable)",
    desc: "I always need copper.",
    objectives: [{ type: "collect", item: "ponce:raw_ember_copper", count: 16 }],
    rewards: { xp: 40, col: 50 } },

  // ---------------- Pip: cooking ----------------
  { id: "skewers", giver: "cook", difficulty: 1, name: "Skewers for Everyone",
    desc: "Climbers keep asking for skewers. Help me make some!",
    objectives: [{ type: "cook", target: "ponce:boar_skewer", count: 3 }],
    rewards: { xp: 50, col: 20, items: [["ponce:raw_boar", 3]], jobXp: { cooking: 40 } } },
  { id: "pantry", giver: "cook", difficulty: 1, name: "Stock the Pantry",
    desc: "The pantry's empty. Boar and hare, please!",
    objectives: [{ type: "collect", item: "ponce:raw_boar", count: 6 }, { type: "collect", item: "ponce:raw_hare", count: 4 }],
    rewards: { xp: 60, col: 40, items: [["ponce:hare_stew", 2]] } },
  { id: "perfect_plate", giver: "cook", difficulty: 2, name: "The Perfect Plate",
    desc: "Timing is everything. Cook five dishes perfectly.",
    requires: { quests: ["skewers"] },
    objectives: [{ type: "cook_perfect", count: 5 }],
    rewards: { xp: 180, col: 80, items: [["ponce:hearty_roast", 2]], jobXp: { cooking: 120 } } },
  { id: "grand_feast", giver: "cook", difficulty: 3, name: "A Grand Feast",
    desc: "The guild wants a feast before the Boar King hunt. Two of every dish!",
    requires: { quests: ["perfect_plate"] },
    objectives: [
      { type: "cook", target: "ponce:boar_skewer", count: 2 }, { type: "cook", target: "ponce:hare_stew", count: 2 },
      { type: "cook", target: "ponce:jelly_tart", count: 2 }, { type: "cook", target: "ponce:hearty_roast", count: 2 },
    ],
    rewards: { xp: 450, col: 200, items: [["ponce:hearty_roast", 3], ["ponce:golemite_core", 1]], jobXp: { cooking: 250 } } },
  { id: "kitchen_help", giver: "cook", difficulty: 1, repeatable: true, name: "Kitchen Help (repeatable)",
    desc: "Jelly Gel makes the best tarts. I'll pay for it!",
    objectives: [{ type: "collect", item: "ponce:jelly_gel", count: 8 }],
    rewards: { xp: 30, col: 30 } },
];

export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

// Col shops. buy = what the NPC sells you, sell = what the NPC buys from you.
export const SHOPS = {
  guild: {
    buy: [["ponce:boar_kings_call", 300], ["ponce:boar_skewer", 25], ["ponce:hearty_roast", 60]],
    sell: [["ponce:jelly_gel", 2], ["ponce:thorn_quill", 2], ["ponce:wasp_wing", 3], ["ponce:wasp_stinger", 3],
      ["ponce:boar_hide", 4], ["ponce:mole_claw", 4], ["ponce:moss_clump", 2], ["ponce:boar_tusk", 8],
      ["ponce:golemite_core", 15], ["ponce:boar_king_crest", 60]],
  },
  smith: {
    buy: [["ponce:ember_copper_ingot", 10], ["ponce:ironheart_ingot", 25], ["ponce:glimmer_silver_ingot", 60], ["ponce:stormsteel_ingot", 110],
      ["ponce:smithing_forge", 200], ["minecraft:iron_pickaxe", 80]],
    sell: [["ponce:raw_ember_copper", 4], ["ponce:raw_ironheart", 10], ["ponce:raw_glimmer_silver", 25], ["ponce:raw_stormsteel", 40]],
  },
  warden: {
    buy: [["ponce:mire_lure", 400], ["ponce:marsh_gumbo", 50], ["ponce:frog_legs", 6]],
    sell: [["ponce:frog_skin", 4], ["ponce:wisp_essence", 6], ["ponce:bog_moss", 3], ["ponce:gator_hide", 8],
      ["ponce:gator_tooth", 10], ["ponce:hydra_scale", 40], ["ponce:hydra_fang", 80]],
  },
  ranger: {
    buy: [["ponce:thunder_call", 600], ["ponce:highland_stew", 70]],
    sell: [["ponce:bull_horn", 12], ["ponce:highland_hide", 8], ["ponce:lizard_scale", 10], ["ponce:wind_essence", 9],
      ["ponce:hawk_feather", 9], ["ponce:thunder_horn", 120]],
  },
  cook: {
    buy: [["ponce:cooking_pot", 150], ["ponce:boar_skewer", 25], ["ponce:hare_stew", 35], ["ponce:jelly_tart", 40],
      ["minecraft:bowl", 2], ["minecraft:sugar", 3]],
    sell: [["ponce:raw_boar", 3], ["ponce:raw_hare", 3], ["ponce:jelly_gel", 2]],
  },
};
