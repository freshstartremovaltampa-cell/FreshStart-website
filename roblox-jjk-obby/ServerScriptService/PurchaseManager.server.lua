-- PurchaseManager.server.lua (Script → ServerScriptService)
-- Single ProcessReceipt handler covering every Developer Product in the game.
-- PathManager no longer sets ProcessReceipt — all receipt logic lives here.
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  HOW TO CONFIGURE PRODUCT IDs                               │
-- │  1. Go to create.roblox.com → your game                    │
-- │  2. Click Monetization → Developer Products                 │
-- │  3. Create one product per item below with matching name    │
-- │  4. Copy each numeric ID Roblox assigns                     │
-- │  5. Paste it into GameData.Products in GameData.lua         │
-- │     replacing the 0 placeholder for that product            │
-- └─────────────────────────────────────────────────────────────┘

local Players            = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage  = game:GetService("ReplicatedStorage")

local GameData = require(ReplicatedStorage.Modules.GameData)

local function PDM() return require(game.ServerScriptService.PlayerDataManager) end
local function TM()  return require(game.ServerScriptService.TrophyManager)     end

local RemoteEvents = ReplicatedStorage:WaitForChild("RemoteEvents")
local UpdateStats  = RemoteEvents:WaitForChild("UpdateStats")
local PathChanged  = RemoteEvents:WaitForChild("PathChanged")

-- ── Receipt handlers (keyed by productId at startup) ─────────────────────

local HANDLERS = {}  -- [productId] = function(player) → boolean

local function register(productKey, handler)
	local prod = GameData.Products[productKey]
	if prod and prod.productId ~= 0 then
		HANDLERS[prod.productId] = handler
	end
end

-- Path switch
register("EarlyPathSwitch", function(player)
	local data = PDM().Get(player)
	if not data or not data.path then return false end
	data.path        = (data.path == "Sorcerer") and "CurseSpirit" or "Sorcerer"
	data.stage       = 1
	data.switchCount = data.switchCount + 1
	PDM().Save(player)
	PathChanged:FireClient(player, data.path, data.stage)
	return true
end)

-- Trophy packs (award directly — TM.Award applies rebirth/VIP multipliers)
register("Trophies1k",  function(p) TM().Award(p, 1000)  return true end)
register("Trophies5k",  function(p) TM().Award(p, 5000)  return true end)
register("Trophies25k", function(p) TM().Award(p, 25000) return true end)

-- 2× Trophies for 1 hour (stored as expiry timestamp)
register("DoubleTrophies1h", function(player)
	local data = PDM().Get(player)
	if not data then return false end
	local existing = data.doubleTrophiesExpiry or 0
	-- Stack with remaining time if already active
	data.doubleTrophiesExpiry = math.max(existing, os.time()) + 3600
	PDM().Save(player)
	return true
end)

-- Permanent: double damage
register("DoubleDamage", function(player)
	local data = PDM().Get(player)
	if not data then return false end
	if data.hasDoubleDamage then return true end  -- already owned, still grant
	data.hasDoubleDamage = true
	PDM().Save(player)
	local StatsCalculator = require(ReplicatedStorage.Modules.StatsCalculator)
	local stats = StatsCalculator.GetFinalStats(data.path, data.stage, data.inventory)
	stats.damage = math.floor(stats.damage * 2)
	local char = player.Character
	if char then StatsCalculator.ApplyToCharacter(char, stats) end
	UpdateStats:FireClient(player, stats)
	return true
end)

-- Permanent: +5 walkspeed
register("SpeedBoost", function(player)
	local data = PDM().Get(player)
	if not data then return false end
	data.hasSpeedBoost = true
	PDM().Save(player)
	local char = player.Character
	local hum  = char and char:FindFirstChild("Humanoid")
	if hum then hum.WalkSpeed = hum.WalkSpeed + 5 end
	return true
end)

-- Permanent: VIP (2× trophies + 2× damage handled in TrophyManager/StatsCalculator)
register("VipPass", function(player)
	local data = PDM().Get(player)
	if not data then return false end
	data.hasVip = true
	PDM().Save(player)
	return true
end)

-- Permanent: Auto-fight flag (EnemyManager checks this)
register("AutoFight", function(player)
	local data = PDM().Get(player)
	if not data then return false end
	data.hasAutoFight = true
	PDM().Save(player)
	return true
end)

-- ── ProcessReceipt ────────────────────────────────────────────────────────

MarketplaceService.ProcessReceipt = function(receiptInfo)
	local player = Players:GetPlayerByUserId(receiptInfo.PlayerId)
	if not player then
		-- Player left; retry later
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	local handler = HANDLERS[receiptInfo.ProductId]
	if not handler then
		warn("[PurchaseManager] Unrecognised productId:", receiptInfo.ProductId,
			"— add it to GameData.Products and register a handler here.")
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	local ok, result = pcall(handler, player)
	if ok and result then
		return Enum.ProductPurchaseDecision.PurchaseGranted
	else
		warn("[PurchaseManager] Handler failed for productId:", receiptInfo.ProductId,
			ok and "(returned false)" or tostring(result))
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
end

-- ── Startup report ────────────────────────────────────────────────────────

local configured, total = 0, 0
for key in pairs(GameData.Products) do
	total = total + 1
	local prod = GameData.Products[key]
	if prod.productId ~= 0 then configured = configured + 1 end
end
if configured < total then
	warn(string.format(
		"[PurchaseManager] %d/%d products have placeholder productId=0. "..
		"Set real IDs in GameData.Products before publishing.",
		total - configured, total))
else
	print("[PurchaseManager] All", total, "products configured.")
end
