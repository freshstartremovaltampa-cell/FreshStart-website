-- StageBuilder.server.lua (Script → ServerScriptService)
-- Builds 7 themed combat arenas in Workspace at server start.
-- Each arena is a flat enclosed battlefield — no obstacle courses.
-- Enemy spawn zones, decorative pillars, and a return-to-hub portal are included.

local STAGE_OFFSET_X = 600
local BASE_Y         = 100
local ARENA_W        = 90   -- width (X)
local ARENA_D        = 90   -- depth (Z)
local WALL_H         = 12
local WALL_T         = 3

local arenaConfigs = {

	-- 1: Tokyo Jujutsu High — school courtyard, stone/tan
	{
		name        = "TokyoJJHigh",
		floor       = { color=Color3.fromRGB(200,190,160), mat=Enum.Material.SmoothPlastic },
		wall        = { color=Color3.fromRGB(160,150,120), mat=Enum.Material.SmoothPlastic },
		pillar      = { color=Color3.fromRGB(140,130,100), mat=Enum.Material.SmoothPlastic },
		accent      = Color3.fromRGB(100,160,220),
		description = "Tokyo Jujutsu High School",
	},

	-- 2: Kyoto Jujutsu High — traditional dojo, red/dark wood
	{
		name        = "KyotoJJHigh",
		floor       = { color=Color3.fromRGB(120,50,30),   mat=Enum.Material.Wood         },
		wall        = { color=Color3.fromRGB(80,30,15),    mat=Enum.Material.Wood         },
		pillar      = { color=Color3.fromRGB(60,20,10),    mat=Enum.Material.Wood         },
		accent      = Color3.fromRGB(220,160,40),
		description = "Kyoto Jujutsu High Dojo",
	},

	-- 3: Shibuya — underground station, concrete/grey
	{
		name        = "Shibuya",
		floor       = { color=Color3.fromRGB(70,70,80),    mat=Enum.Material.Concrete     },
		wall        = { color=Color3.fromRGB(50,50,60),    mat=Enum.Material.Concrete     },
		pillar      = { color=Color3.fromRGB(60,60,70),    mat=Enum.Material.Concrete     },
		accent      = Color3.fromRGB(220,50,50),
		description = "Shibuya Station — October 31st",
	},

	-- 4: Fight Club — dark industrial warehouse
	{
		name        = "FightClub",
		floor       = { color=Color3.fromRGB(40,40,45),    mat=Enum.Material.Metal        },
		wall        = { color=Color3.fromRGB(30,30,35),    mat=Enum.Material.Metal        },
		pillar      = { color=Color3.fromRGB(50,50,55),    mat=Enum.Material.Metal        },
		accent      = Color3.fromRGB(255,100,0),
		description = "Hakari's Fight Club",
	},

	-- 5: Shinjuku — city street, dark urban + neon
	{
		name        = "Shinjuku",
		floor       = { color=Color3.fromRGB(35,40,55),    mat=Enum.Material.SmoothPlastic},
		wall        = { color=Color3.fromRGB(25,30,45),    mat=Enum.Material.SmoothPlastic},
		pillar      = { color=Color3.fromRGB(20,60,100),   mat=Enum.Material.Neon         },
		accent      = Color3.fromRGB(0,180,255),
		description = "Shinjuku — Final Arc",
	},

	-- 6: Culling Games Colony — outdoor battlefield, earth/grass
	{
		name        = "CullingGames",
		floor       = { color=Color3.fromRGB(90,75,50),    mat=Enum.Material.Ground       },
		wall        = { color=Color3.fromRGB(100,80,50),   mat=Enum.Material.SmoothPlastic},
		pillar      = { color=Color3.fromRGB(110,85,50),   mat=Enum.Material.Rock         },
		accent      = Color3.fromRGB(180,220,60),
		description = "Culling Games Colony",
	},

	-- 7: Domain Expansion — void realm, black + purple neon
	{
		name        = "FinalDomain",
		floor       = { color=Color3.fromRGB(10,5,20),     mat=Enum.Material.Neon         },
		wall        = { color=Color3.fromRGB(20,0,40),     mat=Enum.Material.SmoothPlastic},
		pillar      = { color=Color3.fromRGB(120,0,200),   mat=Enum.Material.Neon         },
		accent      = Color3.fromRGB(200,0,255),
		description = "Domain Expansion — Malevolent Shrine",
	},
}

-- ----------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------

local function part(parent, name, size, pos, color, mat, anchored, trans)
	local p        = Instance.new("Part")
	p.Name         = name
	p.Size         = size
	p.Position     = pos
	p.Color        = color
	p.Material     = mat or Enum.Material.SmoothPlastic
	p.Anchored     = anchored ~= false
	p.CanCollide   = true
	p.CastShadow   = false
	p.Transparency = trans or 0
	p.Parent       = parent
	return p
end

local function billboard(adornee, text, textColor, yOff)
	local bg          = Instance.new("BillboardGui")
	bg.Adornee        = adornee
	bg.Size           = UDim2.new(0,200,0,50)
	bg.StudsOffset    = Vector3.new(0, yOff or 4, 0)
	bg.AlwaysOnTop    = false
	bg.Parent         = adornee
	local lbl         = Instance.new("TextLabel")
	lbl.Text          = text
	lbl.Font          = Enum.Font.GothamBold
	lbl.TextSize      = 14
	lbl.TextColor3    = textColor or Color3.new(1,1,1)
	lbl.TextWrapped   = true
	lbl.Size          = UDim2.new(1,0,1,0)
	lbl.BackgroundColor3 = Color3.fromRGB(10,10,20)
	lbl.BackgroundTransparency = 0.2
	lbl.Parent        = bg
	local c = Instance.new("UICorner"); c.CornerRadius=UDim.new(0,6); c.Parent=lbl
end

-- ----------------------------------------------------------------
-- Arena builder
-- ----------------------------------------------------------------

local function buildArena(stageIndex, cfg, stagesFolder)
	local cx  = (stageIndex - 1) * STAGE_OFFSET_X
	local cy  = BASE_Y
	local cz  = 0
	local ctr = Vector3.new(cx, cy, cz)

	local folder      = Instance.new("Folder")
	folder.Name       = cfg.name
	folder.Parent     = stagesFolder

	-- Floor
	local floor = part(folder, "Floor",
		Vector3.new(ARENA_W, 1, ARENA_D),
		ctr + Vector3.new(0, -0.5, 0),
		cfg.floor.color, cfg.floor.mat)

	-- Player spawn (center of arena)
	local spawnLoc        = Instance.new("SpawnLocation")
	spawnLoc.Name         = "StageSpawn"
	spawnLoc.Size         = Vector3.new(6, 0.2, 6)
	spawnLoc.Position     = ctr + Vector3.new(0, 0.6, 0)
	spawnLoc.Anchored     = true
	spawnLoc.CanCollide   = false
	spawnLoc.Transparency = 1
	spawnLoc.TeamColor    = BrickColor.new("Bright blue")
	spawnLoc.AllowTeamChangeOnTouch = false
	spawnLoc.Parent       = folder

	-- Four walls (N, S, E, W) — south wall has a gap for the return portal
	local halfW = ARENA_W / 2
	local halfD = ARENA_D / 2

	-- North wall (Z-)
	part(folder,"WallN",Vector3.new(ARENA_W,WALL_H,WALL_T),
		ctr+Vector3.new(0,WALL_H/2,-halfD),cfg.wall.color,cfg.wall.mat)
	-- South wall (Z+) - split into two halves to leave portal gap
	part(folder,"WallS_L",Vector3.new(ARENA_W/2-8,WALL_H,WALL_T),
		ctr+Vector3.new(-ARENA_W/4-4,WALL_H/2,halfD),cfg.wall.color,cfg.wall.mat)
	part(folder,"WallS_R",Vector3.new(ARENA_W/2-8,WALL_H,WALL_T),
		ctr+Vector3.new( ARENA_W/4+4,WALL_H/2,halfD),cfg.wall.color,cfg.wall.mat)
	-- East wall (X+)
	part(folder,"WallE",Vector3.new(WALL_T,WALL_H,ARENA_D),
		ctr+Vector3.new(halfW,WALL_H/2,0),cfg.wall.color,cfg.wall.mat)
	-- West wall (X-)
	part(folder,"WallW",Vector3.new(WALL_T,WALL_H,ARENA_D),
		ctr+Vector3.new(-halfW,WALL_H/2,0),cfg.wall.color,cfg.wall.mat)

	-- Four corner pillars (decorative + solid)
	local corners = {
		Vector3.new(-halfW+3, 0,  halfD-3),
		Vector3.new( halfW-3, 0,  halfD-3),
		Vector3.new(-halfW+3, 0, -halfD+3),
		Vector3.new( halfW-3, 0, -halfD+3),
	}
	for i, off in ipairs(corners) do
		part(folder,"Pillar"..i,Vector3.new(4,WALL_H+4,4),
			ctr+off+Vector3.new(0,(WALL_H+4)/2,0),
			cfg.pillar.color,cfg.pillar.mat)
	end

	-- Interior pillars (mid-arena, 4 positions) — cover, not obstacles
	local innerPillars = {
		Vector3.new(-20, 0,  20),
		Vector3.new( 20, 0,  20),
		Vector3.new(-20, 0, -20),
		Vector3.new( 20, 0, -20),
	}
	for i, off in ipairs(innerPillars) do
		part(folder,"InnerPillar"..i,Vector3.new(3,6,3),
			ctr+off+Vector3.new(0,3,0),cfg.pillar.color,cfg.pillar.mat)

		-- Neon ring on top of each inner pillar
		local ring = part(folder,"PillarTop"..i,Vector3.new(4,0.5,4),
			ctr+off+Vector3.new(0,6.25,0),cfg.accent,Enum.Material.Neon)
		ring.Shape = Enum.PartType.Cylinder
	end

	-- Accent trim along top of north wall
	part(folder,"AccentTrimN",Vector3.new(ARENA_W,0.6,WALL_T+0.5),
		ctr+Vector3.new(0,WALL_H,-halfD),cfg.accent,Enum.Material.Neon)

	-- Stage name billboard (above north wall, visible from inside)
	local signPart = part(folder,"StageSign",Vector3.new(20,4,1),
		ctr+Vector3.new(0,WALL_H+2,-halfD+0.5),cfg.accent,Enum.Material.Neon)
	billboard(signPart,
		string.format("Stage %d — %s", stageIndex, cfg.description),
		Color3.new(1,1,1), 2)

	-- 6 enemy spawn zones (invisible, around perimeter inner edge)
	local spawnOffsets = {
		Vector3.new(0,   1, -halfD+8),   -- N center
		Vector3.new(0,   1,  halfD-8),   -- S center
		Vector3.new(-halfW+8, 1, 0),     -- W center
		Vector3.new( halfW-8, 1, 0),     -- E center
		Vector3.new(-halfW+8, 1, -halfD+8), -- NW
		Vector3.new( halfW-8, 1, -halfD+8), -- NE
	}
	for i, off in ipairs(spawnOffsets) do
		local sp           = part(folder,"EnemySpawn"..i,Vector3.new(4,0.5,4),
			ctr+off,Color3.fromRGB(200,0,0),Enum.Material.Neon,true,0.9)
		sp.CanCollide      = false
	end

	-- Return to hub portal (south gap in wall)
	local portal = part(folder,"HubPortal",Vector3.new(14,10,2),
		ctr+Vector3.new(0,5,halfD),cfg.accent,Enum.Material.Neon,true,0.4)
	portal.CanCollide = false

	billboard(portal,"Return to Hub\n[Walk through]",Color3.fromRGB(255,200,50),5)

	-- Portal touch → teleport to hub
	local portalScript   = Instance.new("Script")
	portalScript.Source  = [[
		local portal  = script.Parent
		local Players = game:GetService("Players")
		local debounce = {}
		portal.Touched:Connect(function(hit)
			local player = Players:GetPlayerFromCharacter(hit.Parent)
			if player and not debounce[player.UserId] then
				debounce[player.UserId] = true
				local hrp = hit.Parent:FindFirstChild("HumanoidRootPart")
				local hubSpawn = workspace:FindFirstChild("Hub") and
					workspace.Hub:FindFirstChild("HubSpawnPoint")
				if hrp and hubSpawn then
					hrp.CFrame = hubSpawn.CFrame + Vector3.new(0,3,0)
				end
				task.wait(2)
				debounce[player.UserId] = nil
			end
		end)
	]]
	portalScript.Parent = portal
end

-- ----------------------------------------------------------------
-- Run
-- ----------------------------------------------------------------

local stagesFolder = workspace:WaitForChild("Stages")

for i, cfg in ipairs(arenaConfigs) do
	buildArena(i, cfg, stagesFolder)
end

print("[StageBuilder] 7 combat arenas built.")
