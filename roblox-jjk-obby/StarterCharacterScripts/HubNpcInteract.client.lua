-- HubNpcInteract.client.lua (LocalScript → StarterCharacterScripts)
-- Handles proximity prompt interaction with the Path Switch NPC in the hub

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player    = Players.LocalPlayer
local character = player.Character or player.CharacterAdded:Wait()

local RemoteEvents = ReplicatedStorage:WaitForChild("RemoteEvents")
local SwitchPath   = RemoteEvents:WaitForChild("SwitchPath")

-- The Path Switch NPC should be a Model in Workspace named "PathSwitchNPC"
-- with a ProximityPrompt inside its HumanoidRootPart (or any BasePart)
local npc = workspace:WaitForChild("Hub", 15) and
            workspace.Hub:WaitForChild("PathSwitchNPC", 10)

if not npc then
	warn("[HubNpcInteract] PathSwitchNPC not found in workspace.Hub")
	return
end

-- Find or create ProximityPrompt
local prompt = npc:FindFirstChildWhichIsA("ProximityPrompt", true)
if not prompt then
	local hrp = npc:FindFirstChild("HumanoidRootPart") or npc:FindFirstChildWhichIsA("BasePart")
	if hrp then
		prompt = Instance.new("ProximityPrompt")
		prompt.ActionText    = "Switch Path"
		prompt.ObjectText    = "Kenjaku"
		prompt.HoldDuration  = 0
		prompt.MaxActivationDistance = 10
		prompt.Parent = hrp
	end
end

if not prompt then
	warn("[HubNpcInteract] Could not find or create ProximityPrompt on PathSwitchNPC")
	return
end

-- Show confirmation dialog before firing switch
local function showSwitchConfirm()
	local playerGui = player.PlayerGui
	local confirmGui = playerGui:FindFirstChild("SwitchConfirmGui")
	if confirmGui then confirmGui:Destroy() end  -- remove stale instance

	local sg = Instance.new("ScreenGui")
	sg.Name            = "SwitchConfirmGui"
	sg.ResetOnSpawn    = false
	sg.DisplayOrder    = 20
	sg.Parent = playerGui

	local overlay = Instance.new("Frame")
	overlay.Size             = UDim2.new(1, 0, 1, 0)
	overlay.BackgroundColor3 = Color3.fromRGB(0, 0, 0)
	overlay.BackgroundTransparency = 0.5
	overlay.BorderSizePixel  = 0
	overlay.Parent = sg

	local box = Instance.new("Frame")
	box.Size             = UDim2.new(0, 420, 0, 220)
	box.Position         = UDim2.new(0.5, -210, 0.5, -110)
	box.BackgroundColor3 = Color3.fromRGB(10, 10, 22)
	box.BorderSizePixel  = 0
	box.Parent = sg

	local boxCorner = Instance.new("UICorner")
	boxCorner.CornerRadius = UDim.new(0, 14)
	boxCorner.Parent = box

	local boxStroke = Instance.new("UIStroke")
	boxStroke.Color     = Color3.fromRGB(255, 200, 50)
	boxStroke.Thickness = 2
	boxStroke.Parent = box

	local titleLbl = Instance.new("TextLabel")
	titleLbl.Text      = "Switch Evolution Path?"
	titleLbl.Font      = Enum.Font.GothamBlack
	titleLbl.TextSize  = 20
	titleLbl.TextColor3 = Color3.fromRGB(255, 200, 50)
	titleLbl.Size      = UDim2.new(1, 0, 0, 44)
	titleLbl.Position  = UDim2.new(0, 0, 0, 10)
	titleLbl.BackgroundTransparency = 1
	titleLbl.Parent = box

	local bodyLbl = Instance.new("TextLabel")
	bodyLbl.Text      = "Your evolution resets to Stage 1 on the opposite path.\nYour cursed tools carry over.\n\nFree after completing all 8 stages — otherwise costs Robux."
	bodyLbl.Font      = Enum.Font.Gotham
	bodyLbl.TextSize  = 13
	bodyLbl.TextColor3 = Color3.fromRGB(180, 180, 200)
	bodyLbl.Size      = UDim2.new(0.9, 0, 0, 80)
	bodyLbl.Position  = UDim2.new(0.05, 0, 0, 58)
	bodyLbl.TextWrapped = true
	bodyLbl.BackgroundTransparency = 1
	bodyLbl.Parent = box

	-- Confirm button
	local confirmBtn = Instance.new("TextButton")
	confirmBtn.Text             = "SWITCH PATH"
	confirmBtn.Font             = Enum.Font.GothamBold
	confirmBtn.TextSize         = 15
	confirmBtn.TextColor3       = Color3.fromRGB(5, 5, 15)
	confirmBtn.BackgroundColor3 = Color3.fromRGB(255, 200, 50)
	confirmBtn.Size             = UDim2.new(0, 160, 0, 40)
	confirmBtn.Position         = UDim2.new(0.5, -170, 1, -56)
	confirmBtn.Parent = box
	local cc = Instance.new("UICorner"); cc.CornerRadius = UDim.new(0,8); cc.Parent = confirmBtn

	-- Cancel button
	local cancelBtn = Instance.new("TextButton")
	cancelBtn.Text             = "CANCEL"
	cancelBtn.Font             = Enum.Font.GothamBold
	cancelBtn.TextSize         = 15
	cancelBtn.TextColor3       = Color3.fromRGB(200, 200, 220)
	cancelBtn.BackgroundColor3 = Color3.fromRGB(40, 40, 60)
	cancelBtn.Size             = UDim2.new(0, 120, 0, 40)
	cancelBtn.Position         = UDim2.new(0.5, 20, 1, -56)
	cancelBtn.Parent = box
	local cc2 = Instance.new("UICorner"); cc2.CornerRadius = UDim.new(0,8); cc2.Parent = cancelBtn

	confirmBtn.MouseButton1Click:Connect(function()
		sg:Destroy()
		SwitchPath:FireServer()
	end)

	cancelBtn.MouseButton1Click:Connect(function()
		sg:Destroy()
	end)
end

prompt.Triggered:Connect(function(triggeringPlayer)
	if triggeringPlayer == player then
		showSwitchConfirm()
	end
end)
