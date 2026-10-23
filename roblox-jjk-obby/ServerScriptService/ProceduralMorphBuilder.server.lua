-- ProceduralMorphBuilder.server.lua (Script → ServerScriptService)
-- Builds procedural R6 character morph models for all 16 stages at game start.
-- CharacterMorphManager finds these automatically (named "Stage1"…"Stage8").
-- To replace a stage with a real 3D upload: add a Model named "Stage{n}_YourName"
-- in the same folder — findMorphModel prefers that over the bare "Stage{n}" name.

local ServerStorage = game:GetService("ServerStorage")

-- ── Joints ────────────────────────────────────────────────────────────────
-- Standard Roblox R6 Motor6D C0/C1 values
local JOINTS = {
	-- { hostPartName, jointName, targetPartName, C0, C1 }
	{ "HumanoidRootPart", "RootJoint",      "Torso",
		CFrame.new(0,0,0,-1,0,0,0,0,1,0,1,0),
		CFrame.new(0,-1,0,-1,0,0,0,0,1,0,1,0) },
	{ "Torso", "Neck",            "Head",
		CFrame.new(0,1,0,-1,0,0,0,0,1,0,1,0),
		CFrame.new(0,-0.5,0,-1,0,0,0,0,1,0,1,0) },
	{ "Torso", "Left Shoulder",   "Left Arm",
		CFrame.new(-1,0.5,0,0,0,-1,0,1,0,1,0,0),
		CFrame.new(0.5,0.5,0,0,0,-1,0,1,0,1,0,0) },
	{ "Torso", "Right Shoulder",  "Right Arm",
		CFrame.new(1,0.5,0,0,0,1,0,1,0,-1,0,0),
		CFrame.new(-0.5,0.5,0,0,0,1,0,1,0,-1,0,0) },
	{ "Torso", "Left Hip",        "Left Leg",
		CFrame.new(-1,-1,0,0,0,-1,0,1,0,1,0,0),
		CFrame.new(-0.5,1,0,0,0,-1,0,1,0,1,0,0) },
	{ "Torso", "Right Hip",       "Right Leg",
		CFrame.new(1,-1,0,0,0,1,0,1,0,-1,0,0),
		CFrame.new(0.5,1,0,0,0,1,0,1,0,-1,0,0) },
}

-- ── Helpers ───────────────────────────────────────────────────────────────

local function buildBaseRig(model, bodyColor, headColor, material)
	local function makePart(name, size, color, mat, transparent)
		local p = Instance.new("Part")
		p.Name         = name
		p.Size         = size
		p.Color        = color
		p.Material     = mat
		p.CanCollide   = false
		p.Anchored     = false
		if transparent then p.Transparency = 1 end
		p.Parent       = model
		return p
	end

	local hrp   = makePart("HumanoidRootPart", Vector3.new(2,2,1),   bodyColor, Enum.Material.SmoothPlastic, true)
	local torso = makePart("Torso",            Vector3.new(2,2,1),   bodyColor, material)
	local head  = makePart("Head",             Vector3.new(2,1,1),   headColor, Enum.Material.SmoothPlastic)
	local larm  = makePart("Left Arm",         Vector3.new(1,2,1),   bodyColor, material)
	local rarm  = makePart("Right Arm",        Vector3.new(1,2,1),   bodyColor, material)
	local lleg  = makePart("Left Leg",         Vector3.new(1,2,1),   bodyColor, material)
	local rleg  = makePart("Right Leg",        Vector3.new(1,2,1),   bodyColor, material)

	local hum         = Instance.new("Humanoid")
	hum.RigType       = Enum.HumanoidRigType.R6
	hum.Parent        = model

	-- Motor6D joints
	local parts = { HumanoidRootPart=hrp, Torso=torso, Head=head,
	                ["Left Arm"]=larm, ["Right Arm"]=rarm,
	                ["Left Leg"]=lleg, ["Right Leg"]=rleg }
	for _, j in ipairs(JOINTS) do
		local m = Instance.new("Motor6D")
		m.Name   = j[2]
		m.Part0  = parts[j[1]]
		m.Part1  = parts[j[3]]
		m.C0     = j[4]
		m.C1     = j[5]
		m.Parent = parts[j[1]]
	end

	model.PrimaryPart = hrp
	return { hrp=hrp, torso=torso, head=head, larm=larm, rarm=rarm, lleg=lleg, rleg=rleg }
end

-- Attach a decorative part with a WeldConstraint (rigid, follows animation)
local function deco(parent_part, model, name, size, cfOffset, color, material, meshType)
	local p         = Instance.new("Part")
	p.Name          = name
	p.Size          = size
	p.Color         = color
	p.Material      = material or Enum.Material.Neon
	p.CanCollide    = false
	p.CastShadow    = false
	p.CFrame        = parent_part.CFrame * cfOffset   -- parent is at origin; offset = local offset
	p.Parent        = model
	if meshType then
		local m = Instance.new("SpecialMesh")
		m.MeshType = meshType
		m.Parent   = p
	end
	local w  = Instance.new("WeldConstraint")
	w.Part0  = parent_part
	w.Part1  = p
	w.Parent = parent_part
end

local function aura(part, color, size, rate, speed, lifetime)
	local att = Instance.new("Attachment")
	att.Parent = part
	local pe = Instance.new("ParticleEmitter")
	pe.Color          = ColorSequence.new{
		ColorSequenceKeypoint.new(0, color),
		ColorSequenceKeypoint.new(1, Color3.new(0,0,0))
	}
	pe.Size           = NumberSequence.new{
		NumberSequenceKeypoint.new(0, size),
		NumberSequenceKeypoint.new(1, 0)
	}
	pe.Rate           = rate
	pe.Speed          = NumberRange.new(speed * 0.5, speed)
	pe.Lifetime       = NumberRange.new(lifetime * 0.7, lifetime)
	pe.LightEmission  = 1
	pe.LightInfluence = 0
	pe.Parent         = att
end

-- ── Sorcerer stage decorations ────────────────────────────────────────────

local function decorateSorcerer(p, model, stage)
	local h, t, la, ra = p.head, p.torso, p.larm, p.rarm

	if stage == 1 then
		-- Grade 4: faint blue wisps
		aura(t, Color3.fromRGB(120,180,255), 0.15, 5,  1, 1.5)

	elseif stage == 2 then
		-- Grade 3: blue sparks on body + arms
		aura(t,  Color3.fromRGB(60,140,255), 0.2,  15, 2, 1.2)
		aura(la, Color3.fromRGB(60,140,255), 0.1,  5,  1, 0.8)
		aura(ra, Color3.fromRGB(60,140,255), 0.1,  5,  1, 0.8)

	elseif stage == 3 then
		-- Grade 2: teal aura + glowing shoulder orbs
		aura(t, Color3.fromRGB(0,220,200), 0.25, 20, 2.5, 1.5)
		deco(la, model, "L_Orb", Vector3.new(0.55,0.55,0.55), CFrame.new(0,1.2,0),  Color3.fromRGB(0,220,200), Enum.Material.Neon, Enum.MeshType.Sphere)
		deco(ra, model, "R_Orb", Vector3.new(0.55,0.55,0.55), CFrame.new(0,1.2,0),  Color3.fromRGB(0,220,200), Enum.Material.Neon, Enum.MeshType.Sphere)

	elseif stage == 4 then
		-- Grade 1: deep blue + gold chest bands
		aura(t, Color3.fromRGB(30,80,200), 0.3, 28, 3, 2)
		deco(t, model, "Band1", Vector3.new(2.06,0.2,1.06), CFrame.new(0, 0.35,0), Color3.fromRGB(255,200,50), Enum.Material.Neon)
		deco(t, model, "Band2", Vector3.new(2.06,0.2,1.06), CFrame.new(0,-0.35,0), Color3.fromRGB(255,200,50), Enum.Material.Neon)

	elseif stage == 5 then
		-- Semi-Grade 1: blue + energy wing panels
		aura(t, Color3.fromRGB(20,60,220), 0.35, 38, 4, 2)
		deco(t, model, "LWingU", Vector3.new(1.6,0.12,0.9),  CFrame.new(-1.9, 0.3,-0.15)*CFrame.Angles(0,0, math.rad(30)), Color3.fromRGB(80,160,255), Enum.Material.Neon)
		deco(t, model, "RWingU", Vector3.new(1.6,0.12,0.9),  CFrame.new( 1.9, 0.3,-0.15)*CFrame.Angles(0,0,-math.rad(30)), Color3.fromRGB(80,160,255), Enum.Material.Neon)
		deco(t, model, "LWingL", Vector3.new(1.1,0.1, 0.7),  CFrame.new(-2.3,-0.2,-0.15)*CFrame.Angles(0,0, math.rad(50)), Color3.fromRGB(80,160,255), Enum.Material.Neon)
		deco(t, model, "RWingL", Vector3.new(1.1,0.1, 0.7),  CFrame.new( 2.3,-0.2,-0.15)*CFrame.Angles(0,0,-math.rad(50)), Color3.fromRGB(80,160,255), Enum.Material.Neon)

	elseif stage == 6 then
		-- Special Grade Student: purple + halo ring
		aura(t, Color3.fromRGB(140,60,220), 0.4,  48, 5, 2.5)
		aura(h, Color3.fromRGB(140,60,220), 0.2,  15, 2, 1)
		deco(h, model, "Halo", Vector3.new(2.3,0.12,2.3), CFrame.new(0,0.7,0), Color3.fromRGB(180,80,255), Enum.Material.Neon, Enum.MeshType.Cylinder)

	elseif stage == 7 then
		-- Special Grade: white/gold neon + halo + large wings
		aura(t, Color3.fromRGB(255,220,80),  0.5,  65, 6, 3)
		aura(h, Color3.fromRGB(255,255,200), 0.3,  22, 3, 1.5)
		deco(h, model, "Halo",  Vector3.new(2.6,0.12,2.6), CFrame.new(0,0.95,0), Color3.fromRGB(255,210,0), Enum.Material.Neon, Enum.MeshType.Cylinder)
		deco(t, model, "LWU",   Vector3.new(2.6,0.1,1.3),  CFrame.new(-2.6, 0.5,-0.2)*CFrame.Angles(0,0, math.rad(18)), Color3.fromRGB(255,240,160), Enum.Material.Neon)
		deco(t, model, "RWU",   Vector3.new(2.6,0.1,1.3),  CFrame.new( 2.6, 0.5,-0.2)*CFrame.Angles(0,0,-math.rad(18)), Color3.fromRGB(255,240,160), Enum.Material.Neon)
		deco(t, model, "LWL",   Vector3.new(1.6,0.09,0.9), CFrame.new(-3.4,-0.1,-0.2)*CFrame.Angles(0,0, math.rad(38)), Color3.fromRGB(255,240,160), Enum.Material.Neon)
		deco(t, model, "RWL",   Vector3.new(1.6,0.09,0.9), CFrame.new( 3.4,-0.1,-0.2)*CFrame.Angles(0,0,-math.rad(38)), Color3.fromRGB(255,240,160), Enum.Material.Neon)

	elseif stage == 8 then
		-- Vessel: red/black + black flame aura + face tattoos + shoulder spikes
		aura(t, Color3.fromRGB(200,20,20), 0.6, 85, 8, 3.5)
		aura(t, Color3.fromRGB(15,0,0),   0.4, 40, 5, 2.5)
		deco(h, model, "FM_L",  Vector3.new(0.14,0.55,0.06), CFrame.new(-0.5,-0.02,-0.53), Color3.fromRGB(180,0,0),   Enum.Material.Neon)
		deco(h, model, "FM_R",  Vector3.new(0.14,0.55,0.06), CFrame.new( 0.5,-0.02,-0.53), Color3.fromRGB(180,0,0),   Enum.Material.Neon)
		deco(la, model, "LSpk", Vector3.new(0.32,0.8,0.32),  CFrame.new(0,1.1,0)*CFrame.Angles(0,0, 0.1), Color3.fromRGB(15,0,0), Enum.Material.SmoothPlastic)
		deco(ra, model, "RSpk", Vector3.new(0.32,0.8,0.32),  CFrame.new(0,1.1,0)*CFrame.Angles(0,0,-0.1), Color3.fromRGB(15,0,0), Enum.Material.SmoothPlastic)
	end
end

-- ── CurseSpirit stage decorations ─────────────────────────────────────────

local function decorateCurse(p, model, stage)
	local h, t, la, ra = p.head, p.torso, p.larm, p.rarm

	if stage == 1 then
		-- Curse Seed: wispy gray/purple smoke
		aura(t, Color3.fromRGB(100,60,140), 0.2, 8, 1, 2.2)

	elseif stage == 2 then
		-- Low Grade Curse: purple + hanging tendrils
		aura(t, Color3.fromRGB(80,20,120), 0.25, 18, 2, 2)
		deco(t, model, "Tend1", Vector3.new(0.2,1.3,0.2), CFrame.new(-0.5,-1.65,-0.3)*CFrame.Angles( 0.2,0, 0.1), Color3.fromRGB(80,20,120), Enum.Material.Neon)
		deco(t, model, "Tend2", Vector3.new(0.2,1.1,0.2), CFrame.new( 0.5,-1.65,-0.3)*CFrame.Angles( 0.1,0,-0.1), Color3.fromRGB(80,20,120), Enum.Material.Neon)

	elseif stage == 3 then
		-- Grade 2 Curse: dark purple + shoulder spike clusters
		aura(t, Color3.fromRGB(100,30,150), 0.3, 28, 3, 2.5)
		deco(la, model, "LSp1", Vector3.new(0.3,0.7,0.3),  CFrame.new( 0,   1.15, 0),                     Color3.fromRGB(60,0,80),  Enum.Material.SmoothPlastic)
		deco(ra, model, "RSp1", Vector3.new(0.3,0.7,0.3),  CFrame.new( 0,   1.15, 0),                     Color3.fromRGB(60,0,80),  Enum.Material.SmoothPlastic)
		deco(la, model, "LSp2", Vector3.new(0.25,0.5,0.25),CFrame.new(-0.3, 1.1,  0)*CFrame.Angles(0,0,-0.4), Color3.fromRGB(80,20,100),Enum.Material.SmoothPlastic)
		deco(ra, model, "RSp2", Vector3.new(0.25,0.5,0.25),CFrame.new( 0.3, 1.1,  0)*CFrame.Angles(0,0, 0.4), Color3.fromRGB(80,20,100),Enum.Material.SmoothPlastic)

	elseif stage == 4 then
		-- Grade 1 Curse: near-black + horns + strong aura
		aura(t, Color3.fromRGB(120,40,160), 0.35, 40, 4, 3)
		aura(h, Color3.fromRGB(120,40,160), 0.2,  12, 2, 1.5)
		deco(h, model, "LHorn", Vector3.new(0.38,1.0,0.38), CFrame.new(-0.55,0.65,0)*CFrame.Angles(0,0,-0.3), Color3.fromRGB(25,0,35),  Enum.Material.SmoothPlastic)
		deco(h, model, "RHorn", Vector3.new(0.38,1.0,0.38), CFrame.new( 0.55,0.65,0)*CFrame.Angles(0,0, 0.3), Color3.fromRGB(25,0,35),  Enum.Material.SmoothPlastic)

	elseif stage == 5 then
		-- Special Grade Fragment: pure black + purple neon chest spine + large horns
		aura(t, Color3.fromRGB(160,50,200), 0.45, 55, 5, 3)
		aura(t, Color3.fromRGB(40,0,60),    0.3,  25, 3, 2)
		deco(h, model, "LHorn", Vector3.new(0.42,1.25,0.42), CFrame.new(-0.55,0.82,0)*CFrame.Angles(0,0,-0.4), Color3.fromRGB(18,0,25),  Enum.Material.SmoothPlastic)
		deco(h, model, "RHorn", Vector3.new(0.42,1.25,0.42), CFrame.new( 0.55,0.82,0)*CFrame.Angles(0,0, 0.4), Color3.fromRGB(18,0,25),  Enum.Material.SmoothPlastic)
		deco(t, model, "Spine", Vector3.new(0.3,2.25,0.3),   CFrame.new(0,0,-0.66),                            Color3.fromRGB(140,20,180),Enum.Material.Neon)

	elseif stage == 6 then
		-- Special Grade Curse: black/red + 4 tendrils + large horns
		aura(t, Color3.fromRGB(180,20,20), 0.5,  68, 6, 3.5)
		aura(t, Color3.fromRGB(60,0,80),   0.35, 30, 4, 2.5)
		for i, x in ipairs({-0.7,-0.2,0.2,0.7}) do
			deco(t, model, "Td"..i, Vector3.new(0.18,1.6,0.18),
				CFrame.new(x,-1.8, 0)*CFrame.Angles((i%2==0 and 0.15 or -0.15), 0, (i<3 and 0.12 or -0.12)),
				Color3.fromRGB(100,0,0), Enum.Material.Neon)
		end
		deco(h, model, "LHorn", Vector3.new(0.52,1.55,0.52), CFrame.new(-0.62,0.92,0)*CFrame.Angles(0,0,-0.5), Color3.fromRGB(8,0,8),    Enum.Material.SmoothPlastic)
		deco(h, model, "RHorn", Vector3.new(0.52,1.55,0.52), CFrame.new( 0.62,0.92,0)*CFrame.Angles(0,0, 0.5), Color3.fromRGB(8,0,8),    Enum.Material.SmoothPlastic)

	elseif stage == 7 then
		-- Sukuna Fragment: dark red + tattoos + gold arm bands + twin aura layers
		aura(t, Color3.fromRGB(220,40,20),  0.55, 78, 7, 4)
		aura(t, Color3.fromRGB(255,180,20), 0.25, 32, 4, 2)
		deco(h, model, "FM_L",  Vector3.new(0.13,0.62,0.06), CFrame.new(-0.5, 0,   -0.52), Color3.fromRGB(255,100,0), Enum.Material.Neon)
		deco(h, model, "FM_R",  Vector3.new(0.13,0.62,0.06), CFrame.new( 0.5, 0,   -0.52), Color3.fromRGB(255,100,0), Enum.Material.Neon)
		deco(h, model, "EM_L",  Vector3.new(0.42,0.1,0.06),  CFrame.new(-0.3, 0.12,-0.52), Color3.fromRGB(255,200,0), Enum.Material.Neon)
		deco(h, model, "EM_R",  Vector3.new(0.42,0.1,0.06),  CFrame.new( 0.3, 0.12,-0.52), Color3.fromRGB(255,200,0), Enum.Material.Neon)
		deco(la, model, "LAB",  Vector3.new(1.06,0.26,1.06), CFrame.new(0, 0.3, 0),        Color3.fromRGB(255,180,0), Enum.Material.Neon)
		deco(ra, model, "RAB",  Vector3.new(1.06,0.26,1.06), CFrame.new(0, 0.3, 0),        Color3.fromRGB(255,180,0), Enum.Material.Neon)

	elseif stage == 8 then
		-- Ryomen Sukuna: crimson + gold + extra arms + massive multi-layer aura
		aura(t, Color3.fromRGB(220,20,0),  0.7,  105, 10, 4.5)
		aura(t, Color3.fromRGB(255,160,0), 0.4,  52,  6,  3)
		aura(h, Color3.fromRGB(220,0,0),   0.4,  30,  4,  2)
		-- Extra upper arms (4-arm impression)
		deco(t, model, "LArm2", Vector3.new(1,2,1), CFrame.new(-2.2, 0.5, 0)*CFrame.Angles(0,0, math.rad(30)), Color3.fromRGB(110,10,10), Enum.Material.SmoothPlastic)
		deco(t, model, "RArm2", Vector3.new(1,2,1), CFrame.new( 2.2, 0.5, 0)*CFrame.Angles(0,0,-math.rad(30)), Color3.fromRGB(110,10,10), Enum.Material.SmoothPlastic)
		-- Tattoos + gold eyes
		deco(h, model, "FM_L",  Vector3.new(0.13,0.62,0.06), CFrame.new(-0.5, 0,   -0.52), Color3.fromRGB(255,120,0), Enum.Material.Neon)
		deco(h, model, "FM_R",  Vector3.new(0.13,0.62,0.06), CFrame.new( 0.5, 0,   -0.52), Color3.fromRGB(255,120,0), Enum.Material.Neon)
		deco(h, model, "EM_L",  Vector3.new(0.42,0.1,0.06),  CFrame.new(-0.3, 0.12,-0.52), Color3.fromRGB(255,200,0), Enum.Material.Neon)
		deco(h, model, "EM_R",  Vector3.new(0.42,0.1,0.06),  CFrame.new( 0.3, 0.12,-0.52), Color3.fromRGB(255,200,0), Enum.Material.Neon)
		-- Gold arm bands on all arms
		deco(la, model, "LAB",  Vector3.new(1.06,0.26,1.06), CFrame.new(0, 0.3, 0), Color3.fromRGB(255,180,0), Enum.Material.Neon)
		deco(ra, model, "RAB",  Vector3.new(1.06,0.26,1.06), CFrame.new(0, 0.3, 0), Color3.fromRGB(255,180,0), Enum.Material.Neon)
		-- Massive horns
		deco(h, model, "LHorn", Vector3.new(0.58,1.9,0.58), CFrame.new(-0.68,1.05,0)*CFrame.Angles(0,0,-0.62), Color3.fromRGB(8,0,0),    Enum.Material.SmoothPlastic)
		deco(h, model, "RHorn", Vector3.new(0.58,1.9,0.58), CFrame.new( 0.68,1.05,0)*CFrame.Angles(0,0, 0.62), Color3.fromRGB(8,0,0),    Enum.Material.SmoothPlastic)
	end
end

-- ── Color definitions ──────────────────────────────────────────────────────
-- { bodyColor, headColor, material }

local SC = {                                                                   -- Sorcerer
	[1] = { Color3.fromRGB(230,240,255), Color3.fromRGB(245,218,195), Enum.Material.SmoothPlastic },
	[2] = { Color3.fromRGB(60,120,220),  Color3.fromRGB(200,158,120), Enum.Material.SmoothPlastic },
	[3] = { Color3.fromRGB(0,160,180),   Color3.fromRGB(178,138,108), Enum.Material.SmoothPlastic },
	[4] = { Color3.fromRGB(20,60,160),   Color3.fromRGB(158,118,98),  Enum.Material.SmoothPlastic },
	[5] = { Color3.fromRGB(10,40,140),   Color3.fromRGB(138,108,88),  Enum.Material.SmoothPlastic },
	[6] = { Color3.fromRGB(80,20,160),   Color3.fromRGB(118,98,78),   Enum.Material.SmoothPlastic },
	[7] = { Color3.fromRGB(240,230,200), Color3.fromRGB(240,210,170), Enum.Material.Neon          },
	[8] = { Color3.fromRGB(110,10,10),   Color3.fromRGB(100,58,58),   Enum.Material.SmoothPlastic },
}

local CC = {                                                                   -- CurseSpirit
	[1] = { Color3.fromRGB(80,70,90),   Color3.fromRGB(68,58,78),   Enum.Material.SmoothPlastic },
	[2] = { Color3.fromRGB(60,20,80),   Color3.fromRGB(48,14,68),   Enum.Material.SmoothPlastic },
	[3] = { Color3.fromRGB(80,10,100),  Color3.fromRGB(58,8,78),    Enum.Material.SmoothPlastic },
	[4] = { Color3.fromRGB(20,5,30),    Color3.fromRGB(14,4,24),    Enum.Material.SmoothPlastic },
	[5] = { Color3.fromRGB(10,0,15),    Color3.fromRGB(10,0,15),    Enum.Material.SmoothPlastic },
	[6] = { Color3.fromRGB(6,0,6),      Color3.fromRGB(6,0,6),      Enum.Material.SmoothPlastic },
	[7] = { Color3.fromRGB(100,10,10),  Color3.fromRGB(78,6,6),     Enum.Material.SmoothPlastic },
	[8] = { Color3.fromRGB(120,15,15),  Color3.fromRGB(98,10,10),   Enum.Material.SmoothPlastic },
}

-- ── Build and store all 16 models ─────────────────────────────────────────

local function ensureFolder(parent, name)
	local f = parent:FindFirstChild(name)
	if not f then
		f = Instance.new("Folder"); f.Name = name; f.Parent = parent
	end
	return f
end

local morphsRoot   = ensureFolder(ServerStorage, "CharacterMorphs")
local sFolder      = ensureFolder(morphsRoot,    "Sorcerer")
local csFolder     = ensureFolder(morphsRoot,    "CurseSpirit")

local built = 0
for stage = 1, 8 do
	-- Skip if a real model was already placed (name "Stage{n}" exists)
	if not sFolder:FindFirstChild("Stage"..stage) then
		local def   = SC[stage]
		local model = Instance.new("Model")
		model.Name  = "Stage"..stage
		local parts = buildBaseRig(model, def[1], def[2], def[3])
		decorateSorcerer(parts, model, stage)
		model.Parent = sFolder
		built += 1
	end

	if not csFolder:FindFirstChild("Stage"..stage) then
		local def   = CC[stage]
		local model = Instance.new("Model")
		model.Name  = "Stage"..stage
		local parts = buildBaseRig(model, def[1], def[2], def[3])
		decorateCurse(parts, model, stage)
		model.Parent = csFolder
		built += 1
	end
end

print(string.format("[ProceduralMorphBuilder] Built %d/16 morph models.", built))
