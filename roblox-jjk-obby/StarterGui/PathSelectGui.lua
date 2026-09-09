-- PathSelectGui.lua (LocalScript inside a ScreenGui named "PathSelectGui" → StarterGui)
-- Displays the path selection screen on first join

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService      = game:GetService("TweenService")

local player    = Players.LocalPlayer
local playerGui = player.PlayerGui

local RemoteEvents = ReplicatedStorage:WaitForChild("RemoteEvents")
local SelectPath   = RemoteEvents:WaitForChild("SelectPath")

local screenGui = script.Parent  -- the ScreenGui this script lives inside

-- ----------------------------------------------------------------
-- Build the UI programmatically so no Studio setup is needed for the GUI
-- ----------------------------------------------------------------

screenGui.IgnoreGuiInset  = true
screenGui.ResetOnSpawn    = false
screenGui.DisplayOrder    = 10

-- Background overlay
local bg = Instance.new("Frame")
bg.Name              = "Background"
bg.Size              = UDim2.new(1, 0, 1, 0)
bg.BackgroundColor3  = Color3.fromRGB(5, 5, 15)
bg.BackgroundTransparency = 0
bg.Parent = screenGui

-- Title
local title = Instance.new("TextLabel")
title.Name           = "Title"
title.Text           = "CHOOSE YOUR PATH"
title.Font           = Enum.Font.GothamBlack
title.TextSize       = 42
title.TextColor3     = Color3.fromRGB(255, 200, 50)
title.Size           = UDim2.new(0.8, 0, 0.12, 0)
title.Position       = UDim2.new(0.1, 0, 0.06, 0)
title.BackgroundTransparency = 1
title.TextScaled     = true
title.Parent = bg

-- Subtitle
local sub = Instance.new("TextLabel")
sub.Name         = "Subtitle"
sub.Text         = "Your evolution begins here. Choose wisely — switching paths costs Robux until you complete all 8 stages."
sub.Font         = Enum.Font.Gotham
sub.TextSize     = 16
sub.TextColor3   = Color3.fromRGB(180, 180, 200)
sub.Size         = UDim2.new(0.7, 0, 0.06, 0)
sub.Position     = UDim2.new(0.15, 0, 0.18, 0)
sub.BackgroundTransparency = 1
sub.TextScaled   = false
sub.TextWrapped  = true
sub.Parent = bg

-- ----------------------------------------------------------------
-- Helper: build a path card
-- ----------------------------------------------------------------

local function buildCard(parent, xPos, pathKey, cardTitle, subtitle, stages, accentColor)
	local card = Instance.new("Frame")
	card.Name             = pathKey .. "Card"
	card.Size             = UDim2.new(0.36, 0, 0.62, 0)
	card.Position         = UDim2.new(xPos, 0, 0.27, 0)
	card.BackgroundColor3 = Color3.fromRGB(15, 15, 30)
	card.BorderSizePixel  = 0
	card.Parent = parent

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = card

	local stroke = Instance.new("UIStroke")
	stroke.Color     = accentColor
	stroke.Thickness = 2
	stroke.Parent = card

	-- Card title
	local ctitle = Instance.new("TextLabel")
	ctitle.Text      = cardTitle
	ctitle.Font      = Enum.Font.GothamBold
	ctitle.TextSize  = 22
	ctitle.TextColor3 = accentColor
	ctitle.Size      = UDim2.new(1, 0, 0.12, 0)
	ctitle.Position  = UDim2.new(0, 0, 0.03, 0)
	ctitle.BackgroundTransparency = 1
	ctitle.TextScaled = true
	ctitle.Parent = card

	-- Subtitle
	local csub = Instance.new("TextLabel")
	csub.Text       = subtitle
	csub.Font       = Enum.Font.Gotham
	csub.TextSize   = 13
	csub.TextColor3 = Color3.fromRGB(160, 160, 180)
	csub.Size       = UDim2.new(0.9, 0, 0.08, 0)
	csub.Position   = UDim2.new(0.05, 0, 0.15, 0)
	csub.BackgroundTransparency = 1
	csub.TextWrapped = true
	csub.Parent = card

	-- Stage list
	local stageListFrame = Instance.new("Frame")
	stageListFrame.Size  = UDim2.new(0.9, 0, 0.52, 0)
	stageListFrame.Position = UDim2.new(0.05, 0, 0.25, 0)
	stageListFrame.BackgroundTransparency = 1
	stageListFrame.Parent = card

	local listLayout = Instance.new("UIListLayout")
	listLayout.SortOrder   = Enum.SortOrder.LayoutOrder
	listLayout.Padding     = UDim.new(0, 3)
	listLayout.Parent = stageListFrame

	for i, stageName in ipairs(stages) do
		local row = Instance.new("TextLabel")
		row.Text      = string.format("%d.  %s", i, stageName)
		row.Font      = Enum.Font.Gotham
		row.TextSize  = 13
		row.TextColor3 = (i == #stages)
			and Color3.fromRGB(255, 165, 0)  -- final form is gold
			or  Color3.fromRGB(200, 200, 220)
		row.Size      = UDim2.new(1, 0, 0, 22)
		row.BackgroundTransparency = 1
		row.TextXAlignment = Enum.TextXAlignment.Left
		row.LayoutOrder = i
		row.Parent = stageListFrame
	end

	-- Select button
	local btn = Instance.new("TextButton")
	btn.Text             = "SELECT"
	btn.Font             = Enum.Font.GothamBlack
	btn.TextSize         = 18
	btn.TextColor3       = Color3.fromRGB(5, 5, 15)
	btn.BackgroundColor3 = accentColor
	btn.Size             = UDim2.new(0.7, 0, 0.1, 0)
	btn.Position         = UDim2.new(0.15, 0, 0.87, 0)
	btn.Parent = card

	local btnCorner = Instance.new("UICorner")
	btnCorner.CornerRadius = UDim.new(0, 8)
	btnCorner.Parent = btn

	btn.MouseButton1Click:Connect(function()
		-- Tween out
		local tween = TweenService:Create(bg,
			TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
			{ BackgroundTransparency = 1 }
		)
		tween:Play()
		task.wait(0.5)
		screenGui.Enabled = false

		SelectPath:FireServer(pathKey)
	end)

	return card
end

-- ----------------------------------------------------------------
-- Sorcerer card
-- ----------------------------------------------------------------

buildCard(
	bg,
	0.07,
	"Sorcerer",
	"⚔  SORCERER PATH",
	"Fight cursed spirits. Master your cursed energy and ascend to the pinnacle of jujutsu.",
	{
		"Weakling (No CE)",
		"Grade 4 Sorcerer",
		"Grade 3 Sorcerer",
		"Grade 2 Sorcerer",
		"Grade 1 Sorcerer",
		"Special Grade Sorcerer",
		"Six Eyes (Gojo-tier)",
		"10 Shadows Sukuna",
	},
	Color3.fromRGB(80, 160, 255)
)

-- ----------------------------------------------------------------
-- Curse Spirit card
-- ----------------------------------------------------------------

buildCard(
	bg,
	0.57,
	"CurseSpirit",
	"☠  CURSE SPIRIT PATH",
	"Slaughter sorcerers. Consume and evolve from a helpless womb into the King of Curses.",
	{
		"Cursed Womb",
		"Low-grade Curse",
		"High-grade Curse",
		"Finger Bearer",
		"Special Grade Curse",
		"Mahito-tier",
		"Jogo / Dagon-tier",
		"Heian Era Sukuna",
	},
	Color3.fromRGB(220, 60, 60)
)
