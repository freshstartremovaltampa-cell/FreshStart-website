-- CharacterMorphManager.server.lua (Script → ServerScriptService)
-- Applies stage-specific character appearance on evolution and respawn.
--
-- DROP MODELS HERE:
--   ServerStorage/CharacterMorphs/Sorcerer/Stage1_Weakling   (Model, valid R6 rig)
--   ServerStorage/CharacterMorphs/Sorcerer/Stage2_Grade4     ...etc
--   ServerStorage/CharacterMorphs/CurseSpirit/Stage1_CursedWomb
--   ...
--
-- Accepted name formats for each model: "Stage3_Grade3", "Stage3", or "Grade3"
-- If a model is missing the game falls back to body color + aura particles.
-- Models are added one at a time; fallback covers any not yet uploaded.

local Players           = game:GetService("Players")
local ServerStorage     = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local GameData = require(ReplicatedStorage.Modules.GameData)
local function PDM() return require(game.ServerScriptService.PlayerDataManager) end

-- ── Morph folder scaffold ─────────────────────────────────────────────────

local MorphsRoot = ServerStorage:FindFirstChild("CharacterMorphs")
if not MorphsRoot then
	MorphsRoot = Instance.new("Folder")
	MorphsRoot.Name   = "CharacterMorphs"
	MorphsRoot.Parent = ServerStorage
end
for _, pathName in ipairs({"Sorcerer","CurseSpirit"}) do
	if not MorphsRoot:FindFirstChild(pathName) then
		local f = Instance.new("Folder")
		f.Name = pathName
		f.Parent = MorphsRoot
	end
end

-- ── Helpers ───────────────────────────────────────────────────────────────

local morphingPlayers = {}  -- [userId] = true while a swap is in progress

local function getStageInfo(path, stageId)
	local stages = GameData.Stages[path]
	return stages and stages[stageId]
end

local function findMorphModel(path, stageId, stageName)
	local folder = MorphsRoot:FindFirstChild(path)
	if not folder then return nil end
	local candidates = {
		"Stage"..stageId.."_"..stageName,
		"Stage"..stageId,
		stageName,
	}
	for _, name in ipairs(candidates) do
		local m = folder:FindFirstChild(name)
		if m and m:IsA("Model") then return m end
	end
	return nil
end

local R6_PARTS = {
	"Head","Torso","Left Arm","Right Arm","Left Leg","Right Leg",
}
local R15_PARTS = {
	"UpperTorso","LowerTorso",
	"LeftUpperArm","RightUpperArm","LeftLowerArm","RightLowerArm","LeftHand","RightHand",
	"LeftUpperLeg","RightUpperLeg","LeftLowerLeg","RightLowerLeg","LeftFoot","RightFoot",
	"Head",
}

local function colorCharacter(character, stageColor)
	for _, name in ipairs(R6_PARTS) do
		local p = character:FindFirstChild(name)
		if p and p:IsA("BasePart") then
			p.Color    = stageColor
			p.Material = Enum.Material.Neon
		end
	end
	for _, name in ipairs(R15_PARTS) do
		local p = character:FindFirstChild(name)
		if p and p:IsA("BasePart") then
			p.Color    = stageColor
			p.Material = Enum.Material.Neon
		end
	end
end

local function clearAura(character)
	for _, desc in ipairs(character:GetDescendants()) do
		if desc.Name == "MorphAuraAtt" then desc:Destroy() end
	end
end

local function addAura(character, stageColor)
	clearAura(character)
	local anchor = character:FindFirstChild("Torso") or character:FindFirstChild("UpperTorso")
	if not anchor then return end

	local att   = Instance.new("Attachment")
	att.Name    = "MorphAuraAtt"
	att.Parent  = anchor

	local p = Instance.new("ParticleEmitter")
	p.Name          = "MorphAura"
	p.Color         = ColorSequence.new(stageColor)
	p.LightEmission  = 0.85
	p.LightInfluence = 0
	p.Size          = NumberSequence.new({
		NumberSequenceKeypoint.new(0,   0.3),
		NumberSequenceKeypoint.new(0.5, 0.7),
		NumberSequenceKeypoint.new(1,   0),
	})
	p.Transparency  = NumberSequence.new({
		NumberSequenceKeypoint.new(0, 0.2),
		NumberSequenceKeypoint.new(1, 1),
	})
	p.Lifetime    = NumberRange.new(0.6, 1.5)
	p.Rate        = 25
	p.Speed       = NumberRange.new(2, 6)
	p.SpreadAngle = Vector2.new(45, 45)
	p.RotSpeed    = NumberRange.new(-45, 45)
	p.Rotation    = NumberRange.new(0, 360)
	p.Parent      = att
end

local function applyFallback(character, stageColor)
	colorCharacter(character, stageColor)
	addAura(character, stageColor)
end

local function addNameTag(character, displayName, stageColor)
	local head = character:FindFirstChild("Head")
	if not head then return end
	local existing = head:FindFirstChild("StageTag")
	if existing then existing:Destroy() end

	local bg           = Instance.new("BillboardGui")
	bg.Name            = "StageTag"
	bg.Size            = UDim2.new(0, 180, 0, 36)
	bg.StudsOffset     = Vector3.new(0, 2.5, 0)
	bg.AlwaysOnTop     = false
	bg.Parent          = head

	local lbl               = Instance.new("TextLabel")
	lbl.Size                = UDim2.new(1, 0, 1, 0)
	lbl.Text                = displayName
	lbl.Font                = Enum.Font.GothamBlack
	lbl.TextSize            = 13
	lbl.TextColor3          = stageColor
	lbl.BackgroundColor3    = Color3.fromRGB(5, 5, 15)
	lbl.BackgroundTransparency = 0.3
	lbl.TextWrapped         = true
	lbl.TextScaled          = false
	lbl.Parent              = bg

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 6)
	corner.Parent = lbl
end

-- ── Full model swap ───────────────────────────────────────────────────────

local function swapCharacter(player, morphModel, stageInfo)
	local oldChar = player.Character
	if not oldChar then return end

	local oldHRP = oldChar:FindFirstChild("HumanoidRootPart")
	local oldHum = oldChar:FindFirstChild("Humanoid")
	if not oldHRP or not oldHum then return end

	local spawnCF     = oldHRP.CFrame * CFrame.new(0, 2, 0)
	local healthRatio = oldHum.MaxHealth > 0 and (oldHum.Health / oldHum.MaxHealth) or 1

	-- Rescue equipped tools into backpack before old character is destroyed
	for _, child in ipairs(oldChar:GetChildren()) do
		if child:IsA("Tool") then
			child.Parent = player.Backpack
		end
	end

	local newChar  = morphModel:Clone()
	newChar.Name   = player.Name
	newChar.Parent = workspace

	local newHRP = newChar:FindFirstChild("HumanoidRootPart")
	if newHRP then
		newHRP.CFrame   = spawnCF
		newHRP.Anchored = false
	end

	-- Flag so CharacterAdded listeners know this was triggered by us
	morphingPlayers[player.UserId] = true

	player.Character = newChar

	-- Apply health ratio and name tag after Humanoid initialises
	task.defer(function()
		local newHum = newChar:FindFirstChild("Humanoid")
		if newHum then
			newHum.Health = math.max(1, newHum.MaxHealth * healthRatio)
		end
		if stageInfo then
			addAura(newChar, stageInfo.color)
			addNameTag(newChar, stageInfo.displayName, stageInfo.color)
		end
	end)

	task.delay(0.2, function()
		if oldChar and oldChar.Parent then oldChar:Destroy() end
	end)
	task.delay(4, function()
		morphingPlayers[player.UserId] = nil
	end)
end

-- ── Public API ────────────────────────────────────────────────────────────

local CharacterMorphManager = {}

-- Called by TrophyManager after a successful stage purchase.
function CharacterMorphManager.applyStageAppearance(player, path, stageId)
	local info = getStageInfo(path, stageId)
	if not info then return end

	local morph = findMorphModel(path, stageId, info.name)

	if morph
	and morph:FindFirstChild("HumanoidRootPart")
	and morph:FindFirstChild("Humanoid") then
		swapCharacter(player, morph, info)
	else
		-- Fallback: recolor + aura on current character
		local char = player.Character
		if char then
			applyFallback(char, info.color)
			addNameTag(char, info.displayName, info.color)
		end
	end
end

-- ── Auto-apply on every respawn ───────────────────────────────────────────

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function(char)
		if morphingPlayers[player.UserId] then
			-- Triggered by our own swap — just add the name tag (aura already added in defer)
			return
		end

		-- Normal spawn/respawn: wait for StageManager to teleport (2s), then apply
		task.wait(2.5)
		if not player.Character or player.Character ~= char then return end

		local data = PDM().Get(player)
		if not data or not data.path then return end

		local info = getStageInfo(data.path, data.stage or 1)
		if info then
			applyFallback(char, info.color)
			addNameTag(char, info.displayName, info.color)
		end
	end)
end)

return CharacterMorphManager
