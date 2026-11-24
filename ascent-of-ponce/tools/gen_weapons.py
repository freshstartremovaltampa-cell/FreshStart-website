#!/usr/bin/env python3
"""Generates the Ponce weapons: item files, pixel-art icons, and
behavior_pack/scripts/weapon_data.js (the table the scripts read, including
each weapon's forge recipe). Weapons are forged at the Smithing Forge, not
crafted: see scripts/forging.js.

Run from the add-on folder:  python3 tools/gen_weapons.py
Edit WEAPONS below, then re-run. Weapons never carry special abilities:
skills belong to the player, and each weapon TYPE has its own handling
(see WEAPON_HANDLING in scripts/config.js).
"""
import json
import os
from PIL import Image

BP, RP = "behavior_pack", "resource_pack"


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


IRON = {"blade": (196, 200, 206), "edge": (236, 240, 245), "shadow": (130, 134, 142)}
WOOD, LEATHER, GOLD = (120, 84, 50), (92, 60, 40), (214, 170, 60)

# id, name, type, tier, damage, durability, level, stats, recipe, palette
WORN = {"blade": (150, 148, 140), "edge": (185, 182, 175), "shadow": (100, 98, 92)}
RELIC = {"blade": (196, 178, 240), "edge": (255, 236, 160), "shadow": (112, 82, 170)}

WEAPONS = [
    # ---- Starter: one is chosen on first login. Can't be forged or crafted. Unbreakable.
    #      Every starter is weaker than every other weapon (lowest real weapon: 5 damage). ----
    ("wayfarers_sword", "Wayfarer's Sword", "sword", 0, 4, None, 1, {}, None, WORN),
    ("wayfarers_dagger", "Wayfarer's Dagger", "dagger", 0, 3, None, 1, {}, None, WORN),
    ("wayfarers_rapier", "Wayfarer's Rapier", "rapier", 0, 3, None, 1, {}, None, WORN),
    ("wayfarers_hammer", "Wayfarer's Hammer", "hammer", 0, 4, None, 1, {}, None, WORN),
    ("wayfarers_axe", "Wayfarer's Axe", "axe", 0, 4, None, 1, {}, None, WORN),
    ("wayfarers_spear", "Wayfarer's Spear", "spear", 0, 4, None, 1, {}, None, WORN),
    ("wayfarers_katana", "Wayfarer's Katana", "katana", 0, 4, None, 1, {}, None, WORN),
    ("wayfarers_greatsword", "Wayfarer's Greatsword", "greatsword", 0, 4, None, 1, {}, None, WORN),

    # ---- Tier I: Ironheart, forged. Lv 3. ----
    ("iron_longsword", "Iron Longsword", "sword", 1, 7, 450, 3, {"str": 2, "dex": 2},
     {"shaped": ["  I", " I ", "S  "]}, IRON),
    ("iron_dagger", "Iron Dagger", "dagger", 1, 5, 450, 3, {"dex": 3},
     {"shaped": [" I", "S "]}, IRON),
    ("iron_rapier", "Iron Rapier", "rapier", 1, 6, 450, 3, {"dex": 4},
     {"shaped": ["  I", " I ", "SN "]}, IRON),
    ("iron_warhammer", "Iron Warhammer", "hammer", 1, 9, 450, 3, {"str": 4},
     {"shaped": ["III", "ISI", " S "]}, IRON),
    ("iron_battleaxe", "Iron Battleaxe", "axe", 1, 8, 450, 3, {"str": 3},
     {"shaped": ["III", "IS ", " S "]}, IRON),
    ("iron_spear", "Iron Spear", "spear", 1, 7, 450, 3, {"agi": 2, "str": 2},
     {"shaped": ["  I", " S ", "S  "]}, IRON),
    ("iron_katana", "Iron Katana", "katana", 1, 7, 450, 3, {"dex": 3, "agi": 2},
     {"shaped": ["  I", " I ", "LS "]}, IRON),
    ("iron_greatsword", "Iron Greatsword", "greatsword", 1, 11, 450, 3, {"str": 5, "vit": 2},
     {"shaped": [" I ", " I ", "ISI"]}, IRON),

    # ---- Tier II: upgraded with Floor 1 materials. Lv 5-8. ----
    ("tuskfang_blade", "Tuskfang Blade", "sword", 2, 8, 700, 6, {"str": 4, "dex": 4},
     {"upgrade": "iron_longsword", "with": [("ponce:boar_tusk", 2), ("ponce:boar_hide", 1)]},
     {"blade": (238, 230, 205), "edge": (255, 252, 240), "shadow": (180, 168, 140)}),
    ("stinger_dirk", "Stinger Dirk", "dagger", 2, 6, 700, 5, {"dex": 6},
     {"upgrade": "iron_dagger", "with": [("ponce:wasp_stinger", 3)]},
     {"blade": (60, 40, 40), "edge": (176, 42, 38), "shadow": (26, 20, 22)}),
    ("quill_rapier", "Quill Rapier", "rapier", 2, 7, 700, 5, {"dex": 6, "agi": 2},
     {"upgrade": "iron_rapier", "with": [("ponce:thorn_quill", 4)]},
     {"blade": (110, 160, 70), "edge": (200, 230, 150), "shadow": (70, 110, 45)}),
    ("golemite_maul", "Golemite Maul", "hammer", 2, 10, 700, 6, {"str": 7},
     {"upgrade": "iron_warhammer", "with": [("ponce:golemite_core", 1), ("ponce:moss_clump", 2)]},
     {"blade": (128, 128, 122), "edge": (120, 240, 140), "shadow": (82, 132, 56)}),
    ("boarhide_cleaver", "Boarhide Cleaver", "axe", 2, 9, 700, 6, {"str": 5, "vit": 3},
     {"upgrade": "iron_battleaxe", "with": [("ponce:boar_hide", 2), ("ponce:boar_tusk", 1)]},
     {"blade": (200, 204, 210), "edge": (240, 244, 248), "shadow": (104, 72, 48)}),
    ("thornpike", "Thornpike", "spear", 2, 8, 700, 5, {"agi": 5, "str": 3},
     {"upgrade": "iron_spear", "with": [("ponce:thorn_quill", 3), ("ponce:mole_claw", 1)]},
     {"blade": (236, 220, 205), "edge": (255, 245, 235), "shadow": (96, 142, 64)}),
    ("verdant_katana", "Verdant Katana", "katana", 2, 8, 700, 6, {"dex": 5, "agi": 4},
     {"upgrade": "iron_katana", "with": [("ponce:moss_clump", 2), ("ponce:wasp_wing", 1)]},
     {"blade": (170, 215, 190), "edge": (225, 250, 235), "shadow": (82, 132, 56)}),
    ("ironhide_greatsword", "Ironhide Greatsword", "greatsword", 2, 12, 700, 8, {"str": 9, "vit": 4},
     {"upgrade": "iron_greatsword", "with": [("ponce:boar_king_crest", 1), ("ponce:boar_tusk", 2)]},
     {"blade": (140, 146, 152), "edge": (255, 150, 40), "shadow": (70, 52, 44)}),

    # ---- Relic: Legendary quest rewards. Unbreakable, three built-in infusions. Can't be forged.
    #      Semi-high requirements (Lv 25, about double Tier II's stats). Below them a Relic still
    #      works at HALF strength, and even half (with its infusions) beats a Masterwork Tier II
    #      of its type. So full strength is about 2.5x a Tier II. ----
    ("boarbane", "Boarbane", "sword", 3, 18, None, 25, {"str": 10, "dex": 10},
     {"relic": ["ponce:boar_tusk", "ponce:boar_king_crest", "ponce:wasp_stinger"]}, RELIC),
    ("wasps_kiss", "Wasp's Kiss", "dagger", 3, 15, None, 25, {"dex": 14, "agi": 4},
     {"relic": ["ponce:wasp_stinger", "ponce:thorn_quill", "ponce:wasp_wing"]}, RELIC),
    ("thornwhisper", "Thornwhisper", "rapier", 3, 18, None, 25, {"dex": 14, "agi": 5},
     {"relic": ["ponce:thorn_quill", "ponce:wasp_wing", "ponce:wasp_stinger"]}, RELIC),
    ("golemheart_maul", "Golemheart Maul", "hammer", 3, 22, None, 25, {"str": 16, "vit": 5},
     {"relic": ["ponce:golemite_core", "ponce:boar_king_crest", "ponce:moss_clump"]}, RELIC),
    ("tuskreaver", "Tuskreaver", "axe", 3, 21, None, 25, {"str": 12, "vit": 8},
     {"relic": ["ponce:boar_tusk", "ponce:boar_king_crest", "ponce:boar_hide"]}, RELIC),
    ("molefang_pike", "Molefang Pike", "spear", 3, 19, None, 25, {"agi": 12, "str": 8},
     {"relic": ["ponce:mole_claw", "ponce:thorn_quill", "ponce:boar_tusk"]}, RELIC),
    ("verdant_moon", "Verdant Moon", "katana", 3, 21, None, 25, {"dex": 12, "agi": 10},
     {"relic": ["ponce:wasp_wing", "ponce:thorn_quill", "ponce:moss_clump"]}, RELIC),
    ("kingsfall", "Kingsfall", "greatsword", 3, 26, None, 25, {"str": 18, "vit": 8},
     {"relic": ["ponce:boar_king_crest", "ponce:golemite_core", "ponce:boar_tusk"]}, RELIC),
]

SHAPED_KEYS = {"I": "minecraft:iron_ingot", "S": "minecraft:stick", "N": "minecraft:iron_nugget", "L": "minecraft:leather"}
ENCHANT_SLOT = {"axe": "axe"}  # everything else enchants like a sword


# ---------------------------------------------------------------- icons
# Weapons are drawn along the diagonal from bottom-left (grip) to top-right (tip).
# Diagonal step i sits at (i, 15 - i); the perpendicular offset k moves to (i + k, 15 - i + k).

def put(img, i, k, color):
    x, y = i + k, 15 - i + k
    if 0 <= x < 16 and 0 <= y < 16:
        img.putpixel((x, y), color + (255,) if len(color) == 3 else color)


def blade(img, start, end, width, pal, curve=None):
    for i in range(start, end + 1):
        bend = curve(i) if curve else 0
        for k in range(width):
            off = k - width // 2 + bend
            color = pal["edge"] if k == 0 else pal["shadow"] if k == width - 1 and width > 1 else pal["blade"]
            put(img, i, off, color)


def grip(img, start, end, color=LEATHER, wrap=None):
    for i in range(start, end + 1):
        put(img, i, 0, wrap if wrap and i % 2 else color)


def guard(img, i, half, color):
    for k in range(-half, half + 1):
        put(img, i, k, color)


def draw(kind, pal):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    if kind == "sword":
        grip(img, 1, 3); guard(img, 4, 2, GOLD); blade(img, 5, 13, 2, pal); put(img, 14, 0, pal["edge"])
    elif kind == "dagger":
        grip(img, 3, 5); guard(img, 6, 1, GOLD); blade(img, 7, 11, 2, pal); put(img, 12, 0, pal["edge"])
    elif kind == "rapier":
        grip(img, 1, 3); guard(img, 4, 2, GOLD); put(img, 3, -2, GOLD); put(img, 3, 2, GOLD)
        blade(img, 5, 14, 1, pal)
    elif kind == "katana":
        grip(img, 1, 4, (30, 24, 30), wrap=(200, 190, 170)); guard(img, 5, 1, (60, 60, 64))
        blade(img, 6, 14, 2, pal, curve=lambda i: -1 if i >= 12 else 0)
    elif kind == "greatsword":
        grip(img, 0, 3); guard(img, 4, 3, GOLD); blade(img, 5, 13, 3, pal)
        put(img, 14, 0, pal["edge"]); put(img, 14, -1, pal["blade"])
    elif kind == "spear":
        grip(img, 0, 11, WOOD); guard(img, 11, 1, pal["shadow"])
        blade(img, 12, 14, 2, pal); put(img, 15, 0, pal["edge"])
    elif kind == "axe":
        grip(img, 1, 12, WOOD)
        head = {(9, 1): 1, (10, 1): 0, (8, 2): 1, (9, 2): 0, (10, 2): 0, (11, 2): 0, (7, 3): 1, (8, 3): 0,
                (9, 3): 0, (10, 3): 0, (11, 3): 2, (7, 4): 1, (8, 4): 0, (9, 4): 0, (10, 4): 2, (8, 5): 1, (9, 5): 2}
        for (x, y), tone in head.items():
            img.putpixel((x, y), (pal["blade"], pal["edge"], pal["shadow"])[tone] + (255,))
    elif kind == "hammer":
        grip(img, 1, 10, WOOD)
        for x in range(9, 14):
            for y in range(1, 6):
                edge = x in (9, 13) or y in (1, 5)
                img.putpixel((x, y), (pal["shadow"] if edge else pal["blade"]) + (255,))
        for x, y in ((10, 2), (11, 2), (10, 3)):
            img.putpixel((x, y), pal["edge"] + (255,))
    return img


# ---------------------------------------------------------------- files

def item_json(wid, name, kind, tier, damage, durability):
    tags = [f"ponce:{kind}", "ponce:weapon", f"ponce:weapon_tier_{tier}"]
    if tier >= 1:
        tags.append("ponce:tier_iron")  # counts as a "decent weapon" against Ironhide's thick hide
    if tier == 0:
        tags.append("ponce:starter")
    if tier == 3:
        tags.append("ponce:relic")
    comps = {
        "minecraft:icon": f"ponce_{wid}",
        "minecraft:display_name": {"value": f"§{'7fbd'[tier]}{name}"},
        "minecraft:max_stack_size": 1,
        "minecraft:hand_equipped": {"value": True},
        "minecraft:damage": {"value": damage},
        "minecraft:enchantable": {"slot": ENCHANT_SLOT.get(kind, "sword"), "value": 14},
        "minecraft:can_destroy_in_creative": {"value": False},
        "minecraft:cooldown": {"category": "ponce_skill", "duration": 0.25},
        "minecraft:tags": {"tags": tags},
    }
    if durability:  # starters and relics have no durability at all: unbreakable
        comps["minecraft:durability"] = {"max_durability": durability}
        comps["minecraft:repairable"] = {"repair_items": [{"items": ["minecraft:iron_ingot"], "repair_amount": durability // 4}]}
    if tier == 3:
        comps["minecraft:glint"] = {"value": True}
    if kind == "sword":
        comps["minecraft:allow_off_hand"] = {"value": True}  # for Dual Wield
    return {
        "format_version": "1.21.40",
        "minecraft:item": {
            "description": {"identifier": f"ponce:{wid}",
                            "menu_category": {"category": "equipment", "group": "minecraft:itemGroup.name.sword"}},
            "components": comps,
        },
    }


INGOTS = {"dagger": 2, "spear": 2, "sword": 3, "rapier": 3, "katana": 3, "axe": 3, "hammer": 4, "greatsword": 5}


def forge_recipe(kind, tier, recipe):
    """Tier I: Ironheart plus an Ember Copper fitting. Tier II adds Glimmer Silver and Floor 1 materials.
    Starters (tier 0) and Relics (tier 3) can't be forged."""
    if tier in (0, 3):
        return None
    mats = [("ponce:ironheart_ingot", INGOTS[kind]), ("ponce:ember_copper_ingot", 1)]
    if tier == 2:
        mats = [("ponce:ironheart_ingot", INGOTS[kind]), ("ponce:glimmer_silver_ingot", 1)] + list(recipe["with"])
    return {"smithing": 1 if tier == 1 else 8, "xp": 30 if tier == 1 else 80, "slots": tier,
            "materials": [{"item": i, "count": n} for i, n in mats]}


# Optional monster-drop infusions added while forging (Tier I: 1 slot, Tier II: 2).
# Stats only, never abilities. damage is flat; durability, crit and swing are
# fractions (swing -0.2 = 20% faster swings). Every infusion has a trade-off or a cost.
INFUSIONS = {
    "ponce:boar_tusk": {"name": "Tusk Edge", "cost": 1, "damage": 1, "durability": -0.1},
    "ponce:boar_hide": {"name": "Hide Grip", "cost": 2, "durability": 0.3},
    "ponce:thorn_quill": {"name": "Quill Barbs", "cost": 3, "crit": 0.05},
    "ponce:wasp_stinger": {"name": "Stinger Point", "cost": 2, "damage": 0.5, "crit": 0.03},
    "ponce:mole_claw": {"name": "Claw Serration", "cost": 2, "damage": 0.5, "swing": -0.1},
    "ponce:jelly_gel": {"name": "Gel Temper", "cost": 4, "damage": -0.5, "swing": -0.2},
    "ponce:wasp_wing": {"name": "Wing Balance", "cost": 2, "swing": -0.15},
    "ponce:moss_clump": {"name": "Moss Binding", "cost": 3, "durability": 0.2},
    "ponce:golemite_core": {"name": "Core Weight", "cost": 1, "damage": 2, "swing": 0.15},
    "ponce:boar_king_crest": {"name": "King's Crest", "cost": 1, "damage": 1.5, "durability": 0.25},
}


def recipe_json(wid, recipe):
    ident = f"ponce:{wid}"
    if "shaped" in recipe:
        used = {c for row in recipe["shaped"] for c in row if c != " "}
        return {"format_version": "1.20.10", "minecraft:recipe_shaped": {
            "description": {"identifier": ident}, "tags": ["crafting_table"],
            "pattern": recipe["shaped"], "key": {c: {"item": SHAPED_KEYS[c]} for c in sorted(used)},
            "unlock": [{"item": "minecraft:iron_ingot"}], "result": {"item": ident}}}
    base = f"ponce:{recipe['upgrade']}"
    return {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": ident}, "tags": ["crafting_table"],
        "ingredients": [{"item": base}] + [{"item": i, "count": n} for i, n in recipe["with"]],
        "unlock": [{"item": base}], "result": {"item": ident}}}


def main():
    textures, table = {}, {}
    for wid, name, kind, tier, damage, dur, level, stats, recipe, pal in WEAPONS:
        write_json(f"{BP}/items/weapons/{wid}.json", item_json(wid, name, kind, tier, damage, dur))

        os.makedirs(f"{RP}/textures/items/weapons", exist_ok=True)
        draw(kind, pal).save(f"{RP}/textures/items/weapons/{wid}.png")
        textures[f"ponce_{wid}"] = {"textures": f"textures/items/weapons/{wid}"}
        table[f"ponce:{wid}"] = {"name": name, "type": kind, "tier": tier, "damage": damage,
                                 "durability": dur, "req": {"level": level, "stats": stats},
                                 "forge": forge_recipe(kind, tier, recipe)}
        if tier == 3:
            table[f"ponce:{wid}"]["infusions"] = recipe["relic"]

    path = f"{RP}/textures/item_texture.json"
    data = json.load(open(path))
    data["texture_data"].update(textures)
    write_json(path, data)

    with open(f"{BP}/scripts/weapon_data.js", "w") as f:
        f.write("// Generated by tools/gen_weapons.py. Edit the generator, not this file.\n\n")
        f.write("export const WEAPON_DEFS = " + json.dumps(table, indent=2) + ";\n\n")
        f.write("export const INFUSIONS = " + json.dumps(INFUSIONS, indent=2) + ";\n")
    print(f"Generated {len(WEAPONS)} weapons.")


if __name__ == "__main__":
    main()
