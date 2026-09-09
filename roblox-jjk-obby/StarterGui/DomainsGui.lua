-- DomainsGui.lua (LocalScript inside ScreenGui "DomainsGui" → StarterGui)
-- Domain Expansions (Auras) — buy with trophies, requires rebirth count.

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService      = game:GetService("TweenService")

local player = Players.LocalPlayer
local sg     = script.Parent
sg.Enabled      = false
sg.ResetOnSpawn = false
sg.DisplayOrder = 14

local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")
local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local GetDomainsData  = RemoteFunctions:WaitForChild("GetDomainsData")
local BuyDomain       = RemoteEvents:WaitForChild("BuyDomain")
local EquipDomain     = RemoteEvents:WaitForChild("EquipDomain")

-- ── Helpers ───────────────────────────────────────────────────

local function corner(p,r) local c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,r or 8) c.Parent=p end
local function fmt(n)
	n=math.floor(n)
	if n>=1e9 then return string.format("%.1fB",n/1e9)
	elseif n>=1e6 then return string.format("%.1fM",n/1e6)
	elseif n>=1e3 then return string.format("%.1fK",n/1e3)
	else return tostring(n) end
end

-- ── Overlay ───────────────────────────────────────────────────

local overlay=Instance.new("Frame")
overlay.Size=UDim2.new(1,0,1,0) overlay.BackgroundColor3=Color3.new(0,0,0)
overlay.BackgroundTransparency=0.5 overlay.BorderSizePixel=0 overlay.Parent=sg
local ocb=Instance.new("TextButton") ocb.Size=UDim2.new(1,0,1,0)
ocb.BackgroundTransparency=1 ocb.Text="" ocb.Parent=overlay
ocb.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- ── Panel ─────────────────────────────────────────────────────

local panel=Instance.new("Frame")
panel.Name="DomainsPanel"
panel.Size=UDim2.new(0,480,0,500)
panel.Position=UDim2.new(0.5,-240,0.5,-250)
panel.BackgroundColor3=Color3.fromRGB(8,12,8)
panel.BorderSizePixel=0 panel.Parent=sg
corner(panel,14)
Instance.new("UIStroke",panel).Color=Color3.fromRGB(60,200,80)
local ps=panel:FindFirstChildOfClass("UIStroke") ps.Thickness=2

-- Header
local hdr=Instance.new("Frame")
hdr.Size=UDim2.new(1,0,0,52) hdr.BackgroundColor3=Color3.fromRGB(40,180,70)
hdr.BorderSizePixel=0 hdr.Parent=panel corner(hdr,14)
local htitle=Instance.new("TextLabel")
htitle.Text="⚡  DOMAINS" htitle.Font=Enum.Font.GothamBlack htitle.TextSize=22
htitle.TextColor3=Color3.fromRGB(5,20,5) htitle.BackgroundTransparency=1
htitle.Size=UDim2.new(1,-50,1,0) htitle.Position=UDim2.new(0,14,0,0)
htitle.TextXAlignment=Enum.TextXAlignment.Left htitle.Parent=hdr

local xBtn=Instance.new("TextButton") xBtn.Text="✕" xBtn.Font=Enum.Font.GothamBlack
xBtn.TextSize=20 xBtn.TextColor3=Color3.fromRGB(5,20,5) xBtn.BackgroundTransparency=1
xBtn.Size=UDim2.new(0,40,1,0) xBtn.Position=UDim2.new(1,-44,0,0) xBtn.Parent=hdr
xBtn.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- Scroll
local scroll=Instance.new("ScrollingFrame")
scroll.Size=UDim2.new(1,-16,1,-60) scroll.Position=UDim2.new(0,8,0,56)
scroll.BackgroundTransparency=1 scroll.BorderSizePixel=0
scroll.ScrollBarThickness=4 scroll.ScrollBarImageColor3=Color3.fromRGB(40,180,70)
scroll.CanvasSize=UDim2.new(0,0,0,0) scroll.AutomaticCanvasSize=Enum.AutomaticSize.Y
scroll.Parent=panel

local ll=Instance.new("UIListLayout") ll.SortOrder=Enum.SortOrder.LayoutOrder
ll.Padding=UDim.new(0,6) ll.Parent=scroll
Instance.new("UIPadding",scroll).PaddingTop=UDim.new(0,4)

-- ── Row builder ───────────────────────────────────────────────

local rowRefs = {}  -- [domainId] = {row, actionBtn}

local function buildRow(domain, order)
	local row=Instance.new("Frame")
	row.Size=UDim2.new(1,0,0,64)
	row.BackgroundColor3=Color3.fromRGB(14,22,14)
	row.BorderSizePixel=0 row.LayoutOrder=order row.Parent=scroll
	corner(row,8)

	-- Color stripe
	local stripe=Instance.new("Frame")
	stripe.Size=UDim2.new(0,5,1,0) stripe.BackgroundColor3=domain.color
	stripe.BorderSizePixel=0 stripe.Parent=row corner(stripe,4)

	-- Domain name
	local nameLbl=Instance.new("TextLabel")
	nameLbl.Text=domain.name nameLbl.Font=Enum.Font.GothamBold nameLbl.TextSize=15
	nameLbl.TextColor3=Color3.new(1,1,1) nameLbl.BackgroundTransparency=1
	nameLbl.Size=UDim2.new(0,210,0,28) nameLbl.Position=UDim2.new(0,14,0,6)
	nameLbl.TextXAlignment=Enum.TextXAlignment.Left nameLbl.Parent=row

	-- Damage mult
	local multLbl=Instance.new("TextLabel")
	multLbl.Text=string.format("💪 x%.2g Damage",domain.damageMult)
	multLbl.Font=Enum.Font.Gotham multLbl.TextSize=12
	multLbl.TextColor3=domain.color multLbl.BackgroundTransparency=1
	multLbl.Size=UDim2.new(0,210,0,22) multLbl.Position=UDim2.new(0,14,0,34)
	multLbl.TextXAlignment=Enum.TextXAlignment.Left multLbl.Parent=row

	-- Rebirth req
	local rebirthLbl=Instance.new("TextLabel")
	rebirthLbl.Text=domain.rebirthReq>0 and ("🔄 "..domain.rebirthReq.." Rebirths") or "⭐ No Rebirth"
	rebirthLbl.Font=Enum.Font.Gotham rebirthLbl.TextSize=11
	rebirthLbl.TextColor3=Color3.fromRGB(180,160,220) rebirthLbl.BackgroundTransparency=1
	rebirthLbl.Size=UDim2.new(0,140,0,18) rebirthLbl.Position=UDim2.new(0,14,1,-22)
	rebirthLbl.TextXAlignment=Enum.TextXAlignment.Left rebirthLbl.Parent=row

	-- Action button
	local actionBtn=Instance.new("TextButton")
	actionBtn.Font=Enum.Font.GothamBlack actionBtn.TextSize=13
	actionBtn.Size=UDim2.new(0,120,0,40) actionBtn.Position=UDim2.new(1,-128,0.5,-20)
	actionBtn.BorderSizePixel=0 actionBtn.Parent=row corner(actionBtn,8)

	rowRefs[domain.id] = { row=row, actionBtn=actionBtn }
	return actionBtn
end

-- ── Populate & refresh ────────────────────────────────────────

local cachedData = nil

local function refresh()
	-- clear old rows
	for _, ref in pairs(rowRefs) do ref.row:Destroy() end
	rowRefs = {}

	local data = cachedData
	if not data then return end

	local ownedSet = {}
	for _, id in ipairs(data.ownedDomains) do ownedSet[id]=true end

	local GameData = require(ReplicatedStorage.Modules.GameData)
	for i, domain in ipairs(GameData.Domains) do
		local btn = buildRow(domain, i)
		local isOwned    = ownedSet[domain.id]
		local isEquipped = data.equippedDomain == domain.id
		local canAfford  = data.trophies >= domain.trophyCost
		local canRebirth = data.rebirthCount >= domain.rebirthReq

		if isEquipped then
			btn.Text="✅ Equipped" btn.BackgroundColor3=Color3.fromRGB(30,120,30)
			btn.TextColor3=Color3.new(1,1,1)
			btn.MouseButton1Click:Connect(function() end)
		elseif isOwned then
			btn.Text="Equip" btn.BackgroundColor3=domain.color
			btn.TextColor3=Color3.fromRGB(5,10,5)
			btn.MouseButton1Click:Connect(function()
				EquipDomain:FireServer(domain.id)
				task.wait(0.3)
				cachedData = GetDomainsData:InvokeServer()
				refresh()
			end)
		else
			if domain.trophyCost == 0 then
				btn.Text="FREE" btn.BackgroundColor3=Color3.fromRGB(40,160,60)
				btn.TextColor3=Color3.new(1,1,1)
				btn.MouseButton1Click:Connect(function()
					BuyDomain:FireServer(domain.id)
					task.wait(0.3)
					cachedData = GetDomainsData:InvokeServer()
					refresh()
				end)
			elseif not canRebirth then
				btn.Text="🔒 Locked" btn.BackgroundColor3=Color3.fromRGB(50,50,50)
				btn.TextColor3=Color3.fromRGB(120,120,120)
				btn.MouseButton1Click:Connect(function() end)
			elseif not canAfford then
				btn.Text="🏆 "..fmt(domain.trophyCost)
				btn.BackgroundColor3=Color3.fromRGB(80,60,20)
				btn.TextColor3=Color3.fromRGB(200,160,60)
				btn.MouseButton1Click:Connect(function() end)
			else
				btn.Text="🏆 "..fmt(domain.trophyCost)
				btn.BackgroundColor3=domain.color btn.TextColor3=Color3.fromRGB(5,10,5)
				btn.MouseButton1Click:Connect(function()
					BuyDomain:FireServer(domain.id)
					task.wait(0.3)
					cachedData = GetDomainsData:InvokeServer()
					refresh()
				end)
			end
		end
	end
end

sg:GetPropertyChangedSignal("Enabled"):Connect(function()
	if not sg.Enabled then return end
	task.spawn(function()
		cachedData = GetDomainsData:InvokeServer()
		refresh()
	end)
end)
