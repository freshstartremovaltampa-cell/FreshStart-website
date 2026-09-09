-- TrophyManager.server.lua (Script → ServerScriptService)
-- Awards trophies on kills; handles hub showcase "buy evolution stage" logic

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameData          = require(ReplicatedStorage.Modules.GameData)
local StatsCalculator   = require(ReplicatedStorage.Modules.StatsCalculator)

local function PDM()  return require(game.ServerScriptService.PlayerDataManager)     end
local function CMM()  return require(game.ServerScriptService.CharacterMorphManager) end

local RemoteEvents      = ReplicatedStorage:WaitForChild("RemoteEvents")
local TrophyUpdate      = RemoteEvents:WaitForChild("TrophyUpdate")      -- server→client: (trophies)
local StageEvolved      = RemoteEvents:WaitForChild("StageEvolved")      -- server→client: (newStage, stageData)
local UpdateStats       = RemoteEvents:WaitForChild("UpdateStats")       -- server→client: (stats)
local PathChanged       = RemoteEvents:WaitForChild("PathChanged")       -- server→client: (path, stage)
local BuyStageRequest   = RemoteEvents:WaitForChild("BuyStageRequest")  -- client→server: (targetStageId)
local DamageBoostRequest= RemoteEvents:WaitForChild("DamageBoostRequest")-- client→server: (boostIndex)

local TrophyManager = {}

-- Award trophies to a player (called by StageManager on kill)
function TrophyManager.Award(player, baseAmount)
	local data = PDM().Get(player)
	if not data then return end

	local rebirthMult  = GameData.GetRebirthMultiplier(data.rebirthCount)
	local vipMult      = data.hasVip and 2 or 1
	local timedMult    = (data.doubleTrophiesExpiry and os.time() < data.doubleTrophiesExpiry) and 2 or 1
	local total        = math.floor(baseAmount * rebirthMult * vipMult * timedMult)

	PDM().AddTrophies(player, total)
	PDM().AddXP(player, math.floor(total * 0.1))

	local updated = PDM().Get(player)
	TrophyUpdate:FireClient(player, updated.trophies, updated.level, updated.xp)
end

-- Handle client request to buy the next evolution stage
BuyStageRequest.OnServerEvent:Connect(function(player, targetStageId)
	local data = PDM().Get(player)
	if not data or not data.path then return end

	-- Must be buying the next stage exactly
	if targetStageId ~= data.stage + 1 then return end
	if targetStageId > 8 then return end

	local cost = GameData.TrophyStageCosts[targetStageId] or 0

	if not PDM().SpendTrophies(player, cost) then
		-- Not enough trophies — fire back a "denied" signal
		TrophyUpdate:FireClient(player, PDM().Get(player).trophies, data.level, data.xp)
		return
	end

	-- Advance stage
	data = PDM().Get(player)
	data.stage = targetStageId
	if data.stage >= 8 then data.completedAll = true end
	PDM().Save(player)

	local newStageData = GameData.GetStageData(data.path, data.stage)
	local stats        = StatsCalculator.GetFinalStats(data.path, data.stage, data.inventory)

	local char = player.Character
	if char then StatsCalculator.ApplyToCharacter(char, stats) end

	StageEvolved:FireClient(player, data.stage, newStageData)
	UpdateStats:FireClient(player, stats)
	PathChanged:FireClient(player, data.path, data.stage)
	TrophyUpdate:FireClient(player, data.trophies, data.level, data.xp)

	-- Teleport to next stage location
	local locationId    = math.min(data.stage, 7)
	local locationData  = GameData.Locations[locationId]
	if locationData then
		local stagesF = workspace:FindFirstChild("Stages")
		local locF    = stagesF and stagesF:FindFirstChild(locationData.name)
		local spawn   = locF and locF:FindFirstChild("StageSpawn")
		if spawn then
			local hrp = char and char:FindFirstChild("HumanoidRootPart")
			if hrp then hrp.CFrame = spawn.CFrame + Vector3.new(0,3,0) end
		end
	end

	-- Apply stage appearance (model swap if uploaded, else color + aura)
	-- Small delay so the teleport settles before any character swap occurs
	local evolvedPath  = data.path
	local evolvedStage = data.stage
	task.delay(0.5, function()
		CMM().applyStageAppearance(player, evolvedPath, evolvedStage)
	end)
end)

-- Handle damage boost button (temp multiplier)
DamageBoostRequest.OnServerEvent:Connect(function(player, boostIndex)
	local boost = GameData.DamageBoostButtons[boostIndex]
	if not boost then return end

	if not PDM().SpendTrophies(player, boost.trophyCost) then return end

	local data = PDM().Get(player)
	data.tempDamageMultiplier = (data.tempDamageMultiplier or 1) + boost.multiplier

	local stats = StatsCalculator.GetFinalStats(data.path, data.stage, data.inventory)
	stats.damage = math.floor(stats.damage * data.tempDamageMultiplier)

	local char = player.Character
	if char then StatsCalculator.ApplyToCharacter(char, stats) end
	UpdateStats:FireClient(player, stats)
	TrophyUpdate:FireClient(player, data.trophies, data.level, data.xp)
end)

return TrophyManager
