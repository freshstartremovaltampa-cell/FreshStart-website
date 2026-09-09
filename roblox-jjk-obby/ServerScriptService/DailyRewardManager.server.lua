-- DailyRewardManager.server.lua (Script → ServerScriptService)
-- Handles 7-day daily login reward claims.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameData = require(ReplicatedStorage.Modules.GameData)

local function PDM() return require(game.ServerScriptService.PlayerDataManager) end
local function TM()  return require(game.ServerScriptService.TrophyManager)     end
local function CTM() return require(game.ServerScriptService.CursedToolManager) end

local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")
local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")

local ClaimDailyReward  = RemoteFunctions:WaitForChild("ClaimDailyReward")
local GetDailyStatus    = RemoteFunctions:WaitForChild("GetDailyStatus")
local DailyRewardClaimed = RemoteEvents:WaitForChild("DailyRewardClaimed")

local function giveReward(player, reward)
	if reward.type == "trophies" then
		TM().Award(player, reward.amount)

	elseif reward.type == "speed" then
		local data = PDM().Get(player)
		if data then
			-- session-only speed buff: tag it on data, apply to character
			data.tempSpeedBonus = (data.tempSpeedBonus or 0) + reward.amount
			local char = player.Character
			local hum  = char and char:FindFirstChildOfClass("Humanoid")
			if hum then hum.WalkSpeed = hum.WalkSpeed + reward.amount end
		end

	elseif reward.type == "hp" then
		local char = player.Character
		local hum  = char and char:FindFirstChildOfClass("Humanoid")
		if hum then
			hum.MaxHealth = hum.MaxHealth + reward.amount
			hum.Health    = hum.Health    + reward.amount
		end

	elseif reward.type == "tool" then
		-- Give a random tool of the specified rarity
		local pool = {}
		for _, t in ipairs(GameData.CursedTools) do
			if t.rarity == reward.rarity then table.insert(pool, t) end
		end
		if #pool > 0 then
			local chosen = pool[math.random(1, #pool)]
			CTM().GiveTool(player, chosen.id)
		end

	elseif reward.type == "chest" then
		-- Trophies + random rare-or-better tool
		TM().Award(player, reward.amount)
		local pool = {}
		for _, t in ipairs(GameData.CursedTools) do
			if t.rarity == "Rare" or t.rarity == "Epic" or t.rarity == "Legendary" then
				table.insert(pool, t)
			end
		end
		if #pool > 0 then
			CTM().GiveTool(player, pool[math.random(1, #pool)].id)
		end
	end
end

ClaimDailyReward.OnServerInvoke = function(player)
	local result = PDM().ClaimDaily(player)
	if result.ok then
		giveReward(player, result.reward)
		DailyRewardClaimed:FireClient(player, result.reward, result.streak)
		return { ok=true, reward=result.reward, streak=result.streak }
	else
		return { ok=false, wait=result.wait }
	end
end

GetDailyStatus.OnServerInvoke = function(player)
	local data = PDM().Get(player)
	if not data then return nil end
	local now     = os.time()
	local elapsed = now - data.lastDailyReward
	local canClaim = elapsed >= 86400
	local streak   = data.dailyStreak
	-- predict which day will be claimed next
	local nextDay  = (streak % 7) + 1
	return {
		streak    = streak,
		canClaim  = canClaim,
		nextDay   = nextDay,
		waitSecs  = canClaim and 0 or (86400 - elapsed),
		rewards   = GameData.DailyRewards,
	}
end
