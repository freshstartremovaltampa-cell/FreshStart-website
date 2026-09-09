-- StageBuilder.server.lua (Script → ServerScriptService)
-- Procedurally generates all 7 obby stage layouts in Workspace at server start

local GameData = require(game:GetService("ReplicatedStorage").Modules.GameData)

-- Spacing between stages on the X axis
local STAGE_OFFSET_X = 600
local BASE_Y         = 100

-- ----------------------------------------------------------------
-- Platform type definitions
-- Each platform entry: { w, d, h, gapZ, gapY, type, [mx, mDist, mSpd] }
--   w=width, d=depth, h=height
--   gapZ = Z gap before this platform (space to jump)
--   gapY = height change (positive = higher platform)
--   type: "normal" | "kill" | "movingX" | "movingZ" | "narrow" | "disappear"
--   mx, mDist, mSpd = move axis distance and speed (for moving types)
-- ----------------------------------------------------------------

local stageConfigs = {

	-- STAGE 1: Tokyo Jujutsu High - EASY
	{
		name    = "TokyoJJHigh",
		color   = Color3.fromRGB(160,160,140),
		material= Enum.Material.SmoothPlastic,
		killColor = Color3.fromRGB(255,50,50),
		platforms = {
			{ 14,14,1, 0,  0, "normal" },  -- start platform (wide)
			{  8, 6,1, 4,  0, "normal" },
			{  8, 6,1, 4,  1, "normal" },
			{  6, 5,1, 5,  0, "normal" },
			{  6, 5,1, 4,  1, "normal" },
			{  8, 6,1, 4,  0, "normal" },
			{  5, 5,1, 5,  0, "normal" },
			{  6, 6,1, 4,  1, "normal" },
			{  6, 5,1, 5,  0, "normal" },
			{  8, 6,1, 4,  1, "normal" },
			{  5, 5,1, 5,  2, "normal" },
			{  6, 6,1, 4,  0, "normal" },
			{  6, 5,1, 4,  1, "normal" },
			{  8, 6,1, 5,  0, "normal" },
			{ 14,14,1, 4,  0, "normal" },  -- end platform (wide, trigger zone)
		},
	},

	-- STAGE 2: Kyoto Jujutsu High - EASY/MEDIUM (introduces moving platforms)
	{
		name    = "KyotoJJHigh",
		color   = Color3.fromRGB(160,50,50),
		material= Enum.Material.Wood,
		killColor = Color3.fromRGB(255,80,0),
		platforms = {
			{ 14,14,1, 0,  0, "normal" },
			{  7, 5,1, 5,  0, "normal" },
			{  6, 5,1, 4,  1, "normal" },
			{  5, 5,1, 5,  0, "movingX", 10, 0.8 },
			{  6, 5,1, 5,  1, "normal" },
			{  5, 4,1, 6,  0, "movingX", 12, 1.0 },
			{  6, 5,1, 5,  1, "normal" },
			{  6, 5,1, 4,  1, "normal" },
			{  5, 4,1, 6,  0, "movingX", 14, 1.2 },
			{  6, 5,1, 5,  1, "normal" },
			{  5, 4,1, 5,  0, "narrow"  },
			{  6, 5,1, 5,  1, "normal" },
			{  5, 5,1, 5,  0, "movingZ", 10, 0.8 },
			{  6, 5,1, 5,  2, "normal" },
			{  6, 5,1, 5,  0, "normal" },
			{  7, 5,1, 5,  1, "normal" },
			{  5, 4,1, 6,  0, "movingX", 12, 1.0 },
			{ 14,14,1, 5,  0, "normal" },
		},
	},

	-- STAGE 3: Shibuya - MEDIUM (narrow + moving + first kill bricks)
	{
		name    = "Shibuya",
		color   = Color3.fromRGB(70,70,90),
		material= Enum.Material.Concrete,
		killColor = Color3.fromRGB(200,0,200),
		platforms = {
			{ 14,14,1, 0,  0, "normal" },
			{  6, 5,1, 5,  1, "normal" },
			{  4, 4,1, 5,  0, "narrow"  },
			{  5, 5,1, 5,  1, "movingX", 12, 1.0 },
			{  4, 3,1, 6,  0, "narrow"  },
			{  6, 5,1, 5,  1, "normal" },
			{  4, 4,1, 6,  0, "kill"   },  -- first kill brick
			{  6, 5,1, 4,  1, "normal" },
			{  4, 3,1, 6,  0, "narrow"  },
			{  5, 5,1, 5,  0, "movingZ", 12, 1.0 },
			{  6, 5,1, 5,  1, "normal" },
			{  4, 4,1, 5,  0, "kill"   },
			{  6, 5,1, 5,  1, "normal" },
			{  4, 3,1, 6,  0, "narrow"  },
			{  5, 4,1, 5,  0, "movingX", 14, 1.2 },
			{  4, 4,1, 5,  1, "narrow"  },
			{  6, 5,1, 5,  1, "normal" },
			{  4, 3,1, 6,  0, "kill"   },
			{  6, 5,1, 5,  2, "normal" },
			{ 14,14,1, 4,  0, "normal" },
		},
	},

	-- STAGE 4: Fight Club - MEDIUM/HARD
	{
		name    = "FightClub",
		color   = Color3.fromRGB(40,40,50),
		material= Enum.Material.Metal,
		killColor = Color3.fromRGB(255,30,30),
		platforms = {
			{ 14,14,1, 0,  0, "normal" },
			{  5, 5,1, 5,  1, "movingX", 14, 1.2 },
			{  4, 4,1, 6,  0, "kill"   },
			{  5, 5,1, 5,  1, "narrow"  },
			{  5, 4,1, 6,  0, "movingX", 16, 1.4 },
			{  4, 4,1, 5,  1, "kill"   },
			{  6, 5,1, 5,  1, "normal" },
			{  4, 3,1, 7,  0, "narrow"  },
			{  5, 4,1, 6,  0, "movingZ", 14, 1.2 },
			{  4, 4,1, 6,  1, "kill"   },
			{  5, 5,1, 5,  1, "normal" },
			{  4, 3,1, 7,  0, "narrow"  },
			{  5, 4,1, 6,  0, "movingX", 18, 1.5 },
			{  4, 4,1, 6,  0, "kill"   },
			{  5, 5,1, 5,  1, "normal" },
			{  4, 3,1, 7,  1, "narrow"  },
			{  5, 4,1, 6,  0, "movingZ", 16, 1.4 },
			{  4, 4,1, 6,  0, "kill"   },
			{  5, 5,1, 5,  1, "normal" },
			{  5, 4,1, 5,  2, "normal" },
			{  5, 4,1, 5,  0, "movingX", 16, 1.5 },
			{ 14,14,1, 4,  0, "normal" },
		},
	},

	-- STAGE 5: Shinjuku - HARD
	{
		name    = "Shinjuku",
		color   = Color3.fromRGB(30,50,90),
		material= Enum.Material.Neon,
		killColor = Color3.fromRGB(0,200,255),
		platforms = {
			{ 14,14,1, 0,  0, "normal" },
			{  5, 4,1, 6,  1, "movingX", 16, 1.5 },
			{  3, 4,1, 6,  0, "narrow"  },
			{  5, 4,1, 6,  0, "kill"   },
			{  4, 4,1, 6,  1, "movingX", 18, 1.6 },
			{  3, 3,1, 7,  0, "narrow"  },
			{  4, 4,1, 6,  0, "movingZ", 16, 1.5 },
			{  3, 4,1, 6,  1, "kill"   },
			{  4, 4,1, 6,  0, "narrow"  },
			{  5, 4,1, 6,  0, "movingX", 18, 1.6 },
			{  3, 3,1, 7,  1, "narrow"  },
			{  4, 4,1, 6,  0, "kill"   },
			{  5, 4,1, 6,  1, "movingZ", 16, 1.5 },
			{  3, 3,1, 7,  0, "narrow"  },
			{  4, 4,1, 6,  0, "movingX", 20, 1.7 },
			{  3, 4,1, 6,  1, "kill"   },
			{  4, 4,1, 6,  0, "narrow"  },
			{  5, 4,1, 6,  0, "movingX", 18, 1.6 },
			{  4, 4,1, 6,  1, "kill"   },
			{  4, 4,1, 6,  0, "movingZ", 16, 1.5 },
			{  4, 4,1, 6,  2, "normal" },
			{  5, 4,1, 5,  0, "movingX", 16, 1.6 },
			{ 14,14,1, 4,  0, "normal" },
		},
	},

	-- STAGE 6: Culling Games Colony - VERY HARD
	{
		name    = "CullingGames",
		color   = Color3.fromRGB(90,70,40),
		material= Enum.Material.Grass,
		killColor = Color3.fromRGB(80,200,0),
		platforms = {
			{ 14,14,1, 0,  0, "normal" },
			{  4, 4,1, 7,  1, "movingX", 18, 1.7 },
			{  3, 3,1, 7,  0, "narrow"  },
			{  4, 4,1, 7,  0, "kill"   },
			{  4, 4,1, 7,  1, "movingZ", 18, 1.7 },
			{  3, 3,1, 8,  0, "narrow"  },
			{  4, 4,1, 7,  0, "kill"   },
			{  4, 4,1, 7,  1, "movingX", 20, 1.8 },
			{  3, 3,1, 8,  0, "narrow"  },
			{  4, 4,1, 7,  0, "kill"   },
			{  4, 4,1, 7,  1, "movingZ", 18, 1.7 },
			{  3, 3,1, 8,  0, "narrow"  },
			{  4, 4,1, 7,  0, "movingX", 20, 1.8 },
			{  3, 3,1, 8,  1, "kill"   },
			{  4, 4,1, 7,  0, "narrow"  },
			{  4, 4,1, 7,  0, "movingZ", 20, 1.8 },
			{  3, 3,1, 8,  1, "narrow"  },
			{  4, 4,1, 7,  0, "kill"   },
			{  4, 4,1, 7,  0, "movingX", 22, 1.9 },
			{  3, 3,1, 8,  1, "narrow"  },
			{  4, 4,1, 7,  0, "kill"   },
			{  4, 4,1, 7,  0, "movingZ", 20, 1.8 },
			{  4, 4,1, 7,  2, "normal" },
			{  5, 5,1, 6,  0, "movingX", 18, 1.7 },
			{ 14,14,1, 4,  0, "normal" },
		},
	},

	-- STAGE 7: Domain Expansion - EXTREME
	{
		name    = "FinalDomain",
		color   = Color3.fromRGB(40,0,80),
		material= Enum.Material.Neon,
		killColor = Color3.fromRGB(255,0,80),
		platforms = {
			{ 14,14,1, 0,  0, "normal" },
			{  4, 4,1, 8,  1, "movingX", 20, 2.0 },
			{  3, 3,1, 8,  0, "narrow"  },
			{  4, 4,1, 8,  0, "kill"   },
			{  4, 4,1, 8,  1, "movingZ", 22, 2.0 },
			{  3, 3,1, 9,  0, "kill"   },
			{  4, 4,1, 8,  1, "narrow"  },
			{  4, 4,1, 8,  0, "movingX", 24, 2.1 },
			{  3, 3,1, 9,  1, "kill"   },
			{  4, 4,1, 8,  0, "narrow"  },
			{  4, 4,1, 8,  0, "movingZ", 22, 2.0 },
			{  3, 3,1, 9,  1, "kill"   },
			{  4, 4,1, 8,  0, "movingX", 24, 2.1 },
			{  3, 3,1, 9,  0, "narrow"  },
			{  4, 4,1, 8,  1, "kill"   },
			{  4, 4,1, 8,  0, "movingZ", 22, 2.0 },
			{  3, 3,1, 9,  0, "narrow"  },
			{  4, 4,1, 8,  1, "movingX", 24, 2.1 },
			{  3, 3,1, 9,  0, "kill"   },
			{  4, 4,1, 8,  1, "narrow"  },
			{  4, 4,1, 8,  0, "movingZ", 22, 2.0 },
			{  3, 3,1, 9,  0, "kill"   },
			{  4, 4,1, 8,  1, "movingX", 24, 2.2 },
			{  3, 3,1, 9,  0, "narrow"  },
			{  4, 4,1, 8,  0, "kill"   },
			{  4, 4,1, 8,  1, "movingZ", 22, 2.0 },
			{  4, 4,1, 8,  2, "normal" },
			{  5, 5,1, 6,  0, "movingX", 22, 2.0 },
			{ 14,14,1, 5,  0, "normal" },
		},
	},
}

-- ----------------------------------------------------------------
-- Builder
-- ----------------------------------------------------------------

local function makeKillScript(part)
	local script = Instance.new("Script")
	script.Source = [[
		local part = script.Parent
		part.Touched:Connect(function(hit)
			local hum = hit.Parent:FindFirstChildOfClass("Humanoid")
			if hum then hum:TakeDamage(hum.MaxHealth) end
		end)
	]]
	script.Parent = part
end

local function buildStage(stageIndex, config, stagesFolder)
	local baseX   = (stageIndex - 1) * STAGE_OFFSET_X
	local basePos = Vector3.new(baseX, BASE_Y, 0)

	local folder  = Instance.new("Folder")
	folder.Name   = config.name
	folder.Parent = stagesFolder

	local cursor = basePos  -- tracks where next platform starts (front edge)

	for i, plat in ipairs(config.platforms) do
		local w, d, h = plat[1], plat[2], plat[3]
		local gapZ    = plat[4]
		local gapY    = plat[5]
		local pType   = plat[6]
		local mDist   = plat[7] or 10
		local mSpd    = plat[8] or 1.0

		-- New position
		local pos = Vector3.new(
			cursor.X,
			cursor.Y + gapY,
			cursor.Z + gapZ + d / 2
		)
		cursor = Vector3.new(pos.X, pos.Y, pos.Z + d / 2)

		local part = Instance.new("Part")
		part.Size     = Vector3.new(w, h, d)
		part.Position = pos
		part.Material = (pType == "kill") and Enum.Material.Neon or config.material
		part.Color    = (pType == "kill") and config.killColor or config.color
		part.Anchored = true
		part.CanCollide = true
		part.Parent   = folder

		-- Name end platform so StageManager can find it
		if i == #config.platforms then
			part.Name = "StageEnd"

			-- Glow effect on end platform
			local sg = Instance.new("SelectionBox")
			sg.Adornee  = part
			sg.Color3   = Color3.fromRGB(255,215,0)
			sg.LineThickness = 0.06
			sg.Parent   = part

			-- Touch detector → fires server to award stage clear
			local touchScript = Instance.new("Script")
			touchScript.Source = string.format([[
				local Players = game:GetService("Players")
				local RS = game:GetService("ReplicatedStorage")
				local StageEnd = script.Parent
				local StageEndReached = RS:WaitForChild("RemoteEvents"):WaitForChild("StageEndReached")
				local debounce = {}
				StageEnd.Touched:Connect(function(hit)
					local player = Players:GetPlayerFromCharacter(hit.Parent)
					if player and not debounce[player.UserId] then
						debounce[player.UserId] = true
						StageEndReached:FireServer(%d)
						task.wait(2)
						debounce[player.UserId] = nil
					end
				end)
			]], stageIndex)
			touchScript.Parent = part
		elseif i == 1 then
			-- Mark spawn point on first platform
			local spawnPart      = Instance.new("SpawnLocation")
			spawnPart.Name       = "StageSpawn"
			spawnPart.Size       = Vector3.new(w, 0.2, d)
			spawnPart.Position   = pos + Vector3.new(0, h/2 + 0.1, 0)
			spawnPart.Anchored   = true
			spawnPart.CanCollide = false
			spawnPart.Transparency = 1
			spawnPart.TeamColor  = BrickColor.new("Bright blue")
			spawnPart.AllowTeamChangeOnTouch = false
			spawnPart.Parent     = folder
		end

		-- Kill brick damage script
		if pType == "kill" then
			makeKillScript(part)
		end

		-- Moving platform tween
		if pType == "movingX" or pType == "movingZ" then
			part.Anchored = false

			local axis    = (pType == "movingX") and Vector3.new(1,0,0) or Vector3.new(0,0,1)
			local origPos = pos

			local mScript = Instance.new("Script")
			mScript.Source = string.format([[
				local part    = script.Parent
				local origPos = part.Position
				local axis    = Vector3.new(%g, 0, %g)
				local dist    = %g
				local spd     = %g
				local dir     = 1
				local moved   = 0
				local dt      = 0.05

				part.Anchored = false
				local weld = Instance.new("WeldConstraint")

				game:GetService("RunService").Heartbeat:Connect(function(delta)
					local step = spd * delta
					moved = moved + step * dir
					if math.abs(moved) >= dist then dir = -dir end
					local vel = axis * spd * dir
					part.Velocity = vel
				end)
			]], axis.X, axis.Z, mDist, mSpd)
			mScript.Parent = part
		end
	end
end

-- ----------------------------------------------------------------
-- Run at server start
-- ----------------------------------------------------------------

local stagesFolder = workspace:WaitForChild("Stages")

for i, cfg in ipairs(stageConfigs) do
	buildStage(i, cfg, stagesFolder)
end

print("[StageBuilder] All 7 stages built.")
