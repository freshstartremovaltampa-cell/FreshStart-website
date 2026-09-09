-- MainHUD.lua (LocalScript inside a ScreenGui named "MainHUD" → StarterGui)
-- Builds the in-game HUD: path, stage, stats bar, kill counter, inventory toggle

local Players       = game:GetService("Players")
local TweenService  = game:GetService("TweenService")

local player    = Players.LocalPlayer
local screenGui = script.Parent

screenGui.ResetOnSpawn  = false
screenGui.DisplayOrder  = 5

-- ----------------------------------------------------------------
-- Main HUD frame (top-left corner)
-- ----------------------------------------------------------------

local mainFrame = Instance.new("Frame")
mainFrame.Name             = "MainFrame"
mainFrame.Size             = UDim2.new(0, 280, 0, 110)
mainFrame.Position         = UDim2.new(0, 12, 0, 12)
mainFrame.BackgroundColor3 = Color3.fromRGB(10, 10, 20)
mainFrame.BackgroundTransparency = 0.2
mainFrame.BorderSizePixel  = 0
mainFrame.Parent = screenGui

local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 10)
corner.Parent = mainFrame

local stroke = Instance.new("UIStroke")
stroke.Color     = Color3.fromRGB(255, 200, 50)
stroke.Thickness = 1
stroke.Parent = mainFrame

-- Path label
local pathLabel = Instance.new("TextLabel")
pathLabel.Name       = "PathLabel"
pathLabel.Text       = "Path: —"
pathLabel.Font       = Enum.Font.GothamBold
pathLabel.TextSize   = 15
pathLabel.TextColor3 = Color3.fromRGB(255, 200, 50)
pathLabel.Size       = UDim2.new(1, -12, 0, 28)
pathLabel.Position   = UDim2.new(0, 10, 0, 6)
pathLabel.BackgroundTransparency = 1
pathLabel.TextXAlignment = Enum.TextXAlignment.Left
pathLabel.Parent = mainFrame

-- Stage label
local stageLabel = Instance.new("TextLabel")
stageLabel.Name       = "StageLabel"
stageLabel.Text       = "Stage: 1 / 8"
stageLabel.Font       = Enum.Font.Gotham
stageLabel.TextSize   = 13
stageLabel.TextColor3 = Color3.fromRGB(200, 200, 220)
stageLabel.Size       = UDim2.new(1, -12, 0, 22)
stageLabel.Position   = UDim2.new(0, 10, 0, 36)
stageLabel.BackgroundTransparency = 1
stageLabel.TextXAlignment = Enum.TextXAlignment.Left
stageLabel.Parent = mainFrame

-- Stats label
local statsLabel = Instance.new("TextLabel")
statsLabel.Name       = "StatsLabel"
statsLabel.Text       = "HP: —  |  SPD: —  |  DMG: —"
statsLabel.Font       = Enum.Font.Gotham
statsLabel.TextSize   = 12
statsLabel.TextColor3 = Color3.fromRGB(160, 200, 160)
statsLabel.Size       = UDim2.new(1, -12, 0, 20)
statsLabel.Position   = UDim2.new(0, 10, 0, 60)
statsLabel.BackgroundTransparency = 1
statsLabel.TextXAlignment = Enum.TextXAlignment.Left
statsLabel.Parent = mainFrame

-- Kill progress label
local killLabel = Instance.new("TextLabel")
killLabel.Name       = "KillLabel"
killLabel.Text       = "Kills: 0 / ?"
killLabel.Font       = Enum.Font.Gotham
killLabel.TextSize   = 12
killLabel.TextColor3 = Color3.fromRGB(220, 100, 100)
killLabel.Size       = UDim2.new(1, -12, 0, 18)
killLabel.Position   = UDim2.new(0, 10, 0, 84)
killLabel.BackgroundTransparency = 1
killLabel.TextXAlignment = Enum.TextXAlignment.Left
killLabel.Parent = mainFrame

-- ----------------------------------------------------------------
-- Inventory toggle button (bottom-right)
-- ----------------------------------------------------------------

local invBtn = Instance.new("TextButton")
invBtn.Name             = "InventoryButton"
invBtn.Text             = "TOOLS"
invBtn.Font             = Enum.Font.GothamBold
invBtn.TextSize         = 14
invBtn.TextColor3       = Color3.fromRGB(255, 255, 255)
invBtn.BackgroundColor3 = Color3.fromRGB(40, 40, 80)
invBtn.Size             = UDim2.new(0, 90, 0, 36)
invBtn.Position         = UDim2.new(1, -102, 1, -48)
invBtn.Parent = screenGui

local invBtnCorner = Instance.new("UICorner")
invBtnCorner.CornerRadius = UDim.new(0, 8)
invBtnCorner.Parent = invBtn

invBtn.MouseButton1Click:Connect(function()
	local invGui = player.PlayerGui:FindFirstChild("InventoryGui")
	if invGui then
		invGui.Enabled = not invGui.Enabled
	end
end)

-- ----------------------------------------------------------------
-- Kill counter updates (listen to EnemyKilled events from ClientManager)
-- This label is updated externally by ClientManager
-- ----------------------------------------------------------------
