-- RebirthManager.server.lua (Script → ServerScriptService)
-- Handles rebirth: resets stage/trophies/level, keeps tools and perks

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameData          = require(ReplicatedStorage.Modules.GameData)
local StatsCalculator   = require(ReplicatedStorage.Modules.StatsCalculator)

local function PDM()  return require(game.ServerScriptService.PlayerDataManager) end

local RemoteEvents  = ReplicatedStorage:WaitForChild("RemoteEvents")
local RebirthRequest = RemoteEvents:WaitForChild("RebirthRequest")  -- client→server
local RebirthResult  = RemoteEvents:WaitForChild("RebirthResult")   -- server→client: (success, rebirthCount, mult)
local TrophyUpdate   = RemoteEvents:WaitForChild("TrophyUpdate")
local UpdateStats    = RemoteEvents:WaitForChild("UpdateStats")
local PathChanged    = RemoteEvents:WaitForChild("PathChanged")

RebirthRequest.OnServerEvent:Connect(function(player)
	local pdm  = PDM()
	local data = pdm.Get(player)
	if not data then return end

	if data.stage < 8 then
		RebirthResult:FireClient(player, false, data.rebirthCount, GameData.GetRebirthMultiplier(data.rebirthCount))
		return
	end

	local ok = pdm.DoRebirth(player)
	if not ok then
		RebirthResult:FireClient(player, false, data.rebirthCount, GameData.GetRebirthMultiplier(data.rebirthCount))
		return
	end

	data = pdm.Get(player)
	local mult = GameData.GetRebirthMultiplier(data.rebirthCount)

	-- Reapply stats for stage 1
	local stats = StatsCalculator.GetFinalStats(data.path, 1, data.inventory)
	local char  = player.Character
	if char then StatsCalculator.ApplyToCharacter(char, stats) end

	RebirthResult:FireClient(player, true, data.rebirthCount, mult)
	TrophyUpdate:FireClient(player, data.trophies, data.level, data.xp)
	UpdateStats:FireClient(player, stats)
	PathChanged:FireClient(player, data.path, data.stage)

	-- Teleport back to Stage 1 spawn
	local loc1   = GameData.Locations[1]
	local stagesF = workspace:FindFirstChild("Stages")
	local locF    = stagesF and stagesF:FindFirstChild(loc1.name)
	local spawn   = locF and locF:FindFirstChild("StageSpawn")
	if spawn and char then
		local hrp = char:FindFirstChild("HumanoidRootPart")
		if hrp then hrp.CFrame = spawn.CFrame + Vector3.new(0,3,0) end
	end
end)
