-- SpiritsGui.lua (LocalScript inside ScreenGui "SpiritsGui" → StarterGui)
-- Cursed Spirit companion inventory (Pets equivalent).

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local sg     = script.Parent
sg.Enabled      = false
sg.ResetOnSpawn = false
sg.DisplayOrder = 14

local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")
local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local GetSpiritsData  = RemoteFunctions:WaitForChild("GetSpiritsData")
local SpiritAction    = RemoteEvents:WaitForChild("SpiritAction")
local SpiritDropped   = RemoteEvents:WaitForChild("SpiritDropped")

local GameData = require(ReplicatedStorage.Modules.GameData)

-- ── Helpers ───────────────────────────────────────────────────

local function corner(p,r) local c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,r or 8) c.Parent=p end

local RARITY_COLORS = {
	Common    = Color3.fromRGB(160,160,160),
	Uncommon  = Color3.fromRGB(80,200,80),
	Rare      = Color3.fromRGB(60,120,255),
	Epic      = Color3.fromRGB(160,60,255),
	Legendary = Color3.fromRGB(255,165,0),
}

-- ── Overlay ───────────────────────────────────────────────────

local overlay=Instance.new("Frame")
overlay.Size=UDim2.new(1,0,1,0) overlay.BackgroundColor3=Color3.new(0,0,0)
overlay.BackgroundTransparency=0.5 overlay.BorderSizePixel=0 overlay.Parent=sg
local ocb=Instance.new("TextButton") ocb.Size=UDim2.new(1,0,1,0)
ocb.BackgroundTransparency=1 ocb.Text="" ocb.Parent=overlay
ocb.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- ── Panel ─────────────────────────────────────────────────────

local panel=Instance.new("Frame")
panel.Name="SpiritsPanel"
panel.Size=UDim2.new(0,560,0,520)
panel.Position=UDim2.new(0.5,-280,0.5,-260)
panel.BackgroundColor3=Color3.fromRGB(8,10,18)
panel.BorderSizePixel=0 panel.Parent=sg
corner(panel,14)
local ps=Instance.new("UIStroke") ps.Color=Color3.fromRGB(60,180,255) ps.Thickness=2 ps.Parent=panel

-- Header
local hdr=Instance.new("Frame")
hdr.Size=UDim2.new(1,0,0,52) hdr.BackgroundColor3=Color3.fromRGB(40,160,220)
hdr.BorderSizePixel=0 hdr.Parent=panel corner(hdr,14)
local htitle=Instance.new("TextLabel")
htitle.Text="👻  SPIRITS" htitle.Font=Enum.Font.GothamBlack htitle.TextSize=22
htitle.TextColor3=Color3.fromRGB(5,10,20) htitle.BackgroundTransparency=1
htitle.Size=UDim2.new(1,-50,1,0) htitle.Position=UDim2.new(0,14,0,0)
htitle.TextXAlignment=Enum.TextXAlignment.Left htitle.Parent=hdr

local xBtn=Instance.new("TextButton") xBtn.Text="✕" xBtn.Font=Enum.Font.GothamBlack
xBtn.TextSize=20 xBtn.TextColor3=Color3.fromRGB(5,10,20) xBtn.BackgroundTransparency=1
xBtn.Size=UDim2.new(0,40,1,0) xBtn.Position=UDim2.new(1,-44,0,0) xBtn.Parent=hdr
xBtn.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- Left sidebar
local sidebar=Instance.new("Frame")
sidebar.Size=UDim2.new(0,130,1,-60) sidebar.Position=UDim2.new(0,0,0,56)
sidebar.BackgroundColor3=Color3.fromRGB(12,16,28) sidebar.BorderSizePixel=0 sidebar.Parent=panel

local function sideBtn(name, text, color, yPos, onClick)
	local b=Instance.new("TextButton")
	b.Text=text b.Font=Enum.Font.GothamBlack b.TextSize=14
	b.TextColor3=Color3.fromRGB(5,10,20) b.BackgroundColor3=color
	b.Size=UDim2.new(1,-12,0,44) b.Position=UDim2.new(0,6,0,yPos)
	b.BorderSizePixel=0 b.Parent=sidebar corner(b,8)
	b.MouseButton1Click:Connect(onClick)
	return b
end

sideBtn("EquipBest","⚡ Equip Best",Color3.fromRGB(60,200,80),10,function()
	SpiritAction:FireServer({action="equipAll"})
	task.wait(0.4) sg.Enabled=false sg.Enabled=true
end)
sideBtn("UnequipAll","Unequip All",Color3.fromRGB(200,80,60),62,function()
	SpiritAction:FireServer({action="unequipAll"})
	task.wait(0.4) sg.Enabled=false sg.Enabled=true
end)
sideBtn("Delete","🗑️ Delete",Color3.fromRGB(180,30,30),114,function()
	-- delete mode toggled via selectedUid
end)

-- Hint
local hintLbl=Instance.new("TextLabel")
hintLbl.Text="Tap a spirit\nto equip/unequip"
hintLbl.Font=Enum.Font.Gotham hintLbl.TextSize=11
hintLbl.TextColor3=Color3.fromRGB(120,140,180) hintLbl.BackgroundTransparency=1
hintLbl.Size=UDim2.new(1,-12,0,40) hintLbl.Position=UDim2.new(0,6,0,170)
hintLbl.TextWrapped=true hintLbl.TextXAlignment=Enum.TextXAlignment.Center
hintLbl.Parent=sidebar

-- Spirit grid (scrolling)
local scroll=Instance.new("ScrollingFrame")
scroll.Size=UDim2.new(1,-138,1,-104) scroll.Position=UDim2.new(0,134,0,56)
scroll.BackgroundColor3=Color3.fromRGB(10,12,22) scroll.BorderSizePixel=0
scroll.ScrollBarThickness=4 scroll.ScrollBarImageColor3=Color3.fromRGB(60,180,255)
scroll.CanvasSize=UDim2.new(0,0,0,0) scroll.AutomaticCanvasSize=Enum.AutomaticSize.Y
scroll.Parent=panel

local grid=Instance.new("UIGridLayout")
grid.CellSize=UDim2.new(0,90,0,100) grid.CellPadding=UDim2.new(0,6,0,6)
grid.SortOrder=Enum.SortOrder.LayoutOrder grid.Parent=scroll
Instance.new("UIPadding",scroll).PaddingTop=UDim.new(0,6)
Instance.new("UIPadding",scroll).PaddingLeft=UDim.new(0,4)

-- Bottom counter bar
local bottomBar=Instance.new("Frame")
bottomBar.Size=UDim2.new(1,-134,0,40) bottomBar.Position=UDim2.new(0,134,1,-44)
bottomBar.BackgroundColor3=Color3.fromRGB(10,12,22) bottomBar.BorderSizePixel=0 bottomBar.Parent=panel

local countLbl=Instance.new("TextLabel")
countLbl.Text="👻 0/100   ⚡ 0/4 Equipped"
countLbl.Font=Enum.Font.GothamBold countLbl.TextSize=14
countLbl.TextColor3=Color3.fromRGB(180,200,255) countLbl.BackgroundTransparency=1
countLbl.Size=UDim2.new(1,0,1,0) countLbl.TextXAlignment=Enum.TextXAlignment.Center
countLbl.Parent=bottomBar

-- ── Spirit card builder ───────────────────────────────────────

local function buildCard(spiritData, layoutOrder)
	local rarColor = RARITY_COLORS[spiritData.rarity] or Color3.fromRGB(160,160,160)

	local card=Instance.new("Frame")
	card.BackgroundColor3=spiritData.equipped and Color3.fromRGB(20,40,70) or Color3.fromRGB(16,18,32)
	card.BorderSizePixel=0 card.LayoutOrder=layoutOrder card.Parent=scroll
	corner(card,8)
	if spiritData.equipped then
		local es=Instance.new("UIStroke") es.Color=Color3.fromRGB(60,180,255) es.Thickness=2 es.Parent=card
	end

	-- Rarity stripe top
	local topBar=Instance.new("Frame")
	topBar.Size=UDim2.new(1,0,0,4) topBar.BackgroundColor3=rarColor
	topBar.BorderSizePixel=0 topBar.Parent=card corner(topBar,4)

	local emojiLbl=Instance.new("TextLabel")
	emojiLbl.Text="👻" emojiLbl.Font=Enum.Font.GothamBold emojiLbl.TextSize=30
	emojiLbl.BackgroundTransparency=1 emojiLbl.Size=UDim2.new(1,0,0,40)
	emojiLbl.Position=UDim2.new(0,0,0,6) emojiLbl.TextXAlignment=Enum.TextXAlignment.Center
	emojiLbl.Parent=card

	local nameLbl=Instance.new("TextLabel")
	nameLbl.Text=spiritData.name nameLbl.Font=Enum.Font.GothamBold nameLbl.TextSize=10
	nameLbl.TextColor3=Color3.new(1,1,1) nameLbl.BackgroundTransparency=1
	nameLbl.Size=UDim2.new(1,-4,0,24) nameLbl.Position=UDim2.new(0,2,0,48)
	nameLbl.TextWrapped=true nameLbl.TextXAlignment=Enum.TextXAlignment.Center
	nameLbl.Parent=card

	local multLbl=Instance.new("TextLabel")
	multLbl.Text=string.format("x%.2g",spiritData.damageMult)
	multLbl.Font=Enum.Font.GothamBlack multLbl.TextSize=12
	multLbl.TextColor3=rarColor multLbl.BackgroundTransparency=1
	multLbl.Size=UDim2.new(1,0,0,18) multLbl.Position=UDim2.new(0,0,1,-20)
	multLbl.TextXAlignment=Enum.TextXAlignment.Center multLbl.Parent=card

	-- Click to equip/unequip
	local hitbox=Instance.new("TextButton")
	hitbox.Size=UDim2.new(1,0,1,0) hitbox.BackgroundTransparency=1 hitbox.Text=""
	hitbox.Parent=card
	hitbox.MouseButton1Click:Connect(function()
		if spiritData.equipped then
			SpiritAction:FireServer({action="unequip", uid=spiritData.uid})
		else
			SpiritAction:FireServer({action="equip",   uid=spiritData.uid})
		end
		task.wait(0.3)
		sg.Enabled=false sg.Enabled=true
	end)
end

-- ── Refresh ───────────────────────────────────────────────────

local function refresh()
	for _, ch in ipairs(scroll:GetChildren()) do
		if ch:IsA("Frame") then ch:Destroy() end
	end

	local data = GetSpiritsData:InvokeServer()
	if not data then return end

	countLbl.Text = string.format("👻 %d/100   ⚡ %d/4 Equipped",
		data.totalCount, data.equippedCount)

	if data.totalCount == 0 then
		local empty=Instance.new("TextLabel")
		empty.Text="No spirits yet!\nKill enemies to earn them."
		empty.Font=Enum.Font.GothamBold empty.TextSize=14
		empty.TextColor3=Color3.fromRGB(120,140,180) empty.BackgroundTransparency=1
		empty.Size=UDim2.new(1,0,0,60) empty.TextWrapped=true
		empty.TextXAlignment=Enum.TextXAlignment.Center empty.Parent=scroll
		return
	end

	for i, spiritData in ipairs(data.spirits) do
		buildCard(spiritData, i)
	end
end

sg:GetPropertyChangedSignal("Enabled"):Connect(function()
	if not sg.Enabled then return end
	task.spawn(refresh)
end)

-- Show toast when a spirit drops
SpiritDropped:Connect(function(name, rarity, uid)
	local rarColor = RARITY_COLORS[rarity] or Color3.fromRGB(160,160,160)
	local toast=Instance.new("ScreenGui")
	toast.Name="SpiritToast" toast.ResetOnSpawn=false toast.DisplayOrder=20
	toast.Parent=player.PlayerGui
	local f=Instance.new("Frame")
	f.Size=UDim2.new(0,260,0,50) f.Position=UDim2.new(0.5,-130,0,80)
	f.BackgroundColor3=Color3.fromRGB(10,12,22) f.BorderSizePixel=0 f.Parent=toast
	corner(f,10)
	local s=Instance.new("UIStroke") s.Color=rarColor s.Thickness=2 s.Parent=f
	local l=Instance.new("TextLabel")
	l.Text=string.format("👻 Spirit: %s [%s]!", name, rarity)
	l.Font=Enum.Font.GothamBold l.TextSize=14 l.TextColor3=rarColor
	l.BackgroundTransparency=1 l.Size=UDim2.new(1,0,1,0) l.TextWrapped=true
	l.TextXAlignment=Enum.TextXAlignment.Center l.Parent=f
	task.delay(3, function() toast:Destroy() end)
end)
