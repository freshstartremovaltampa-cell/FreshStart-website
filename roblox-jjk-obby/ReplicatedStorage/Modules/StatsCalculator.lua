-- StatsCalculator.lua (ModuleScript → ReplicatedStorage/Modules/StatsCalculator)
-- Computes a player's final stats from their stage base + all equipped tool boosts

local GameData = require(script.Parent.GameData)

local StatsCalculator = {}

-- Returns the final combined stats for a player given their path, stageId, and inventory
function StatsCalculator.GetFinalStats(path, stageId, inventory)
	local base = GameData.GetStageData(path, stageId)
	if not base then
		return { health = 100, speed = 16, damage = 10 }
	end

	local finalHealth = base.health
	local finalSpeed  = base.speed
	local finalDamage = base.damage

	for _, toolId in ipairs(inventory) do
		local tool = GameData.GetToolById(toolId)
		if tool then
			finalHealth = finalHealth + tool.statBoost.health
			finalSpeed  = finalSpeed  + tool.statBoost.speed
			finalDamage = finalDamage + tool.statBoost.damage
		end
	end

	return {
		health = finalHealth,
		speed  = finalSpeed,
		damage = finalDamage,
	}
end

-- Convenience wrapper: pass the full player data table
function StatsCalculator.GetPlayerStats(data)
	local stats = StatsCalculator.GetFinalStats(data.path, data.stage, data.inventory)
	local domainMult  = GameData.GetDomainMult(data.equippedDomain)
	local spiritMult  = GameData.GetSpiritsMult(data.equippedSpirits, data.spirits)
	stats.damage = math.round(stats.damage * domainMult * spiritMult)
	return stats
end

-- Applies stats to an actual Roblox character model
function StatsCalculator.ApplyToCharacter(character, stats)
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid then return end

	humanoid.MaxHealth = stats.health
	humanoid.Health    = stats.health
	humanoid.WalkSpeed = stats.speed
end

return StatsCalculator
