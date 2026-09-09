-- GameManager.server.lua (Script → ServerScriptService)
-- Entry point: sets up remote infrastructure and bootstraps all managers

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players           = game:GetService("Players")

-- ----------------------------------------------------------------
-- Create Remote Events / Functions folder structure if missing
-- (In production, create these manually in Studio for clarity)
-- ----------------------------------------------------------------

local function ensureFolder(parent, name)
	local f = parent:FindFirstChild(name)
	if not f then
		f = Instance.new("Folder")
		f.Name   = name
		f.Parent = parent
	end
	return f
end

local function ensureRemoteEvent(parent, name)
	local r = parent:FindFirstChild(name)
	if not r then
		r = Instance.new("RemoteEvent")
		r.Name   = name
		r.Parent = parent
	end
	return r
end

local function ensureRemoteFunction(parent, name)
	local r = parent:FindFirstChild(name)
	if not r then
		r = Instance.new("RemoteFunction")
		r.Name   = name
		r.Parent = parent
	end
	return r
end

local eventsFolder    = ensureFolder(ReplicatedStorage, "RemoteEvents")
local functionsFolder = ensureFolder(ReplicatedStorage, "RemoteFunctions")

-- Remote Events
ensureRemoteEvent(eventsFolder, "SelectPath")
ensureRemoteEvent(eventsFolder, "SwitchPath")
ensureRemoteEvent(eventsFolder, "StageComplete")
ensureRemoteEvent(eventsFolder, "UpdateStats")
ensureRemoteEvent(eventsFolder, "PathChanged")
ensureRemoteEvent(eventsFolder, "EnemyKilled")
ensureRemoteEvent(eventsFolder, "InventoryUpdate")

-- Remote Functions
ensureRemoteFunction(functionsFolder, "GetInventory")
ensureRemoteFunction(functionsFolder, "GetPlayerData")

-- ----------------------------------------------------------------
-- GetPlayerData remote function (used by client GUI on join)
-- ----------------------------------------------------------------

local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")
local GetPlayerData   = RemoteFunctions:WaitForChild("GetPlayerData")

local function getPlayerDataManager()
	return require(game.ServerScriptService.PlayerDataManager)
end

GetPlayerData.OnServerInvoke = function(player)
	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data then return nil end

	-- Return a safe copy (no direct reference to live table)
	return {
		path         = data.path,
		stage        = data.stage,
		inventory    = data.inventory,
		completedAll = data.completedAll,
		switchCount  = data.switchCount,
	}
end

-- ----------------------------------------------------------------
-- Ensure Stages folder exists in Workspace for map organisation
-- ----------------------------------------------------------------

if not workspace:FindFirstChild("Stages") then
	local stagesFolder   = Instance.new("Folder")
	stagesFolder.Name    = "Stages"
	stagesFolder.Parent  = workspace
end

print("[GameManager] JJK Obby server initialised.")
