-- AttackManager.server.lua (Script → ServerScriptService)
-- Handles AttackRequest from clients: validates cooldown, finds enemies in range,
-- and applies damage based on the player's fully-calculated stats + perks.

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local StatsCalculator = require(ReplicatedStorage.Modules.StatsCalculator)
local function PDM()  return require(game.ServerScriptService.PlayerDataManager) end

local ATTACK_RANGE   = 14   -- studs radius around HumanoidRootPart
local MAX_TARGETS    = 5    -- enemies hit per swing (prevents one-tap wave clear)
local COOLDOWN       = 0.55 -- seconds; mirrors client value

local lastAttack = {}  -- [userId] = tick()

local AttackRequest = ReplicatedStorage:WaitForChild("RemoteEvents"):WaitForChild("AttackRequest")

AttackRequest.OnServerEvent:Connect(function(player)
	local uid = player.UserId
	local now = tick()

	-- Server-side rate limit (cheap exploit guard)
	if (lastAttack[uid] or 0) + COOLDOWN > now then return end
	lastAttack[uid] = now

	local char = player.Character
	local hrp  = char and char:FindFirstChild("HumanoidRootPart")
	if not hrp then return end

	local data = PDM().Get(player)
	if not data or not data.path then return end

	-- Full damage: base stats × domain/spirit mult × permanent perks × temp boost
	local stats = StatsCalculator.GetPlayerStats(data)
	local dmg   = stats.damage
	if data.hasDoubleDamage then dmg = dmg * 2 end
	if data.hasVip          then dmg = dmg * 2 end
	dmg = math.max(1, math.round(dmg * (data.tempDamageMultiplier or 1)))

	-- Sweep workspace for enemy models in range
	local origin = hrp.Position
	local hits   = 0

	for _, obj in ipairs(workspace:GetChildren()) do
		if hits >= MAX_TARGETS then break end
		if obj:IsA("Model") and obj ~= char then
			local eHrp = obj:FindFirstChild("HumanoidRootPart")
			local eHum = obj:FindFirstChildOfClass("Humanoid")
			if eHrp and eHum and eHum.Health > 0 then
				if (eHrp.Position - origin).Magnitude <= ATTACK_RANGE then
					eHum:TakeDamage(dmg)
					hits += 1
				end
			end
		end
	end
end)

Players.PlayerRemoving:Connect(function(p)
	lastAttack[p.UserId] = nil
end)
