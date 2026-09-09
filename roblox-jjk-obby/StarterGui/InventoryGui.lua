-- InventoryGui.lua (LocalScript inside a ScreenGui named "InventoryGui" → StarterGui)
-- Sliding panel showing all owned cursed tools and their stat boosts

local Players      = game:GetService("Players")
local TweenService = game:GetService("TweenService")

local screenGui = script.Parent
screenGui.Enabled       = false
screenGui.ResetOnSpawn  = false
screenGui.DisplayOrder  = 8

-- ----------------------------------------------------------------
-- Panel frame (right side, slides in/out)
-- ----------------------------------------------------------------

local panel = Instance.new("Frame")
panel.Name             = "InventoryFrame"
panel.Size             = UDim2.new(0, 320, 0.7, 0)
panel.Position         = UDim2.new(1, 10, 0.15, 0)  -- starts off-screen right
panel.BackgroundColor3 = Color3.fromRGB(10, 10, 22)
panel.BackgroundTransparency = 0.1
panel.BorderSizePixel  = 0
panel.Parent = screenGui

local panelCorner = Instance.new("UICorner")
panelCorner.CornerRadius = UDim.new(0, 12)
panelCorner.Parent = panel

local panelStroke = Instance.new("UIStroke")
panelStroke.Color     = Color3.fromRGB(255, 200, 50)
panelStroke.Thickness = 1
panelStroke.Parent = panel

-- Header
local header = Instance.new("TextLabel")
header.Text      = "CURSED TOOLS"
header.Font      = Enum.Font.GothamBlack
header.TextSize  = 18
header.TextColor3 = Color3.fromRGB(255, 200, 50)
header.Size      = UDim2.new(1, 0, 0, 40)
header.Position  = UDim2.new(0, 0, 0, 0)
header.BackgroundColor3 = Color3.fromRGB(20, 20, 40)
header.BackgroundTransparency = 0
header.BorderSizePixel = 0
header.Parent = panel

-- Scroll frame for tool entries (populated by ClientManager)
local scrollFrame = Instance.new("ScrollingFrame")
scrollFrame.Name             = "ScrollFrame"
scrollFrame.Size             = UDim2.new(1, 0, 1, -50)
scrollFrame.Position         = UDim2.new(0, 0, 0, 44)
scrollFrame.BackgroundTransparency = 1
scrollFrame.BorderSizePixel  = 0
scrollFrame.ScrollBarThickness = 4
scrollFrame.ScrollBarImageColor3 = Color3.fromRGB(255, 200, 50)
scrollFrame.CanvasSize       = UDim2.new(0, 0, 0, 0)
scrollFrame.AutomaticCanvasSize = Enum.AutomaticSize.Y
scrollFrame.Parent = panel

local listLayout = Instance.new("UIListLayout")
listLayout.SortOrder = Enum.SortOrder.LayoutOrder
listLayout.Padding   = UDim.new(0, 4)
listLayout.Parent    = scrollFrame

local padding = Instance.new("UIPadding")
padding.PaddingLeft   = UDim.new(0, 8)
padding.PaddingRight  = UDim.new(0, 8)
padding.PaddingTop    = UDim.new(0, 6)
padding.Parent        = scrollFrame

-- Empty state label
local emptyLabel = Instance.new("TextLabel")
emptyLabel.Name      = "EmptyLabel"
emptyLabel.Text      = "No cursed tools yet.\nDefeat enemies to earn drops!"
emptyLabel.Font      = Enum.Font.Gotham
emptyLabel.TextSize  = 14
emptyLabel.TextColor3 = Color3.fromRGB(120, 120, 140)
emptyLabel.Size      = UDim2.new(1, 0, 0, 80)
emptyLabel.Position  = UDim2.new(0, 0, 0, 10)
emptyLabel.BackgroundTransparency = 1
emptyLabel.TextWrapped = true
emptyLabel.Parent = scrollFrame

-- ----------------------------------------------------------------
-- Slide animation
-- ----------------------------------------------------------------

local openPos  = UDim2.new(1, -330, 0.15, 0)
local closePos = UDim2.new(1, 10,   0.15, 0)

local tweenInfo = TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)

screenGui:GetPropertyChangedSignal("Enabled"):Connect(function()
	if screenGui.Enabled then
		panel.Position = closePos
		local tween = TweenService:Create(panel, tweenInfo, { Position = openPos })
		tween:Play()
	end
end)
