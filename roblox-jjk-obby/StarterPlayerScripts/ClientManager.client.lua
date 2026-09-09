-- ClientManager.client.lua (LocalScript → StarterPlayerScripts)
-- Manages client-side state, listens to server events, drives GUI updates

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player    = Players.LocalPlayer
local playerGui = player.PlayerGui

local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")

local SelectPath    = RemoteEvents:WaitForChild("SelectPath")
local SwitchPath    = RemoteEvents:WaitForChild("SwitchPath")
local StageComplete = RemoteEvents:WaitForChild("StageComplete")
local UpdateStats   = RemoteEvents:WaitForChild("UpdateStats")
local PathChanged   = RemoteEvents:WaitForChild("PathChanged")
local EnemyKilled   = RemoteEvents:WaitForChild("EnemyKilled")
local InventoryUpdate = RemoteEvents:WaitForChild("InventoryUpdate")

local GetPlayerData = RemoteFunctions:WaitForChild("GetPlayerData")

-- Local state
local clientData = {
	path      = nil,
	stage     = 1,
	stats     = {},
	inventory = {},
}

-- ----------------------------------------------------------------
-- GUI references (set up after GUIs load)
-- ----------------------------------------------------------------

local PathSelectGui, MainHUD, InventoryGui

local function waitForGui(name)
	return playerGui:WaitForChild(name, 10)
end

-- ----------------------------------------------------------------
-- Path Select Screen
-- ----------------------------------------------------------------

local function showPathSelect()
	if PathSelectGui then
		PathSelectGui.Enabled = true
	end
end

local function hidePathSelect()
	if PathSelectGui then
		PathSelectGui.Enabled = false
	end
end

-- ----------------------------------------------------------------
-- Main HUD updates
-- ----------------------------------------------------------------

local function updateHUD()
	if not MainHUD then return end

	local hud = MainHUD:FindFirstChild("MainFrame")
	if not hud then return end

	local pathLabel  = hud:FindFirstChild("PathLabel")
	local stageLabel = hud:FindFirstChild("StageLabel")
	local statsLabel = hud:FindFirstChild("StatsLabel")

	if pathLabel  then pathLabel.Text  = "Path: " .. (clientData.path or "None") end
	if stageLabel then stageLabel.Text = "Stage: " .. tostring(clientData.stage) .. " / 8" end

	if statsLabel and clientData.stats then
		statsLabel.Text = string.format(
			"HP: %d  |  SPD: %d  |  DMG: %d",
			clientData.stats.health or 0,
			clientData.stats.speed  or 0,
			clientData.stats.damage or 0
		)
	end
end

-- ----------------------------------------------------------------
-- Inventory GUI updates
-- ----------------------------------------------------------------

local GameData = require(ReplicatedStorage.Modules.GameData)

local function updateInventoryGui()
	if not InventoryGui then return end
	local scrollFrame = InventoryGui:FindFirstChild("InventoryFrame")
		and InventoryGui.InventoryFrame:FindFirstChild("ScrollFrame")
	if not scrollFrame then return end

	-- Clear existing entries
	for _, child in ipairs(scrollFrame:GetChildren()) do
		if child:IsA("Frame") then child:Destroy() end
	end

	-- Populate from inventory
	for i, toolId in ipairs(clientData.inventory) do
		local toolData = GameData.GetToolById(toolId)
		if toolData then
			local entry = Instance.new("Frame")
			entry.Size  = UDim2.new(1, 0, 0, 50)
			entry.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
			entry.BorderSizePixel  = 0
			entry.LayoutOrder       = i
			entry.Parent = scrollFrame

			local nameLabel = Instance.new("TextLabel")
			nameLabel.Text  = toolData.name
			nameLabel.Font  = Enum.Font.GothamBold
			nameLabel.TextColor3 = GameData.RarityColors[toolData.rarity] or Color3.new(1,1,1)
			nameLabel.TextSize   = 14
			nameLabel.Size       = UDim2.new(0.6, 0, 1, 0)
			nameLabel.Position   = UDim2.new(0, 8, 0, 0)
			nameLabel.BackgroundTransparency = 1
			nameLabel.TextXAlignment = Enum.TextXAlignment.Left
			nameLabel.Parent = entry

			local statsLabel = Instance.new("TextLabel")
			statsLabel.Text  = string.format(
				"+%d DMG  +%d HP  +%d SPD",
				toolData.statBoost.damage,
				toolData.statBoost.health,
				toolData.statBoost.speed
			)
			statsLabel.Font  = Enum.Font.Gotham
			statsLabel.TextColor3 = Color3.fromRGB(180, 180, 180)
			statsLabel.TextSize   = 12
			statsLabel.Size       = UDim2.new(0.38, 0, 1, 0)
			statsLabel.Position   = UDim2.new(0.62, 0, 0, 0)
			statsLabel.BackgroundTransparency = 1
			statsLabel.TextXAlignment = Enum.TextXAlignment.Right
			statsLabel.Parent = entry
		end
	end
end

-- ----------------------------------------------------------------
-- Drop notification
-- ----------------------------------------------------------------

local function showDropNotification(enemyName, toolId)
	if not toolId then return end
	local toolData = GameData.GetToolById(toolId)
	if not toolData then return end

	local notifGui = playerGui:FindFirstChild("NotificationGui")
	if not notifGui then return end

	local label = notifGui:FindFirstChild("DropLabel")
	if not label then return end

	local rarityColor = GameData.RarityColors[toolData.rarity] or Color3.new(1,1,1)
	label.Text       = string.format("[%s] %s dropped: %s!", toolData.rarity, enemyName, toolData.name)
	label.TextColor3 = rarityColor
	label.Visible    = true

	task.delay(4, function()
		label.Visible = false
	end)
end

-- ----------------------------------------------------------------
-- Evolution celebration
-- ----------------------------------------------------------------

local function showEvolutionPopup(newStage, stageData)
	local notifGui = playerGui:FindFirstChild("NotificationGui")
	if not notifGui then return end

	local evoLabel = notifGui:FindFirstChild("EvoLabel")
	if not evoLabel then return end

	evoLabel.Text    = "EVOLVED!  →  " .. (stageData and stageData.displayName or "Stage " .. newStage)
	evoLabel.Visible = true

	task.delay(5, function()
		evoLabel.Visible = false
	end)
end

-- ----------------------------------------------------------------
-- Server event handlers
-- ----------------------------------------------------------------

PathChanged:Connect(function(newPath, newStage)
	clientData.path  = newPath
	clientData.stage = newStage
	updateHUD()

	-- Hide path select if it was showing
	hidePathSelect()
end)

UpdateStats:Connect(function(stats)
	clientData.stats = stats
	updateHUD()
end)

StageComplete:Connect(function(newStage, stageData)
	clientData.stage = newStage
	showEvolutionPopup(newStage, stageData)
	updateHUD()
end)

EnemyKilled:Connect(function(enemyName, droppedToolId)
	showDropNotification(enemyName, droppedToolId)
end)

InventoryUpdate:Connect(function(newInventory)
	clientData.inventory = newInventory
	updateInventoryGui()
end)

-- ----------------------------------------------------------------
-- Initialise on load
-- ----------------------------------------------------------------

local function init()
	-- Wait for GUIs
	PathSelectGui = waitForGui("PathSelectGui")
	MainHUD       = waitForGui("MainHUD")
	InventoryGui  = waitForGui("InventoryGui")

	-- Fetch player data from server
	local data = GetPlayerData:InvokeServer()
	if data then
		clientData.path      = data.path
		clientData.stage     = data.stage
		clientData.inventory = data.inventory or {}
	end

	if not clientData.path then
		showPathSelect()
	else
		updateHUD()
		updateInventoryGui()
	end
end

-- Wait for character and run
player.CharacterAdded:Connect(function()
	task.wait(1)
	updateHUD()
end)

task.spawn(init)
