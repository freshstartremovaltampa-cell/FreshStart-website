-- SpiritManager.server.lua (Script → ServerScriptService)
-- Handles spirit drops, equip/unequip/delete, and inventory queries.
-- Spirits drop from enemies at ~5% chance per kill.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local GameData = require(ReplicatedStorage.Modules.GameData)

local function PDM() return require(game.ServerScriptService.PlayerDataManager) end

local RemoteEvents    = ReplicatedStorage:WaitForChild("RemoteEvents")
local RemoteFunctions = ReplicatedStorage:WaitForChild("RemoteFunctions")

local SpiritAction  = RemoteEvents:WaitForChild("SpiritAction")
local SpiritDropped = RemoteEvents:WaitForChild("SpiritDropped")
local GetSpiritsData = RemoteFunctions:WaitForChild("GetSpiritsData")

local SPIRIT_DROP_CHANCE = 0.05  -- 5% per kill

local SpiritManager = {}

-- Called by EnemyManager after each kill
function SpiritManager.TryDropSpirit(player)
	if math.random() > SPIRIT_DROP_CHANCE then return end
	local spirit = GameData.RollSpiritDrop()
	local uid    = PDM().AddSpirit(player, spirit.id)
	if uid then
		SpiritDropped:FireClient(player, spirit.name, spirit.rarity, uid)
	end
end

-- SpiritAction event: { action="equip"|"unequip"|"delete"|"equipAll"|"unequipAll", uid=number }
SpiritAction.OnServerEvent:Connect(function(player, payload)
	if not payload then return end
	local pdm = PDM()
	local action = payload.action
	if action == "equip" then
		pdm.EquipSpirit(player, payload.uid)
	elseif action == "unequip" then
		pdm.UnequipSpirit(player, payload.uid)
	elseif action == "delete" then
		pdm.RemoveSpirit(player, payload.uid)
	elseif action == "equipAll" then
		pdm.EquipBestSpirits(player)
	elseif action == "unequipAll" then
		pdm.UnequipAllSpirits(player)
	end
end)

GetSpiritsData.OnServerInvoke = function(player)
	local data = PDM().Get(player)
	if not data then return nil end
	-- Build enriched spirit list for client (add display info)
	local enriched = {}
	for _, inst in ipairs(data.spirits) do
		local sd = GameData.GetSpiritById(inst.spiritId)
		if sd then
			local isEquipped = false
			for _, uid in ipairs(data.equippedSpirits) do
				if uid == inst.uid then isEquipped = true break end
			end
			table.insert(enriched, {
				uid        = inst.uid,
				spiritId   = inst.spiritId,
				name       = sd.name,
				rarity     = sd.rarity,
				damageMult = sd.damageMult,
				equipped   = isEquipped,
			})
		end
	end
	return {
		spirits         = enriched,
		equippedCount   = #data.equippedSpirits,
		totalCount      = #data.spirits,
	}
end

return SpiritManager
