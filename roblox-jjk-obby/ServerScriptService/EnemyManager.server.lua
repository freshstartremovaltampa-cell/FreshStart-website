-- EnemyManager.server.lua (Script → ServerScriptService)
-- Spawns enemies appropriate for each player's path and stage, handles combat and loot drops

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage     = game:GetService("ServerStorage")

local GameData          = require(ReplicatedStorage.Modules.GameData)

local function getPlayerDataManager()
	return require(game.ServerScriptService.PlayerDataManager)
end
local function getStageManager()
	return require(game.ServerScriptService.StageManager)
end
local function getCursedToolManager()
	return require(game.ServerScriptService.CursedToolManager)
end

local RemoteEvents  = ReplicatedStorage:WaitForChild("RemoteEvents")
local EnemyKilled   = RemoteEvents:WaitForChild("EnemyKilled")   -- server → client: (enemyName, dropped tool or nil)

-- Expects enemy model templates in ServerStorage/EnemyModels/<enemyId>
-- Each model must have a Humanoid and HumanoidRootPart
local EnemyModels = ServerStorage:WaitForChild("EnemyModels")

-- Active enemy instances: [enemyModel] = { ownerId, enemyData }
local activeEnemies = {}

local function rollDrop(enemyData)
	if math.random() > enemyData.dropChance then return nil end
	local pool = enemyData.dropTable
	if #pool == 0 then return nil end
	return pool[math.random(1, #pool)]
end

local function spawnEnemy(player, enemyData, spawnCFrame)
	local template = EnemyModels:FindFirstChild(enemyData.id)
	if not template then
		warn("[EnemyManager] No model found for enemy: " .. enemyData.id)
		return
	end

	local enemy = template:Clone()
	enemy.Parent = workspace

	local hrp = enemy:FindFirstChild("HumanoidRootPart")
	if hrp then
		hrp.CFrame = spawnCFrame
	end

	local humanoid = enemy:FindFirstChildOfClass("Humanoid")
	if humanoid then
		humanoid.MaxHealth = enemyData.health
		humanoid.Health    = enemyData.health
		humanoid.WalkSpeed = enemyData.speed
	end

	activeEnemies[enemy] = { ownerId = player.UserId, enemyData = enemyData }

	-- Simple chase AI: enemy walks toward its owner player
	task.spawn(function()
		while enemy.Parent and humanoid and humanoid.Health > 0 do
			local char = player.Character
			if char then
				local targetHRP = char:FindFirstChild("HumanoidRootPart")
				if targetHRP and hrp then
					humanoid:MoveTo(targetHRP.Position)
				end
			end
			task.wait(0.5)
		end
	end)

	-- Death handler
	humanoid.Died:Connect(function()
		activeEnemies[enemy] = nil

		-- Register kill with StageManager
		getStageManager().RegisterKill(player)

		-- Roll for loot drop
		local droppedToolId = rollDrop(enemyData)
		if droppedToolId then
			local added = getCursedToolManager().GiveTool(player, droppedToolId)
			if added then
				EnemyKilled:FireClient(player, enemyData.name, droppedToolId)
			else
				EnemyKilled:FireClient(player, enemyData.name, nil)
			end
		else
			EnemyKilled:FireClient(player, enemyData.name, nil)
		end

		task.delay(2, function()
			if enemy.Parent then enemy:Destroy() end
		end)
	end)

	-- Enemy deals damage to player on touch
	for _, part in ipairs(enemy:GetDescendants()) do
		if part:IsA("BasePart") and part.Name ~= "HumanoidRootPart" then
			part.Touched:Connect(function(hit)
				local char = player.Character
				if not char then return end

				local hum = char:FindFirstChildOfClass("Humanoid")
				if hum and hit:IsDescendantOf(char) then
					hum:TakeDamage(enemyData.damage * 0.1)  -- tick damage on touch
				end
			end)
		end
	end
end

local function getStageSpawnPositions(stageId)
	-- Returns up to 5 CFrames near the stage's spawn point with slight offsets
	local locationId = math.min(stageId, 7)
	local locationData = GameData.Locations[locationId]
	if not locationData then return {} end

	local stagesFolder = workspace:FindFirstChild("Stages")
	if not stagesFolder then return {} end

	local locationFolder = stagesFolder:FindFirstChild(locationData.name)
	if not locationFolder then return {} end

	local spawnPart = locationFolder:FindFirstChild("StageSpawn")
	if not spawnPart then return {} end

	local base = spawnPart.CFrame
	local offsets = {
		Vector3.new(10,  0,  0),
		Vector3.new(-10, 0,  0),
		Vector3.new(0,   0,  10),
		Vector3.new(0,   0, -10),
		Vector3.new(8,   0,  8),
	}

	local positions = {}
	for _, offset in ipairs(offsets) do
		table.insert(positions, base + offset)
	end
	return positions
end

-- Spawn a wave of enemies for a player when they enter a stage
local function spawnWaveForPlayer(player)
	local PDM  = getPlayerDataManager()
	local data = PDM.Get(player)
	if not data or not data.path then return end

	local stageId = data.stage
	local eligible = GameData.GetEnemiesForStage(data.path, stageId)
	if #eligible == 0 then return end

	local spawnPositions = getStageSpawnPositions(stageId)
	if #spawnPositions == 0 then return end

	-- Pick a random eligible enemy type and spawn 3-5 of them
	local count = math.random(3, 5)
	for i = 1, count do
		local enemyData    = eligible[math.random(1, #eligible)]
		local spawnCFrame  = spawnPositions[((i - 1) % #spawnPositions) + 1]
		spawnEnemy(player, enemyData, spawnCFrame)
		task.wait(0.3)
	end
end

-- Listen for stage advancement to spawn new waves
local StageComplete = RemoteEvents:WaitForChild("StageComplete")
-- StageComplete fires client-side; server spawns wave proactively when stage advances
-- We hook into StageManager via a BindableEvent instead

local SpawnWaveEvent = Instance.new("BindableEvent")
SpawnWaveEvent.Name  = "SpawnWaveEvent"
SpawnWaveEvent.Parent = game.ServerScriptService

SpawnWaveEvent.Event:Connect(function(player)
	spawnWaveForPlayer(player)
end)

-- Expose for StageManager to fire
local EnemyManager = {}
function EnemyManager.SpawnWave(player)
	SpawnWaveEvent:Fire(player)
end

-- Initial wave when player joins and has a path
Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		task.wait(2)  -- let everything load
		spawnWaveForPlayer(player)
	end)
end)

return EnemyManager
