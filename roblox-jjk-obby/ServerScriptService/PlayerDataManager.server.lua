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
