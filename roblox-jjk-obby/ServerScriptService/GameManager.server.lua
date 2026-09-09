-- GameManager.server.lua (Script → ServerScriptService)
-- Creates all Remote Events/Functions and wires GetPlayerData

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players           = game:GetService("Players")

local function folder(parent, name)
	return parent:FindFirstChild(name) or (function()
		local f = Instance.new("Folder"); f.Name=name; f.Parent=parent; return f
	end)()
end
local function re(parent, name)
	return parent:FindFirstChild(name) or (function()
		local r = Instance.new("RemoteEvent"); r.Name=name; r.Parent=parent; return r
	end)()
end
local function rf(parent, name)
	return parent:FindFirstChild(name) or (function()
		local r = Instance.new("RemoteFunction"); r.Name=name; r.Parent=parent; return r
	end)()
end

local ev = folder(ReplicatedStorage, "RemoteEvents")
local fn = folder(ReplicatedStorage, "RemoteFunctions")

-- Events
for _, name in ipairs({
	"SelectPath","SwitchPath","StageEvolved","UpdateStats","PathChanged",
	"EnemyKilled","InventoryUpdate","TrophyUpdate","RebirthRequest",
	"RebirthResult","BuyStageRequest","DamageBoostRequest","StageEndReached",
}) do re(ev, name) end

-- Functions
for _, name in ipairs({"GetPlayerData","GetInventory"}) do rf(fn, name) end

-- Ensure Stages folder exists before builders run
if not workspace:FindFirstChild("Stages") then
	local f = Instance.new("Folder"); f.Name="Stages"; f.Parent=workspace
end

-- GetPlayerData remote function
local GetPlayerData = fn:WaitForChild("GetPlayerData")
local GetInventory  = fn:WaitForChild("GetInventory")

local function PDM() return require(game.ServerScriptService.PlayerDataManager) end

GetPlayerData.OnServerInvoke = function(player)
	local data = PDM().Get(player)
	if not data then return nil end
	return {
		path         = data.path,
		stage        = data.stage,
		inventory    = data.inventory,
		completedAll = data.completedAll,
		switchCount  = data.switchCount,
		trophies     = data.trophies,
		level        = data.level,
		xp           = data.xp,
		rebirthCount = data.rebirthCount,
		hasAutoFight = data.hasAutoFight,
	}
end

GetInventory.OnServerInvoke = function(player)
	local data = PDM().Get(player)
	return data and data.inventory or {}
end

print("[GameManager] JJK Obby server ready.")
