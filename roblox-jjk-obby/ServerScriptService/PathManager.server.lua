-- PathManager.server.lua (Script → ServerScriptService)
-- Handles path selection at character select and path switching (free/paid)

local Players             = game:GetService("Players")
local ReplicatedStorage   = game:GetService("ReplicatedStorage")
local MarketplaceService  = game:GetService("MarketplaceService")

local GameData            = require(ReplicatedStorage.Modules.GameData)
local StatsCalculator     = require(ReplicatedStorage.Modules.StatsCalculator)

-- Lazy-require to avoid circular dependency
local function getPlayerDataManager()
	return require(game.ServerScriptService.PlayerDataManager)
end

-- Remote Events (create these in ReplicatedStorage/RemoteEvents in Studio)
local RemoteEvents  = ReplicatedStorage:WaitForChild("RemoteEvents")
local SelectPath    = RemoteEvents:WaitForChild("SelectPath")      -- client → server: (path: string)
local SwitchPath    = RemoteEvents:WaitForChild("SwitchPath")      -- client → server: ()
local UpdateStats   = RemoteEvents:WaitForChild("UpdateStats")     -- server → client: (stats table)
local PathChanged   = RemoteEvents:WaitForChild("PathChanged")     -- server → client: (newPath, stage)

local EARLY_SWITCH_PRODUCT_ID = GameData.Products.EarlyPathSwitch.productId

local function applyPlayerStats(player)
	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data or not data.path then return end

	local char = player.Character
	if not char then return end

	local stats = StatsCalculator.GetFinalStats(data.path, data.stage, data.inventory)
	StatsCalculator.ApplyToCharacter(char, stats)

	UpdateStats:FireClient(player, stats)
end

-- Called when a player picks a path at character select (first time or after endgame unlock)
SelectPath.OnServerEvent:Connect(function(player, chosenPath)
	if chosenPath ~= "Sorcerer" and chosenPath ~= "CurseSpirit" then return end

	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data then return end

	-- Only allow selection if they haven't chosen yet
	if data.path ~= nil then
		warn("[PathManager] " .. player.Name .. " tried to select a path but already has one.")
		return
	end

	data.path  = chosenPath
	data.stage = 1
	PDM.Save(player)

	PathChanged:FireClient(player, data.path, data.stage)
	applyPlayerStats(player)
end)

-- Called when a player wants to switch paths via the NPC
SwitchPath.OnServerEvent:Connect(function(player)
	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data or not data.path then return end

	local canSwitchFree = data.completedAll  -- finished all 8 stages

	if canSwitchFree then
		performSwitch(player, data, PDM)
	else
		-- Prompt purchase of early switch
		MarketplaceService:PromptProductPurchase(player, EARLY_SWITCH_PRODUCT_ID)
		-- Actual switch handled in ProcessReceipt below
	end
end)

function performSwitch(player, data, PDM)
	-- Flip the path, reset stats, keep inventory
	data.path        = (data.path == "Sorcerer") and "CurseSpirit" or "Sorcerer"
	data.stage       = 1
	data.switchCount = data.switchCount + 1
	PDM.Save(player)

	PathChanged:FireClient(player, data.path, data.stage)
	applyPlayerStats(player)
end

-- Handle paid product receipts
MarketplaceService.ProcessReceipt = function(receiptInfo)
	if receiptInfo.ProductId == EARLY_SWITCH_PRODUCT_ID then
		local player = Players:GetPlayerByUserId(receiptInfo.PlayerId)
		if player then
			local PDM  = getPlayerDataManager()
			local data = PDM.Get(player)
			if data and data.path then
				performSwitch(player, data, PDM)
			end
		end
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	return Enum.ProductPurchaseDecision.NotProcessedYet
end

-- Re-apply stats when character respawns
Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		task.wait(0.5)  -- wait for character to fully load
		applyPlayerStats(player)
	end)
end)
