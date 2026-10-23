-- EnemyModelBuilder.server.lua (Script → ServerScriptService)
-- Builds all 12 enemy NPC models and stores them in ServerStorage/EnemyModels.
-- EnemyManager clones from this store by id string.
-- To replace any enemy with a real 3D upload: place a Model named by its id
-- in ServerStorage/EnemyModels and remove/skip that entry here.

local ServerStorage = game:GetService("ServerStorage")

-- ── Shared R6 joint data ───────────────────────────────────────────────────
local JOINTS = {
	{ "HumanoidRootPart", "RootJoint",      "Torso",
		CFrame.new(0,0,0,-1,0,0,0,0,1,0,1,0), CFrame.new(0,-1,0,-1,0,0,0,0,1,0,1,0) },
	{ "Torso", "Neck",            "Head",
		CFrame.new(0,1,0,-1,0,0,0,0,1,0,1,0), CFrame.new(0,-0.5,0,-1,0,0,0,0,1,0,1,0) },
	{ "Torso", "Left Shoulder",   "Left Arm",
		CFrame.new(-1,0.5,0,0,0,-1,0,1,0,1,0,0), CFrame.new(0.5,0.5,0,0,0,-1,0,1,0,1,0,0) },
	{ "Torso", "Right Shoulder",  "Right Arm",
		CFrame.new(1,0.5,0,0,0,1,0,1,0,-1,0,0),  CFrame.new(-0.5,0.5,0,0,0,1,0,1,0,-1,0,0) },
	{ "Torso", "Left Hip",        "Left Leg",
		CFrame.new(-1,-1,0,0,0,-1,0,1,0,1,0,0),  CFrame.new(-0.5,1,0,0,0,-1,0,1,0,1,0,0) },
	{ "Torso", "Right Hip",       "Right Leg",
		CFrame.new(1,-1,0,0,0,1,0,1,0,-1,0,0),   CFrame.new(0.5,1,0,0,0,1,0,1,0,-1,0,0) },
}

-- ── Helpers ────────────────────────────────────────────────────────────────

local function buildRig(model, bodyColor, headColor, material)
	local function p(name, size, col, mat, noCollide, trans)
		local part       = Instance.new("Part")
		part.Name        = name
		part.Size        = size
		part.Color       = col
		part.Material    = mat or Enum.Material.SmoothPlastic
		part.CanCollide  = not noCollide
		part.Anchored    = false
		part.CastShadow  = false
		if trans then part.Transparency = trans end
		part.Parent      = model
		return part
	end

	local hrp   = p("HumanoidRootPart", Vector3.new(2,2,1), bodyColor, Enum.Material.SmoothPlastic, true, 1)
	local torso = p("Torso",            Vector3.new(2,2,1), bodyColor, material)
	local head  = p("Head",             Vector3.new(2,1,1), headColor, Enum.Material.SmoothPlastic)
	local larm  = p("Left Arm",         Vector3.new(1,2,1), bodyColor, material)
	local rarm  = p("Right Arm",        Vector3.new(1,2,1), bodyColor, material)
	local lleg  = p("Left Leg",         Vector3.new(1,2,1), bodyColor, material)
	local rleg  = p("Right Leg",        Vector3.new(1,2,1), bodyColor, material)

	local hum         = Instance.new("Humanoid")
	hum.RigType       = Enum.HumanoidRigType.R6
	hum.DisplayName   = ""   -- overridden per-enemy below
	hum.Parent        = model

	local parts = { HumanoidRootPart=hrp, Torso=torso, Head=head,
	                ["Left Arm"]=larm, ["Right Arm"]=rarm,
	                ["Left Leg"]=lleg, ["Right Leg"]=rleg }
	for _, j in ipairs(JOINTS) do
		local m = Instance.new("Motor6D")
		m.Name = j[2]; m.Part0 = parts[j[1]]; m.Part1 = parts[j[3]]
		m.C0 = j[4]; m.C1 = j[5]; m.Parent = parts[j[1]]
	end
	model.PrimaryPart = hrp
	return { hrp=hrp, torso=torso, head=head, larm=larm, rarm=rarm, lleg=lleg, rleg=rleg }
end

local function deco(parent_part, model, name, size, cfOff, color, mat, mesh)
	local p = Instance.new("Part")
	p.Name = name; p.Size = size; p.Color = color
	p.Material = mat or Enum.Material.Neon
	p.CanCollide = false; p.CastShadow = false
	p.CFrame = parent_part.CFrame * cfOff
	p.Parent = model
	if mesh then local m=Instance.new("SpecialMesh"); m.MeshType=mesh; m.Parent=p end
	local w = Instance.new("WeldConstraint")
	w.Part0 = parent_part; w.Part1 = p; w.Parent = parent_part
end

local function aura(part, color, size, rate, speed, life)
	local att = Instance.new("Attachment"); att.Parent = part
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new{ ColorSequenceKeypoint.new(0,color), ColorSequenceKeypoint.new(1,Color3.new(0,0,0)) }
	pe.Size  = NumberSequence.new{ NumberSequenceKeypoint.new(0,size), NumberSequenceKeypoint.new(1,0) }
	pe.Rate = rate; pe.Speed = NumberRange.new(speed*0.5, speed)
	pe.Lifetime = NumberRange.new(life*0.7, life)
	pe.LightEmission = 1; pe.LightInfluence = 0; pe.Parent = att
end

local function nameTag(head, displayName, color)
	local bg = Instance.new("BillboardGui")
	bg.Adornee = head; bg.Size = UDim2.new(0,160,0,40)
	bg.StudsOffset = Vector3.new(0,2,0); bg.AlwaysOnTop = false
	bg.Parent = head
	local lbl = Instance.new("TextLabel")
	lbl.Size = UDim2.new(1,0,1,0); lbl.Text = displayName
	lbl.Font = Enum.Font.GothamBold; lbl.TextSize = 14
	lbl.TextColor3 = color or Color3.new(1,1,1)
	lbl.BackgroundColor3 = Color3.fromRGB(10,10,20)
	lbl.BackgroundTransparency = 0.2; lbl.TextWrapped = true
	lbl.Parent = bg
	local c = Instance.new("UICorner"); c.CornerRadius = UDim.new(0,6); c.Parent = lbl
end

-- ── Enemy definitions ──────────────────────────────────────────────────────
-- { id, displayName, bodyColor, headColor, material, buildFn }

local enemies = {

	-- ── Curse Spirits (Sorcerer Path enemies) ────────────────────────────

	{
		id = "BasicCurse", name = "Basic Curse Spirit",
		body = Color3.fromRGB(90,70,110), head = Color3.fromRGB(80,60,100),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(100,50,140), 0.2, 10, 1.5, 1.8)
		end,
	},

	{
		id = "Grade2Curse", name = "Grade 2 Curse",
		body = Color3.fromRGB(80,20,110), head = Color3.fromRGB(70,15,100),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(120,30,160), 0.28, 22, 2.5, 2)
			deco(p.larm, m, "LTend", Vector3.new(0.18,1.1,0.18), CFrame.new(0,-1.6,0)*CFrame.Angles(0.15,0,0.1), Color3.fromRGB(80,20,110), Enum.Material.Neon)
			deco(p.rarm, m, "RTend", Vector3.new(0.18,1.1,0.18), CFrame.new(0,-1.6,0)*CFrame.Angles(0.1,0,-0.1),  Color3.fromRGB(80,20,110), Enum.Material.Neon)
		end,
	},

	{
		id = "Grade1Curse", name = "Grade 1 Curse",
		body = Color3.fromRGB(50,10,70), head = Color3.fromRGB(40,8,60),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(140,40,180), 0.35, 32, 3.5, 2.5)
			aura(p.head,  Color3.fromRGB(140,40,180), 0.18, 10, 2,   1.5)
			deco(p.head, m, "LHorn", Vector3.new(0.38,0.95,0.38), CFrame.new(-0.52,0.6,0)*CFrame.Angles(0,0,-0.3), Color3.fromRGB(20,0,30), Enum.Material.SmoothPlastic)
			deco(p.head, m, "RHorn", Vector3.new(0.38,0.95,0.38), CFrame.new( 0.52,0.6,0)*CFrame.Angles(0,0, 0.3), Color3.fromRGB(20,0,30), Enum.Material.SmoothPlastic)
		end,
	},

	{
		id = "SpecialCurse", name = "Special Grade Curse",
		body = Color3.fromRGB(20,5,30), head = Color3.fromRGB(15,3,22),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(160,50,200), 0.5, 55, 5, 3)
			aura(p.torso, Color3.fromRGB(40,0,60),    0.3, 25, 3, 2.5)
			deco(p.head, m, "LHorn",  Vector3.new(0.45,1.3,0.45),  CFrame.new(-0.56,0.78,0)*CFrame.Angles(0,0,-0.45), Color3.fromRGB(10,0,15), Enum.Material.SmoothPlastic)
			deco(p.head, m, "RHorn",  Vector3.new(0.45,1.3,0.45),  CFrame.new( 0.56,0.78,0)*CFrame.Angles(0,0, 0.45), Color3.fromRGB(10,0,15), Enum.Material.SmoothPlastic)
			deco(p.torso, m, "Spine", Vector3.new(0.28,2.1,0.28),  CFrame.new(0,0,-0.65),                             Color3.fromRGB(130,20,170), Enum.Material.Neon)
		end,
	},

	{
		id = "MahitoEnemy", name = "Mahito",
		body = Color3.fromRGB(60,60,70), head = Color3.fromRGB(50,50,60),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(80,100,200), 0.3, 20, 2.5, 2)
			-- Blue soul patches on body
			deco(p.torso, m, "Patch1", Vector3.new(0.9,0.9,1.06), CFrame.new(-0.4,0.2,0),  Color3.fromRGB(60,80,200), Enum.Material.Neon)
			deco(p.torso, m, "Patch2", Vector3.new(0.7,0.7,1.06), CFrame.new( 0.5,-0.4,0), Color3.fromRGB(60,80,200), Enum.Material.Neon)
			deco(p.larm,  m, "PatchA", Vector3.new(0.5,0.5,1.06), CFrame.new(0,-0.3,0),    Color3.fromRGB(60,80,200), Enum.Material.Neon)
			-- Seam line across face
			deco(p.head, m, "Seam",   Vector3.new(2.06,0.08,1.06), CFrame.new(0,0.1,0),    Color3.fromRGB(40,60,180), Enum.Material.Neon)
		end,
	},

	{
		id = "JogoEnemy", name = "Jogo",
		body = Color3.fromRGB(160,60,20), head = Color3.fromRGB(200,80,0),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(255,100,20), 0.45, 45, 5, 3)
			aura(p.head,  Color3.fromRGB(255,120,0),  0.3,  20, 3, 2)
			-- Volcano cone on top of head
			deco(p.head, m, "Volcano", Vector3.new(1.4,1.8,1.4), CFrame.new(0,0.9,0), Color3.fromRGB(80,30,10), Enum.Material.SmoothPlastic, Enum.MeshType.Wedge)
			-- Lava glow top
			deco(p.head, m, "LavaTop", Vector3.new(0.8,0.5,0.8), CFrame.new(0,1.9,0), Color3.fromRGB(255,100,0), Enum.Material.Neon, Enum.MeshType.Sphere)
			-- Single large eye
			deco(p.head, m, "Eye",     Vector3.new(0.6,0.6,0.1), CFrame.new(0,0.05,-0.54), Color3.fromRGB(255,200,0), Enum.Material.Neon, Enum.MeshType.Sphere)
		end,
	},

	-- ── Sorcerers (CurseSpirit Path enemies) ─────────────────────────────

	{
		id = "WeakSorcerer", name = "Weakling Sorcerer",
		body = Color3.fromRGB(210,210,220), head = Color3.fromRGB(220,190,160),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(160,180,255), 0.1, 5, 1, 1.2)
		end,
	},

	{
		id = "Grade2Sorcerer", name = "Grade 2 Sorcerer",
		body = Color3.fromRGB(50,100,200), head = Color3.fromRGB(200,165,130),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(80,140,255), 0.22, 18, 2, 1.5)
			aura(p.larm,  Color3.fromRGB(80,140,255), 0.1,  6,  1, 1)
			aura(p.rarm,  Color3.fromRGB(80,140,255), 0.1,  6,  1, 1)
		end,
	},

	{
		id = "Grade1Sorcerer", name = "Grade 1 Sorcerer",
		body = Color3.fromRGB(20,50,150), head = Color3.fromRGB(185,150,120),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(50,100,220), 0.3, 28, 3, 2)
			deco(p.torso, m, "Band1", Vector3.new(2.06,0.18,1.06), CFrame.new(0, 0.32,0), Color3.fromRGB(255,200,50), Enum.Material.Neon)
			deco(p.torso, m, "Band2", Vector3.new(2.06,0.18,1.06), CFrame.new(0,-0.32,0), Color3.fromRGB(255,200,50), Enum.Material.Neon)
		end,
	},

	{
		id = "SpecialSorcerer", name = "Special Grade Sorcerer",
		body = Color3.fromRGB(90,20,160), head = Color3.fromRGB(170,135,105),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(150,60,220), 0.4,  42, 4, 2.5)
			aura(p.head,  Color3.fromRGB(150,60,220), 0.2,  14, 2, 1.5)
			deco(p.head, m, "Crown", Vector3.new(2.2,0.14,2.2), CFrame.new(0,0.65,0), Color3.fromRGB(180,80,255), Enum.Material.Neon, Enum.MeshType.Cylinder)
		end,
	},

	{
		id = "YutaEnemy", name = "Yuta Okkotsu",
		body = Color3.fromRGB(30,30,40), head = Color3.fromRGB(200,175,150),
		mat  = Enum.Material.SmoothPlastic,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(200,220,255), 0.45, 50, 5, 3)
			aura(p.torso, Color3.fromRGB(100,80,200),  0.25, 20, 3, 2)
			-- White collar/coat trim
			deco(p.torso, m, "Collar", Vector3.new(2.06,0.3,1.06), CFrame.new(0,0.85,0), Color3.fromRGB(230,230,240), Enum.Material.SmoothPlastic)
			-- Rika aura ring
			deco(p.torso, m, "RikaRing", Vector3.new(3.5,0.12,3.5), CFrame.new(0,0.5,0), Color3.fromRGB(180,50,200), Enum.Material.Neon, Enum.MeshType.Cylinder)
		end,
	},

	{
		id = "GojoEnemy", name = "Satoru Gojo",
		body = Color3.fromRGB(240,240,255), head = Color3.fromRGB(230,230,245),
		mat  = Enum.Material.Neon,
		build = function(p, m)
			aura(p.torso, Color3.fromRGB(0,220,255), 0.6, 80, 8, 4)
			aura(p.head,  Color3.fromRGB(0,200,255), 0.35, 30, 4, 2.5)
			-- Blindfold strip
			deco(p.head, m, "Blindfold", Vector3.new(2.06,0.45,1.06), CFrame.new(0,0.1,0), Color3.fromRGB(10,10,15), Enum.Material.SmoothPlastic)
			-- Infinity aura rings (two)
			deco(p.torso, m, "Ring1", Vector3.new(4,0.1,4),   CFrame.new(0, 0.5,0)*CFrame.Angles(0,0,0),              Color3.fromRGB(0,200,255), Enum.Material.Neon, Enum.MeshType.Cylinder)
			deco(p.torso, m, "Ring2", Vector3.new(4.6,0.1,4.6), CFrame.new(0,-0.2,0)*CFrame.Angles(math.rad(15),0,0), Color3.fromRGB(0,160,220), Enum.Material.Neon, Enum.MeshType.Cylinder)
		end,
	},
}

-- ── Build and store ────────────────────────────────────────────────────────

local function ensureFolder(parent, name)
	local f = parent:FindFirstChild(name)
	if not f then f = Instance.new("Folder"); f.Name = name; f.Parent = parent end
	return f
end

local store  = ensureFolder(ServerStorage, "EnemyModels")
local nameColors = {
	-- Curse Spirits: red name tags
	BasicCurse=Color3.fromRGB(220,100,100), Grade2Curse=Color3.fromRGB(200,80,80),
	Grade1Curse=Color3.fromRGB(200,60,200), SpecialCurse=Color3.fromRGB(160,40,200),
	MahitoEnemy=Color3.fromRGB(100,120,255), JogoEnemy=Color3.fromRGB(255,140,20),
	-- Sorcerers: blue name tags
	WeakSorcerer=Color3.fromRGB(160,200,255), Grade2Sorcerer=Color3.fromRGB(100,160,255),
	Grade1Sorcerer=Color3.fromRGB(80,130,255), SpecialSorcerer=Color3.fromRGB(180,100,255),
	YutaEnemy=Color3.fromRGB(200,180,255), GojoEnemy=Color3.fromRGB(0,220,255),
}

local built = 0
for _, def in ipairs(enemies) do
	if not store:FindFirstChild(def.id) then
		local model = Instance.new("Model")
		model.Name  = def.id
		local parts = buildRig(model, def.body, def.head, def.mat)
		def.build(parts, model)
		nameTag(parts.head, def.name, nameColors[def.id])
		-- Humanoid display name
		local hum = model:FindFirstChildOfClass("Humanoid")
		if hum then hum.DisplayName = def.name end
		model.Parent = store
		built += 1
	end
end

print(string.format("[EnemyModelBuilder] Built %d/12 enemy models.", built))
