-- AttackClient.client.lua (LocalScript → StarterPlayerScripts)
-- Left-click or tap to attack. Fires AttackRequest remote; server handles damage.
-- Plays a neon burst VFX at the player's position.
-- If the player has the AutoFight perk, attacks automatically every cooldown tick.

local Players           = game:GetService("Players")
local UserInputService  = game:GetService("UserInputService")
local TweenService      = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer

local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")

local AttackRequest  = RemoteEvents:WaitForChild("AttackRequest")
local PathChanged    = RemoteEvents:WaitForChild("PathChanged")
local GetPlayerData  = RemoteFunctions:WaitForChild("GetPlayerData")

local COOLDOWN   = 0.55   -- matches server; prevents spamming the remote
local lastSwing  = 0
local swingColor = Color3.fromRGB(80, 140, 255)  -- updated by PathChanged

-- ── Swing color follows the player's path ─────────────────────────────────

PathChanged:Connect(function(path)
	swingColor = (path == "CurseSpirit")
		and Color3.fromRGB(130, 40, 170)
		or  Color3.fromRGB(80, 140, 255)
end)

-- ── Visual effect (expanding Neon sphere that fades out) ──────────────────

local function showSwingEffect()
	local char = player.Character
	local hrp  = char and char:FindFirstChild("HumanoidRootPart")
	if not hrp then return end

	local flash          = Instance.new("Part")
	flash.Shape          = Enum.PartType.Ball
	flash.Size           = Vector3.new(5, 5, 5)
	flash.CFrame         = hrp.CFrame
	flash.Color          = swingColor
	flash.Material       = Enum.Material.Neon
	flash.Transparency   = 0.25
	flash.CanCollide     = false
	flash.CastShadow     = false
	flash.Anchored       = true
	flash.Parent         = workspace

	local tween = TweenService:Create(
		flash,
		TweenInfo.new(0.28, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
		{ Size = Vector3.new(22, 22, 22), Transparency = 1 }
	)
	tween:Play()
	tween.Completed:Connect(function() flash:Destroy() end)
end

-- ── Core attack function ───────────────────────────────────────────────────

local function attack()
	if not player.Character then return end
	local now = tick()
	if now - lastSwing < COOLDOWN then return end
	lastSwing = now
	AttackRequest:FireServer()
	showSwingEffect()
end

-- ── Input ──────────────────────────────────────────────────────────────────

UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end
	if  input.UserInputType == Enum.UserInputType.MouseButton1
	or  input.UserInputType == Enum.UserInputType.Touch then
		attack()
	end
end)

-- ── Auto-Fight perk ────────────────────────────────────────────────────────

local autoActive = false

local function startAuto()
	if autoActive then return end
	autoActive = true
	task.spawn(function()
		while autoActive do
			attack()
			task.wait(COOLDOWN + 0.05)
		end
	end)
end

local function stopAuto()
	autoActive = false
end

-- Re-check perk on each respawn (perk can be purchased mid-session)
local function checkAutoFight()
	task.wait(2.5)  -- let PlayerDataManager finish loading
	local ok, data = pcall(function() return GetPlayerData:InvokeServer() end)
	if ok and data and data.hasAutoFight then
		startAuto()
	end
end

player.CharacterAdded:Connect(function()
	stopAuto()  -- stop old loop; restart cleanly for new character
	checkAutoFight()
end)

-- Initial check for players who are already in-game when this script loads
if player.Character then
	checkAutoFight()
end
