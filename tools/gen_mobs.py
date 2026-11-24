#!/usr/bin/env python3
"""Generates the tower mobs: behavior + resource entity files, models,
animations, loot, spawn rules, drop items and placeholder textures.

Run from the repo root:  python3 tools/gen_mobs.py
Edit the MOB definitions below, then re-run. Hand-made art can replace the
generated PNGs later; set KEEP_TEXTURES = True so they aren't overwritten.
"""
import json
import os
import random
from PIL import Image

KEEP_TEXTURES = False
BP, RP = "behavior_pack", "resource_pack"
random.seed(7)


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def save_png(img, path):
    if KEEP_TEXTURES and os.path.exists(path):
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


# ---------------------------------------------------------------- painting

def jitter(color, amount=14):
    r, g, b, *a = color
    d = random.randint(-amount, amount)
    clamp = lambda v: max(0, min(255, v + d))
    return (clamp(r), clamp(g), clamp(b), a[0] if a else 255)


def fill(img, x, y, w, h, color, noise=14):
    px = img.load()
    for j in range(y, y + h):
        for i in range(x, x + w):
            px[i, j] = jitter(color, noise)


def box_faces(u, v, w, h, d):
    """Bedrock box-UV layout. Returns face -> (x, y, width, height)."""
    return {
        "top": (u + d, v, w, d),
        "bottom": (u + d + w, v, w, d),
        "east": (u, v + d, d, h),
        "north": (u + d, v + d, w, h),  # front
        "west": (u + d + w, v + d, d, h),
        "south": (u + 2 * d + w, v + d, w, h),  # back
    }


def paint_box(img, uv, size, colors, noise=14):
    w, h, d = size
    for face, (x, y, fw, fh) in box_faces(uv[0], uv[1], w, h, d).items():
        fill(img, x, y, fw, fh, colors.get(face, colors["default"]), noise)


def cube(origin, size, uv):
    return {"origin": origin, "size": size, "uv": uv}


def geometry(ident, tw, th, bones, bounds=(2, 2)):
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {
                "identifier": ident, "texture_width": tw, "texture_height": th,
                "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                "visible_bounds_offset": [0, bounds[1] / 2, 0],
            },
            "bones": bones,
        }],
    }


# ---------------------------------------------------------------- shared entity pieces

def base_components(family, hp, damage, speed, box, loot):
    return {
        "minecraft:type_family": {"family": family + ["ponce_mob", "mob"]},
        "minecraft:health": {"value": hp, "max": hp},
        "minecraft:attack": {"damage": damage},
        "minecraft:collision_box": {"width": box[0], "height": box[1]},
        "minecraft:movement": {"value": speed},
        "minecraft:movement.basic": {},
        "minecraft:navigation.walk": {"avoid_water": True, "can_open_doors": False},
        "minecraft:jump.static": {},
        "minecraft:physics": {},
        "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
        "minecraft:nameable": {},
        "minecraft:despawn": {"despawn_from_distance": {}},
        "minecraft:loot": {"table": f"loot_tables/entities/{loot}.json"},
        "minecraft:experience_reward": {"on_death": "query.last_hit_by_player ? 2 : 0"},
        "minecraft:behavior.float": {"priority": 0},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
        "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 6},
        "minecraft:behavior.random_look_around": {"priority": 8},
    }


def bp_entity(ident, components):
    return {
        "format_version": "1.21.40",
        "minecraft:entity": {
            "description": {"identifier": ident, "is_spawnable": True, "is_summonable": True},
            "components": components,
        },
    }


def rp_entity(ident, name, animations, scripts, egg, materials=None, controller="controller.render.default"):
    return {
        "format_version": "1.10.0",
        "minecraft:client_entity": {
            "description": {
                "identifier": ident,
                "materials": materials or {"default": "entity_alphatest"},
                "textures": {"default": f"textures/entity/{name}"},
                "geometry": {"default": f"geometry.ponce.{name}"},
                "render_controllers": [controller],
                "animations": animations,
                "scripts": {"animate": scripts},
                "spawn_egg": {"base_color": egg[0], "overlay_color": egg[1]},
            }
        },
    }


def spawn_rules(ident, population, weight, herd, biomes, extra=None):
    cond = {
        "minecraft:spawns_on_surface": {},
        "minecraft:weight": {"default": weight},
        "minecraft:herd": {"min_size": herd[0], "max_size": herd[1]},
        "minecraft:biome_filter": {"any_of": [{"test": "has_biome_tag", "value": b} for b in biomes]},
    }
    cond.update(extra or {})
    return {
        "format_version": "1.8.0",
        "minecraft:spawn_rules": {
            "description": {"identifier": ident, "population_control": population},
            "conditions": [cond],
        },
    }


def item(ident, name, texture, extra=None):
    comps = {
        "minecraft:icon": texture,
        "minecraft:display_name": {"value": name},
        "minecraft:max_stack_size": 64,
    }
    comps.update(extra or {})
    return {
        "format_version": "1.21.40",
        "minecraft:item": {
            "description": {"identifier": ident, "menu_category": {"category": "items"}},
            "components": comps,
        },
    }


ITEM_TEXTURES = {}


def drop_item(key, name, painter, extra=None):
    ITEM_TEXTURES[f"ponce_{key}"] = {"textures": f"textures/items/{key}"}
    write_json(f"{BP}/items/{key}.json", item(f"ponce:{key}", name, f"ponce_{key}", extra))
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    painter(img)
    save_png(img, f"{RP}/textures/items/{key}.png")


def blob(img, cx, cy, rx, ry, color, noise=10):
    px = img.load()
    for y in range(16):
        for x in range(16):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                px[x, y] = jitter(color, noise)


# ================================================================ MEADOW JELLY (Floor 1)

def meadow_jelly():
    ident, name = "ponce:meadow_jelly", "meadow_jelly"
    comps = base_components(["jelly", "monster"], hp=12, damage=2, speed=0.2, box=(0.8, 0.8), loot=name)
    comps.update({
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 3, "must_see": True, "reselect_targets": True, "within_radius": 10,
            "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 10}],
        },
    })
    write_json(f"{BP}/entities/{name}.json", bp_entity(ident, comps))
    write_json(f"{BP}/spawn_rules/{name}.json", spawn_rules(
        ident, "monster", weight=40, herd=(1, 3), biomes=["plains", "forest", "meadow"]))
    write_json(f"{BP}/loot_tables/entities/{name}.json", {"pools": [{
        "rolls": 1,
        "entries": [{"type": "item", "name": "ponce:jelly_gel", "weight": 1, "functions": [
            {"function": "set_count", "count": {"min": 0, "max": 2}},
            {"function": "looting_enchant", "count": {"min": 0, "max": 1}},
        ]}],
    }]})

    # Model: a rounded droplet of jelly (stacked layers) with a leaf sprout on top
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 32, [
        {"name": "body", "pivot": [0, 0, 0], "cubes": [
            cube([-5, 0, -5], [10, 5, 10], [0, 0]),
            cube([-4, 5, -4], [8, 3, 8], [0, 15]),
            cube([-3, 8, -3], [6, 2, 6], [32, 15]),
            cube([-1, 10, -1], [2, 1, 2], [40, 0]),
        ]},
        {"name": "sprout", "parent": "body", "pivot": [0, 11, 0], "cubes": [
            cube([-0.5, 11, -0.5], [1, 2, 1], [48, 0]),
            cube([0.5, 12, -0.5], [3, 1, 1], [52, 0]),
        ]},
    ], bounds=(1.5, 1.5)))

    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    jelly, shine, shade = (96, 214, 170), (170, 245, 215), (60, 165, 130)
    paint_box(img, (0, 0), (10, 5, 10), {"default": jelly, "bottom": shade, "top": jelly}, noise=8)
    paint_box(img, (0, 15), (8, 3, 8), {"default": jelly, "top": shine}, noise=8)
    paint_box(img, (32, 15), (6, 2, 6), {"default": shine}, noise=6)
    paint_box(img, (40, 0), (2, 1, 2), {"default": shine}, noise=4)
    paint_box(img, (48, 0), (1, 2, 1), {"default": (70, 120, 50)}, noise=4)
    paint_box(img, (52, 0), (3, 1, 1), {"default": (110, 190, 70)}, noise=8)
    px = img.load()
    for x in range(0, 40):  # darker band where the jelly meets the ground
        px[x, 14] = jitter(shade, 6)
    fx, fy = 10, 10  # base front face (10 x 5)
    for ex in (fx + 2, fx + 7):
        px[ex, fy + 1] = (25, 45, 40, 255)
        px[ex, fy + 2] = (25, 45, 40, 255)
        px[ex - 1 if ex < fx + 5 else ex + 1, fy + 1] = (255, 255, 255, 255)  # eye shine
    px[fx + 4, fy + 3] = px[fx + 5, fy + 3] = (40, 110, 90, 255)
    px[fx + 1, fy + 3] = px[fx + 8, fy + 3] = (235, 140, 150, 255)  # blush
    save_png(img, f"{RP}/textures/entity/{name}.png")

    write_json(f"{RP}/animations/{name}.animation.json", {
        "format_version": "1.8.0",
        "animations": {f"animation.ponce.{name}.move": {
            "loop": True,
            "bones": {"sprout": {"rotation": [0, 0, "math.sin(query.anim_time * 300) * 12"]}, "body": {
                "position": [0, "math.abs(math.sin(query.anim_time * 400)) * 3 * query.modified_move_speed", 0],
                "scale": [
                    "1 + math.sin(query.anim_time * 800) * 0.06 * (0.3 + query.modified_move_speed)",
                    "1 - math.sin(query.anim_time * 800) * 0.08 * (0.3 + query.modified_move_speed)",
                    "1 + math.sin(query.anim_time * 800) * 0.06 * (0.3 + query.modified_move_speed)",
                ],
            }},
        }},
    })
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name, {"move": f"animation.ponce.{name}.move"}, ["move"], ("#60D6AA", "#6EBE46")))

    def gel(img):
        blob(img, 7.5, 9, 6, 5, (96, 214, 170, 235))
        blob(img, 6, 7, 2, 1.5, (190, 250, 225, 255), noise=4)
    drop_item("jelly_gel", "§fJelly Gel", gel)


# ================================================================ TUSK BOAR (Floor 1-2)

def tusk_boar():
    ident, name = "ponce:tusk_boar", "tusk_boar"
    comps = base_components(["boar", "animal"], hp=24, damage=4, speed=0.22, box=(0.9, 0.9), loot=name)
    comps.update({
        # Neutral: grazes until hit, then charges. Nearby boars join in.
        "minecraft:behavior.hurt_by_target": {"priority": 1, "alert_same_type": True},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.7, "track_target": True},
        "minecraft:knockback_resistance": {"value": 0.3},
    })
    write_json(f"{BP}/entities/{name}.json", bp_entity(ident, comps))
    write_json(f"{BP}/spawn_rules/{name}.json", spawn_rules(
        ident, "animal", weight=18, herd=(2, 4), biomes=["plains", "forest", "taiga"],
        extra={"minecraft:spawns_on_block_filter": "minecraft:grass_block",
               "minecraft:brightness_filter": {"min": 7, "max": 15, "adjust_for_weather": False}}))
    write_json(f"{BP}/loot_tables/entities/{name}.json", {"pools": [
        {"rolls": 1, "entries": [{"type": "item", "name": "ponce:raw_boar", "weight": 1, "functions": [
            {"function": "set_count", "count": {"min": 1, "max": 2}},
            {"function": "looting_enchant", "count": {"min": 0, "max": 1}}]}]},
        {"rolls": 1, "entries": [{"type": "item", "name": "ponce:boar_hide", "weight": 1, "functions": [
            {"function": "set_count", "count": {"min": 0, "max": 1}}]}]},
        {"rolls": 1, "conditions": [{"condition": "random_chance_with_looting", "chance": 0.1, "looting_multiplier": 0.05}],
         "entries": [{"type": "item", "name": "ponce:boar_tusk", "weight": 1}]},
    ]})

    legs = [("leg0", [-4.5, 0, -7], [-3, 6, -5.5], [0, 40]), ("leg1", [1.5, 0, -7], [3, 6, -5.5], [12, 40]),
            ("leg2", [-4.5, 0, 4], [-3, 6, 5.5], [24, 40]), ("leg3", [1.5, 0, 4], [3, 6, 5.5], [36, 40])]
    bones = [
        {"name": "body", "pivot": [0, 10, 0], "cubes": [
            cube([-5, 6, -8], [10, 8, 16], [0, 0]),
            cube([-1, 14, -7], [2, 2, 12], [0, 49]),  # bristle ridge
        ]},
        {"name": "head", "parent": "body", "pivot": [0, 11, -8], "cubes": [
            cube([-4, 7, -15], [8, 7, 7], [0, 24]),
            cube([-2.5, 7.5, -17], [5, 4, 2], [30, 24]),  # snout
            cube([-3.5, 7, -17], [1, 3, 1], [44, 24]),  # tusks
            cube([2.5, 7, -17], [1, 3, 1], [48, 24]),
            cube([-4.5, 13, -10], [2, 2, 1], [52, 24]),  # ears
            cube([2.5, 13, -10], [2, 2, 1], [52, 28]),
        ]},
    ] + [{"name": n, "parent": "body", "pivot": p, "cubes": [cube(o, [3, 6, 3], uv)]} for n, o, p, uv in legs]
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 64, bones, bounds=(2, 1.5)))

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    hide, dark, belly = (104, 72, 48), (62, 42, 28), (140, 104, 74)
    paint_box(img, (0, 0), (10, 8, 16), {"default": hide, "top": dark, "bottom": belly}, noise=18)
    paint_box(img, (0, 49), (2, 2, 12), {"default": (40, 28, 20)}, noise=10)
    paint_box(img, (0, 24), (8, 7, 7), {"default": hide, "top": dark}, noise=16)
    paint_box(img, (30, 24), (5, 4, 2), {"default": (150, 100, 90), "north": (170, 120, 110)}, noise=8)
    for uv in ([44, 24], [48, 24]):
        paint_box(img, uv, (1, 3, 1), {"default": (238, 230, 205)}, noise=6)
    for uv in ([52, 24], [52, 28]):
        paint_box(img, uv, (2, 2, 1), {"default": dark}, noise=8)
    for _, _, _, uv in legs:
        paint_box(img, uv, (3, 6, 3), {"default": dark, "bottom": (25, 20, 18)}, noise=10)
        fill(img, uv[0], uv[1] + 3 + 4, 12, 2, (25, 20, 18), noise=4)  # hooves
    px = img.load()
    fx, fy = 7, 31  # head front face
    for ex in (fx + 1, fx + 6):
        px[ex, fy + 2] = (15, 10, 8, 255)
        px[ex, fy + 1] = (200, 70, 50, 255)  # angry red glint
    sx, sy = 32, 26  # snout front: nostrils
    px[sx + 1, sy + 2] = px[sx + 3, sy + 2] = (60, 30, 30, 255)
    save_png(img, f"{RP}/textures/entity/{name}.png")

    swing = "math.cos(query.modified_distance_moved * 38.17) * 50 * query.modified_move_speed"
    write_json(f"{RP}/animations/{name}.animation.json", {
        "format_version": "1.8.0",
        "animations": {f"animation.ponce.{name}.walk": {
            "loop": True,
            "bones": {
                "leg0": {"rotation": [swing, 0, 0]}, "leg3": {"rotation": [swing, 0, 0]},
                "leg1": {"rotation": [f"-{swing}", 0, 0]}, "leg2": {"rotation": [f"-{swing}", 0, 0]},
            },
        }},
    })
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name,
        {"walk": f"animation.ponce.{name}.walk", "look_at_target": "animation.common.look_at_target"},
        ["walk", "look_at_target"], ("#5E4130", "#EEE6CD")))

    def meat(img):
        blob(img, 7.5, 8, 6, 4.5, (190, 70, 70, 255))
        blob(img, 5, 7, 2.5, 1.5, (240, 220, 210, 255), noise=6)
        blob(img, 10, 10, 1.5, 1, (240, 220, 210, 255), noise=6)
    drop_item("raw_boar", "§fRaw Boar Meat", meat, extra={
        "minecraft:food": {"nutrition": 3, "saturation_modifier": 0.3},
        "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
        "minecraft:use_animation": "eat",
    })

    def hide_icon(img):
        fill(img, 3, 3, 10, 10, (110, 76, 50, 255), noise=20)
        for x, y in ((2, 4), (13, 6), (5, 2), (10, 13), (2, 10), (13, 11)):
            img.putpixel((x, y), (90, 62, 40, 255))
    drop_item("boar_hide", "§fBoar Hide", hide_icon)

    def tusk(img):
        for i, (x, y) in enumerate([(4, 13), (5, 12), (5, 11), (6, 10), (6, 9), (7, 8), (8, 7), (9, 6), (10, 5), (11, 4), (12, 4)]):
            c = (238, 230, 205, 255) if i < 9 else (250, 248, 240, 255)
            img.putpixel((x, y), c)
            img.putpixel((x - 1, y), (200, 190, 160, 255))
    drop_item("boar_tusk", "§eBoar Tusk", tusk)


# ================================================================ shared resource files

def resources():
    path = f"{RP}/textures/item_texture.json"
    data = json.load(open(path))
    data["texture_data"].update(ITEM_TEXTURES)
    write_json(path, data)

    write_json(f"{RP}/sounds.json", {"entity_sounds": {"entities": {
        "ponce:meadow_jelly": {"volume": 0.8, "pitch": [1.1, 1.4], "events": {
            "hurt": "mob.slime.small", "death": "mob.slime.small", "attack": "mob.slime.attack",
            "step": {"sound": "mob.slime.small", "volume": 0.25}}},
        "ponce:tusk_boar": {"volume": 1.0, "pitch": [0.9, 1.1], "events": {
            "ambient": "mob.hoglin.ambient", "hurt": "mob.hoglin.hurt", "death": "mob.hoglin.death",
            "attack": "mob.hoglin.attack", "step": {"sound": "mob.pig.step", "volume": 0.2}}},
    }}})


if __name__ == "__main__":
    meadow_jelly()
    tusk_boar()
    resources()
    print("Generated mobs:", "meadow_jelly, tusk_boar")
