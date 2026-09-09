# JJK Evolution Obby — Roblox Game Scripts

A Jujutsu Kaisen–themed evolution obby with two diverging paths, 8 stages each,
enemy combat, cursed tool drops, and a paid path-switch system.

---

## Studio Setup Checklist

### 1. Place scripts in their correct services

| File | Roblox Location |
|---|---|
| `ServerScriptService/GameManager.server.lua` | ServerScriptService (Script) |
| `ServerScriptService/PlayerDataManager.server.lua` | ServerScriptService (Script) |
| `ServerScriptService/PathManager.server.lua` | ServerScriptService (Script) |
| `ServerScriptService/StageManager.server.lua` | ServerScriptService (Script) |
| `ServerScriptService/EnemyManager.server.lua` | ServerScriptService (Script) |
| `ServerScriptService/CursedToolManager.server.lua` | ServerScriptService (Script) |
| `ReplicatedStorage/Modules/GameData.lua` | ReplicatedStorage → Modules folder (ModuleScript) |
| `ReplicatedStorage/Modules/StatsCalculator.lua` | ReplicatedStorage → Modules folder (ModuleScript) |
| `StarterPlayerScripts/ClientManager.client.lua` | StarterPlayerScripts (LocalScript) |
| `StarterCharacterScripts/HubNpcInteract.client.lua` | StarterCharacterScripts (LocalScript) |
| `StarterGui/PathSelectGui.lua` | StarterGui → ScreenGui named **PathSelectGui** (LocalScript inside it) |
| `StarterGui/MainHUD.lua` | StarterGui → ScreenGui named **MainHUD** (LocalScript inside it) |
| `StarterGui/InventoryGui.lua` | StarterGui → ScreenGui named **InventoryGui** (LocalScript inside it) |
| `StarterGui/NotificationGui.lua` | StarterGui → ScreenGui named **NotificationGui** (LocalScript inside it) |

### 2. Create the Stages folder structure in Workspace

```
Workspace/
  Hub/
    PathSwitchNPC  ← Model with HumanoidRootPart (NPC named "Kenjaku")
  Stages/
    TokyoJJHigh/
      StageSpawn   ← Part (SpawnLocation or BasePart)
      [your obby parts here]
    KyotoJJHigh/
      StageSpawn
    Shibuya/
      StageSpawn
    FightClub/
      StageSpawn
    Shinjuku/
      StageSpawn
    CullingGames/
      StageSpawn
    FinalDomain/
      StageSpawn
```

### 3. Create enemy model templates in ServerStorage

```
ServerStorage/
  EnemyModels/
    BasicCurse       ← Model with Humanoid + HumanoidRootPart
    Grade2Curse
    Grade1Curse
    SpecialCurse
    MahitoEnemy
    JogoEnemy
    WeakSorcerer
    Grade2Sorcerer
    Grade1Sorcerer
    SpecialSorcerer
    YutaEnemy
    GojoEnemy
```
Each enemy model needs a `Humanoid` and a `HumanoidRootPart`. Health and speed
are set by the scripts at spawn time, so values in the model don't matter.

### 4. Monetization — Developer Product

1. Go to your game's **Creator Dashboard → Monetization → Developer Products**
2. Create a product called **"Early Path Switch"** (suggested price: 99 Robux)
3. Copy the numeric Product ID
4. Open `ReplicatedStorage/Modules/GameData.lua` and replace the `0` in:
   ```lua
   EarlyPathSwitch = { productId = 0, ... }
   ```
   with your actual Product ID.

---

## Game Flow

```
Join → PathSelectGui (choose Sorcerer or Curse Spirit)
     → Spawn at Stage 1 location (Tokyo JJ High)
     → Defeat enemies to fill kill quota
     → Stage completes → Evolution banner → Teleport to next location
     → Repeat through all 8 stages
     → Stage 8 final form unlocked + free path switch unlocked
```

## Path Switching

- **Free**: available after completing all 8 stages (talk to Kenjaku NPC in Hub)
- **Paid**: available at any stage via Developer Product purchase
- Stats reset to the new path's Stage 1 baseline
- Cursed tool inventory is **kept** across switches

## Cursed Tools

Tools drop from enemies at random based on `dropChance` per enemy type.
Each tool adds flat stat bonuses (damage, health, speed) that stack with
the player's current stage base stats. No duplicates — each tool can only
be owned once per player.

| Rarity | Color |
|---|---|
| Uncommon | Green |
| Rare | Blue |
| Epic | Purple |
| Legendary | Orange |

---

## Notes

- All player data (path, stage, inventory) persists via `DataStoreService`.
  Enable DataStore API access in **Game Settings → Security** for saves to work.
- The `GameManager` script auto-creates the `RemoteEvents` and `RemoteFunctions`
  folders on startup, so you don't need to create them manually in Studio.
- Enemy AI is simple (walks toward its assigned player). Upgrade with
  `PathfindingService` for smarter navigation around obstacles.
