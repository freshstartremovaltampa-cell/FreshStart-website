#!/usr/bin/env python3
"""Generates Phase 3 job content: ore nodes (and the depleted node), the
Smithing Forge and Cooking Pot blocks, raw ores, ingots, foods, recipes,
underground ore generation, placeholder textures, and
behavior_pack/scripts/jobs_data.js (the table the scripts read).

Run from the add-on folder:  python3 tools/gen_jobs.py
"""
import json
import os
import random
from PIL import Image

BP, RP = "behavior_pack", "resource_pack"
random.seed(11)

# key, name, mining level, min pickaxe tier, xp, regen seconds, flecks, sparkle, map color, y range, veins per chunk
ORES = [
    ("ember_copper", "Ember Copper", 1, "wooden", 10, 30, (214, 120, 60), (245, 170, 100), "#B0703C", (0, 80), 8),
    ("ironheart", "Ironheart", 5, "stone", 25, 60, (150, 40, 40), (210, 90, 80), "#8C3A34", (-32, 48), 5),
    ("glimmer_silver", "Glimmer Silver", 12, "iron", 50, 120, (205, 212, 228), (255, 255, 255), "#C8D0E0", (-64, 16), 3),
]
PICKAXE_TIERS = ["wooden", "golden", "stone", "iron", "diamond", "netherite"]  # golden counts as wooden-level

# key, name, nutrition, saturation, buff stats, buff seconds, cooking level, xp, ingredients, colors
FOODS = [
    ("boar_skewer", "Boar Skewer", 6, 0.6, {"str": 3}, 180, 1, 12,
     [("ponce:raw_boar", 1), ("minecraft:stick", 1)], ((150, 80, 50), (110, 84, 50))),
    ("hare_stew", "Hare Stew", 7, 0.6, {"agi": 3}, 180, 3, 18,
     [("ponce:raw_hare", 1), ("minecraft:carrot", 1), ("minecraft:bowl", 1)], ((170, 110, 60), (120, 90, 60))),
    ("jelly_tart", "Jelly Tart", 5, 0.5, {"dex": 3}, 180, 5, 22,
     [("ponce:jelly_gel", 2), ("minecraft:wheat", 1), ("minecraft:sugar", 1)], ((96, 214, 170), (220, 180, 110))),
    ("hearty_roast", "Hearty Roast", 10, 0.8, {"vit": 3}, 300, 8, 30,
     [("ponce:raw_boar", 2), ("minecraft:potato", 2)], ((140, 70, 40), (200, 160, 90))),
    # Floor 2
    ("marsh_gumbo", "Marsh Gumbo", 10, 0.8, {"agi": 4, "dex": 2}, 300, 12, 45,
     [("ponce:frog_legs", 2), ("ponce:bog_moss", 1), ("minecraft:bowl", 1)], ((110, 90, 50), (70, 84, 44))),
]


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def jitter(c, n=12):
    d = random.randint(-n, n)
    return tuple(max(0, min(255, v + d)) for v in c[:3]) + (255,)


def tex(name, painter, folder="blocks"):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    painter(img)
    path = f"{RP}/textures/{folder}/{name}.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
    return f"textures/{folder}/{name}"


def stone(img, base=(125, 125, 125), n=14):
    for y in range(16):
        for x in range(16):
            img.putpixel((x, y), jitter(base, n))


def flecks(img, color, sparkle, count=6):
    for _ in range(count):
        cx, cy = random.randint(2, 13), random.randint(2, 13)
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1), (-1, 0)):
            if random.random() < 0.8:
                img.putpixel((cx + dx, cy + dy), jitter(color, 10))
        img.putpixel((cx, cy), sparkle + (255,))


def blob(img, cx, cy, rx, ry, color, n=8):
    for y in range(16):
        for x in range(16):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                img.putpixel((x, y), jitter(color, n))


# ---------------------------------------------------------------- blocks

def block(ident, texture_side, texture_top=None, destroy=2.5, loot=None, map_color="#808080", unbreakable=False, menu="nature"):
    mats = {"*": {"texture": texture_side, "render_method": "opaque"}}
    if texture_top:
        mats["up"] = {"texture": texture_top, "render_method": "opaque"}
    comps = {
        "minecraft:destructible_by_mining": False if unbreakable else {"seconds_to_destroy": destroy},
        "minecraft:destructible_by_explosion": {"explosion_resistance": 1200 if unbreakable else 30},
        "minecraft:material_instances": mats,
        "minecraft:map_color": map_color,
    }
    if loot:
        comps["minecraft:loot"] = loot
    return {"format_version": "1.21.40", "minecraft:block": {
        "description": {"identifier": ident, "menu_category": {"category": menu}}, "components": comps}}


def item(ident, name, icon, extra=None, stack=64, category="items"):
    comps = {"minecraft:icon": icon, "minecraft:display_name": {"value": name}, "minecraft:max_stack_size": stack}
    comps.update(extra or {})
    return {"format_version": "1.21.40", "minecraft:item": {
        "description": {"identifier": ident, "menu_category": {"category": category}}, "components": comps}}


def main():
    terrain, items_tex, sounds, lang = {}, {}, {}, []
    write_json(f"{BP}/loot_tables/empty.json", {"pools": []})

    # Ore nodes: drops are handled by script (mining.js), so the block loot is empty
    for key, name, lvl, tier, xp, regen, col, spark, mapc, (ylo, yhi), veins in ORES:
        node = f"ponce:{key}_node"
        terrain[f"ponce_{key}_node"] = {"textures": tex(f"{key}_node", lambda img, c=col, s=spark: (stone(img), flecks(img, c, s)))}
        write_json(f"{BP}/blocks/{key}_node.json", block(node, f"ponce_{key}_node", loot="loot_tables/empty.json", map_color=mapc, destroy=2.0 + lvl * 0.1))
        sounds[node] = {"sound": "stone"}
        lang.append(f"tile.{node}.name={name} Node")

        items_tex[f"ponce_raw_{key}"] = {"textures": tex(f"raw_{key}", lambda img, c=col, s=spark: (
            blob(img, 7.5, 8, 5.5, 4.5, (110, 110, 112)), flecks(img, c, s, 3)), "items")}
        write_json(f"{BP}/items/jobs/raw_{key}.json", item(f"ponce:raw_{key}", f"§fRaw {name}", f"ponce_raw_{key}"))

        def ingot(img, c=col, s=spark):
            for y in range(6, 11):
                for x in range(3 + (10 - y) // 2, 13 - (y - 6) // 2):
                    img.putpixel((x, y), jitter(c, 6) if y > 6 else s + (255,))
        items_tex[f"ponce_{key}_ingot"] = {"textures": tex(f"{key}_ingot", ingot, "items")}
        write_json(f"{BP}/items/jobs/{key}_ingot.json", item(f"ponce:{key}_ingot", f"§f{name} Ingot", f"ponce_{key}_ingot"))
        write_json(f"{BP}/recipes/jobs/smelt_{key}.json", {"format_version": "1.20.10", "minecraft:recipe_furnace": {
            "description": {"identifier": f"ponce:smelt_{key}"}, "tags": ["furnace", "blast_furnace"],
            "input": f"ponce:raw_{key}", "output": f"ponce:{key}_ingot"}})

        # Underground generation
        write_json(f"{BP}/features/{key}_node_feature.json", {"format_version": "1.13.0", "minecraft:ore_feature": {
            "description": {"identifier": f"ponce:{key}_node_feature"}, "count": 3,
            "replace_rules": [{"places_block": node, "may_replace": [
                "minecraft:stone", "minecraft:andesite", "minecraft:diorite", "minecraft:granite", "minecraft:deepslate", "minecraft:tuff"]}]}})
        write_json(f"{BP}/feature_rules/{key}_node_rule.json", {"format_version": "1.13.0", "minecraft:feature_rules": {
            "description": {"identifier": f"ponce:{key}_node_rule", "places_feature": f"ponce:{key}_node_feature"},
            "conditions": {"placement_pass": "underground_pass",
                           "minecraft:biome_filter": [{"test": "has_biome_tag", "operator": "==", "value": "overworld"}]},
            "distribution": {"iterations": veins, "coordinate_eval_order": "zyx",
                             "x": {"distribution": "uniform", "extent": [0, 16]},
                             "y": {"distribution": "uniform", "extent": [ylo, yhi]},
                             "z": {"distribution": "uniform", "extent": [0, 16]}}}})

    # Depleted node: can't be mined in survival, regrows by script
    terrain["ponce_depleted_node"] = {"textures": tex("depleted_node", lambda img: (
        stone(img, (88, 88, 92), 10), [img.putpixel((random.randint(1, 14), random.randint(1, 14)), (48, 48, 52, 255)) for _ in range(14)]))}
    write_json(f"{BP}/blocks/depleted_node.json", block("ponce:depleted_node", "ponce_depleted_node", unbreakable=True, map_color="#58585C"))
    sounds["ponce:depleted_node"] = {"sound": "stone"}
    lang.append("tile.ponce:depleted_node.name=Depleted Node")

    # Smithing Forge
    def forge_side(img):
        for y in range(16):
            for x in range(16):
                mortar = y % 4 == 3 or (x + (4 if (y // 4) % 2 else 0)) % 8 == 7
                img.putpixel((x, y), jitter((70, 66, 64) if mortar else (150, 70, 50), 10))
        for y in range(9, 14):
            for x in range(5, 11):
                img.putpixel((x, y), jitter((255, 150, 40) if y > 10 else (230, 90, 30), 15))

    def forge_top(img):
        stone(img, (60, 60, 66), 8)
        for y in range(5, 10):
            for x in range(3, 13):
                if y > 6 or 5 <= x <= 10:
                    img.putpixel((x, y), jitter((150, 154, 162), 8))
    terrain["ponce_forge_side"] = {"textures": tex("smithing_forge_side", forge_side)}
    terrain["ponce_forge_top"] = {"textures": tex("smithing_forge_top", forge_top)}
    write_json(f"{BP}/blocks/smithing_forge.json", block("ponce:smithing_forge", "ponce_forge_side", "ponce_forge_top",
                                                          destroy=4, map_color="#964632", menu="items"))
    sounds["ponce:smithing_forge"] = {"sound": "anvil"}
    lang.append("tile.ponce:smithing_forge.name=Smithing Forge")
    write_json(f"{BP}/recipes/jobs/smithing_forge.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "ponce:smithing_forge"}, "tags": ["crafting_table"],
        "pattern": ["CCC", "BIB", "BBB"],
        "key": {"C": {"item": "ponce:ember_copper_ingot"}, "B": {"item": "minecraft:brick_block"}, "I": {"item": "minecraft:iron_block"}},
        "unlock": [{"item": "ponce:ember_copper_ingot"}], "result": {"item": "ponce:smithing_forge"}}})

    # Cooking Pot
    def pot_side(img):
        for y in range(16):
            for x in range(16):
                c = (200, 110, 60) if y not in (2, 3, 12) else (150, 80, 40)
                img.putpixel((x, y), jitter(c, 10))

    def pot_top(img):
        stone(img, (150, 80, 40), 8)
        blob(img, 7.5, 7.5, 6, 6, (140, 90, 50), 10)
        for x, y in ((5, 6), (9, 8), (7, 10), (10, 5)):
            img.putpixel((x, y), (220, 190, 140, 255))
    terrain["ponce_pot_side"] = {"textures": tex("cooking_pot_side", pot_side)}
    terrain["ponce_pot_top"] = {"textures": tex("cooking_pot_top", pot_top)}
    write_json(f"{BP}/blocks/cooking_pot.json", block("ponce:cooking_pot", "ponce_pot_side", "ponce_pot_top",
                                                       destroy=2, map_color="#C86E3C", menu="items"))
    sounds["ponce:cooking_pot"] = {"sound": "metal"}
    lang.append("tile.ponce:cooking_pot.name=Cooking Pot")
    write_json(f"{BP}/recipes/jobs/cooking_pot.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "ponce:cooking_pot"}, "tags": ["crafting_table"],
        "pattern": ["C C", "CFC", "CCC"],
        "key": {"C": {"item": "ponce:ember_copper_ingot"}, "F": {"item": "minecraft:campfire"}},
        "unlock": [{"item": "ponce:ember_copper_ingot"}], "result": {"item": "ponce:cooking_pot"}}})

    # Stair Gate: the sealed way up to the next floor (opened per player by script)
    def gate_tex(img):
        for y in range(16):
            for x in range(16):
                r = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
                band = int(r * 1.6 + (x * 0.6 - y * 0.4)) % 3
                img.putpixel((x, y), jitter([(90, 60, 170), (130, 100, 220), (175, 150, 255)][band], 8))
        for x, y in ((4, 5), (11, 3), (8, 11), (2, 12), (13, 10)):
            img.putpixel((x, y), (250, 245, 255, 255))
    terrain["ponce_stair_gate"] = {"textures": tex("stair_gate", gate_tex)}
    gate = block("ponce:stair_gate", "ponce_stair_gate", unbreakable=True, map_color="#8C64DC", menu="items")
    gate["minecraft:block"]["components"]["minecraft:light_emission"] = 12
    write_json(f"{BP}/blocks/stair_gate.json", gate)
    sounds["ponce:stair_gate"] = {"sound": "glass"}
    lang.append("tile.ponce:stair_gate.name=Stair Gate")

    # Foods
    for key, name, nut, sat, stats, secs, lvl, xp, ingr, (c1, c2) in FOODS:
        def food_icon(img, a=c1, b=c2):
            blob(img, 7.5, 9, 6, 4, b)
            blob(img, 7.5, 7.5, 4.5, 3, a)
        items_tex[f"ponce_{key}"] = {"textures": tex(key, food_icon, "items")}
        write_json(f"{BP}/items/jobs/{key}.json", item(f"ponce:{key}", f"§e{name}", f"ponce_{key}", stack=16, extra={
            "minecraft:food": {"nutrition": nut, "saturation_modifier": sat, "can_always_eat": True},
            "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
            "minecraft:use_animation": "eat"}))
    items_tex["ponce_burnt_mess"] = {"textures": tex("burnt_mess", lambda img: blob(img, 7.5, 9, 6, 4, (40, 30, 25), 10), "items")}
    write_json(f"{BP}/items/jobs/burnt_mess.json", item("ponce:burnt_mess", "§8Burnt Mess", "ponce_burnt_mess", stack=16, extra={
        "minecraft:food": {"nutrition": 1, "saturation_modifier": 0.1},
        "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
        "minecraft:use_animation": "eat"}))

    # Resource registries
    write_json(f"{RP}/textures/terrain_texture.json", {"resource_pack_name": "ascent_of_ponce", "texture_name": "atlas.terrain",
                                                       "padding": 8, "num_mip_levels": 4, "texture_data": terrain})
    path = f"{RP}/textures/item_texture.json"
    data = json.load(open(path))
    data["texture_data"].update(items_tex)
    write_json(path, data)
    write_json(f"{RP}/blocks.json", {"format_version": [1, 1, 0], **sounds})

    langp = f"{RP}/texts/en_US.lang"
    existing = open(langp).read().splitlines()
    keep = [l for l in existing if not l.startswith("tile.ponce:")]
    with open(langp, "w") as f:
        f.write("\n".join(keep + lang) + "\n")

    # Script table
    table = {
        "ORES": {f"ponce:{k}_node": {"key": k, "name": n, "level": lv, "pickaxe": t, "xp": xp, "regen": rg,
                                     "drop": f"ponce:raw_{k}"} for k, n, lv, t, xp, rg, *_ in ORES},
        "PICKAXE_TIERS": PICKAXE_TIERS,
        "FOODS": {f"ponce:{k}": {"name": n, "stats": st, "seconds": s} for k, n, _, _, st, s, *_ in FOODS},
        "COOK_RECIPES": [{"result": f"ponce:{k}", "name": n, "level": lv, "xp": xp,
                          "ingredients": [{"item": i, "count": c} for i, c in ingr]}
                         for k, n, _, _, _, _, lv, xp, ingr, _ in FOODS],
    }
    with open(f"{BP}/scripts/jobs_data.js", "w") as f:
        f.write("// Generated by tools/gen_jobs.py. Edit the generator, not this file.\n\n")
        for k, v in table.items():
            f.write(f"export const {k} = " + json.dumps(v, indent=2) + ";\n\n")
    print("Generated ores, forge, cooking pot, foods.")


if __name__ == "__main__":
    main()
