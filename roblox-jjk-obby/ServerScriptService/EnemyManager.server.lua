-- EnemyManager.server.lua (Script → ServerScriptService)
-- Continuous wave-based combat. Each player gets their own wave loop inside
-- their current arena. Waves scale in enemy count and health per wave.
-- Wave clear awards bonus trophies, then the next wave starts after 3 seconds.

local Players           = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage     = game:GetService("ServerStorage")

local GameData = require(ReplicatedStorage.Modules.GameData)

local function PDM() return require(game.ServerScriptService.PlayerDataManager) end
local function TM()  return require(game.ServerScriptService.TrophyManager)     end
local function CTM() return require(game.ServerScriptService.CursedToolManager) end

local RemoteEvents = ReplicatedStorage:WaitForChild("RemoteEvents")
local EnemyKilled  = RemoteEvents:WaitForChild("EnemyKilled")
local WaveUpdate   = RemoteEvents:WaitForChild("WaveUpdate")

local EnemyModels = ServerStorage:WaitForChild("EnemyModels")

-- playerState[userId] = { wave=N, aliveCount=N, active=bool, lastStage=N }
local playerState   = {}
-- playerEnemies[userId] = { [enemyModel] = true }
local playerEnemies = {}

local MAX_WAVE_ENEMIES  = 8
local HEALTH_SCALE_RATE = 0.15  -- +15% health per wave
local WAVE_BONUS_MULT   = 5     -- bonus trophies = base * this on wave clear

-- ────────────────────────────────────────────────────────────────
-- Helpers
-- ────────────────────────────────────────────────────────────────

local function rollDrop(enemyData)
	if math.random() > enemyData.dropChance then return nil end
	local pool = enemyData.dropTable
	return #pool > 0 and pool[math.random(1, #pool)] or nil
end

local function getArenaSpawnCFrames(stageId)
	local locData = GameData.Locations[math.min(stageId, 7)]
	if not locData then return {} end
	local stagesF = workspace:FindFirstChild("Stages")
	if not stagesF then return {} end
	local locF = stagesF:FindFirstChild(locData.name)
	if not locF then return {} end
	local out = {}
	for i = 1, 6 do
		local sp = locF:FindFirstChild("EnemySpawn" .. i)
		if sp then table.insert(out, sp.CFrame + Vector3.new(0, 2, 0)) end
	end
	return out
end

local function cleanupPlayerEnemies(uid)
	if playerEnemies[uid] then
		for enemy in pairs(playerEnemies[uid]) do
			if enemy.Parent then enemy:Destroy() end
		end
	end
	playerEnemies[uid] = {}
end

-- ────────────────────────────────────────────────────────────────
-- Wave logic (forward declarations)
-- ────────────────────────────────────────────────────────────────

local spawnWave
local waveClear

waveClear = function(player)
	local uid = player.UserId
	local ps  = playerState[uid]
	if not ps or not ps.active then return end

	-- Bonus trophies for clearing the wave
	local data = PDM().Get(player)
	if data and data.stage then
		local bonus = (GameData.TrophiesPerKill[data.stage] or 20) * WAVE_BONUS_MULT
		TM().Award(player, bonus)
	end

	ps.wave = ps.wave + 1
	task.wait(3)

	ps = playerState[uid]
	if ps and ps.active then
		spawnWave(player)
	end
end

spawnWave = function(player)
	local uid = player.UserId
	local ps  = playerState[uid]
	if not ps or not ps.active then return end

	local data = PDM().Get(player)
	if not data or not data.path then return end

	-- Auto-reset wave counter when stage advances
	if ps.lastStage ~= data.stage then
		ps.wave      = 1
		ps.lastStage = data.stage
		cleanupPlayerEnemies(uid)
	end

	local wave     = ps.wave
	local eligible = GameData.GetEnemiesForStage(data.path, data.stage)
	if #eligible == 0 then return end

	local spawnCFrames = getArenaSpawnCFrames(data.stage)
	if #spawnCFrames == 0 then return end

	local count  = math.min(3 + math.floor((wave - 1) / 2), MAX_WAVE_ENEMIES)
	local hpMult = 1 + (wave - 1) * HEALTH_SCALE_RATE

	ps.aliveCount        = count
	playerEnemies[uid]   = playerEnemies[uid] or {}

	WaveUpdate:FireClient(player, wave)

	for i = 1, count do
		task.spawn(function()
			ps = playerState[uid]
			if not ps or not ps.active then return end

			local enemyData   = eligible[math.random(1, #eligible)]
			local spawnCFrame = spawnCFrames[((i - 1) % #spawnCFrames) + 1]
			local template    = EnemyModels:FindFirstChild(enemyData.id)

			if not template then
				warn("[EnemyManager] Missing model: " .. enemyData.id)
				ps.aliveCount = math.max(0, ps.aliveCount - 1)
				if ps.aliveCount <= 0 then waveClear(player) end
				return
			end

			local enemy  = template:Clone()
			enemy.Parent = workspace
			playerEnemies[uid][enemy] = true

			local hrp = enemy:FindFirstChild("HumanoidRootPart")
			if hrp then hrp.CFrame = spawnCFrame end

			local humanoid = enemy:FindFirstChildOfClass("Humanoid")
			if humanoid then
				humanoid.MaxHealth = math.round(enemyData.health * hpMult)
				humanoid.Health    = humanoid.MaxHealth
				humanoid.WalkSpeed = enemyData.speed or 14
			end

			-- Chase AI
			task.spawn(function()
				while enemy.Parent and humanoid and humanoid.Health > 0 do
					local char = player.Character
					if char then
						local tHrp = char:FindFirstChild("HumanoidRootPart")
						if tHrp and hrp then humanoid:MoveTo(tHrp.Position) end
					end
					task.wait(0.5)
				end
			end)

			-- Touch damage to player
			for _, part in ipairs(enemy:GetDescendants()) do
				if part:IsA("BasePart") and part ~= hrp then
					part.Touched:Connect(function(hit)
						if not player.Character then return end
						local hum = player.Character:FindFirstChildOfClass("Humanoid")
						if hum and hit:IsDescendantOf(player.Character) then
							hum:TakeDamage(enemyData.damage * 0.1)
						end
					end)
				end
			end

			-- Death handler
			if humanoid then
				humanoid.Died:Connect(function()
					if playerEnemies[uid] then
						playerEnemies[uid][enemy] = nil
					end

					-- Award trophies per kill
					local tBase = GameData.TrophiesPerKill[data.stage] or 20
					TM().Award(player, tBase)

					-- Loot roll
					local toolId = rollDrop(enemyData)
					if toolId then
						local added = CTM().GiveTool(player, toolId)
						EnemyKilled:FireClient(player, enemyData.name, added and toolId or nil)
					else
						EnemyKilled:FireClient(player, enemyData.name, nil)
					end

					task.delay(2, function()
						if enemy.Parent then enemy:Destroy() end
					end)

					-- Check wave clear
					local cur = playerState[uid]
					if cur then
						cur.aliveCount = math.max(0, cur.aliveCount - 1)
						if cur.aliveCount <= 0 then waveClear(player) end
					end
				end)
			end
		end)

		task.wait(0.25)
	end
end

-- ────────────────────────────────────────────────────────────────
-- Player lifecycle
-- ────────────────────────────────────────────────────────────────

local function startCombat(player)
	local uid  = player.UserId
	local data = PDM().Get(player)
	if not data or not data.path then return end  -- no path chosen yet

	cleanupPlayerEnemies(uid)
	playerState[uid] = {
		wave      = 1,
		aliveCount = 0,
		active    = true,
		lastStage = data.stage,
	}
	playerEnemies[uid] = {}

	task.wait(2)  -- let character settle at spawn
	local ps = playerState[uid]
	if ps and ps.active then
		spawnWave(player)
	end
end

local function stopCombat(uid)
	if playerState[uid] then
		playerState[uid].active = false
	end
	cleanupPlayerEnemies(uid)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		local uid = player.UserId
		stopCombat(uid)
		startCombat(player)
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	local uid = player.UserId
	stopCombat(uid)
	playerState[uid]   = nil
	playerEnemies[uid] = nil
end)
