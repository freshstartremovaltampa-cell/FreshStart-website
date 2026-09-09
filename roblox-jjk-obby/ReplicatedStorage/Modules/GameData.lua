-- GameData.lua (ModuleScript → ReplicatedStorage/Modules/GameData)

local GameData = {}

-- ============================================================
-- EVOLUTION STAGES
-- ============================================================

GameData.Stages = {
	Sorcerer = {
		{ id=1, name="Weakling",     displayName="Weakling (No CE)",          health=100,  speed=16, damage=10,  color=Color3.fromRGB(180,180,180) },
		{ id=2, name="Grade4",       displayName="Grade 4 Sorcerer",          health=150,  speed=16, damage=15,  color=Color3.fromRGB(100,160,220) },
		{ id=3, name="Grade3",       displayName="Grade 3 Sorcerer",          health=200,  speed=17, damage=22,  color=Color3.fromRGB(80,130,200)  },
		{ id=4, name="Grade2",       displayName="Grade 2 Sorcerer",          health=280,  speed=17, damage=30,  color=Color3.fromRGB(60,100,180)  },
		{ id=5, name="Grade1",       displayName="Grade 1 Sorcerer",          health=380,  speed=18, damage=42,  color=Color3.fromRGB(40,80,160)   },
		{ id=6, name="SpecialGrade", displayName="Special Grade Sorcerer",    health=520,  speed=19, damage=60,  color=Color3.fromRGB(160,60,220)  },
		{ id=7, name="SixEyes",      displayName="Six Eyes (Gojo-tier)",      health=780,  speed=21, damage=90,  color=Color3.fromRGB(100,220,255) },
		{ id=8, name="TenShadows",   displayName="10 Shadows Sukuna (Megumi)",health=1200, speed=23, damage=140, color=Color3.fromRGB(255,165,0)   },
	},
	CurseSpirit = {
		{ id=1, name="CursedWomb",   displayName="Cursed Womb",               health=100,  speed=14, damage=8,   color=Color3.fromRGB(180,60,60)   },
		{ id=2, name="LowGrade",     displayName="Low-grade Curse Spirit",    health=145,  speed=15, damage=13,  color=Color3.fromRGB(160,40,40)   },
		{ id=3, name="HighGrade",    displayName="High-grade Curse Spirit",   health=210,  speed=16, damage=20,  color=Color3.fromRGB(140,20,20)   },
		{ id=4, name="FingerBearer", displayName="Finger Bearer",             health=320,  speed=17, damage=36,  color=Color3.fromRGB(120,0,160)   },
		{ id=5, name="SpecialGrade", displayName="Special Grade Curse",       health=460,  speed=18, damage=55,  color=Color3.fromRGB(100,0,140)   },
		{ id=6, name="MahitoTier",   displayName="Mahito-tier Curse",         health=620,  speed=19, damage=76,  color=Color3.fromRGB(80,0,120)    },
		{ id=7, name="JogoDagon",    displayName="Jogo / Dagon-tier",         health=850,  speed=21, damage=110, color=Color3.fromRGB(220,80,0)    },
		{ id=8, name="HeianSukuna",  displayName="Heian Era Sukuna",          health=1400, speed=24, damage=160, color=Color3.fromRGB(180,0,0)     },
	},
}

-- ============================================================
-- TROPHY COSTS to unlock each stage (spent in hub showcase)
-- ============================================================

GameData.TrophyStageCosts = {
	[1] = 0,
	[2] = 500,
	[3] = 2500,
	[4] = 10000,
	[5] = 35000,
	[6] = 100000,
	[7] = 300000,
	[8] = 750000,
}

-- Trophies earned per enemy kill at each player stage
GameData.TrophiesPerKill = {
	[1] = 20,
	[2] = 50,
	[3] = 120,
	[4] = 350,
	[5] = 900,
	[6] = 2500,
	[7] = 6500,
	[8] = 15000,
}

-- ============================================================
-- REBIRTH
-- ============================================================

-- Multiplier applied to damage per rebirth level
GameData.RebirthMultipliers = { 1, 1.5, 2, 3, 4, 6, 8, 10, 15, 20, 30 }

-- Trophy bonus buttons (spend trophies to get temporary damage boost)
-- These appear as the bottom row buttons (like +277K, +462K, +1.1M in the screenshot)
GameData.DamageBoostButtons = {
	{ label="+1x",   trophyCost=5000,    multiplier=1   },
	{ label="+3x",   trophyCost=20000,   multiplier=2   },
	{ label="+10x",  trophyCost=75000,   multiplier=7   },
}

-- ============================================================
-- LOCATIONS
-- ============================================================

GameData.Locations = {
	{ id=1, name="TokyoJJHigh",  displayName="Tokyo Jujutsu High",   baseColor=Color3.fromRGB(160,160,140), theme="school"     },
	{ id=2, name="KyotoJJHigh",  displayName="Kyoto Jujutsu High",   baseColor=Color3.fromRGB(180,60,60),   theme="traditional"},
	{ id=3, name="Shibuya",      displayName="Shibuya Station",       baseColor=Color3.fromRGB(80,80,100),   theme="urban"      },
	{ id=4, name="FightClub",    displayName="Hakari's Fight Club",   baseColor=Color3.fromRGB(50,50,60),    theme="industrial" },
	{ id=5, name="Shinjuku",     displayName="Shinjuku",              baseColor=Color3.fromRGB(60,80,120),   theme="city"       },
	{ id=6, name="CullingGames", displayName="Culling Games Colony",  baseColor=Color3.fromRGB(100,80,50),   theme="battlefield"},
	{ id=7, name="FinalDomain",  displayName="Domain Expansion Arena",baseColor=Color3.fromRGB(20,10,40),    theme="void"       },
}

-- ============================================================
-- ENEMIES
-- ============================================================

GameData.Enemies = {
	-- Curse Spirits (fought by Sorcerer path)
	{ id="BasicCurse",      name="Basic Curse Spirit",       forPath="Sorcerer",    stageRange={1,2}, health=80,  damage=8,  speed=12, dropTable={"SlaughterDemon","BlackRope"},                   dropChance=0.15 },
	{ id="Grade2Curse",     name="Grade 2 Curse Spirit",     forPath="Sorcerer",    stageRange={3,4}, health=180, damage=20, speed=13, dropTable={"NanamisBlade","SlaughterDemon","BlackRope"},     dropChance=0.20 },
	{ id="Grade1Curse",     name="Grade 1 Curse Spirit",     forPath="Sorcerer",    stageRange={4,5}, health=280, damage=32, speed=14, dropTable={"NanamisBlade","DragonBone","FesteringLifeSword"},dropChance=0.22 },
	{ id="SpecialCurse",    name="Special Grade Curse",       forPath="Sorcerer",    stageRange={5,6}, health=420, damage=50, speed=15, dropTable={"PlayfulCloud","DragonBone","FesteringLifeSword"},dropChance=0.25 },
	{ id="MahitoEnemy",     name="Mahito",                    forPath="Sorcerer",    stageRange={6,7}, health=600, damage=72, speed=16, dropTable={"PlayfulCloud","SwordOfExtermination"},           dropChance=0.28 },
	{ id="JogoEnemy",       name="Jogo",                      forPath="Sorcerer",    stageRange={7,8}, health=900, damage=100,speed=17, dropTable={"SwordOfExtermination","InvertedSpear"},          dropChance=0.30 },
	-- Sorcerers (fought by Curse Spirit path)
	{ id="WeakSorcerer",    name="Weakling Sorcerer",         forPath="CurseSpirit", stageRange={1,2}, health=75,  damage=7,  speed=14, dropTable={"BlackRope","SlaughterDemon"},                   dropChance=0.15 },
	{ id="Grade2Sorcerer",  name="Grade 2 Sorcerer",          forPath="CurseSpirit", stageRange={2,4}, health=200, damage=22, speed=15, dropTable={"NanamisBlade","SlaughterDemon"},                dropChance=0.20 },
	{ id="Grade1Sorcerer",  name="Grade 1 Sorcerer",          forPath="CurseSpirit", stageRange={4,5}, health=300, damage=35, speed=16, dropTable={"NanamisBlade","PlayfulCloud","FesteringLifeSword"},dropChance=0.22},
	{ id="SpecialSorcerer", name="Special Grade Sorcerer",    forPath="CurseSpirit", stageRange={5,6}, health=450, damage=55, speed=17, dropTable={"DragonBone","PlayfulCloud"},                    dropChance=0.25 },
	{ id="YutaEnemy",       name="Yuta Okkotsu",              forPath="CurseSpirit", stageRange={6,7}, health=650, damage=78, speed=18, dropTable={"DragonBone","SwordOfExtermination"},            dropChance=0.28 },
	{ id="GojoEnemy",       name="Satoru Gojo",               forPath="CurseSpirit", stageRange={7,8}, health=950, damage=110,speed=20, dropTable={"SwordOfExtermination","InvertedSpear"},         dropChance=0.30 },
}

-- ============================================================
-- CURSED TOOLS
-- ============================================================

GameData.CursedTools = {
	{ id="SlaughterDemon",     name="Slaughter Demon",          rarity="Uncommon", statBoost={damage=12, health=0,  speed=1} },
	{ id="BlackRope",          name="Black Rope",                rarity="Uncommon", statBoost={damage=8,  health=35, speed=0} },
	{ id="NanamisBlade",       name="Nanami's Blunt Blade",      rarity="Uncommon", statBoost={damage=18, health=20, speed=0} },
	{ id="FesteringLifeSword", name="Festering Life Sword",      rarity="Rare",     statBoost={damage=28, health=0,  speed=0} },
	{ id="DragonBone",         name="Dragon-Bone",               rarity="Rare",     statBoost={damage=32, health=0,  speed=2} },
	{ id="PlayfulCloud",       name="Playful Cloud",             rarity="Rare",     statBoost={damage=38, health=0,  speed=1} },
	{ id="SwordOfExtermination",name="Sword of Extermination",  rarity="Epic",     statBoost={damage=55, health=40, speed=1} },
	{ id="InvertedSpear",      name="Inverted Spear of Heaven",  rarity="Legendary",statBoost={damage=80, health=60, speed=3} },
}

-- ============================================================
-- STORE ITEMS (Robux products — fill in actual IDs)
-- ============================================================

GameData.Products = {
	EarlyPathSwitch  = { productId=0, name="Early Path Switch",      robux=99,  description="Switch paths now. Cursed tools carry over." },
	DoubleDamage     = { productId=0, name="x2 DAMAGE",              robux=299, description="Permanently double your damage output.",  permanent=true },
	SpeedBoost       = { productId=0, name="+5 Speed PERMANENT",     robux=199, description="Add +5 walkspeed permanently.",           permanent=true },
	VipPass          = { productId=0, name="VIP Pass",               robux=499, description="2x trophies, 2x damage, custom aura.",    permanent=true },
	AutoFight        = { productId=0, name="Auto Fight",             robux=99,  description="Automatically fight nearby enemies.",     permanent=true },
	DoubleTrophies1h = { productId=0, name="2x Trophies (1 Hour)",   robux=49,  description="Double trophy gain for 1 hour.",          permanent=false },
	Trophies1k       = { productId=0, name="1,000 Trophies",         robux=29,  description="Instantly receive 1,000 trophies.",       permanent=false },
	Trophies5k       = { productId=0, name="5,000 Trophies",         robux=99,  description="Instantly receive 5,000 trophies.",       permanent=false },
	Trophies25k      = { productId=0, name="25,000 Trophies",        robux=399, description="Instantly receive 25,000 trophies.",      permanent=false },
}

-- ============================================================
-- DOMAINS  (Auras — buy with trophies, require rebirth count)
-- ============================================================

GameData.Domains = {
	{ id="CursedEnergyVeil",    name="Cursed Energy Veil",     damageMult=1.25, trophyCost=0,         rebirthReq=0,  color=Color3.fromRGB(120,200,80)  },
	{ id="BlackFlash",           name="Black Flash",             damageMult=1.5,  trophyCost=1000,      rebirthReq=1,  color=Color3.fromRGB(60,120,220)  },
	{ id="DivergentFist",        name="Divergent Fist",          damageMult=2,    trophyCost=10000,     rebirthReq=3,  color=Color3.fromRGB(220,120,60)  },
	{ id="HollowPurple",         name="Hollow Purple",           damageMult=3,    trophyCost=100000,    rebirthReq=5,  color=Color3.fromRGB(160,60,220)  },
	{ id="MalevolentShrine",     name="Malevolent Shrine",       damageMult=5,    trophyCost=1000000,   rebirthReq=10, color=Color3.fromRGB(220,0,80)    },
	{ id="UnlimitedVoid",        name="Unlimited Void",          damageMult=8,    trophyCost=10000000,  rebirthReq=20, color=Color3.fromRGB(0,200,255)   },
	{ id="AuthenticMutualLove",  name="Authentic Mutual Love",   damageMult=12,   trophyCost=100000000, rebirthReq=30, color=Color3.fromRGB(255,200,0)   },
}

-- ============================================================
-- SPIRITS  (Pets — drop from enemies, equip up to 4)
-- ============================================================

GameData.Spirits = {
	{ id="CursedWombSpirit",   name="Cursed Womb",   rarity="Common",    damageMult=1.10, dropWeight=30 },
	{ id="FingerBearerSpirit", name="Finger Bearer", rarity="Common",    damageMult=1.15, dropWeight=25 },
	{ id="SmallpoxSpirit",     name="Smallpox Deity",rarity="Uncommon",  damageMult=1.30, dropWeight=18 },
	{ id="MahitoSpirit",       name="Mahito",        rarity="Uncommon",  damageMult=1.50, dropWeight=12 },
	{ id="HanamiSpirit",       name="Hanami",        rarity="Rare",      damageMult=1.75, dropWeight=7  },
	{ id="JogoSpirit",         name="Jogo",          rarity="Rare",      damageMult=2.00, dropWeight=5  },
	{ id="DagonSpirit",        name="Dagon",         rarity="Epic",      damageMult=2.50, dropWeight=2  },
	{ id="GetouSpirit",        name="Suguru Geto",   rarity="Legendary", damageMult=3.00, dropWeight=1  },
}

-- ============================================================
-- DAILY REWARDS  (7-day streak, loops after day 7)
-- ============================================================

GameData.DailyRewards = {
	{ day=1, type="trophies",  amount=500,   label="🏆 +500 Trophies",        emoji="🏆" },
	{ day=2, type="speed",     amount=5,     label="⚡ +5 Speed (session)",    emoji="⚡" },
	{ day=3, type="tool",      rarity="Uncommon", label="🗡️ Uncommon Cursed Tool",  emoji="🗡️" },
	{ day=4, type="trophies",  amount=5000,  label="🏆 +5,000 Trophies",       emoji="🏆" },
	{ day=5, type="hp",        amount=50,    label="❤️ +50 Max HP (session)",  emoji="❤️" },
	{ day=6, type="tool",      rarity="Rare",    label="🗡️ Rare Cursed Tool",       emoji="🗡️" },
	{ day=7, type="chest",     amount=25000, label="💜 Legendary Chest!",      emoji="💜" },
}

-- ============================================================
-- RARITY COLORS
-- ============================================================

GameData.RarityColors = {
	Uncommon  = Color3.fromRGB(80,  200, 80),
	Rare      = Color3.fromRGB(60,  120, 255),
	Epic      = Color3.fromRGB(160, 60,  255),
	Legendary = Color3.fromRGB(255, 165, 0),
}

-- ============================================================
-- HELPERS
-- ============================================================

function GameData.GetDomainById(id)
	for _, d in ipairs(GameData.Domains) do
		if d.id == id then return d end
	end
end

function GameData.GetSpiritById(id)
	for _, s in ipairs(GameData.Spirits) do
		if s.id == id then return s end
	end
end

-- Returns total damage multiplier from an equipped domain (1 if none)
function GameData.GetDomainMult(equippedDomainId)
	if not equippedDomainId then return 1 end
	local d = GameData.GetDomainById(equippedDomainId)
	return d and d.damageMult or 1
end

-- Returns total damage multiplier from equipped spirits
-- equippedUids: array of instance uids; spiritInstances: array of {spiritId, uid}
function GameData.GetSpiritsMult(equippedUids, spiritInstances)
	local bonus = 0
	for _, uid in ipairs(equippedUids or {}) do
		for _, inst in ipairs(spiritInstances or {}) do
			if inst.uid == uid then
				local sd = GameData.GetSpiritById(inst.spiritId)
				if sd then bonus = bonus + (sd.damageMult - 1) end
				break
			end
		end
	end
	return 1 + bonus
end

-- Weighted random spirit drop
function GameData.RollSpiritDrop()
	local totalWeight = 0
	for _, s in ipairs(GameData.Spirits) do totalWeight = totalWeight + s.dropWeight end
	local roll = math.random() * totalWeight
	local running = 0
	for _, s in ipairs(GameData.Spirits) do
		running = running + s.dropWeight
		if roll <= running then return s end
	end
	return GameData.Spirits[1]
end

function GameData.GetToolById(id)
	for _, t in ipairs(GameData.CursedTools) do
		if t.id == id then return t end
	end
end

function GameData.GetStageData(path, stageId)
	local s = GameData.Stages[path]
	return s and s[stageId]
end

function GameData.GetEnemiesForStage(path, stageId)
	local result = {}
	for _, e in ipairs(GameData.Enemies) do
		if e.forPath == path and stageId >= e.stageRange[1] and stageId <= e.stageRange[2] then
			table.insert(result, e)
		end
	end
	return result
end

function GameData.GetRebirthMultiplier(rebirthCount)
	local t = GameData.RebirthMultipliers
	return t[math.min(rebirthCount + 1, #t)]
end

return GameData
