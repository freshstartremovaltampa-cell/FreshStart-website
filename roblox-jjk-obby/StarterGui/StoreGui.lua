-- StoreGui.lua (LocalScript inside ScreenGui "StoreGui" → StarterGui)
-- Popup store matching the Dino Evolution aesthetic

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")
local TweenService      = game:GetService("TweenService")

local player = Players.LocalPlayer
local sg     = script.Parent
sg.Enabled       = false
sg.ResetOnSpawn  = false
sg.DisplayOrder  = 12

local GameData = require(ReplicatedStorage.Modules.GameData)

-- Overlay
local overlay = Instance.new("Frame")
overlay.Size             = UDim2.new(1,0,1,0)
overlay.BackgroundColor3 = Color3.new(0,0,0)
overlay.BackgroundTransparency = 0.5
overlay.BorderSizePixel  = 0
overlay.Parent = sg

-- Close on overlay click
local closeArea = Instance.new("TextButton")
closeArea.Size=UDim2.new(1,0,1,0)
closeArea.BackgroundTransparency=1
closeArea.Text=""
closeArea.Parent=overlay
closeArea.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- Store panel
local panel = Instance.new("Frame")
panel.Name             = "StorePanel"
panel.Size             = UDim2.new(0,520,0,520)
panel.Position         = UDim2.new(0.5,-260,0.5,-260)
panel.BackgroundColor3 = Color3.fromRGB(10,10,22)
panel.BorderSizePixel  = 0
panel.Parent = sg

local pc = Instance.new("UICorner"); pc.CornerRadius=UDim.new(0,14); pc.Parent=panel
local ps = Instance.new("UIStroke"); ps.Color=Color3.fromRGB(255,160,0); ps.Thickness=2; ps.Parent=panel

-- Header
local header = Instance.new("Frame")
header.Size=UDim2.new(1,0,0,50)
header.BackgroundColor3=Color3.fromRGB(255,140,0)
header.BorderSizePixel=0
header.Parent=panel
local hc=Instance.new("UICorner"); hc.CornerRadius=UDim.new(0,14); hc.Parent=header

local hTitle = Instance.new("TextLabel")
hTitle.Text="🏪  CURSED STORE"
hTitle.Font=Enum.Font.GothamBlack
hTitle.TextSize=22
hTitle.TextColor3=Color3.fromRGB(5,5,15)
hTitle.Size=UDim2.new(1,-50,1,0)
hTitle.Position=UDim2.new(0,12,0,0)
hTitle.BackgroundTransparency=1
hTitle.TextXAlignment=Enum.TextXAlignment.Left
hTitle.Parent=header

local closeBtn = Instance.new("TextButton")
closeBtn.Text="✕"
closeBtn.Font=Enum.Font.GothamBlack
closeBtn.TextSize=20
closeBtn.TextColor3=Color3.fromRGB(5,5,15)
closeBtn.BackgroundTransparency=1
closeBtn.Size=UDim2.new(0,40,1,0)
closeBtn.Position=UDim2.new(1,-42,0,0)
closeBtn.Parent=header
closeBtn.MouseButton1Click:Connect(function() sg.Enabled=false end)

-- Scroll
local scroll = Instance.new("ScrollingFrame")
scroll.Size=UDim2.new(1,-16,1,-58)
scroll.Position=UDim2.new(0,8,0,54)
scroll.BackgroundTransparency=1
scroll.BorderSizePixel=0
scroll.ScrollBarThickness=4
scroll.ScrollBarImageColor3=Color3.fromRGB(255,160,0)
scroll.CanvasSize=UDim2.new(0,0,0,0)
scroll.AutomaticCanvasSize=Enum.AutomaticSize.Y
scroll.Parent=panel

local ll=Instance.new("UIListLayout")
ll.SortOrder=Enum.SortOrder.LayoutOrder
ll.Padding=UDim.new(0,8)
ll.Parent=scroll
Instance.new("UIPadding",scroll).PaddingTop=UDim.new(0,6)

-- Item categories
local categories = {
	{ label="⚡  PERMANENT BOOSTS", color=Color3.fromRGB(255,140,0), items={
		{ name="x2 DAMAGE",          desc="Double your damage output forever.", price="299 R$",  color=Color3.fromRGB(220,80,0),  key="DoubleDamage"  },
		{ name="+5 Speed PERMANENT", desc="Add 5 walkspeed permanently.",        price="199 R$",  color=Color3.fromRGB(0,120,180), key="SpeedBoost"    },
		{ name="VIP Pass",           desc="2x trophies, 2x damage, VIP aura.",   price="499 R$",  color=Color3.fromRGB(160,40,220),key="VipPass"       },
		{ name="Auto Fight",         desc="Auto-attack nearby enemies.",          price="99 R$",   color=Color3.fromRGB(60,160,60), key="AutoFight"     },
	}},
	{ label="🏆  TROPHIES", color=Color3.fromRGB(255,200,50), items={
		{ name="1,000 Trophies",  desc="Instantly receive 1,000 trophies.",  price="29 R$",  color=Color3.fromRGB(80,120,200), key="Trophies1k"  },
		{ name="5,000 Trophies",  desc="Instantly receive 5,000 trophies.",  price="99 R$",  color=Color3.fromRGB(60,100,180), key="Trophies5k"  },
		{ name="25,000 Trophies", desc="Instantly receive 25,000 trophies.", price="399 R$", color=Color3.fromRGB(40,80,160),  key="Trophies25k" },
	}},
	{ label="⏳  BOOSTS (LIMITED)", color=Color3.fromRGB(60,200,140), items={
		{ name="2x Trophies (1 Hour)", desc="Double trophy gain for 1 hour.", price="49 R$", color=Color3.fromRGB(40,160,120), key="DoubleTrophies1h" },
	}},
}

for _, cat in ipairs(categories) do
	-- Category header
	local catLabel = Instance.new("TextLabel")
	catLabel.Text=cat.label
	catLabel.Font=Enum.Font.GothamBlack
	catLabel.TextSize=14
	catLabel.TextColor3=cat.color
	catLabel.Size=UDim2.new(1,0,0,26)
	catLabel.BackgroundTransparency=1
	catLabel.TextXAlignment=Enum.TextXAlignment.Left
	catLabel.LayoutOrder=_
	catLabel.Parent=scroll

	for _, item in ipairs(cat.items) do
		local row=Instance.new("Frame")
		row.Size=UDim2.new(1,0,0,54)
		row.BackgroundColor3=Color3.fromRGB(18,18,34)
		row.BorderSizePixel=0
		row.LayoutOrder=_
		row.Parent=scroll
		local rc=Instance.new("UICorner"); rc.CornerRadius=UDim.new(0,8); rc.Parent=row

		local colorStripe=Instance.new("Frame")
		colorStripe.Size=UDim2.new(0,5,1,0)
		colorStripe.BackgroundColor3=item.color
		colorStripe.BorderSizePixel=0
		colorStripe.Parent=row
		local sc2=Instance.new("UICorner"); sc2.CornerRadius=UDim.new(0,4); sc2.Parent=colorStripe

		local nameLbl=Instance.new("TextLabel")
		nameLbl.Text=item.name
		nameLbl.Font=Enum.Font.GothamBold
		nameLbl.TextSize=14
		nameLbl.TextColor3=Color3.new(1,1,1)
		nameLbl.Size=UDim2.new(0.55,0,0.5,0)
		nameLbl.Position=UDim2.new(0,14,0,4)
		nameLbl.BackgroundTransparency=1
		nameLbl.TextXAlignment=Enum.TextXAlignment.Left
		nameLbl.Parent=row

		local descLbl=Instance.new("TextLabel")
		descLbl.Text=item.desc
		descLbl.Font=Enum.Font.Gotham
		descLbl.TextSize=11
		descLbl.TextColor3=Color3.fromRGB(150,150,170)
		descLbl.Size=UDim2.new(0.55,0,0.5,0)
		descLbl.Position=UDim2.new(0,14,0.5,0)
		descLbl.BackgroundTransparency=1
		descLbl.TextXAlignment=Enum.TextXAlignment.Left
		descLbl.TextWrapped=true
		descLbl.Parent=row

		local buyBtn=Instance.new("TextButton")
		buyBtn.Text=item.price
		buyBtn.Font=Enum.Font.GothamBlack
		buyBtn.TextSize=13
		buyBtn.TextColor3=Color3.fromRGB(5,5,15)
		buyBtn.BackgroundColor3=item.color
		buyBtn.Size=UDim2.new(0,100,0,36)
		buyBtn.Position=UDim2.new(1,-110,0.5,-18)
		buyBtn.BorderSizePixel=0
		buyBtn.Parent=row
		local bc=Instance.new("UICorner"); bc.CornerRadius=UDim.new(0,8); bc.Parent=buyBtn

		buyBtn.MouseButton1Click:Connect(function()
			local product = GameData.Products[item.key]
			if product and product.productId ~= 0 then
				MarketplaceService:PromptProductPurchase(player, product.productId)
			end
		end)
	end
end
