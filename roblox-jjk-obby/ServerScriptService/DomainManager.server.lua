-- DomainManager.server.lua (Script → ServerScriptService)
-- Handles buying and equipping Domain Expansions (Auras).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameData  = require(ReplicatedStorage.Modules.GameData)
local StatsCalc = require(ReplicatedStorage.Modules.StatsCalculator)

local function PDM() return require(game.ServerScriptService.PlayerDataManager) end

local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")

local BuyDomain    = RemoteEvents:WaitForChild("BuyDomain")
local EquipDomain  = RemoteEvents:WaitForChild("EquipDomain")
local GetDomainsData = RemoteFunctions:WaitForChild("GetDomainsData")
local UpdateStats  = RemoteEvents:WaitForChild("UpdateStats")
local TrophyUpdate = RemoteEvents:WaitForChild("TrophyUpdate")

local function reapplyStats(player)
	local data = PDM().Get(player)
	if not data or not data.path then return end
	local stats = StatsCalc.GetPlayerStats(data)
	if data.hasDoubleDamage then stats.damage = stats.damage * 2 end
	if data.hasSpeedBoost   then stats.speed  = stats.speed  + 5  end
	stats.damage = math.round(stats.damage * (data.tempDamageMultiplier or 1)
		* (data.hasVip and 2 or 1)
		* GameData.GetRebirthMultiplier(data.rebirthCount))
	local char = player.Character
	if char then StatsCalc.ApplyToCharacter(char, stats) end
	UpdateStats:FireClient(player, stats)
	TrophyUpdate:FireClient(player, data.trophies, data.level, data.xp)
end

BuyDomain.OnServerEvent:Connect(function(player, domainId)
	local ok, reason = PDM().BuyDomain(player, domainId)
	if not ok then
		warn("[DomainManager] Buy failed for", player.Name, ":", reason)
		return
	end
	-- Auto-equip if it's their first domain or better than current
	local data = PDM().Get(player)
	if not data.equippedDomain then
		PDM().EquipDomain(player, domainId)
	end
	reapplyStats(player)
	-- Refresh client domain list
	GetDomainsData.OnServerInvoke(player)
end)

EquipDomain.OnServerEvent:Connect(function(player, domainId)
	PDM().EquipDomain(player, domainId)
	reapplyStats(player)
end)

GetDomainsData.OnServerInvoke = function(player)
	local data = PDM().Get(player)
	if not data then return nil end
	return {
		domains       = GameData.Domains,
		ownedDomains  = data.ownedDomains,
		equippedDomain = data.equippedDomain,
		trophies      = data.trophies,
		rebirthCount  = data.rebirthCount,
	}
end
