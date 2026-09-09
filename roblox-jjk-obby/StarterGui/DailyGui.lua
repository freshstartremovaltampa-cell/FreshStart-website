-- DailyGui.lua (LocalScript inside ScreenGui "DailyGui" → StarterGui)
-- 7-day daily reward popup matching the Dino Evolution layout.

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService      = game:GetService("TweenService")

local player = Players.LocalPlayer
local sg     = script.Parent
sg.Enabled      = false
sg.ResetOnSpawn = false
sg.DisplayOrder = 15

local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")
local ClaimDailyReward = RemoteFunctions:WaitForChild("ClaimDailyReward")
local GetDailyStatus   = RemoteFunctions:WaitForChild("GetDailyStatus")

-- ── Helpers ───────────────────────────────────────────────────

local function corner(p, r) local c=Instance.new("UICorner") c.CornerRadius=UDim.new(0,r or 8) c.Parent=p end
local function label(p, text, font, size, color)
	local l=Instance.new("TextLabel") l.Text=text l.Font=font or Enum.Font.GothamBold
	l.TextSize=size or 14 l.TextColor3=color or Color3.new(1,1,1)
	l.BackgroundTransparency=1 l.Size=UDim2.new(1,0,1,0) l.Parent=p return l
end

local function fmtTime(secs)
	secs = math.max(0, math.floor(secs))
	local h = math.floor(secs/3600)
	local m = math.floor((secs%3600)/60)
	local s = secs % 60
	return string.format("%02d:%02d:%02d", h, m, s)
end

-- ── Overlay ───────────────────────────────────────────────────

local overlay = Instance.new("Frame")
overlay.Size=UDim2.new(1,0,1,0) overlay.BackgroundColor3=Color3.new(0,0,0)
overlay.BackgroundTransparency=0.5 overlay.BorderSizePixel=0 overlay.Parent=sg
local ocb=Instance.new("TextButton") ocb.Size=UDim2.new(1,0,1,0)
ocb.BackgroundTransparency=1 ocb.Text="" ocb.Parent=overlay
ocb.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- ── Panel ─────────────────────────────────────────────────────

local panel=Instance.new("Frame")
panel.Name="DailyPanel"
panel.Size=UDim2.new(0,560,0,420)
panel.Position=UDim2.new(0.5,-280,0.5,-210)
panel.BackgroundColor3=Color3.fromRGB(20,15,8)
panel.BorderSizePixel=0 panel.Parent=sg
corner(panel,14)
local ps=Instance.new("UIStroke") ps.Color=Color3.fromRGB(255,165,0) ps.Thickness=2 ps.Parent=panel

-- Header
local hdr=Instance.new("Frame")
hdr.Size=UDim2.new(1,0,0,52) hdr.BackgroundColor3=Color3.fromRGB(220,130,0)
hdr.BorderSizePixel=0 hdr.Parent=panel corner(hdr,14)
local htitle=label(hdr,"🎁  DAILY REWARDS",Enum.Font.GothamBlack,22,Color3.fromRGB(10,5,0))
htitle.Position=UDim2.new(0,14,0,0) htitle.TextXAlignment=Enum.TextXAlignment.Left
htitle.Size=UDim2.new(1,-50,1,0)

local xBtn=Instance.new("TextButton") xBtn.Text="✕" xBtn.Font=Enum.Font.GothamBlack
xBtn.TextSize=20 xBtn.TextColor3=Color3.fromRGB(10,5,0) xBtn.BackgroundTransparency=1
xBtn.Size=UDim2.new(0,40,1,0) xBtn.Position=UDim2.new(1,-44,0,0) xBtn.Parent=hdr
xBtn.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- ── Day cards ─────────────────────────────────────────────────

local CARD_COLORS = {
	claimed  = Color3.fromRGB(50,100,50),
	active   = Color3.fromRGB(60,45,10),
	locked   = Color3.fromRGB(35,30,20),
}
local RARITY_EMOJIS = { trophies="🏆", speed="⚡", tool="🗡️", hp="❤️", chest="💜" }

-- Days 1-6 grid (3 cols × 2 rows)
local gridFrame=Instance.new("Frame")
gridFrame.Size=UDim2.new(0,380,0,340)
gridFrame.Position=UDim2.new(0,10,0,58)
gridFrame.BackgroundTransparency=1 gridFrame.Parent=panel

local CARD_W = 118
local CARD_H = 158

local dayCards = {}  -- [dayNum] = {frame, statusLbl, timerLbl}

local GameData = require(ReplicatedStorage.Modules.GameData)

for i = 1, 6 do
	local col = (i-1) % 3
	local row = math.floor((i-1) / 3)
	local reward = GameData.DailyRewards[i]

	local card = Instance.new("Frame")
	card.Size     = UDim2.new(0,CARD_W,0,CARD_H)
	card.Position = UDim2.new(0, col*(CARD_W+8), 0, row*(CARD_H+8))
	card.BackgroundColor3 = CARD_COLORS.locked
	card.BorderSizePixel  = 0
	card.Parent = gridFrame
	corner(card,10)

	-- Day number
	local dayLbl=Instance.new("TextLabel")
	dayLbl.Text="Day "..i dayLbl.Font=Enum.Font.GothamBlack dayLbl.TextSize=14
	dayLbl.TextColor3=Color3.fromRGB(255,200,50) dayLbl.BackgroundColor3=Color3.fromRGB(60,45,5)
	dayLbl.Size=UDim2.new(1,0,0,24) dayLbl.TextXAlignment=Enum.TextXAlignment.Center
	dayLbl.BorderSizePixel=0 dayLbl.Parent=card corner(dayLbl,0)

	-- Emoji icon
	local icon=Instance.new("TextLabel")
	icon.Text=reward.emoji icon.Font=Enum.Font.GothamBold icon.TextSize=36
	icon.BackgroundTransparency=1 icon.Size=UDim2.new(1,0,0,50)
	icon.Position=UDim2.new(0,0,0,28) icon.TextXAlignment=Enum.TextXAlignment.Center
	icon.Parent=card

	-- Reward label
	local rLbl=Instance.new("TextLabel")
	rLbl.Text=reward.label rLbl.Font=Enum.Font.GothamBold rLbl.TextSize=11
	rLbl.TextColor3=Color3.fromRGB(230,210,180) rLbl.BackgroundTransparency=1
	rLbl.Size=UDim2.new(1,-8,0,34) rLbl.Position=UDim2.new(0,4,0,80)
	rLbl.TextWrapped=true rLbl.TextXAlignment=Enum.TextXAlignment.Center rLbl.Parent=card

	-- Status / timer
	local statusBg=Instance.new("Frame")
	statusBg.Size=UDim2.new(1,0,0,28) statusBg.Position=UDim2.new(0,0,1,-28)
	statusBg.BackgroundColor3=Color3.fromRGB(80,60,10) statusBg.BorderSizePixel=0 statusBg.Parent=card
	corner(statusBg,8)
	local statusLbl=Instance.new("TextLabel")
	statusLbl.Text="LOCKED" statusLbl.Font=Enum.Font.GothamBlack statusLbl.TextSize=12
	statusLbl.TextColor3=Color3.fromRGB(180,170,150) statusLbl.BackgroundTransparency=1
	statusLbl.Size=UDim2.new(1,0,1,0) statusLbl.TextXAlignment=Enum.TextXAlignment.Center
	statusLbl.Parent=statusBg

	dayCards[i] = { frame=card, statusBg=statusBg, statusLbl=statusLbl }
end

-- Day 7 — big card on the right
local day7Reward = GameData.DailyRewards[7]
local big = Instance.new("Frame")
big.Size=UDim2.new(0,148,0,340) big.Position=UDim2.new(0,398,0,58)
big.BackgroundColor3=CARD_COLORS.locked big.BorderSizePixel=0 big.Parent=panel
corner(big,12)
local bigStroke=Instance.new("UIStroke") bigStroke.Color=Color3.fromRGB(255,100,220) bigStroke.Thickness=2 bigStroke.Parent=big

local bigDay=Instance.new("TextLabel") bigDay.Text="Day 7" bigDay.Font=Enum.Font.GothamBlack
bigDay.TextSize=16 bigDay.TextColor3=Color3.fromRGB(255,100,220) bigDay.BackgroundColor3=Color3.fromRGB(50,10,50)
bigDay.Size=UDim2.new(1,0,0,28) bigDay.TextXAlignment=Enum.TextXAlignment.Center
bigDay.BorderSizePixel=0 bigDay.Parent=big corner(bigDay,0)

local limitedLbl=Instance.new("TextLabel") limitedLbl.Text="Limited!" limitedLbl.Font=Enum.Font.GothamBlack
limitedLbl.TextSize=18 limitedLbl.TextColor3=Color3.fromRGB(255,60,60)
limitedLbl.BackgroundTransparency=1 limitedLbl.Size=UDim2.new(1,0,0,28) limitedLbl.Position=UDim2.new(0,0,0,30)
limitedLbl.TextXAlignment=Enum.TextXAlignment.Center limitedLbl.Parent=big

local bigEmoji=Instance.new("TextLabel") bigEmoji.Text="💜" bigEmoji.Font=Enum.Font.GothamBold
bigEmoji.TextSize=56 bigEmoji.BackgroundTransparency=1 bigEmoji.Size=UDim2.new(1,0,0,70)
bigEmoji.Position=UDim2.new(0,0,0,62) bigEmoji.TextXAlignment=Enum.TextXAlignment.Center bigEmoji.Parent=big

local bigName=Instance.new("TextLabel") bigName.Text="Legendary\nChest" bigName.Font=Enum.Font.GothamBlack
bigName.TextSize=16 bigName.TextColor3=Color3.fromRGB(255,200,50) bigName.BackgroundTransparency=1
bigName.Size=UDim2.new(1,0,0,48) bigName.Position=UDim2.new(0,0,0,140)
bigName.TextXAlignment=Enum.TextXAlignment.Center bigName.TextWrapped=true bigName.Parent=big

local day7StatusBg=Instance.new("Frame")
day7StatusBg.Size=UDim2.new(1,0,0,36) day7StatusBg.Position=UDim2.new(0,0,1,-36)
day7StatusBg.BackgroundColor3=Color3.fromRGB(80,20,80) day7StatusBg.BorderSizePixel=0 day7StatusBg.Parent=big
corner(day7StatusBg,10)
local day7StatusLbl=Instance.new("TextLabel") day7StatusLbl.Text="LOCKED"
day7StatusLbl.Font=Enum.Font.GothamBlack day7StatusLbl.TextSize=13
day7StatusLbl.TextColor3=Color3.fromRGB(200,170,220) day7StatusLbl.BackgroundTransparency=1
day7StatusLbl.Size=UDim2.new(1,0,1,0) day7StatusLbl.TextXAlignment=Enum.TextXAlignment.Center
day7StatusLbl.Parent=day7StatusBg
dayCards[7] = { frame=big, statusBg=day7StatusBg, statusLbl=day7StatusLbl }

-- ── Claim button ──────────────────────────────────────────────

local claimBtn=Instance.new("TextButton")
claimBtn.Text="🎁  CLAIM TODAY'S REWARD"
claimBtn.Font=Enum.Font.GothamBlack claimBtn.TextSize=17
claimBtn.TextColor3=Color3.fromRGB(10,5,0) claimBtn.BackgroundColor3=Color3.fromRGB(255,160,0)
claimBtn.Size=UDim2.new(1,-20,0,44) claimBtn.Position=UDim2.new(0,10,1,-52)
claimBtn.BorderSizePixel=0 claimBtn.Parent=panel corner(claimBtn,10)

-- ── State & refresh ───────────────────────────────────────────

local statusData = nil   -- cached from server
local timerRunning = false

local function refreshCards()
	if not statusData then return end
	local nextDay = statusData.nextDay
	local canClaim = statusData.canClaim
	local streak   = statusData.streak

	for i = 1, 7 do
		local c = dayCards[i]
		if i < nextDay then
			-- already claimed in current rotation
			c.frame.BackgroundColor3 = CARD_COLORS.claimed
			c.statusBg.BackgroundColor3 = Color3.fromRGB(30,80,30)
			c.statusLbl.Text = "✅ Claimed!"
			c.statusLbl.TextColor3 = Color3.fromRGB(100,230,100)
		elseif i == nextDay then
			c.frame.BackgroundColor3 = CARD_COLORS.active
			if canClaim then
				c.statusBg.BackgroundColor3 = Color3.fromRGB(200,100,0)
				c.statusLbl.Text = "CLAIM!"
				c.statusLbl.TextColor3 = Color3.new(1,1,1)
			else
				c.statusBg.BackgroundColor3 = Color3.fromRGB(80,60,10)
				c.statusLbl.Text = fmtTime(statusData.waitSecs)
				c.statusLbl.TextColor3 = Color3.fromRGB(230,200,100)
			end
		else
			c.frame.BackgroundColor3 = CARD_COLORS.locked
			c.statusBg.BackgroundColor3 = Color3.fromRGB(50,40,20)
			c.statusLbl.Text = "LOCKED"
			c.statusLbl.TextColor3 = Color3.fromRGB(180,160,130)
		end
	end

	claimBtn.BackgroundColor3 = canClaim and Color3.fromRGB(255,160,0) or Color3.fromRGB(60,50,30)
	claimBtn.TextColor3 = canClaim and Color3.fromRGB(10,5,0) or Color3.fromRGB(120,110,80)
end

-- Countdown tick
task.spawn(function()
	while true do
		task.wait(1)
		if sg.Enabled and statusData and not statusData.canClaim then
			statusData.waitSecs = math.max(0, statusData.waitSecs - 1)
			if statusData.waitSecs <= 0 then
				statusData.canClaim = true
			end
			refreshCards()
		end
	end
end)

sg:GetPropertyChangedSignal("Enabled"):Connect(function()
	if not sg.Enabled then return end
	task.spawn(function()
		statusData = GetDailyStatus:InvokeServer()
		refreshCards()
	end)
end)

claimBtn.MouseButton1Click:Connect(function()
	if not statusData or not statusData.canClaim then return end
	claimBtn.Text = "Claiming..."
	local result = ClaimDailyReward:InvokeServer()
	if result and result.ok then
		statusData.streak   = result.streak
		statusData.nextDay  = (result.streak % 7) + 1
		statusData.canClaim = false
		statusData.waitSecs = 86400
		refreshCards()
		claimBtn.Text = "🎁  CLAIM TODAY'S REWARD"
	else
		claimBtn.Text = "🎁  CLAIM TODAY'S REWARD"
	end
end)
