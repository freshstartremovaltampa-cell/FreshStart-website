-- StageManager.server.lua (Script → ServerScriptService)
-- Manages stage progression: tracks kills, grants evolution, teleports players

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameData          = require(ReplicatedStorage.Modules.GameData)
local StatsCalculator   = require(ReplicatedStorage.Modules.StatsCalculator)

local function getPlayerDataManager()
	return require(game.ServerScriptService.PlayerDataManager)
end

local RemoteEvents      = ReplicatedStorage:WaitForChild("RemoteEvents")
local StageComplete     = RemoteEvents:WaitForChild("StageComplete")   -- server → client: (newStage, stageData)
local UpdateStats       = RemoteEvents:WaitForChild("UpdateStats")     -- server → client: (stats)
local PathChanged       = RemoteEvents:WaitForChild("PathChanged")     -- server → client: (path, stage)

-- killsNeeded[stageId] = number of enemies required to clear that stage
local KILLS_NEEDED = { 5, 8, 10, 12, 15, 15, 20, 25 }

-- Per-player kill tracking (resets each stage)
local killCounts = {}  -- [userId] = number

-- Called by EnemyManager when a player kills an enemy
local StageManager = {}

function StageManager.RegisterKill(player)
	local userId = player.UserId
	killCounts[userId] = (killCounts[userId] or 0) + 1

	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data or not data.path then return end

	local needed = KILLS_NEEDED[data.stage] or 10

	if killCounts[userId] >= needed then
		killCounts[userId] = 0
		StageManager.AdvanceStage(player)
	end
end

function StageManager.AdvanceStage(player)
	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data or not data.path then return end

	if data.stage >= 8 then
		-- Already at final stage
		data.completedAll = true
		PDM.Save(player)
		return
	end

	data.stage = data.stage + 1

	if data.stage >= 8 then
		data.completedAll = true
	end

	PDM.Save(player)

	local newStageData = GameData.GetStageData(data.path, data.stage)
	local stats        = StatsCalculator.GetFinalStats(data.path, data.stage, data.inventory)

	-- Apply new stats to character
	local char = player.Character
	if char then
		StatsCalculator.ApplyToCharacter(char, stats)
	end

	-- Notify client of evolution and new stats
	StageComplete:FireClient(player, data.stage, newStageData)
	UpdateStats:FireClient(player, stats)
	PathChanged:FireClient(player, data.path, data.stage)

	-- Teleport to the next location's spawn (Stage maps to Location id = stage - 1, capped at 7)
	local locationId = math.min(data.stage, 7)
	StageManager.TeleportToLocation(player, locationId)
end

function StageManager.TeleportToLocation(player, locationId)
	local locationData = GameData.Locations[locationId]
	if not locationData then return end

	-- Expects a Folder named "Stages" in Workspace, with child Folders named by location name,
	-- each containing a SpawnPoint Part named "StageSpawn"
	local stagesFolder = workspace:FindFirstChild("Stages")
	if not stagesFolder then return end

	local locationFolder = stagesFolder:FindFirstChild(locationData.name)
	if not locationFolder then return end

	local spawnPart = locationFolder:FindFirstChild("StageSpawn")
	if not spawnPart then return end

	local char = player.Character
	if not char then return end

	local hrp = char:FindFirstChild("HumanoidRootPart")
	if hrp then
		hrp.CFrame = spawnPart.CFrame + Vector3.new(0, 3, 0)
	end
end

-- Reset kill count when player respawns or joins
Players.PlayerAdded:Connect(function(player)
	killCounts[player.UserId] = 0
	player.CharacterAdded:Connect(function()
		killCounts[player.UserId] = 0
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	killCounts[player.UserId] = nil
end)

return StageManager
