-- PlayerDataManager.server.lua (Script → ServerScriptService)
-- Handles saving and loading player data via DataStoreService

local Players         = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local PlayerStore = DataStoreService:GetDataStore("JJKObblyPlayerData_v1")

local PlayerDataManager = {}
local cache = {}  -- userId → data table (live in-memory copy)

local DEFAULT_DATA = {
	path         = nil,   -- "Sorcerer" | "CurseSpirit" | nil (not chosen yet)
	stage        = 1,
	inventory    = {},    -- list of cursed tool ids
	completedAll = false, -- true once the player finishes stage 8
	switchCount  = 0,     -- how many times they've switched paths
}

local function deepCopy(t)
	local copy = {}
	for k, v in pairs(t) do
		copy[k] = (type(v) == "table") and deepCopy(v) or v
	end
	return copy
end

local function loadData(player)
	local key = "Player_" .. player.UserId
	local success, data = pcall(function()
		return PlayerStore:GetAsync(key)
	end)

	if success and data then
		-- Merge with defaults to handle missing keys from old saves
		local merged = deepCopy(DEFAULT_DATA)
		for k, v in pairs(data) do
			merged[k] = v
		end
		cache[player.UserId] = merged
	else
		cache[player.UserId] = deepCopy(DEFAULT_DATA)
	end
end

local function saveData(player)
	local data = cache[player.UserId]
	if not data then return end

	local key = "Player_" .. player.UserId
	local success, err = pcall(function()
		PlayerStore:SetAsync(key, data)
	end)

	if not success then
		warn("[PlayerDataManager] Failed to save data for " .. player.Name .. ": " .. tostring(err))
	end
end

-- Public: get the cached data table (mutate directly, then call Save)
function PlayerDataManager.Get(player)
	return cache[player.UserId]
end

function PlayerDataManager.Save(player)
	saveData(player)
end

function PlayerDataManager.AddToolToInventory(player, toolId)
	local data = cache[player.UserId]
	if not data then return false end

	-- No duplicates
	for _, id in ipairs(data.inventory) do
		if id == toolId then return false end
	end

	table.insert(data.inventory, toolId)
	saveData(player)
	return true
end

-- Auto-save every 60 seconds for each player
local function startAutoSave()
	while true do
		task.wait(60)
		for _, player in ipairs(Players:GetPlayers()) do
			if cache[player.UserId] then
				saveData(player)
			end
		end
	end
end

Players.PlayerAdded:Connect(function(player)
	loadData(player)
end)

Players.PlayerRemoving:Connect(function(player)
	saveData(player)
	cache[player.UserId] = nil
end)

-- Load data for players who joined before this script ran (Studio testing)
for _, player in ipairs(Players:GetPlayers()) do
	loadData(player)
end

task.spawn(startAutoSave)

return PlayerDataManager
