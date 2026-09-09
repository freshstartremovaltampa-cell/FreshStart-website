-- CursedToolManager.server.lua (Script → ServerScriptService)
-- Manages cursed tool inventory: giving tools and reapplying stats

local ReplicatedStorage  = game:GetService("ReplicatedStorage")
local GameData           = require(ReplicatedStorage.Modules.GameData)
local StatsCalculator    = require(ReplicatedStorage.Modules.StatsCalculator)

local function getPlayerDataManager()
	return require(game.ServerScriptService.PlayerDataManager)
end

local RemoteEvents   = ReplicatedStorage:WaitForChild("RemoteEvents")
local UpdateStats    = RemoteEvents:WaitForChild("UpdateStats")
local InventoryUpdate = RemoteEvents:WaitForChild("InventoryUpdate")  -- server → client: (inventory table)

local CursedToolManager = {}

-- Gives a tool to a player, applies stat boost, and notifies client
-- Returns true if the tool was new, false if they already had it
function CursedToolManager.GiveTool(player, toolId)
	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data or not data.path then return false end

	local added = PDM.AddToolToInventory(player, toolId)
	if not added then return false end  -- already owned

	-- Recompute and apply stats
	local stats = StatsCalculator.GetFinalStats(data.path, data.stage, data.inventory)
	local char  = player.Character
	if char then
		StatsCalculator.ApplyToCharacter(char, stats)
	end

	UpdateStats:FireClient(player, stats)
	InventoryUpdate:FireClient(player, data.inventory)
	return true
end

-- Called by client to request their current inventory on join
local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")
local GetInventory    = RemoteFunctions:WaitForChild("GetInventory")

GetInventory.OnServerInvoke = function(player)
	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data then return {} end
	return data.inventory
end

return CursedToolManager
