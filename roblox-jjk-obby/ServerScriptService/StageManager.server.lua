-- StageManager.server.lua (Script → ServerScriptService)
-- Awards trophies + XP per kill; handles StageEndReached (teleport to stage location)

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameData          = require(ReplicatedStorage.Modules.GameData)

local function PDM()  return require(game.ServerScriptService.PlayerDataManager) end
local function TM()   return require(game.ServerScriptService.TrophyManager)     end

local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local TrophyUpdate    = RemoteEvents:WaitForChild("TrophyUpdate")
local StageEndReached = RemoteEvents:WaitForChild("StageEndReached")  -- client→server: (stageId)

local StageManager = {}

-- Called by EnemyManager when a player kills an enemy
function StageManager.RegisterKill(player)
	local data = PDM().Get(player)
	if not data or not data.path then return end

	local trophiesBase = GameData.TrophiesPerKill[data.stage] or 20
	TM().Award(player, trophiesBase)
end

-- Handle "StageEndReached" (player reached the end platform of a stage, OR pressed gate)
StageEndReached.OnServerEvent:Connect(function(player, stageId)
	local data = PDM().Get(player)
	if not data or not data.path then return end

	local targetLocationId
	if stageId == 0 then
		-- Gate entrance: teleport to current stage
		targetLocationId = math.min(data.stage, 7)
	else
		-- End-of-stage platform touched: teleport to next stage (or back to hub)
		if stageId >= data.stage then
			targetLocationId = math.min(stageId + 1, 7)
		else
			return  -- stale event from old stage
		end
	end

	local locationData = GameData.Locations[targetLocationId]
	if not locationData then return end

	local stagesF = workspace:FindFirstChild("Stages")
	local locF    = stagesF and stagesF:FindFirstChild(locationData.name)
	local spawn   = locF and locF:FindFirstChild("StageSpawn")
	if not spawn then return end

	local char = player.Character
	local hrp  = char and char:FindFirstChild("HumanoidRootPart")
	if hrp then
		hrp.CFrame = spawn.CFrame + Vector3.new(0, 3, 0)
	end
end)

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		-- Teleport to appropriate location after respawn
		task.wait(2)
		local data = PDM().Get(player)
		if not data or not data.path then return end
		local locationId = math.min(data.stage, 7)
		local locationData = GameData.Locations[locationId]
		if not locationData then return end
		local stagesF = workspace:FindFirstChild("Stages")
		local locF    = stagesF and stagesF:FindFirstChild(locationData.name)
		local spawn   = locF and locF:FindFirstChild("StageSpawn")
		if spawn then
			local char = player.Character
			local hrp  = char and char:FindFirstChild("HumanoidRootPart")
			if hrp then hrp.CFrame = spawn.CFrame + Vector3.new(0,3,0) end
		end
	end)
end)

return StageManager
