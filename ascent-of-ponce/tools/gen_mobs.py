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


def bp_entity(ident, components, groups=None, events=None):
    ent = {
        "description": {"identifier": ident, "is_spawnable": True, "is_summonable": True},
        "components": components,
    }
    if groups:
        ent["component_groups"] = groups
    if events:
        ent["events"] = events
    return {"format_version": "1.21.40", "minecraft:entity": ent}


PLAYER_TARGET = [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": 24}]


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
    groups = {"ponce:hostile": {
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 24,
            "entity_types": PLAYER_TARGET},
        "minecraft:persistent": {},
    }}
    events = {"ponce:enrage": {"add": {"component_groups": ["ponce:hostile"]}}}
    write_json(f"{BP}/entities/{name}.json", bp_entity(ident, comps, groups, events))
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

    bones = boar_bones()
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 64, bones, bounds=(2, 1.5)))
    img = paint_boar((104, 72, 48), (62, 42, 28), (140, 104, 74), eye=(200, 70, 50, 255))
    save_png(img, f"{RP}/textures/entity/{name}.png")
    write_json(f"{RP}/animations/{name}.animation.json", boar_walk(name))
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name,
        {"walk": f"animation.ponce.{name}.walk", "look_at_target": "animation.common.look_at_target"},
        ["walk", "look_at_target"], ("#5E4130", "#EEE6CD")))
    boar_items()


LEGS = [("leg0", [-4.5, 0, -7], [-3, 6, -5.5], [0, 40]), ("leg1", [1.5, 0, -7], [3, 6, -5.5], [12, 40]),
        ("leg2", [-4.5, 0, 4], [-3, 6, 5.5], [24, 40]), ("leg3", [1.5, 0, 4], [3, 6, 5.5], [36, 40])]


def boar_bones():
    legs = LEGS
    return [
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


def paint_boar(hide, dark, belly, eye):
    legs = LEGS
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
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
        px[ex, fy + 1] = eye  # glint
    sx, sy = 32, 26  # snout front: nostrils
    px[sx + 1, sy + 2] = px[sx + 3, sy + 2] = (60, 30, 30, 255)
    return img


def boar_walk(name):
    swing = "math.cos(query.modified_distance_moved * 38.17) * 50 * query.modified_move_speed"
    return {
        "format_version": "1.8.0",
        "animations": {f"animation.ponce.{name}.walk": {
            "loop": True,
            "bones": {
                "leg0": {"rotation": [swing, 0, 0]}, "leg3": {"rotation": [swing, 0, 0]},
                "leg1": {"rotation": [f"-{swing}", 0, 0]}, "leg2": {"rotation": [f"-{swing}", 0, 0]},
            },
        }},
    }


def boar_items():
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


# ================================================================ helpers for the remaining Floor 1 mobs

def walk_anim(name, forward, backward, amp=50, extra_bones=None, anim="walk"):
    swing = f"math.cos(query.modified_distance_moved * 38.17) * {amp} * query.modified_move_speed"
    bones = {b: {"rotation": [swing, 0, 0]} for b in forward}
    bones.update({b: {"rotation": [f"-{swing}", 0, 0]} for b in backward})
    bones.update(extra_bones or {})
    return {"format_version": "1.8.0", "animations": {f"animation.ponce.{name}.{anim}": {"loop": True, "bones": bones}}}


def hostile_to_players(radius, priority=3):
    return {"minecraft:behavior.nearest_attackable_target": {
        "priority": priority, "must_see": True, "reselect_targets": True, "within_radius": radius,
        "entity_types": [{"filters": {"test": "is_family", "subject": "other", "value": "player"}, "max_dist": radius}]}}


def loot(*pools):
    out = []
    for name, lo, hi, chance in pools:
        pool = {"rolls": 1, "entries": [{"type": "item", "name": name, "weight": 1,
                                         "functions": [{"function": "set_count", "count": {"min": lo, "max": hi}}]}]}
        if chance < 1:
            pool["conditions"] = [{"condition": "random_chance_with_looting", "chance": chance, "looting_multiplier": 0.05}]
        out.append(pool)
    return {"pools": out}


def eyes(img, x, y, gap, color=(15, 15, 15, 255)):
    img.putpixel((x, y), color)
    img.putpixel((x + gap, y), color)


# ================================================================ THORNBACK HARE (Lv 2)

def thornback_hare():
    ident, name = "ponce:thornback_hare", "thornback_hare"
    comps = base_components(["hare", "animal"], hp=8, damage=3, speed=0.32, box=(0.5, 0.6), loot=name)
    comps.update({
        # Skittish: bolts from players, but kicks back hard once cornered or hit
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.avoid_mob_type": {"priority": 4, "entity_types": [{
            "filters": {"test": "is_family", "subject": "other", "value": "player"},
            "max_dist": 8, "walk_speed_multiplier": 1.1, "sprint_speed_multiplier": 1.5}]},
    })
    write_json(f"{BP}/entities/{name}.json", bp_entity(ident, comps))
    write_json(f"{BP}/spawn_rules/{name}.json", spawn_rules(
        ident, "animal", weight=20, herd=(1, 2), biomes=["plains", "meadow", "forest"],
        extra={"minecraft:spawns_on_block_filter": "minecraft:grass_block",
               "minecraft:brightness_filter": {"min": 7, "max": 15, "adjust_for_weather": False}}))
    write_json(f"{BP}/loot_tables/entities/{name}.json", loot(
        ("ponce:raw_hare", 1, 1, 1), ("ponce:thorn_quill", 0, 2, 1)))

    bones = [
        {"name": "body", "pivot": [0, 4, 0], "cubes": [
            cube([-2, 3, -3], [4, 4, 6], [0, 0]),
            cube([-1, 5, 3], [2, 2, 1], [40, 0]),  # tail
            cube([-0.5, 7, -2], [1, 2, 1], [48, 0]),  # thorns
            cube([-0.5, 7, 0], [1, 2, 1], [52, 0]),
            cube([-0.5, 7, 1.8], [1, 2, 1], [56, 0]),
        ]},
        {"name": "head", "parent": "body", "pivot": [0, 6, -3], "cubes": [
            cube([-1.5, 5, -6], [3, 3, 3], [20, 0]),
            cube([-1.5, 8, -5], [1, 4, 1], [32, 0]),  # ears
            cube([0.5, 8, -5], [1, 4, 1], [36, 0]),
        ]},
        {"name": "leg0", "parent": "body", "pivot": [-1, 3, -2], "cubes": [cube([-1.5, 0, -2.5], [1, 3, 1], [0, 12])]},
        {"name": "leg1", "parent": "body", "pivot": [1, 3, -2], "cubes": [cube([0.5, 0, -2.5], [1, 3, 1], [4, 12])]},
        {"name": "leg2", "parent": "body", "pivot": [-1.5, 3, 2], "cubes": [cube([-2, 0, 0.5], [1, 3, 3], [8, 12])]},
        {"name": "leg3", "parent": "body", "pivot": [1.5, 3, 2], "cubes": [cube([1, 0, 0.5], [1, 3, 3], [16, 12])]},
    ]
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 32, bones, bounds=(1, 1)))

    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    fur, light, thorn = (176, 134, 92), (214, 186, 150), (96, 142, 64)
    paint_box(img, (0, 0), (4, 4, 6), {"default": fur, "bottom": light}, noise=12)
    paint_box(img, (40, 0), (2, 2, 1), {"default": (245, 240, 232)}, noise=4)
    for uv in ([48, 0], [52, 0], [56, 0]):
        paint_box(img, uv, (1, 2, 1), {"default": thorn, "top": (190, 220, 140)}, noise=8)
    paint_box(img, (20, 0), (3, 3, 3), {"default": fur}, noise=10)
    for uv in ([32, 0], [36, 0]):
        paint_box(img, uv, (1, 4, 1), {"default": fur, "north": (225, 160, 160)}, noise=8)
    for uv, size in (([0, 12], (1, 3, 1)), ([4, 12], (1, 3, 1)), ([8, 12], (1, 3, 3)), ([16, 12], (1, 3, 3))):
        paint_box(img, uv, size, {"default": (150, 112, 76)}, noise=8)
    eyes(img, 23, 4, 2)
    img.putpixel((24, 5), (220, 140, 150, 255))
    save_png(img, f"{RP}/textures/entity/{name}.png")

    write_json(f"{RP}/animations/{name}.animation.json", walk_anim(name, ["leg0", "leg3"], ["leg1", "leg2"], amp=60, extra_bones={
        "body": {"position": [0, "math.abs(math.sin(query.modified_distance_moved * 25)) * 1.5 * query.modified_move_speed", 0]}}))
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name, {"walk": f"animation.ponce.{name}.walk", "look_at_target": "animation.common.look_at_target"},
        ["walk", "look_at_target"], ("#B0865C", "#60904A")))

    def hare_meat(img):
        blob(img, 7.5, 8.5, 5, 4, (200, 90, 90, 255))
        blob(img, 6, 7, 1.5, 1, (240, 215, 205, 255), noise=5)
    drop_item("raw_hare", "§fRaw Hare", hare_meat, extra={
        "minecraft:food": {"nutrition": 2, "saturation_modifier": 0.3},
        "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35},
        "minecraft:use_animation": "eat"})

    def quill(img):
        for i in range(10):
            img.putpixel((3 + i, 12 - i), (110, 160, 70, 255) if i < 7 else (200, 230, 150, 255))
        img.putpixel((3, 13), (70, 50, 35, 255))
    drop_item("thorn_quill", "§fThorn Quill", quill)


# ================================================================ BURROW MOLE (Lv 3)

def burrow_mole():
    ident, name = "ponce:burrow_mole", "burrow_mole"
    comps = base_components(["mole", "monster"], hp=16, damage=3, speed=0.2, box=(0.7, 0.5), loot=name)
    for k in ("minecraft:behavior.random_stroll", "minecraft:behavior.look_at_player", "minecraft:behavior.random_look_around"):
        comps.pop(k)
    groups = {
        # Hidden under a dirt mound and untouchable until a player steps close (script triggers ponce:emerge)
        "ponce:burrowed": {
            "minecraft:movement": {"value": 0},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        },
        "ponce:emerged": {
            "minecraft:behavior.hurt_by_target": {"priority": 1},
            "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.3, "track_target": True},
            **hostile_to_players(16),
            "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 6},
        },
    }
    events = {
        "minecraft:entity_spawned": {"add": {"component_groups": ["ponce:burrowed"]}},
        "ponce:emerge": {"set_property": {"ponce:burrowed": False},
                         "remove": {"component_groups": ["ponce:burrowed"]},
                         "add": {"component_groups": ["ponce:emerged"]}},
    }
    ent = bp_entity(ident, comps, groups, events)
    ent["minecraft:entity"]["description"]["properties"] = {
        "ponce:burrowed": {"type": "bool", "default": True, "client_sync": True}}
    write_json(f"{BP}/entities/{name}.json", ent)
    write_json(f"{BP}/spawn_rules/{name}.json", spawn_rules(
        ident, "monster", weight=15, herd=(1, 1), biomes=["plains", "forest", "meadow"],
        extra={"minecraft:spawns_on_block_filter": "minecraft:grass_block"}))
    write_json(f"{BP}/loot_tables/entities/{name}.json", loot(
        ("ponce:mole_claw", 0, 1, 1), ("minecraft:raw_copper", 1, 2, 0.3)))

    bones = [
        {"name": "mound", "pivot": [0, 0, 0], "cubes": [cube([-6, 0, -6], [12, 3, 12], [0, 40])]},
        {"name": "body", "pivot": [0, 4, 0], "cubes": [cube([-3, 1, -4], [6, 4, 8], [0, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 3, -4], "cubes": [
            cube([-2, 1.5, -7], [4, 3, 3], [0, 12]),
            cube([-1, 2, -9], [2, 2, 2], [14, 12]),  # snout
        ]},
        {"name": "paw0", "parent": "body", "pivot": [-3, 2, -3], "cubes": [cube([-5, 1, -5], [2, 1, 3], [24, 12])]},
        {"name": "paw1", "parent": "body", "pivot": [3, 2, -3], "cubes": [cube([3, 1, -5], [2, 1, 3], [34, 12])]},
        {"name": "leg2", "parent": "body", "pivot": [-2, 1, 3], "cubes": [cube([-3, 0, 2], [2, 1, 2], [0, 20])]},
        {"name": "leg3", "parent": "body", "pivot": [2, 1, 3], "cubes": [cube([1, 0, 2], [2, 1, 2], [8, 20])]},
    ]
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 64, bones, bounds=(1.5, 1)))

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    velvet, pink, claw = (72, 64, 74), (224, 150, 162), (236, 220, 205)
    paint_box(img, (0, 0), (6, 4, 8), {"default": velvet}, noise=10)
    paint_box(img, (0, 12), (4, 3, 3), {"default": velvet}, noise=10)
    paint_box(img, (14, 12), (2, 2, 2), {"default": pink}, noise=6)
    for uv in ([24, 12], [34, 12]):
        paint_box(img, uv, (2, 1, 3), {"default": claw}, noise=6)
    for uv in ([0, 20], [8, 20]):
        paint_box(img, uv, (2, 1, 2), {"default": pink}, noise=6)
    paint_box(img, (0, 40), (12, 3, 12), {"default": (122, 86, 56), "top": (98, 150, 62)}, noise=16)
    eyes(img, 4, 16, 1, (10, 10, 10, 255))  # tiny squinting eyes on the head front
    img.putpixel((16, 15), (90, 40, 50, 255))
    save_png(img, f"{RP}/textures/entity/{name}.png")

    anims = walk_anim(name, ["paw0", "leg3"], ["paw1", "leg2"], amp=40)
    anims["animations"][f"animation.ponce.{name}.burrowed"] = {"loop": True, "bones": {"body": {"position": [0, -6, 0]}}}
    anims["animations"][f"animation.ponce.{name}.emerged"] = {"loop": True, "bones": {"mound": {"scale": 0}}}
    write_json(f"{RP}/animations/{name}.animation.json", anims)
    write_json(f"{RP}/animation_controllers/{name}.animation_controllers.json", {
        "format_version": "1.10.0",
        "animation_controllers": {f"controller.animation.ponce.{name}": {
            "initial_state": "burrowed",
            "states": {
                "burrowed": {"animations": ["burrowed"], "transitions": [{"emerged": "!query.property('ponce:burrowed')"}]},
                "emerged": {"animations": ["walk", "emerged"], "transitions": [{"burrowed": "query.property('ponce:burrowed')"}]},
            },
        }},
    })
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name,
        {"walk": f"animation.ponce.{name}.walk", "burrowed": f"animation.ponce.{name}.burrowed",
         "emerged": f"animation.ponce.{name}.emerged", "state": f"controller.animation.ponce.{name}"},
        ["state"], ("#48404A", "#E096A2")))

    def mole_claw(img):
        for k, x in enumerate((5, 8, 11)):
            for i in range(5):
                img.putpixel((x + (i // 2), 4 + i + k % 2), (236, 220, 205, 255))
        fill(img, 4, 10, 9, 3, (224, 150, 162, 255), noise=6)
    drop_item("mole_claw", "§fMole Claw", mole_claw)


# ================================================================ MOSS GOLEMITE (Lv 4)

def moss_golemite():
    ident, name = "ponce:moss_golemite", "moss_golemite"
    comps = base_components(["golemite", "monster"], hp=40, damage=6, speed=0.15, box=(0.9, 1.2), loot=name)
    comps.update({
        # Slow, heavy stone body. Weak to hammers, shrugs off blades (scripted in mobs.js).
        "minecraft:knockback_resistance": {"value": 0.8},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.1, "track_target": True, "cooldown_time": 1.5},
        **hostile_to_players(12),
    })
    write_json(f"{BP}/entities/{name}.json", bp_entity(ident, comps))
    write_json(f"{BP}/spawn_rules/{name}.json", spawn_rules(
        ident, "monster", weight=8, herd=(1, 1), biomes=["forest", "taiga", "mountains"]))
    write_json(f"{BP}/loot_tables/entities/{name}.json", loot(
        ("ponce:moss_clump", 1, 3, 1), ("minecraft:cobblestone", 1, 3, 1), ("ponce:golemite_core", 1, 1, 0.15)))

    bones = [
        {"name": "body", "pivot": [0, 10, 0], "cubes": [
            cube([-4, 7, -3], [8, 8, 6], [0, 0]),
            cube([-4.5, 15, -3.5], [9, 1, 7], [28, 0]),  # moss cap
            cube([-1, 9, 3], [2, 3, 1], [44, 14]),  # glowing core
        ]},
        {"name": "head", "parent": "body", "pivot": [0, 14, -2], "cubes": [cube([-3, 12, -6], [6, 5, 4], [0, 14])]},
        {"name": "arm0", "parent": "body", "pivot": [-5.5, 14, 0], "cubes": [cube([-7, 3, -1.5], [3, 11, 3], [20, 14])]},
        {"name": "arm1", "parent": "body", "pivot": [5.5, 14, 0], "cubes": [cube([4, 3, -1.5], [3, 11, 3], [32, 14])]},
        {"name": "leg0", "parent": "body", "pivot": [-2, 7, 0], "cubes": [cube([-3.5, 0, -1.5], [3, 7, 3], [0, 28])]},
        {"name": "leg1", "parent": "body", "pivot": [2, 7, 0], "cubes": [cube([0.5, 0, -1.5], [3, 7, 3], [12, 28])]},
    ]
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 64, bones, bounds=(1.5, 1.5)))

    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    stone, dark, moss = (128, 128, 122), (92, 92, 88), (82, 132, 56)
    paint_box(img, (0, 0), (8, 8, 6), {"default": stone, "top": moss}, noise=16)
    paint_box(img, (28, 0), (9, 1, 7), {"default": moss, "top": (104, 160, 70)}, noise=16)
    paint_box(img, (44, 14), (2, 3, 1), {"default": (120, 240, 140)}, noise=10)
    paint_box(img, (0, 14), (6, 5, 4), {"default": stone, "top": moss}, noise=14)
    for uv in ([20, 14], [32, 14]):
        paint_box(img, uv, (3, 11, 3), {"default": stone, "top": moss, "bottom": dark}, noise=14)
    for uv in ([0, 28], [12, 28]):
        paint_box(img, uv, (3, 7, 3), {"default": dark}, noise=12)
    px = img.load()
    for x, y in ((2, 9), (3, 10), (14, 8), (15, 9), (16, 9), (22, 20), (35, 22)):  # cracks
        px[x, y] = (70, 70, 66, 255)
    for x in range(0, 28):  # moss drips down the body sides
        if random.random() < 0.5:
            px[x, 6] = jitter(moss, 10)
    eyes(img, 5, 20, 3, (150, 255, 150, 255))
    save_png(img, f"{RP}/textures/entity/{name}.png")

    write_json(f"{RP}/animations/{name}.animation.json", walk_anim(name, ["leg0", "arm1"], ["leg1", "arm0"], amp=35))
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name, {"walk": f"animation.ponce.{name}.walk", "look_at_target": "animation.common.look_at_target"},
        ["walk", "look_at_target"], ("#80807A", "#528438")))

    drop_item("moss_clump", "§fMoss Clump", lambda img: (blob(img, 7.5, 8.5, 6, 4.5, (82, 132, 56, 255), noise=18),
                                                          blob(img, 6, 7, 2, 1.5, (130, 180, 90, 255), noise=8)))

    def core(img):
        blob(img, 7.5, 7.5, 5.5, 5.5, (110, 110, 106, 255), noise=12)
        blob(img, 7.5, 7.5, 3, 3, (120, 240, 140, 255), noise=10)
        img.putpixel((7, 6), (220, 255, 225, 255))
    drop_item("golemite_core", "§aGolemite Core", core)


# ================================================================ FIELD WASP (Lv 2)

def field_wasp():
    ident, name = "ponce:field_wasp", "field_wasp"
    comps = base_components(["wasp", "monster", "arthropod"], hp=6, damage=2, speed=0.25, box=(0.6, 0.6), loot=name)
    for k in ("minecraft:movement.basic", "minecraft:navigation.walk", "minecraft:jump.static",
              "minecraft:behavior.random_stroll", "minecraft:behavior.float"):
        comps.pop(k)
    comps.update({
        "minecraft:attack": {"damage": 2, "effect_name": "poison", "effect_duration": 3},
        "minecraft:can_fly": {},
        "minecraft:movement.hover": {},
        "minecraft:flying_speed": {"value": 0.14},
        "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_pass_doors": False,
                                       "can_path_from_air": True, "avoid_water": True, "avoid_damage_blocks": True},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.4, "track_target": True, "cooldown_time": 1.2},
        **hostile_to_players(10),
        "minecraft:behavior.random_hover": {"priority": 8, "xz_dist": 8, "y_dist": 4, "y_offset": -1,
                                            "interval": 1, "hover_height": [1, 3]},
    })
    write_json(f"{BP}/entities/{name}.json", bp_entity(ident, comps))
    write_json(f"{BP}/spawn_rules/{name}.json", spawn_rules(
        ident, "monster", weight=15, herd=(1, 2), biomes=["plains", "meadow", "flower_forest"],
        extra={"minecraft:brightness_filter": {"min": 7, "max": 15, "adjust_for_weather": False}}))
    write_json(f"{BP}/loot_tables/entities/{name}.json", loot(
        ("ponce:wasp_stinger", 0, 1, 1), ("ponce:wasp_wing", 0, 1, 0.5)))

    bones = [
        {"name": "body", "pivot": [0, 7.5, 0], "cubes": [
            cube([-1.5, 6, -2], [3, 3, 4], [0, 0]),
            cube([-1, 5, -1], [2, 1, 2], [12, 8]),  # legs
        ]},
        {"name": "abdomen", "parent": "body", "pivot": [0, 7.5, 2], "cubes": [
            cube([-1.5, 5.5, 2], [3, 3, 5], [14, 0]),
            cube([-0.5, 6.5, 7], [1, 1, 2], [30, 0]),  # stinger
        ]},
        {"name": "head", "parent": "body", "pivot": [0, 7.5, -2], "cubes": [cube([-1.5, 6, -5], [3, 3, 3], [0, 8])]},
        {"name": "wing0", "parent": "body", "pivot": [-1.5, 9, 0], "cubes": [cube([-6.5, 9, -1.5], [5, 0, 3], [36, 0])]},
        {"name": "wing1", "parent": "body", "pivot": [1.5, 9, 0], "cubes": [cube([1.5, 9, -1.5], [5, 0, 3], [36, 4])]},
    ]
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 32, bones, bounds=(1, 1)))

    img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    crimson, black = (176, 42, 38), (26, 20, 22)
    paint_box(img, (0, 0), (3, 3, 4), {"default": black}, noise=6)
    paint_box(img, (12, 8), (2, 1, 2), {"default": black}, noise=4)
    paint_box(img, (14, 0), (3, 3, 5), {"default": crimson}, noise=10)
    px = img.load()
    for x in range(14, 30):  # stripes run across the abdomen's side and top faces
        for y in range(0, 8):
            if (x - 14 + y) % 3 == 0:
                px[x, y] = jitter(black, 6)
    paint_box(img, (30, 0), (1, 1, 2), {"default": (20, 12, 8)}, noise=2)
    paint_box(img, (0, 8), (3, 3, 3), {"default": crimson}, noise=8)
    for x, y in ((3, 12), (5, 12), (3, 11), (5, 11)):  # glowing amber eyes on head front
        px[x, y] = (255, 190, 60, 255)
    for v in (0, 4):
        fill(img, 36, v, 16, 3, (215, 235, 250, 255), noise=6)
    save_png(img, f"{RP}/textures/entity/{name}.png")

    flap = "math.sin(query.anim_time * 2400) * 35"
    write_json(f"{RP}/animations/{name}.animation.json", {"format_version": "1.8.0", "animations": {
        f"animation.ponce.{name}.fly": {"loop": True, "bones": {
            "wing0": {"rotation": [0, 0, flap]},
            "wing1": {"rotation": [0, 0, f"-{flap}"]},
            "body": {"position": [0, "math.sin(query.anim_time * 180) * 0.6", 0]},
            "abdomen": {"rotation": ["math.sin(query.anim_time * 240) * 8", 0, 0]},
        }}}})
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name, {"fly": f"animation.ponce.{name}.fly", "look_at_target": "animation.common.look_at_target"},
        ["fly", "look_at_target"], ("#B02A26", "#1A1416")))

    def stinger(img):
        for i in range(9):
            img.putpixel((4 + i, 11 - i), (40, 25, 15, 255) if i < 6 else (20, 12, 8, 255))
        blob(img, 4.5, 11.5, 2, 1.5, (176, 42, 38, 255), noise=6)
    drop_item("wasp_stinger", "§fWasp Stinger", stinger)

    def wing(img):
        blob(img, 7.5, 7.5, 6, 3.5, (215, 235, 250, 230), noise=6)
        for x in range(3, 13):
            img.putpixel((x, 7), (160, 180, 200, 255))
    drop_item("wasp_wing", "§fWasp Wing", wing)


# ================================================================ IRONHIDE, THE BOAR KING (Floor 1 guardian)

def ironhide():
    ident, name = "ponce:ironhide", "ironhide"
    comps = base_components(["boss_boar", "monster", "ponce_boss"], hp=1800, damage=6, speed=0.24,
                            box=(2.0, 2.0), loot=name)
    for k in ("minecraft:despawn", "minecraft:behavior.random_stroll", "minecraft:pushable"):
        comps.pop(k)
    comps.update({
        "minecraft:scale": {"value": 2.5},
        "minecraft:boss": {"should_darken_sky": False, "hud_range": 48},
        "minecraft:persistent": {},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:damage_sensor": {"triggers": [
            {"cause": "fall", "deals_damage": "no"},
            {"cause": "suffocation", "deals_damage": "no"},
        ]},
        "minecraft:experience_reward": {"on_death": "80"},
        "minecraft:follow_range": {"value": 32, "max": 32},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.3, "track_target": True},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 24,
            "entity_types": PLAYER_TARGET},
        "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.6},
    })
    groups = {"ponce:enraged": {
        "minecraft:movement": {"value": 0.3},
        "minecraft:attack": {"damage": 8},
    }}
    events = {"ponce:enrage": {"add": {"component_groups": ["ponce:enraged"]}}}
    write_json(f"{BP}/entities/{name}.json", bp_entity(ident, comps, groups, events))
    write_json(f"{BP}/loot_tables/entities/{name}.json", {"pools": [
        {"rolls": 1, "entries": [{"type": "item", "name": "ponce:boar_king_crest", "weight": 1}]},
        {"rolls": 1, "entries": [{"type": "item", "name": "ponce:raw_boar", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 3, "max": 5}}]}]},
        {"rolls": 1, "entries": [{"type": "item", "name": "ponce:boar_hide", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 2, "max": 4}}]}]},
        {"rolls": 1, "entries": [{"type": "item", "name": "ponce:boar_tusk", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 1, "max": 2}}]}]},
    ]})

    # Same body as the Tusk Boar, plus an iron back plate and huge forward tusks
    bones = boar_bones()
    bones[0]["cubes"].append(cube([-4, 14, -4], [8, 1, 9], [28, 49]))
    bones[1]["cubes"] += [cube([-4, 9, -19], [1, 1, 2], [44, 30]), cube([3, 9, -19], [1, 1, 2], [50, 30])]
    write_json(f"{RP}/models/entity/{name}.geo.json", geometry(f"geometry.ponce.{name}", 64, 64, bones, bounds=(5, 4)))

    img = paint_boar((70, 52, 44), (38, 28, 24), (96, 74, 60), eye=(255, 150, 40, 255))
    paint_box(img, (28, 49), (8, 1, 9), {"default": (140, 146, 152), "top": (160, 166, 172)}, noise=10)
    px = img.load()
    for x, y in ((38, 51), (41, 54), (45, 52), (40, 57)):  # rivets on the plate's top face
        px[x, y] = (90, 94, 100, 255)
    for uv in ([44, 30], [50, 30], [44, 24], [48, 24]):
        size = (1, 1, 2) if uv[1] == 30 else (1, 3, 1)
        paint_box(img, uv, size, {"default": (250, 244, 225)}, noise=5)
    for x, y in ((20, 18), (21, 19), (22, 20), (23, 21), (5, 20), (6, 21), (7, 22)):  # battle scars
        px[x, y] = (150, 110, 100, 255)
    fx, fy = 7, 31
    for ex in (fx + 1, fx + 6):  # glowing eyes
        px[ex, fy + 2] = (255, 200, 80, 255)
    save_png(img, f"{RP}/textures/entity/{name}.png")

    write_json(f"{RP}/animations/{name}.animation.json", boar_walk(name))
    write_json(f"{RP}/entity/{name}.entity.json", rp_entity(
        ident, name,
        {"walk": f"animation.ponce.{name}.walk", "look_at_target": "animation.common.look_at_target"},
        ["walk", "look_at_target"], ("#2E241E", "#FF9628")))

    def crest(img):
        blob(img, 7.5, 7.5, 6, 6.5, (200, 160, 60, 255), noise=6)
        blob(img, 7.5, 7.5, 4, 4.5, (110, 80, 60, 255), noise=6)
        for x, y in ((5, 9), (4, 10), (10, 9), (11, 10)):
            img.putpixel((x, y), (250, 244, 225, 255))
    drop_item("boar_king_crest", "§6Boar King's Crest", crest)

    # Summoning horn: crafted from boar parts, blown to challenge the guardian
    def horn(img):
        pts = [(3, 12), (4, 12), (4, 11), (5, 11), (5, 10), (6, 10), (6, 9), (7, 9), (7, 8), (8, 8), (8, 7),
               (9, 7), (9, 6), (10, 6), (10, 5), (11, 5), (11, 4), (12, 4), (12, 3)]
        for i, (x, y) in enumerate(pts):
            img.putpixel((x, y), (240, 232, 205, 255) if i > 4 else (200, 190, 160, 255))
            img.putpixel((x, y + 1), (210, 200, 170, 255))
        for x, y in ((6, 9), (6, 10), (7, 10), (9, 7), (9, 8), (10, 7)):
            img.putpixel((x, y), (110, 76, 50, 255))  # hide wraps
        img.putpixel((2, 13), (60, 50, 40, 255))
    drop_item("boar_kings_call", "§cBoar King's Call", horn, extra={
        "minecraft:max_stack_size": 1,
        "minecraft:cooldown": {"category": "ponce_horn", "duration": 2},
    })
    write_json(f"{BP}/recipes/boar_kings_call.json", {
        "format_version": "1.20.10",
        "minecraft:recipe_shaped": {
            "description": {"identifier": "ponce:boar_kings_call"},
            "tags": ["crafting_table"],
            "pattern": [" T ", "THT", " H "],
            "key": {"T": {"item": "ponce:boar_tusk"}, "H": {"item": "ponce:boar_hide"}},
            "unlock": [{"item": "ponce:boar_tusk"}],
            "result": {"item": "ponce:boar_kings_call"},
        },
    })


# ================================================================ shared resource files

def resources():
    path = f"{RP}/textures/item_texture.json"
    data = json.load(open(path))
    data["texture_data"].update(ITEM_TEXTURES)
    write_json(path, data)

    sounds_path = f"{RP}/sounds.json"
    sounds = json.load(open(sounds_path)) if os.path.exists(sounds_path) else {"entity_sounds": {"entities": {}}}
    sounds["entity_sounds"]["entities"].update({
        "ponce:meadow_jelly": {"volume": 0.8, "pitch": [1.1, 1.4], "events": {
            "hurt": "mob.slime.small", "death": "mob.slime.small", "attack": "mob.slime.attack",
            "step": {"sound": "mob.slime.small", "volume": 0.25}}},
        "ponce:ironhide": {"volume": 1.6, "pitch": [0.5, 0.6], "events": {
            "ambient": "mob.hoglin.ambient", "hurt": "mob.hoglin.hurt", "death": "mob.hoglin.death",
            "attack": "mob.hoglin.attack", "step": {"sound": "mob.ravager.step", "volume": 0.6}}},
        "ponce:thornback_hare": {"volume": 0.6, "pitch": [1.3, 1.6], "events": {
            "hurt": "mob.rabbit.hurt", "death": "mob.rabbit.death", "step": {"sound": "mob.rabbit.hop", "volume": 0.2}}},
        "ponce:burrow_mole": {"volume": 0.8, "pitch": [1.2, 1.4], "events": {
            "hurt": "mob.silverfish.hit", "death": "mob.silverfish.kill", "step": {"sound": "mob.silverfish.step", "volume": 0.3}}},
        "ponce:moss_golemite": {"volume": 1.0, "pitch": [0.6, 0.8], "events": {
            "hurt": "mob.irongolem.hit", "death": "mob.irongolem.death", "attack": "mob.irongolem.throw",
            "step": {"sound": "mob.irongolem.walk", "volume": 0.5}}},
        "ponce:field_wasp": {"volume": 0.8, "pitch": [1.2, 1.4], "events": {
            "hurt": "mob.bee.hurt", "death": "mob.bee.death", "ambient": "mob.bee.loop"}},
        "ponce:tusk_boar": {"volume": 1.0, "pitch": [0.9, 1.1], "events": {
            "ambient": "mob.hoglin.ambient", "hurt": "mob.hoglin.hurt", "death": "mob.hoglin.death",
            "attack": "mob.hoglin.attack", "step": {"sound": "mob.pig.step", "volume": 0.2}}},
    })
    write_json(sounds_path, sounds)


if __name__ == "__main__":
    meadow_jelly()
    tusk_boar()
    thornback_hare()
    burrow_mole()
    moss_golemite()
    field_wasp()
    ironhide()
    resources()
    print("Generated Floor 1 mobs and guardian.")
