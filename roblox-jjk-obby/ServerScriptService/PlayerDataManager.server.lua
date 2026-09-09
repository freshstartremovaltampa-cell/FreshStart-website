-- PlayerDataManager.server.lua (Script → ServerScriptService)

local Players          = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local PlayerStore = DataStoreService:GetDataStore("JJKObbyPlayerData_v2")

local PlayerDataManager = {}
local cache = {}

local DEFAULT_DATA = {
	-- path & evolution
	path            = nil,
	stage           = 1,
	completedAll    = false,
	switchCount     = 0,
	-- currency
	trophies        = 0,
	-- progression
	level           = 1,
	xp              = 0,
	-- rebirth
	rebirthCount    = 0,
	-- inventory (cursed tools - NEVER reset on rebirth)
	inventory       = {},
	-- purchased perks (permanent, survive rebirth)
	hasDoubleDamage = false,
	hasSpeedBoost   = false,
	hasVip          = false,
	hasAutoFight    = false,
	-- session boosts (reset on join, not saved)
	tempDamageMultiplier = 1,
	-- daily reward
	lastDailyReward = 0,    -- os.time() of last successful claim
	dailyStreak     = 0,    -- 1-7; 0 = never claimed
	-- domains (auras)
	ownedDomains    = {},   -- array of domain id strings
	equippedDomain  = nil,
	-- spirits (pets)
	spirits         = {},   -- array of { spiritId=string, uid=number }
	spiritNextUid   = 1,
	equippedSpirits = {},   -- array of up to 4 spirit instance uids
}

local XP_PER_LEVEL = 1000  -- flat for now; can curve later

local function deepCopy(t)
	local c = {}
	for k, v in pairs(t) do c[k] = (type(v)=="table") and deepCopy(v) or v end
	return c
end

local function load(player)
	local ok, data = pcall(function()
		return PlayerStore:GetAsync("Player_"..player.UserId)
	end)
	if ok and data then
		local merged = deepCopy(DEFAULT_DATA)
		for k, v in pairs(data) do merged[k] = v end
		merged.tempDamageMultiplier = 1  -- never persist session-only
		cache[player.UserId] = merged
	else
		cache[player.UserId] = deepCopy(DEFAULT_DATA)
	end
end

local function save(player)
	local data = cache[player.UserId]
	if not data then return end
	-- strip session-only fields before saving
	local toSave = deepCopy(data)
	toSave.tempDamageMultiplier = nil
	pcall(function()
		PlayerStore:SetAsync("Player_"..player.UserId, toSave)
	end)
end

function PlayerDataManager.Get(player)
	return cache[player.UserId]
end

function PlayerDataManager.Save(player)
	save(player)
end

function PlayerDataManager.AddToolToInventory(player, toolId)
	local data = cache[player.UserId]
	if not data then return false end
	for _, id in ipairs(data.inventory) do
		if id == toolId then return false end
	end
	table.insert(data.inventory, toolId)
	save(player)
	return true
end

function PlayerDataManager.AddTrophies(player, amount)
	local data = cache[player.UserId]
	if not data then return end
	data.trophies = data.trophies + amount
	save(player)
end

function PlayerDataManager.SpendTrophies(player, amount)
	local data = cache[player.UserId]
	if not data then return false end
	if data.trophies < amount then return false end
	data.trophies = data.trophies - amount
	save(player)
	return true
end

function PlayerDataManager.AddXP(player, amount)
	local data = cache[player.UserId]
	if not data then return end
	data.xp = data.xp + amount
	while data.xp >= XP_PER_LEVEL do
		data.xp    = data.xp - XP_PER_LEVEL
		data.level = data.level + 1
	end
	save(player)
end

function PlayerDataManager.XpNeeded()
	return XP_PER_LEVEL
end

-- ---- Daily reward ----
-- Returns { ok=bool, reward=DailyReward, streak=N } or { ok=false, wait=seconds }
function PlayerDataManager.ClaimDaily(player)
	local data = cache[player.UserId]
	if not data then return { ok=false } end
	local now = os.time()
	local elapsed = now - data.lastDailyReward
	if elapsed < 86400 then
		return { ok=false, wait=86400 - elapsed }
	end
	-- streak expires if more than 48 hours have passed
	if elapsed >= 172800 then data.dailyStreak = 0 end
	data.dailyStreak    = (data.dailyStreak % 7) + 1
	data.lastDailyReward = now
	save(player)
	local GameData = require(game.ReplicatedStorage.Modules.GameData)
	return { ok=true, reward=GameData.DailyRewards[data.dailyStreak], streak=data.dailyStreak }
end

-- ---- Domains ----
function PlayerDataManager.BuyDomain(player, domainId)
	local data = cache[player.UserId]
	if not data then return false, "no data" end
	local GameData = require(game.ReplicatedStorage.Modules.GameData)
	local domain = GameData.GetDomainById(domainId)
	if not domain then return false, "unknown domain" end
	for _, id in ipairs(data.ownedDomains) do
		if id == domainId then return false, "already owned" end
	end
	if data.rebirthCount < domain.rebirthReq then return false, "need "..domain.rebirthReq.." rebirths" end
	if data.trophies < domain.trophyCost then return false, "not enough trophies" end
	data.trophies = data.trophies - domain.trophyCost
	table.insert(data.ownedDomains, domainId)
	save(player)
	return true
end

function PlayerDataManager.EquipDomain(player, domainId)
	local data = cache[player.UserId]
	if not data then return false end
	if domainId == nil then data.equippedDomain = nil save(player) return true end
	for _, id in ipairs(data.ownedDomains) do
		if id == domainId then
			data.equippedDomain = domainId
			save(player)
			return true
		end
	end
	return false
end

-- ---- Spirits ----
local MAX_SPIRITS    = 100
local MAX_EQUIPPED   = 4

function PlayerDataManager.AddSpirit(player, spiritId)
	local data = cache[player.UserId]
	if not data then return false end
	if #data.spirits >= MAX_SPIRITS then return false end
	local uid = data.spiritNextUid
	data.spiritNextUid = uid + 1
	table.insert(data.spirits, { spiritId=spiritId, uid=uid })
	save(player)
	return uid
end

function PlayerDataManager.RemoveSpirit(player, instanceUid)
	local data = cache[player.UserId]
	if not data then return false end
	for i, inst in ipairs(data.spirits) do
		if inst.uid == instanceUid then
			table.remove(data.spirits, i)
			-- unequip if equipped
			for j, uid in ipairs(data.equippedSpirits) do
				if uid == instanceUid then table.remove(data.equippedSpirits, j) break end
			end
			save(player)
			return true
		end
	end
	return false
end

function PlayerDataManager.EquipSpirit(player, instanceUid)
	local data = cache[player.UserId]
	if not data then return false end
	-- check already equipped
	for _, uid in ipairs(data.equippedSpirits) do
		if uid == instanceUid then return true end
	end
	-- check owned
	local owned = false
	for _, inst in ipairs(data.spirits) do
		if inst.uid == instanceUid then owned=true break end
	end
	if not owned then return false end
	if #data.equippedSpirits >= MAX_EQUIPPED then
		table.remove(data.equippedSpirits, 1)  -- drop oldest
	end
	table.insert(data.equippedSpirits, instanceUid)
	save(player)
	return true
end

function PlayerDataManager.UnequipSpirit(player, instanceUid)
	local data = cache[player.UserId]
	if not data then return false end
	for i, uid in ipairs(data.equippedSpirits) do
		if uid == instanceUid then table.remove(data.equippedSpirits, i) save(player) return true end
	end
	return false
end

function PlayerDataManager.UnequipAllSpirits(player)
	local data = cache[player.UserId]
	if not data then return end
	data.equippedSpirits = {}
	save(player)
end

-- ---- EquipBestSpirits: auto-equip the 4 highest damageMult spirits ----
function PlayerDataManager.EquipBestSpirits(player)
	local data = cache[player.UserId]
	if not data then return end
	local GameData = require(game.ReplicatedStorage.Modules.GameData)
	local sorted = {}
	for _, inst in ipairs(data.spirits) do
		local sd = GameData.GetSpiritById(inst.spiritId)
		table.insert(sorted, { uid=inst.uid, mult=sd and sd.damageMult or 1 })
	end
	table.sort(sorted, function(a,b) return a.mult > b.mult end)
	data.equippedSpirits = {}
	for i = 1, math.min(MAX_EQUIPPED, #sorted) do
		table.insert(data.equippedSpirits, sorted[i].uid)
	end
	save(player)
end

-- Reset everything except inventory and permanent perks
function PlayerDataManager.DoRebirth(player)
	local data = cache[player.UserId]
	if not data then return false end
	if data.stage < 8 then return false end

	data.stage           = 1
	data.trophies        = 0
	data.level           = 1
	data.xp              = 0
	data.completedAll    = false
	data.rebirthCount    = data.rebirthCount + 1
	data.tempDamageMultiplier = 1
	-- inventory, path, perks are kept
	save(player)
	return true
end

Players.PlayerAdded:Connect(function(p)
	load(p)
	p.CharacterAdded:Connect(function() end)
end)

Players.PlayerRemoving:Connect(function(p)
	save(p)
	cache[p.UserId] = nil
end)

for _, p in ipairs(Players:GetPlayers()) do load(p) end

task.spawn(function()
	while true do
		task.wait(60)
		for _, p in ipairs(Players:GetPlayers()) do
			if cache[p.UserId] then save(p) end
		end
	end
end)

return PlayerDataManager
