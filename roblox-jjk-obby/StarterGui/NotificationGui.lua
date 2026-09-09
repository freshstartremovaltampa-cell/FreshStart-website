-- NotificationGui.lua (LocalScript inside a ScreenGui named "NotificationGui" → StarterGui)
-- Drop toasts and evolution banners

local screenGui = script.Parent
screenGui.ResetOnSpawn = false
screenGui.DisplayOrder = 15

-- ----------------------------------------------------------------
-- Drop notification (bottom-center toast)
-- ----------------------------------------------------------------

local dropLabel = Instance.new("TextLabel")
dropLabel.Name         = "DropLabel"
dropLabel.Text         = ""
dropLabel.Font         = Enum.Font.GothamBold
dropLabel.TextSize     = 16
dropLabel.TextColor3   = Color3.fromRGB(255, 200, 50)
dropLabel.Size         = UDim2.new(0, 450, 0, 36)
dropLabel.Position     = UDim2.new(0.5, -225, 1, -90)
dropLabel.BackgroundColor3 = Color3.fromRGB(10, 10, 25)
dropLabel.BackgroundTransparency = 0.2
dropLabel.BorderSizePixel = 0
dropLabel.Visible      = false
dropLabel.Parent = screenGui

local dropCorner = Instance.new("UICorner")
dropCorner.CornerRadius = UDim.new(0, 8)
dropCorner.Parent = dropLabel

-- ----------------------------------------------------------------
-- Evolution banner (center screen, large)
-- ----------------------------------------------------------------

local evoLabel = Instance.new("TextLabel")
evoLabel.Name         = "EvoLabel"
evoLabel.Text         = ""
evoLabel.Font         = Enum.Font.GothamBlack
evoLabel.TextSize     = 30
evoLabel.TextColor3   = Color3.fromRGB(255, 220, 0)
evoLabel.Size         = UDim2.new(0, 600, 0, 60)
evoLabel.Position     = UDim2.new(0.5, -300, 0.35, 0)
evoLabel.BackgroundColor3 = Color3.fromRGB(5, 5, 15)
evoLabel.BackgroundTransparency = 0.1
evoLabel.BorderSizePixel = 0
evoLabel.Visible      = false
evoLabel.TextScaled   = true
evoLabel.Parent = screenGui

local evoCorner = Instance.new("UICorner")
evoCorner.CornerRadius = UDim.new(0, 12)
evoCorner.Parent = evoLabel

local evoStroke = Instance.new("UIStroke")
evoStroke.Color     = Color3.fromRGB(255, 200, 50)
evoStroke.Thickness = 2
evoStroke.Parent = evoLabel
