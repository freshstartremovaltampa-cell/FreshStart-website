-- GameData.lua (ModuleScript → ReplicatedStorage/Modules/GameData)
-- All static game data: paths, stages, enemies, tools, locations

local GameData = {}

-- ============================================================
-- EVOLUTION STAGES
-- ============================================================

GameData.Stages = {
	Sorcerer = {
		{ id = 1, name = "Weakling",       displayName = "Weakling (No Cursed Energy)", health = 100,  speed = 16, damage = 10  },
		{ id = 2, name = "Grade4",         displayName = "Grade 4 Sorcerer",            health = 150,  speed = 16, damage = 15  },
		{ id = 3, name = "Grade3",         displayName = "Grade 3 Sorcerer",            health = 200,  speed = 17, damage = 22  },
		{ id = 4, name = "Grade2",         displayName = "Grade 2 Sorcerer",            health = 280,  speed = 17, damage = 30  },
		{ id = 5, name = "Grade1",         displayName = "Grade 1 Sorcerer",            health = 380,  speed = 18, damage = 42  },
		{ id = 6, name = "SpecialGrade",   displayName = "Special Grade Sorcerer",      health = 520,  speed = 19, damage = 60  },
		{ id = 7, name = "SixEyes",        displayName = "Six Eyes (Gojo-tier)",         health = 780,  speed = 21, damage = 90  },
		{ id = 8, name = "TenShadows",     displayName = "10 Shadows Sukuna (Megumi)",  health = 1200, speed = 23, damage = 140 },
	},
	CurseSpirit = {
		{ id = 1, name = "CursedWomb",     displayName = "Cursed Womb",                 health = 100,  speed = 14, damage = 8   },
		{ id = 2, name = "LowGrade",       displayName = "Low-grade Curse Spirit",      health = 145,  speed = 15, damage = 13  },
		{ id = 3, name = "HighGrade",      displayName = "High-grade Curse Spirit",     health = 210,  speed = 16, damage = 20  },
		{ id = 4, name = "FingerBearer",   displayName = "Finger Bearer",               health = 320,  speed = 17, damage = 36  },
		{ id = 5, name = "SpecialGrade",   displayName = "Special Grade Curse",         health = 460,  speed = 18, damage = 55  },
		{ id = 6, name = "MahitoTier",     displayName = "Mahito-tier Curse",           health = 620,  speed = 19, damage = 76  },
		{ id = 7, name = "JogoDagon",      displayName = "Jogo / Dagon-tier",           health = 850,  speed = 21, damage = 110 },
		{ id = 8, name = "HeianSukuna",    displayName = "Heian Era Sukuna",            health = 1400, speed = 24, damage = 160 },
	},
}

-- ============================================================
-- STAGE LOCATIONS (7 locations, each maps to stage id 1-7;
-- final stage 8 is the Domain endgame arena)
-- ============================================================

GameData.Locations = {
	{ id = 1, name = "TokyoJJHigh",   displayName = "Tokyo Jujutsu High"    },
	{ id = 2, name = "KyotoJJHigh",   displayName = "Kyoto Jujutsu High"    },
	{ id = 3, name = "Shibuya",       displayName = "Shibuya Station"        },
	{ id = 4, name = "FightClub",     displayName = "Hakari's Fight Club"    },
	{ id = 5, name = "Shinjuku",      displayName = "Shinjuku"               },
	{ id = 6, name = "CullingGames",  displayName = "Culling Games Colony"   },
	{ id = 7, name = "FinalDomain",   displayName = "Domain Expansion Arena" },
}

-- ============================================================
-- ENEMIES
-- Each enemy has a path it belongs to (who fights it),
-- the stage range it spawns at, health, damage, and loot table
-- ============================================================

-- Sorcerer path enemies = Curse Spirits
-- CurseSpirit path enemies = Sorcerers

GameData.Enemies = {

	-- Curse Spirits (fought by Sorcerer path)
	{
		id = "BasicCurse",      name = "Basic Curse Spirit",
		forPath = "Sorcerer",   stageRange = {1, 2},
		health = 80,            damage = 8,
		speed = 12,             dropTable = { "SlaughterDemon", "BlackRope" },
		dropChance = 0.15,
	},
	{
		id = "Grade2Curse",     name = "Grade 2 Curse Spirit",
		forPath = "Sorcerer",   stageRange = {3, 4},
		health = 180,           damage = 20,
		speed = 13,             dropTable = { "NanamisBlade", "SlaughterDemon", "BlackRope" },
		dropChance = 0.20,
	},
	{
		id = "Grade1Curse",     name = "Grade 1 Curse Spirit",
		forPath = "Sorcerer",   stageRange = {4, 5},
		health = 280,           damage = 32,
		speed = 14,             dropTable = { "NanamisBlade", "DragonBone", "FesteringLifeSword" },
		dropChance = 0.22,
	},
	{
		id = "SpecialCurse",    name = "Special Grade Curse",
		forPath = "Sorcerer",   stageRange = {5, 6},
		health = 420,           damage = 50,
		speed = 15,             dropTable = { "PlayfulCloud", "DragonBone", "FesteringLifeSword" },
		dropChance = 0.25,
	},
	{
		id = "MahitoEnemy",     name = "Mahito",
		forPath = "Sorcerer",   stageRange = {6, 7},
		health = 600,           damage = 72,
		speed = 16,             dropTable = { "PlayfulCloud", "SwordOfExtermination" },
		dropChance = 0.28,
	},
	{
		id = "JogoEnemy",       name = "Jogo",
		forPath = "Sorcerer",   stageRange = {7, 8},
		health = 900,           damage = 100,
		speed = 17,             dropTable = { "SwordOfExtermination", "InvertedSpear" },
		dropChance = 0.30,
	},

	-- Sorcerers (fought by Curse Spirit path)
	{
		id = "WeakSorcerer",    name = "Weakling Sorcerer",
		forPath = "CurseSpirit", stageRange = {1, 2},
		health = 75,            damage = 7,
		speed = 14,             dropTable = { "BlackRope", "SlaughterDemon" },
		dropChance = 0.15,
	},
	{
		id = "Grade2Sorcerer",  name = "Grade 2 Sorcerer",
		forPath = "CurseSpirit", stageRange = {2, 4},
		health = 200,           damage = 22,
		speed = 15,             dropTable = { "NanamisBlade", "SlaughterDemon" },
		dropChance = 0.20,
	},
	{
		id = "Grade1Sorcerer",  name = "Grade 1 Sorcerer",
		forPath = "CurseSpirit", stageRange = {4, 5},
		health = 300,           damage = 35,
		speed = 16,             dropTable = { "NanamisBlade", "PlayfulCloud", "FesteringLifeSword" },
		dropChance = 0.22,
	},
	{
		id = "SpecialSorcerer", name = "Special Grade Sorcerer",
		forPath = "CurseSpirit", stageRange = {5, 6},
		health = 450,           damage = 55,
		speed = 17,             dropTable = { "DragonBone", "PlayfulCloud" },
		dropChance = 0.25,
	},
	{
		id = "YutaEnemy",       name = "Yuta Okkotsu",
		forPath = "CurseSpirit", stageRange = {6, 7},
		health = 650,           damage = 78,
		speed = 18,             dropTable = { "DragonBone", "SwordOfExtermination" },
		dropChance = 0.28,
	},
	{
		id = "GojoEnemy",       name = "Satoru Gojo",
		forPath = "CurseSpirit", stageRange = {7, 8},
		health = 950,           damage = 110,
		speed = 20,             dropTable = { "SwordOfExtermination", "InvertedSpear" },
		dropChance = 0.30,
	},
}

-- ============================================================
-- CURSED TOOLS
-- statBoost values are ADDED on top of the player's base stats
-- ============================================================

GameData.CursedTools = {
	{
		id = "SlaughterDemon",    name = "Slaughter Demon",
		rarity = "Uncommon",
		statBoost = { damage = 12, health = 0,  speed = 1 },
	},
	{
		id = "BlackRope",         name = "Black Rope",
		rarity = "Uncommon",
		statBoost = { damage = 8,  health = 35, speed = 0 },
	},
	{
		id = "NanamisBlade",      name = "Nanami's Blunt Blade",
		rarity = "Uncommon",
		statBoost = { damage = 18, health = 20, speed = 0 },
	},
	{
		id = "FesteringLifeSword", name = "Festering Life Sword",
		rarity = "Rare",
		statBoost = { damage = 28, health = 0,  speed = 0 },
	},
	{
		id = "DragonBone",        name = "Dragon-Bone",
		rarity = "Rare",
		statBoost = { damage = 32, health = 0,  speed = 2 },
	},
	{
		id = "PlayfulCloud",      name = "Playful Cloud",
		rarity = "Rare",
		statBoost = { damage = 38, health = 0,  speed = 1 },
	},
	{
		id = "SwordOfExtermination", name = "Sword of Extermination",
		rarity = "Epic",
		statBoost = { damage = 55, health = 40, speed = 1 },
	},
	{
		id = "InvertedSpear",     name = "Inverted Spear of Heaven",
		rarity = "Legendary",
		statBoost = { damage = 80, health = 60, speed = 3 },
	},
}

-- ============================================================
-- MONETIZATION
-- Replace PRODUCT_ID_HERE with your actual Developer Product ID
-- from the Roblox Creator Dashboard
-- ============================================================

GameData.Products = {
	EarlyPathSwitch = {
		productId = 0,          -- REPLACE with your Developer Product ID
		name = "Early Path Switch",
		robuxCost = 99,         -- display only; Roblox handles actual price
		description = "Switch your evolution path early without completing all 8 stages. Your cursed tools carry over.",
	},
}

-- ============================================================
-- RARITY COLORS (for GUI display)
-- ============================================================

GameData.RarityColors = {
	Uncommon  = Color3.fromRGB(80, 200, 80),
	Rare      = Color3.fromRGB(60, 120, 255),
	Epic      = Color3.fromRGB(160, 60, 255),
	Legendary = Color3.fromRGB(255, 165, 0),
}

-- ============================================================
-- HELPERS
-- ============================================================

function GameData.GetToolById(toolId)
	for _, tool in ipairs(GameData.CursedTools) do
		if tool.id == toolId then return tool end
	end
	return nil
end

function GameData.GetStageData(path, stageId)
	local stages = GameData.Stages[path]
	if stages then return stages[stageId] end
	return nil
end

function GameData.GetEnemiesForStage(path, stageId)
	local result = {}
	for _, enemy in ipairs(GameData.Enemies) do
		if enemy.forPath == path
			and stageId >= enemy.stageRange[1]
			and stageId <= enemy.stageRange[2]
		then
			table.insert(result, enemy)
		end
	end
	return result
end

return GameData
