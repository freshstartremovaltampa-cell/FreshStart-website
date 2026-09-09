-- StageManager.server.lua (Script → ServerScriptService)
-- Teleports players to their current arena on spawn.
-- RegisterKill is kept as a passthrough for any external callers.

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameData          = require(ReplicatedStorage.Modules.GameData)

local function PDM() return require(game.ServerScriptService.PlayerDataManager) end
local function TM()  return require(game.ServerScriptService.TrophyManager)     end

local StageManager = {}

function StageManager.RegisterKill(player)
	local data = PDM().Get(player)
	if not data or not data.path then return end
	local base = GameData.TrophiesPerKill[data.stage] or 20
	TM().Award(player, base)
end

local function teleportToCurrentStage(player)
	local data = PDM().Get(player)
	if not data or not data.path then return end

	local locData = GameData.Locations[math.min(data.stage, 7)]
	if not locData then return end

	local stagesF = workspace:FindFirstChild("Stages")
	local locF    = stagesF and stagesF:FindFirstChild(locData.name)
	local spawn   = locF and locF:FindFirstChild("StageSpawn")
	if not spawn then return end

	local char = player.Character
	local hrp  = char and char:FindFirstChild("HumanoidRootPart")
	if hrp then hrp.CFrame = spawn.CFrame + Vector3.new(0, 3, 0) end
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		task.wait(2)
		teleportToCurrentStage(player)
	end)
end)

-- Player activates the hub gate → teleport them to their current stage arena
local RemoteEvents = ReplicatedStorage:WaitForChild("RemoteEvents")
local EnterStages  = RemoteEvents:WaitForChild("EnterStages")
EnterStages.OnServerEvent:Connect(function(player)
	local data = PDM().Get(player)
	if not data or not data.path then return end
	teleportToCurrentStage(player)
end)

return StageManager
