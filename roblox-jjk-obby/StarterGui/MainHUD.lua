-- MainHUD.lua (LocalScript inside ScreenGui "MainHUD" → StarterGui)
-- Full JJK-themed HUD matching the Dino Evolution layout:
--   Left panel: Store / Spirits / Rebirth / Items / Levels
--   Top center: Auto Fight toggle / Domain (Auras)
--   Bottom: Trophy count, Speed, Rebirth mult, DAMAGE, Level bar, boost buttons
--   Right panel: FREE Reward, x2 Damage offer, +5 Speed offer

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService      = game:GetService("TweenService")

local player    = Players.LocalPlayer
local playerGui = player.PlayerGui
local sg        = script.Parent   -- the ScreenGui

sg.ResetOnSpawn  = false
sg.DisplayOrder  = 5
sg.IgnoreGuiInset = true

-- ============================================================
-- Remote wiring
-- ============================================================

local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")

local TrophyUpdate       = RemoteEvents:WaitForChild("TrophyUpdate")
local UpdateStats        = RemoteEvents:WaitForChild("UpdateStats")
local PathChanged        = RemoteEvents:WaitForChild("PathChanged")
local RebirthResult      = RemoteEvents:WaitForChild("RebirthResult")
local RebirthRequest     = RemoteEvents:WaitForChild("RebirthRequest")
local DamageBoostRequest = RemoteEvents:WaitForChild("DamageBoostRequest")
local StageEvolved       = RemoteEvents:WaitForChild("StageEvolved")
local WaveUpdate         = RemoteEvents:WaitForChild("WaveUpdate")

local GetPlayerData      = RemoteFunctions:WaitForChild("GetPlayerData")

local GameData = require(ReplicatedStorage.Modules.GameData)

-- ============================================================
-- State
-- ============================================================

local state = {
	path         = nil,
	stage        = 1,
	trophies     = 0,
	level        = 1,
	xp           = 0,
	damage       = 10,
	speed        = 16,
	health       = 100,
	rebirthCount = 0,
	rebirthMult  = 1,
	autoFight    = false,
	wave         = 1,
}

-- ============================================================
-- Utility builders
-- ============================================================

local function corner(parent, radius)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 8)
	c.Parent = parent
	return c
end

local function makeFrame(parent, name, size, pos, color, trans)
	local f = Instance.new("Frame")
	f.Name = name
	f.Size = size
	f.Position = pos
	f.BackgroundColor3 = color or Color3.fromRGB(15,15,28)
	f.BackgroundTransparency = trans or 0
	f.BorderSizePixel = 0
	f.Parent = parent
	return f
end

local function makeLabel(parent, name, text, font, size, color, bgtrans)
	local l = Instance.new("TextLabel")
	l.Name = name
	l.Text = text
	l.Font = font or Enum.Font.GothamBold
	l.TextSize = size or 14
	l.TextColor3 = color or Color3.new(1,1,1)
	l.BackgroundTransparency = bgtrans ~= nil and bgtrans or 1
	l.Size = UDim2.new(1,0,1,0)
	l.Parent = parent
	return l
end

local function makeButton(parent, name, text, font, textSize, textColor, bgColor, size, pos, onClick)
	local b = Instance.new("TextButton")
	b.Name = name
	b.Text = text
	b.Font = font or Enum.Font.GothamBold
	b.TextSize = textSize or 14
	b.TextColor3 = textColor or Color3.new(1,1,1)
	b.BackgroundColor3 = bgColor or Color3.fromRGB(50,50,80)
	b.Size = size
	b.Position = pos
	b.BorderSizePixel = 0
	b.AutoButtonColor = false
	b.Parent = parent
	corner(b, 8)
	if onClick then
		b.MouseButton1Click:Connect(onClick)
		b.MouseEnter:Connect(function()
			TweenService:Create(b,TweenInfo.new(0.1),{BackgroundColor3=bgColor:Lerp(Color3.new(1,1,1),0.15)}):Play()
		end)
		b.MouseLeave:Connect(function()
			TweenService:Create(b,TweenInfo.new(0.1),{BackgroundColor3=bgColor}):Play()
		end)
	end
	return b
end

-- ============================================================
-- Format numbers like the screenshot: 231K, 1.5M, etc.
-- ============================================================

local function fmt(n)
	n = math.floor(n)
	if n >= 1e9 then return string.format("%.1fB", n/1e9)
	elseif n >= 1e6 then return string.format("%.1fM", n/1e6)
	elseif n >= 1e3 then return string.format("%.1fK", n/1e3)
	else return tostring(n) end
end

-- ============================================================
-- TOP BAR
-- ============================================================

local topBar = makeFrame(sg,"TopBar",
	UDim2.new(1,0,0,44),
	UDim2.new(0,0,0,0),
	Color3.fromRGB(0,0,0), 0.4)

-- DAILY button
local dailyBtn = makeButton(topBar,"DailyBtn","🎁  DAILY",
	Enum.Font.GothamBlack,14,Color3.fromRGB(5,5,15),
	Color3.fromRGB(255,140,0),
	UDim2.new(0,110,0,32),
	UDim2.new(0,8,0.5,-16),
	function()
		-- open daily reward gui
		local g = playerGui:FindFirstChild("DailyGui")
		if g then g.Enabled = not g.Enabled end
	end)

-- Auto Fight toggle
local autoFightBg = makeFrame(topBar,"AutoFightBg",
	UDim2.new(0,160,0,34),
	UDim2.new(0.5,-80,0.5,-17),
	Color3.fromRGB(180,130,20))
corner(autoFightBg,8)

local autoFightLabel = makeLabel(autoFightBg,"Label",
	"Auto Fight\nOFF",Enum.Font.GothamBlack,13,Color3.fromRGB(5,5,15))
autoFightLabel.TextXAlignment = Enum.TextXAlignment.Center

local autoFightBtn   = Instance.new("TextButton")
autoFightBtn.Size    = UDim2.new(1,0,1,0)
autoFightBtn.BackgroundTransparency = 1
autoFightBtn.Text    = ""
autoFightBtn.Parent  = autoFightBg

autoFightBtn.MouseButton1Click:Connect(function()
	state.autoFight = not state.autoFight
	autoFightLabel.Text = "Auto Fight\n" .. (state.autoFight and "ON" or "OFF")
	autoFightBg.BackgroundColor3 = state.autoFight
		and Color3.fromRGB(50,180,50)
		or  Color3.fromRGB(180,130,20)
end)

-- Domain (Auras equivalent)
local domainBtn = makeButton(topBar,"DomainBtn","Domain",
	Enum.Font.GothamBlack,14,Color3.fromRGB(5,5,15),
	Color3.fromRGB(40,180,80),
	UDim2.new(0,110,0,32),
	UDim2.new(0.5,90,0.5,-16),
	function() end)

-- EVENT button
local eventBtn = makeButton(topBar,"EventBtn","EVENT",
	Enum.Font.GothamBlack,14,Color3.new(1,1,1),
	Color3.fromRGB(40,40,60),
	UDim2.new(0,90,0,32),
	UDim2.new(1,-108,0.5,-16),
	function() end)

-- ============================================================
-- LEFT PANEL (Store / Spirits / Rebirth / Items / Levels)
-- ============================================================

local leftPanel = makeFrame(sg,"LeftPanel",
	UDim2.new(0,120,0,220),
	UDim2.new(0,8,0,54),
	Color3.fromRGB(0,0,0), 0.6)
corner(leftPanel,10)

-- Store button (tall, orange, top of left panel)
local storeBtn = makeButton(leftPanel,"StoreBtn","🏪  Store",
	Enum.Font.GothamBlack,15,Color3.fromRGB(5,5,15),
	Color3.fromRGB(255,160,0),
	UDim2.new(1,-8,0,54),
	UDim2.new(0,4,0,4),
	function()
		local g = playerGui:FindFirstChild("StoreGui")
		if g then g.Enabled = not g.Enabled end
	end)

-- Notification badge on store
local badge       = Instance.new("Frame")
badge.Size        = UDim2.new(0,18,0,18)
badge.Position    = UDim2.new(1,-22,0,2)
badge.BackgroundColor3 = Color3.fromRGB(220,30,30)
badge.BorderSizePixel  = 0
badge.Parent      = storeBtn
corner(badge, 9)
local badgeLbl    = makeLabel(badge,"","!",Enum.Font.GothamBlack,12,Color3.new(1,1,1))
badgeLbl.TextXAlignment = Enum.TextXAlignment.Center

-- Row 1: Spirits | Rebirth
local row1 = makeFrame(leftPanel,"Row1",
	UDim2.new(1,-8,0,52),
	UDim2.new(0,4,0,62),
	Color3.fromRGB(0,0,0),0)

local spiritsBtn = makeButton(row1,"SpiritsBtn","Spirits",
	Enum.Font.Gotham,12,Color3.new(1,1,1),
	Color3.fromRGB(60,40,100),
	UDim2.new(0.5,-2,1,0), UDim2.new(0,0,0,0),
	function() end)

local rebirthBtn = makeButton(row1,"RebirthBtn","Rebirth",
	Enum.Font.Gotham,12,Color3.fromRGB(5,5,15),
	Color3.fromRGB(220,60,220),
	UDim2.new(0.5,-2,1,0), UDim2.new(0.5,2,0,0),
	function()
		local g = playerGui:FindFirstChild("RebirthGui")
		if g then g.Enabled = not g.Enabled end
	end)

-- Row 2: Items | Levels
local row2 = makeFrame(leftPanel,"Row2",
	UDim2.new(1,-8,0,52),
	UDim2.new(0,4,0,120),
	Color3.fromRGB(0,0,0),0)

local itemsBtn = makeButton(row2,"ItemsBtn","Items",
	Enum.Font.Gotham,12,Color3.new(1,1,1),
	Color3.fromRGB(40,80,140),
	UDim2.new(0.5,-2,1,0), UDim2.new(0,0,0,0),
	function()
		local g = playerGui:FindFirstChild("InventoryGui")
		if g then g.Enabled = not g.Enabled end
	end)

local levelsBtn = makeButton(row2,"LevelsBtn","Levels",
	Enum.Font.Gotham,12,Color3.new(1,1,1),
	Color3.fromRGB(40,100,60),
	UDim2.new(0.5,-2,1,0), UDim2.new(0.5,2,0,0),
	function() end)

-- Path & Stage display under buttons
local pathStageLbl = makeLabel(leftPanel,"PathStage",
	"Path: —\nStage: 1/8",
	Enum.Font.Gotham,11,Color3.fromRGB(200,200,220))
pathStageLbl.Size     = UDim2.new(1,-8,0,36)
pathStageLbl.Position = UDim2.new(0,4,0,178)
pathStageLbl.TextXAlignment = Enum.TextXAlignment.Center
pathStageLbl.TextWrapped = true
pathStageLbl.BackgroundTransparency = 1

-- ============================================================
-- RIGHT PANEL (FREE Reward / x2 Damage / +5 Speed offers)
-- ============================================================

local rightPanel = makeFrame(sg,"RightPanel",
	UDim2.new(0,140,0,220),
	UDim2.new(1,-148,0,54),
	Color3.fromRGB(0,0,0),0.6)
corner(rightPanel,10)

-- FREE Reward
makeButton(rightPanel,"FreeReward","🎁\nFREE\nReward",
	Enum.Font.GothamBlack,14,Color3.fromRGB(5,5,15),
	Color3.fromRGB(255,140,0),
	UDim2.new(1,-8,0,72),
	UDim2.new(0,4,0,4),
	function() end)

-- x2 DAMAGE
local dmgOffer = makeFrame(rightPanel,"DmgOffer",
	UDim2.new(1,-8,0,60),
	UDim2.new(0,4,0,82),
	Color3.fromRGB(200,80,0))
corner(dmgOffer,8)
local dmgLbl = makeLabel(dmgOffer,"","x2 DAMAGE\nONLY 299 R$",
	Enum.Font.GothamBlack,13,Color3.fromRGB(5,5,15))
dmgLbl.TextWrapped = true
local dmgBtn = Instance.new("TextButton")
dmgBtn.Size=UDim2.new(1,0,1,0); dmgBtn.BackgroundTransparency=1; dmgBtn.Text=""
dmgBtn.Parent=dmgOffer
dmgBtn.MouseButton1Click:Connect(function()
	-- TODO: MarketplaceService:PromptProductPurchase(player, GameData.Products.DoubleDamage.productId)
end)

-- +5 Speed PERMANENT
local spdOffer = makeFrame(rightPanel,"SpdOffer",
	UDim2.new(1,-8,0,60),
	UDim2.new(0,4,0,150),
	Color3.fromRGB(0,120,160))
corner(spdOffer,8)
local spdLbl = makeLabel(spdOffer,"","+5 Speed\nONLY 199 R$\nPERMANENT!",
	Enum.Font.GothamBlack,12,Color3.new(1,1,1))
spdLbl.TextWrapped = true
local spdBtn = Instance.new("TextButton")
spdBtn.Size=UDim2.new(1,0,1,0); spdBtn.BackgroundTransparency=1; spdBtn.Text=""
spdBtn.Parent=spdOffer
spdBtn.MouseButton1Click:Connect(function() end)

-- ============================================================
-- BOTTOM BAR
-- ============================================================

local botBar = makeFrame(sg,"BottomBar",
	UDim2.new(1,0,0,110),
	UDim2.new(0,0,1,-110),
	Color3.fromRGB(0,0,0), 0.5)

-- Trophy count (bottom left)
local trophyFrame = makeFrame(botBar,"TrophyFrame",
	UDim2.new(0,140,0,32),
	UDim2.new(0,8,0,8),
	Color3.fromRGB(20,20,30))
corner(trophyFrame,6)

local trophyLbl = makeLabel(trophyFrame,"TrophyLabel",
	"🏆  0",Enum.Font.GothamBold,14,Color3.fromRGB(255,200,50))
trophyLbl.TextXAlignment = Enum.TextXAlignment.Left
Instance.new("UIPadding",trophyFrame).PaddingLeft = UDim.new(0,6)

-- Friends label
local friendLbl = makeLabel(botBar,"FriendLbl",
	"👤  Friends: 0  |  Boost +0%",
	Enum.Font.Gotham,12,Color3.fromRGB(140,200,140))
friendLbl.Size     = UDim2.new(0,200,0,20)
friendLbl.Position = UDim2.new(0,8,0,46)
friendLbl.TextXAlignment = Enum.TextXAlignment.Left

-- ---- Center stats cluster ----
-- Speed
local speedLbl = makeLabel(botBar,"SpeedLbl",
	"💨  Speed: 16",Enum.Font.GothamBold,14,Color3.fromRGB(100,200,255))
speedLbl.Size     = UDim2.new(0,140,0,24)
speedLbl.Position = UDim2.new(0.5,-200,0,8)
speedLbl.TextXAlignment = Enum.TextXAlignment.Center

-- Rebirth mult
local rebirthLbl = makeLabel(botBar,"RebirthLbl",
	"Rebirth: x1.00",Enum.Font.GothamBold,14,Color3.fromRGB(220,120,255))
rebirthLbl.Size     = UDim2.new(0,160,0,24)
rebirthLbl.Position = UDim2.new(0.5,-80,0,8)
rebirthLbl.TextXAlignment = Enum.TextXAlignment.Center

-- BIG damage number
local damageFrame = makeFrame(botBar,"DamageFrame",
	UDim2.new(0,200,0,34),
	UDim2.new(0.5,20,0,2))
corner(damageFrame,6)
local damageLbl = makeLabel(damageFrame,"DamageLbl",
	"10 DAMAGE",Enum.Font.GothamBlack,20,Color3.fromRGB(255,210,0))
damageLbl.TextXAlignment = Enum.TextXAlignment.Center

-- Wave counter
local waveFrame = makeFrame(botBar,"WaveFrame",
	UDim2.new(0,110,0,34),
	UDim2.new(0.5,228,0,2),
	Color3.fromRGB(25,15,40))
corner(waveFrame,6)
local waveLbl = makeLabel(waveFrame,"WaveLbl",
	"⚔ WAVE 1",Enum.Font.GothamBlack,16,Color3.fromRGB(255,150,50))
waveLbl.TextXAlignment = Enum.TextXAlignment.Center

-- Level bar
local levelBarBg = makeFrame(botBar,"LevelBarBg",
	UDim2.new(0.5,-10,0,22),
	UDim2.new(0.25,0,0,42),
	Color3.fromRGB(30,30,40))
corner(levelBarBg,5)

local levelBarFill = makeFrame(levelBarBg,"Fill",
	UDim2.new(0,0,1,0),
	UDim2.new(0,0,0,0),
	Color3.fromRGB(80,160,255))
corner(levelBarFill,5)

local levelTextLbl = makeLabel(botBar,"LevelText",
	"LEVEL 1  |  0 / 1K XP",
	Enum.Font.GothamBold,12,Color3.fromRGB(200,200,220))
levelTextLbl.Size     = UDim2.new(0.5,-10,0,20)
levelTextLbl.Position = UDim2.new(0.25,0,0,40)
levelTextLbl.TextXAlignment = Enum.TextXAlignment.Center

-- ---- Damage boost buttons (spend trophies) ----
local boostRow = makeFrame(botBar,"BoostRow",
	UDim2.new(0,340,0,34),
	UDim2.new(0.5,-170,0,72),
	Color3.fromRGB(0,0,0),0)

local boostColors = {
	Color3.fromRGB(60,120,220),
	Color3.fromRGB(120,60,200),
	Color3.fromRGB(200,60,60),
}

for i, boost in ipairs(GameData.DamageBoostButtons) do
	local costFmt = fmt(boost.trophyCost)
	local btn     = makeButton(boostRow,
		"Boost"..i,
		string.format("%s\n🏆 %s", boost.label, costFmt),
		Enum.Font.GothamBlack, 13,
		Color3.new(1,1,1),
		boostColors[i],
		UDim2.new(0,104,1,0),
		UDim2.new(0,(i-1)*116, 0, 0),
		function()
			DamageBoostRequest:FireServer(i)
		end)
end

-- ============================================================
-- UPDATE FUNCTIONS (called by server events or init)
-- ============================================================

local XP_NEEDED = 1000

local function updateHUD()
	trophyLbl.Text = "🏆  " .. fmt(state.trophies)
	speedLbl.Text  = string.format("💨  Speed: %d", state.speed)
	rebirthLbl.Text = string.format("Rebirth: x%.2f", state.rebirthMult)
	damageLbl.Text  = fmt(state.damage) .. " DAMAGE"

	local xpNeeded = XP_NEEDED
	local xpPct    = math.clamp(state.xp / xpNeeded, 0, 1)
	TweenService:Create(levelBarFill, TweenInfo.new(0.3),
		{Size = UDim2.new(xpPct, 0, 1, 0)}):Play()
	levelTextLbl.Text = string.format("LEVEL %d  |  %s / %s XP",
		state.level, fmt(state.xp), fmt(xpNeeded))

	local pathDisp = state.path == "Sorcerer" and "⚔ Sorcerer" or
	                 state.path == "CurseSpirit" and "☠ Curse Spirit" or "—"
	pathStageLbl.Text = pathDisp .. "\nStage: " .. state.stage .. "/8"
	waveLbl.Text = "⚔ WAVE " .. state.wave
end

-- ============================================================
-- SERVER EVENT LISTENERS
-- ============================================================

TrophyUpdate:Connect(function(trophies, level, xp)
	state.trophies = trophies
	state.level    = level
	state.xp       = xp
	updateHUD()
end)

UpdateStats:Connect(function(stats)
	state.damage = stats.damage
	state.speed  = stats.speed
	state.health = stats.health
	updateHUD()
end)

PathChanged:Connect(function(path, stage)
	state.path  = path
	state.stage = stage
	updateHUD()
end)

RebirthResult:Connect(function(success, rebirthCount, mult)
	if success then
		state.rebirthCount = rebirthCount
		state.rebirthMult  = mult
		updateHUD()
	end
end)

StageEvolved:Connect(function(newStage, stageData)
	state.stage = newStage
	state.wave  = 1
	updateHUD()
end)

WaveUpdate:Connect(function(waveNumber)
	state.wave = waveNumber
	waveLbl.Text = "⚔ WAVE " .. waveNumber
end)

-- ============================================================
-- INIT
-- ============================================================

task.spawn(function()
	task.wait(1)
	local data = GetPlayerData:InvokeServer()
	if data then
		state.path         = data.path
		state.stage        = data.stage
		state.trophies     = data.trophies
		state.level        = data.level
		state.xp           = data.xp
		state.rebirthCount = data.rebirthCount
		state.rebirthMult  = GameData.GetRebirthMultiplier(data.rebirthCount)
		updateHUD()
	end
end)
