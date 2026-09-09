-- RebirthGui.lua (LocalScript inside ScreenGui "RebirthGui" → StarterGui)
-- Confirmation popup showing rebirth rewards and what resets vs. keeps

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local sg     = script.Parent
sg.Enabled       = false
sg.ResetOnSpawn  = false
sg.DisplayOrder  = 13

local GameData      = require(ReplicatedStorage.Modules.GameData)
local RemoteEvents  = ReplicatedStorage:WaitForChild("RemoteEvents")
local RebirthRequest = RemoteEvents:WaitForChild("RebirthRequest")
local GetPlayerData  = ReplicatedStorage:WaitForChild("RemoteFunctions"):WaitForChild("GetPlayerData")

-- Overlay
local overlay = Instance.new("Frame")
overlay.Size=UDim2.new(1,0,1,0)
overlay.BackgroundColor3=Color3.new(0,0,0)
overlay.BackgroundTransparency=0.55
overlay.BorderSizePixel=0
overlay.Parent=sg

local ocb=Instance.new("TextButton")
ocb.Size=UDim2.new(1,0,1,0)
ocb.BackgroundTransparency=1
ocb.Text=""
ocb.Parent=overlay
ocb.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- Panel
local panel=Instance.new("Frame")
panel.Name="RebirthPanel"
panel.Size=UDim2.new(0,420,0,460)
panel.Position=UDim2.new(0.5,-210,0.5,-230)
panel.BackgroundColor3=Color3.fromRGB(10,5,25)
panel.BorderSizePixel=0
panel.Parent=sg
local pc=Instance.new("UICorner"); pc.CornerRadius=UDim.new(0,14); pc.Parent=panel
local ps=Instance.new("UIStroke"); ps.Color=Color3.fromRGB(200,80,220); ps.Thickness=2; ps.Parent=panel

-- Header
local hdr=Instance.new("Frame")
hdr.Size=UDim2.new(1,0,0,52)
hdr.BackgroundColor3=Color3.fromRGB(150,40,200)
hdr.BorderSizePixel=0
hdr.Parent=panel
local hc=Instance.new("UICorner"); hc.CornerRadius=UDim.new(0,14); hc.Parent=hdr

local hTitle=Instance.new("TextLabel")
hTitle.Text="🔄  REBIRTH"
hTitle.Font=Enum.Font.GothamBlack
hTitle.TextSize=24
hTitle.TextColor3=Color3.new(1,1,1)
hTitle.Size=UDim2.new(1,-50,1,0)
hTitle.Position=UDim2.new(0,14,0,0)
hTitle.BackgroundTransparency=1
hTitle.TextXAlignment=Enum.TextXAlignment.Left
hTitle.Parent=hdr

local xBtn=Instance.new("TextButton")
xBtn.Text="✕"
xBtn.Font=Enum.Font.GothamBlack
xBtn.TextSize=20
xBtn.TextColor3=Color3.new(1,1,1)
xBtn.BackgroundTransparency=1
xBtn.Size=UDim2.new(0,40,1,0)
xBtn.Position=UDim2.new(1,-42,0,0)
xBtn.Parent=hdr
xBtn.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- Next rebirth info label (updated dynamically)
local infoLbl=Instance.new("TextLabel")
infoLbl.Name="InfoLabel"
infoLbl.Text="Loading..."
infoLbl.Font=Enum.Font.GothamBold
infoLbl.TextSize=16
infoLbl.TextColor3=Color3.fromRGB(220,160,255)
infoLbl.Size=UDim2.new(1,-20,0,40)
infoLbl.Position=UDim2.new(0,10,0,60)
infoLbl.BackgroundTransparency=1
infoLbl.TextWrapped=true
infoLbl.TextXAlignment=Enum.TextXAlignment.Center
infoLbl.Parent=panel

-- What resets
local resetFrame=Instance.new("Frame")
resetFrame.Size=UDim2.new(0.46,-8,0,160)
resetFrame.Position=UDim2.new(0,10,0,108)
resetFrame.BackgroundColor3=Color3.fromRGB(60,10,10)
resetFrame.BorderSizePixel=0
resetFrame.Parent=panel
local r1=Instance.new("UICorner"); r1.CornerRadius=UDim.new(0,8); r1.Parent=resetFrame

local resetTitle=Instance.new("TextLabel")
resetTitle.Text="❌  RESETS"
resetTitle.Font=Enum.Font.GothamBlack
resetTitle.TextSize=14
resetTitle.TextColor3=Color3.fromRGB(255,80,80)
resetTitle.Size=UDim2.new(1,0,0,28)
resetTitle.Position=UDim2.new(0,0,0,4)
resetTitle.BackgroundTransparency=1
resetTitle.TextXAlignment=Enum.TextXAlignment.Center
resetTitle.Parent=resetFrame

local resetItems={"Evolution Stage","Trophies","Level & XP","Damage Boosts"}
for i,item in ipairs(resetItems) do
	local l=Instance.new("TextLabel")
	l.Text="•  "..item
	l.Font=Enum.Font.Gotham
	l.TextSize=13
	l.TextColor3=Color3.fromRGB(220,140,140)
	l.Size=UDim2.new(1,-12,0,24)
	l.Position=UDim2.new(0,8,0,28+i*24)
	l.BackgroundTransparency=1
	l.TextXAlignment=Enum.TextXAlignment.Left
	l.Parent=resetFrame
end

-- What you keep
local keepFrame=Instance.new("Frame")
keepFrame.Size=UDim2.new(0.46,-8,0,160)
keepFrame.Position=UDim2.new(0.5,2,0,108)
keepFrame.BackgroundColor3=Color3.fromRGB(10,40,10)
keepFrame.BorderSizePixel=0
keepFrame.Parent=panel
local k1=Instance.new("UICorner"); k1.CornerRadius=UDim.new(0,8); k1.Parent=keepFrame

local keepTitle=Instance.new("TextLabel")
keepTitle.Text="✅  KEEP"
keepTitle.Font=Enum.Font.GothamBlack
keepTitle.TextSize=14
keepTitle.TextColor3=Color3.fromRGB(80,255,80)
keepTitle.Size=UDim2.new(1,0,0,28)
keepTitle.Position=UDim2.new(0,0,0,4)
keepTitle.BackgroundTransparency=1
keepTitle.TextXAlignment=Enum.TextXAlignment.Center
keepTitle.Parent=keepFrame

local keepItems={"Cursed Tools","Permanent Perks","VIP Status","Path Choice"}
for i,item in ipairs(keepItems) do
	local l=Instance.new("TextLabel")
	l.Text="•  "..item
	l.Font=Enum.Font.Gotham
	l.TextSize=13
	l.TextColor3=Color3.fromRGB(140,220,140)
	l.Size=UDim2.new(1,-12,0,24)
	l.Position=UDim2.new(0,8,0,28+i*24)
	l.BackgroundTransparency=1
	l.TextXAlignment=Enum.TextXAlignment.Left
	l.Parent=keepFrame
end

-- Requirement label
local reqLbl=Instance.new("TextLabel")
reqLbl.Name="ReqLabel"
reqLbl.Text="Requires: Stage 8 (Sukuna)"
reqLbl.Font=Enum.Font.GothamBold
reqLbl.TextSize=13
reqLbl.TextColor3=Color3.fromRGB(200,200,220)
reqLbl.Size=UDim2.new(1,-20,0,22)
reqLbl.Position=UDim2.new(0,10,0,278)
reqLbl.BackgroundTransparency=1
reqLbl.TextXAlignment=Enum.TextXAlignment.Center
reqLbl.Parent=panel

-- REBIRTH button
local rebirthBtn=Instance.new("TextButton")
rebirthBtn.Text="🔄  REBIRTH NOW"
rebirthBtn.Font=Enum.Font.GothamBlack
rebirthBtn.TextSize=18
rebirthBtn.TextColor3=Color3.new(1,1,1)
rebirthBtn.BackgroundColor3=Color3.fromRGB(150,40,200)
rebirthBtn.Size=UDim2.new(1,-24,0,52)
rebirthBtn.Position=UDim2.new(0,12,0,308)
rebirthBtn.BorderSizePixel=0
rebirthBtn.Parent=panel
local rb=Instance.new("UICorner"); rb.CornerRadius=UDim.new(0,12); rb.Parent=rebirthBtn

-- Cancel
local cancelBtn=Instance.new("TextButton")
cancelBtn.Text="Cancel"
cancelBtn.Font=Enum.Font.Gotham
cancelBtn.TextSize=13
cancelBtn.TextColor3=Color3.fromRGB(160,160,180)
cancelBtn.BackgroundColor3=Color3.fromRGB(30,30,50)
cancelBtn.Size=UDim2.new(1,-24,0,36)
cancelBtn.Position=UDim2.new(0,12,0,368)
cancelBtn.BorderSizePixel=0
cancelBtn.Parent=panel
local cb2=Instance.new("UICorner"); cb2.CornerRadius=UDim.new(0,8); cb2.Parent=cancelBtn
cancelBtn.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- Update info when GUI opens
sg:GetPropertyChangedSignal("Enabled"):Connect(function()
	if not sg.Enabled then return end
	task.spawn(function()
		local data = GetPlayerData:InvokeServer()
		if not data then return end
		local nextRebirth = data.rebirthCount + 1
		local mult = GameData.GetRebirthMultiplier(nextRebirth)
		infoLbl.Text = string.format(
			"You are Rebirth #%d\nNext Rebirth: x%.2f Damage Multiplier",
			data.rebirthCount, mult)
		local canRebirth = data.stage >= 8
		rebirthBtn.BackgroundColor3 = canRebirth
			and Color3.fromRGB(150,40,200)
			or  Color3.fromRGB(60,60,80)
		reqLbl.Text = canRebirth
			and "✅  Requirement met — you are Sukuna!"
			or  "⚠  Reach Stage 8 (Sukuna) to rebirth"
		reqLbl.TextColor3 = canRebirth
			and Color3.fromRGB(80,220,80)
			or  Color3.fromRGB(220,100,100)
	end)
end)

rebirthBtn.MouseButton1Click:Connect(function()
	RebirthRequest:FireServer()
	sg.Enabled = false
end)
