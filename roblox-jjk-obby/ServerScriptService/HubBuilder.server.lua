-- HubBuilder.server.lua (Script → ServerScriptService)
-- Builds the hub: baseplate, evolution showcase pedestals (both paths),
-- Kenjaku NPC, and the path select area

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameData          = require(ReplicatedStorage.Modules.GameData)

local HUB_CENTER = Vector3.new(-600, 100, 0)  -- hub sits at X=-600, stages go X=0,600...

-- ----------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------

local function makePart(parent, name, size, pos, color, material, anchored, transparency)
	local p          = Instance.new("Part")
	p.Name           = name
	p.Size           = size
	p.Position       = pos
	p.Color          = color or Color3.fromRGB(100,100,100)
	p.Material       = material or Enum.Material.SmoothPlastic
	p.Anchored       = anchored ~= false
	p.CanCollide     = true
	p.CastShadow     = false
	p.Transparency   = transparency or 0
	p.Parent         = parent
	return p
end

local function makeBillboard(adornee, text, textColor, bgColor, sizeY, textSize)
	local bg           = Instance.new("BillboardGui")
	bg.Adornee         = adornee
	bg.Size            = UDim2.new(0, 160, 0, sizeY or 50)
	bg.StudsOffset     = Vector3.new(0, adornee.Size.Y/2 + 1.2, 0)
	bg.AlwaysOnTop     = false
	bg.Parent          = adornee

	local label        = Instance.new("TextLabel")
	label.Size         = UDim2.new(1,0,1,0)
	label.Text         = text
	label.Font         = Enum.Font.GothamBold
	label.TextSize     = textSize or 14
	label.TextColor3   = textColor or Color3.new(1,1,1)
	label.TextWrapped  = true
	label.BackgroundColor3 = bgColor or Color3.fromRGB(10,10,20)
	label.BackgroundTransparency = 0.15
	label.Parent       = bg

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0,6)
	corner.Parent       = label

	return bg
end

local function makeProximityPrompt(parent, actionText, objectText, holdDuration)
	local pp            = Instance.new("ProximityPrompt")
	pp.ActionText       = actionText
	pp.ObjectText       = objectText
	pp.HoldDuration     = holdDuration or 0
	pp.MaxActivationDistance = 10
	pp.Parent           = parent
	return pp
end

-- ----------------------------------------------------------------
-- Hub folder
-- ----------------------------------------------------------------

local hubFolder = Instance.new("Folder")
hubFolder.Name  = "Hub"
hubFolder.Parent = workspace

-- Baseplate
local base = makePart(
	hubFolder, "HubBase",
	Vector3.new(400, 2, 500),
	HUB_CENTER + Vector3.new(0, -1, 0),
	Color3.fromRGB(20,20,30),
	Enum.Material.SmoothPlastic
)

-- Boundary walls (invisible)
local walls = {
	{ Vector3.new(2,30,500), Vector3.new(-200,15,0) },
	{ Vector3.new(2,30,500), Vector3.new( 200,15,0) },
	{ Vector3.new(400,30,2), Vector3.new(0,15, 250) },
	{ Vector3.new(400,30,2), Vector3.new(0,15,-250) },
}
for _, w in ipairs(walls) do
	local wall = makePart(hubFolder,"Wall",w[1],HUB_CENTER+w[2],Color3.fromRGB(30,30,40))
	wall.Transparency = 0.8
end

-- ----------------------------------------------------------------
-- Spawn platform (center hub)
-- ----------------------------------------------------------------

local spawnPlat = makePart(
	hubFolder, "HubSpawn",
	Vector3.new(30,1,30),
	HUB_CENTER + Vector3.new(0,1,0),
	Color3.fromRGB(40,40,60),
	Enum.Material.SmoothPlastic
)

local spawnLoc        = Instance.new("SpawnLocation")
spawnLoc.Name         = "HubSpawnPoint"
spawnLoc.Size         = Vector3.new(6,0.1,6)
spawnLoc.Position     = HUB_CENTER + Vector3.new(0,2,0)
spawnLoc.Anchored     = true
spawnLoc.CanCollide   = false
spawnLoc.Transparency = 1
spawnLoc.TeamColor    = BrickColor.new("Bright blue")
spawnLoc.AllowTeamChangeOnTouch = false
spawnLoc.Parent       = hubFolder

-- Hub title sign
local titlePart = makePart(hubFolder,"TitleSign",Vector3.new(60,6,1),
	HUB_CENTER+Vector3.new(0,8,-240),Color3.fromRGB(15,15,25))
makeBillboard(titlePart,
	"⚔  CURSED EVOLUTION OBBY  ☠\nChoose your path below",
	Color3.fromRGB(255,200,50),
	Color3.fromRGB(10,10,25), 70, 18)

-- ----------------------------------------------------------------
-- Evolution Showcase Pedestals
-- LEFT row (Z = -200 to +150): Sorcerer path
-- RIGHT row (Z = -200 to +150): Curse Spirit path
-- ----------------------------------------------------------------

local PEDESTAL_SPACING = 50
local LEFT_X  = HUB_CENTER.X - 90   -- Sorcerer side
local RIGHT_X = HUB_CENTER.X + 90   -- CurseSpirit side
local ROW_Z_START = HUB_CENTER.Z - 175

-- Row labels
local sorcLabelPart = makePart(hubFolder,"SorcLabel",Vector3.new(60,3,1),
	Vector3.new(LEFT_X, HUB_CENTER.Y+10, ROW_Z_START-10),Color3.fromRGB(20,40,80))
makeBillboard(sorcLabelPart,"⚔  SORCERER PATH",Color3.fromRGB(100,160,255),Color3.fromRGB(10,20,50),40,16)

local curseLabel = makePart(hubFolder,"CurseLabel",Vector3.new(60,3,1),
	Vector3.new(RIGHT_X, HUB_CENTER.Y+10, ROW_Z_START-10),Color3.fromRGB(80,10,10))
makeBillboard(curseLabel,"☠  CURSE SPIRIT PATH",Color3.fromRGB(220,80,80),Color3.fromRGB(40,5,5),40,16)

local function buildShowcaseRow(path, baseX)
	local stages = GameData.Stages[path]

	for i, stageData in ipairs(stages) do
		local zPos    = ROW_Z_START + (i-1) * PEDESTAL_SPACING
		local worldPos = Vector3.new(baseX, HUB_CENTER.Y, zPos)
		local cost    = GameData.TrophyStageCosts[i] or 0

		-- Pedestal column
		local column = makePart(hubFolder,
			"Pedestal_"..path.."_"..i,
			Vector3.new(4,8,4),
			worldPos + Vector3.new(0,-3,0),
			Color3.fromRGB(30,30,40),
			Enum.Material.SmoothPlastic)

		-- Stage display platform (top of column)
		local topPlat = makePart(hubFolder,
			"PedestalTop_"..path.."_"..i,
			Vector3.new(8,1,8),
			worldPos + Vector3.new(0,2,0),
			stageData.color,
			Enum.Material.Neon)

		-- Stage number circle
		local numPart = makePart(hubFolder,
			"StageNum_"..path.."_"..i,
			Vector3.new(3,3,3),
			worldPos + Vector3.new(0,3.5,0),
			stageData.color,
			Enum.Material.Neon)
		numPart.Shape = Enum.PartType.Ball

		-- Billboard: name + cost
		local costText = (i == 1) and "START" or
			(cost >= 1000000 and string.format("%.1fM Trophies", cost/1000000)) or
			(cost >= 1000    and string.format("%.1fK Trophies", cost/1000))    or
			(cost .. " Trophies")

		makeBillboard(topPlat,
			string.format("%d.  %s\n🏆 %s", i, stageData.displayName, costText),
			Color3.new(1,1,1),
			Color3.fromRGB(10,10,22),
			65, 13)

		-- ProximityPrompt to buy stage
		if i > 1 then
			local pp = makeProximityPrompt(topPlat,
				"Evolve  🏆 " .. costText,
				stageData.displayName)

			-- LocalScript approach: trigger sends BuyStageRequest remote to server
			-- The actual logic is in TrophyManager; the prompt is just the activator
			-- We attach a helper Script that fires the remote when activated
			local ppScript = Instance.new("LocalScript")
			ppScript.Source = string.format([[
				local pp = script.Parent:WaitForChild("ProximityPrompt")
				local RS = game:GetService("ReplicatedStorage")
				local BuyStageRequest = RS:WaitForChild("RemoteEvents"):WaitForChild("BuyStageRequest")
				pp.Triggered:Connect(function()
					BuyStageRequest:FireServer(%d)
				end)
			]], i)
			ppScript.Parent = topPlat
		end
	end
end

buildShowcaseRow("Sorcerer",    LEFT_X)
buildShowcaseRow("CurseSpirit", RIGHT_X)

-- ----------------------------------------------------------------
-- Dividing path (walkway between the two rows)
-- ----------------------------------------------------------------

makePart(hubFolder,"Walkway",
	Vector3.new(60,1,350),
	HUB_CENTER + Vector3.new(0,0,0),
	Color3.fromRGB(25,25,35),
	Enum.Material.SmoothPlastic)

-- ----------------------------------------------------------------
-- Kenjaku NPC (path switch)
-- ----------------------------------------------------------------

local npcFolder      = Instance.new("Model")
npcFolder.Name       = "PathSwitchNPC"
npcFolder.Parent     = hubFolder

local npcBody        = makePart(npcFolder,"HumanoidRootPart",
	Vector3.new(2,3,1),
	HUB_CENTER + Vector3.new(0,2.5,230),
	Color3.fromRGB(20,20,30))

local npcHead        = makePart(npcFolder,"Head",
	Vector3.new(2,2,2),
	HUB_CENTER + Vector3.new(0,5,230),
	Color3.fromRGB(200,80,80),
	Enum.Material.Neon)
npcHead.Shape        = Enum.PartType.Ball

npcFolder.PrimaryPart = npcBody

makeBillboard(npcHead,
	"Kenjaku\n[Switch Path]",
	Color3.fromRGB(255,200,50),
	Color3.fromRGB(10,5,20),
	55, 14)

makeProximityPrompt(npcBody, "Switch Path", "Kenjaku")

-- ----------------------------------------------------------------
-- Path Selection NPCs (initial choice; only visible before choosing)
-- ----------------------------------------------------------------

local function makePathNPC(name, xOff, label, color, pathKey)
	local folder = Instance.new("Model")
	folder.Name  = name
	folder.Parent = hubFolder

	local body = makePart(folder,"HumanoidRootPart",
		Vector3.new(2,3,1),
		HUB_CENTER + Vector3.new(xOff, 2.5, -220),
		Color3.fromRGB(30,30,40))

	local head = makePart(folder,"Head",Vector3.new(2.5,2.5,2.5),
		HUB_CENTER + Vector3.new(xOff, 5.5, -220),
		color, Enum.Material.Neon)
	head.Shape = Enum.PartType.Ball

	makeBillboard(head, label, Color3.new(1,1,1), Color3.fromRGB(10,10,20), 60, 14)
	makeProximityPrompt(body, "Choose Path", label:match("^[^\n]+"))

	local ppScript = Instance.new("LocalScript")
	ppScript.Source = string.format([[
		local pp = script.Parent:WaitForChild("HumanoidRootPart"):WaitForChild("ProximityPrompt")
		local RS = game:GetService("ReplicatedStorage")
		local SelectPath = RS:WaitForChild("RemoteEvents"):WaitForChild("SelectPath")
		pp.Triggered:Connect(function()
			SelectPath:FireServer(%q)
		end)
	]], pathKey)
	ppScript.Parent = folder
end

makePathNPC("SorcererNPC",  -80, "⚔  Sorcerer Path\nMaster cursed energy", Color3.fromRGB(80,120,220), "Sorcerer")
makePathNPC("CurseNPC",      80, "☠  Curse Spirit Path\nConsume and evolve", Color3.fromRGB(200,40,40),  "CurseSpirit")

-- ----------------------------------------------------------------
-- Stage entrance gate (portal to Stage 1)
-- ----------------------------------------------------------------

local gateBase = makePart(hubFolder,"StageGate",
	Vector3.new(20,12,2),
	HUB_CENTER + Vector3.new(0,6,260),
	Color3.fromRGB(15,5,40),
	Enum.Material.Neon)

makeBillboard(gateBase,
	"ENTER STAGES\n→",
	Color3.fromRGB(255,200,50),
	Color3.fromRGB(10,5,30), 55, 18)

local gatePrompt = makeProximityPrompt(gateBase, "Enter Stages", "Stage Gate")

local gateScript = Instance.new("LocalScript")
gateScript.Source = [[
	local pp = script.Parent:WaitForChild("ProximityPrompt")
	local RS = game:GetService("ReplicatedStorage")
	local BuyStageRequest = RS:WaitForChild("RemoteEvents"):WaitForChild("BuyStageRequest")
	-- "entering" fires stage 1 teleport — handled server-side by PathManager on join
	-- This just signals the server to teleport player to their current stage
	pp.Triggered:Connect(function()
		local StageEndReached = RS:WaitForChild("RemoteEvents"):WaitForChild("StageEndReached")
		-- Fire with stageId 0 = "go to current stage location"
		StageEndReached:FireServer(0)
	end)
]]
gateScript.Parent = gateBase

print("[HubBuilder] Hub built.")
