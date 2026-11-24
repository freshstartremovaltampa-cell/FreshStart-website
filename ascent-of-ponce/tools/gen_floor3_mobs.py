#!/usr/bin/env python3
"""Generates the Floor 3 (Rolling Highlands) creatures: Highland Bull, Rock
Lizard, Wind Sprite, Crag Hawk, and the guardian Thunderhoof, the Highland King.
Also their drops, the Thunder Call that summons the guardian, and lang entries.

Run from the add-on folder after gen_mobs.py:  python3 tools/gen_floor3_mobs.py
Floor 3 mobs have no natural spawn rules: the floor's spawner places them.
"""
import json
import os
import random
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_mobs as m  # noqa: E402  (shared helpers)
from gen_floor2_mobs import entity_files, save, swing  # noqa: E402

BP, RP = m.BP, m.RP
random.seed(303)
cube, paint_box, fill, blob, eyes, write_json = m.cube, m.paint_box, m.fill, m.blob, m.eyes, m.write_json


# ================================================================ HIGHLAND BULL (Lv 16)

BULL_LEGS = [("leg0", [-5, 0, -7], [0, 42]), ("leg1", [1, 0, -7], [16, 42]), ("leg2", [-5, 0, 5], [32, 42]), ("leg3", [1, 0, 5], [48, 42])]


def bull_bones():
    return [
        {"name": "body", "pivot": [0, 12, 0], "cubes": [
            cube([-6, 8, -9], [12, 10, 18], [0, 0]),
            cube([-1, 10, 9], [2, 8, 1], [52, 28]),  # tail
        ]},
        {"name": "head", "parent": "body", "pivot": [0, 14, -9], "cubes": [
            cube([-4, 8, -15], [8, 8, 6], [0, 28]),
            cube([-8, 13, -12], [4, 2, 2], [28, 28]), cube([4, 13, -12], [4, 2, 2], [40, 28]),  # horns
            cube([-9, 15, -12], [1, 3, 2], [28, 32]), cube([8, 15, -12], [1, 3, 2], [36, 32]),  # horn tips
        ]},
    ] + [{"name": n, "parent": "body", "pivot": [o[0] + 2, 8, o[2] + 2], "cubes": [cube(o, [4, 8, 4], uv)]} for n, o, uv in BULL_LEGS]


def paint_bull(coat, dark, horn, eye):
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    paint_box(img, (0, 0), (12, 10, 18), {"default": coat, "top": dark}, noise=20)
    paint_box(img, (0, 28), (8, 8, 6), {"default": coat, "top": dark}, noise=18)
    for uv, size in (([28, 28], (4, 2, 2)), ([40, 28], (4, 2, 2)), ([28, 32], (1, 3, 2)), ([36, 32], (1, 3, 2))):
        paint_box(img, uv, size, {"default": horn}, noise=6)
    paint_box(img, (52, 28), (2, 8, 1), {"default": dark}, noise=10)
    for _, _, uv in BULL_LEGS:
        paint_box(img, uv, (4, 8, 4), {"default": dark, "bottom": (30, 24, 20)}, noise=12)
    px = img.load()
    fx, fy = 6, 34  # head front face (8 x 8)
    for x in range(fx, fx + 8):  # shaggy fringe over the eyes
        for y in range(fy, fy + 3):
            if random.random() < 0.7:
                px[x, y] = m.jitter(coat, 25)
    px[fx + 1, fy + 3] = px[fx + 6, fy + 3] = eye + (255,)
    for x in range(fx + 2, fx + 6):  # muzzle
        px[x, fy + 6] = (60, 40, 34, 255)
    for _ in range(140):  # long shaggy streaks down the sides
        x, y = random.randint(0, 59), random.randint(18, 27)
        px[x, y] = m.jitter(dark, 14)
    return img


def bull_walk(name):
    return {f"animation.ponce.{name}.walk": {"loop": True, "bones": {
        "leg0": {"rotation": [swing(45), 0, 0]}, "leg3": {"rotation": [swing(45), 0, 0]},
        "leg1": {"rotation": [f"-{swing(45)}", 0, 0]}, "leg2": {"rotation": [f"-{swing(45)}", 0, 0]},
        "head": {"rotation": ["math.sin(query.anim_time * 60) * 3", 0, 0]}}}}


def highland_bull():
    ident, name = "ponce:highland_bull", "highland_bull"
    comps = m.base_components(["bull", "animal"], hp=90, damage=9, speed=0.22, box=(1.4, 1.5), loot=name)
    comps.update({
        # Grazes in herds until provoked, then the whole herd charges
        "minecraft:behavior.hurt_by_target": {"priority": 1, "alert_same_type": True},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.9, "track_target": True, "cooldown_time": 1.4},
        "minecraft:knockback_resistance": {"value": 0.6},
    })
    entity_files(ident, name, comps, bull_bones(), (64, 64),
                 lambda img: img.paste(paint_bull((168, 92, 44), (110, 56, 26), (236, 226, 200), (20, 14, 10)), (0, 0)),
                 bull_walk(name), None, ("#A85C2C", "#ECE2C8"),
                 loot_table=m.loot(("minecraft:beef", 1, 3, 1), ("ponce:highland_hide", 1, 2, 1), ("ponce:bull_horn", 0, 1, 1)), bounds=(2.5, 2))

    m.drop_item("highland_hide", "§fHighland Hide", lambda img: (fill(img, 3, 3, 10, 10, (168, 92, 44, 255), noise=22),
                                                              [img.putpixel((x, random.randint(3, 12)), (110, 56, 26, 255)) for x in range(3, 13)]))

    def horn(img):
        for i, (x, y) in enumerate([(3, 12), (4, 11), (5, 10), (6, 9), (7, 8), (8, 7), (9, 6), (10, 5), (11, 4), (12, 4), (13, 3)]):
            img.putpixel((x, y), (236, 226, 200, 255) if i < 8 else (120, 110, 90, 255))
            img.putpixel((x, y + 1), (200, 188, 160, 255))
    m.drop_item("bull_horn", "§fBull Horn", horn)


# ================================================================ ROCK LIZARD (Lv 17)

def rock_lizard():
    ident, name = "ponce:rock_lizard", "rock_lizard"
    comps = m.base_components(["lizard", "monster"], hp=60, damage=8, speed=0.3, box=(0.9, 0.5), loot=name)
    comps.update({
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.4, "track_target": True, "cooldown_time": 1.0},
        **m.hostile_to_players(12),
    })
    legs = [("leg0", [-4, 0, -4], [36, 8]), ("leg1", [2, 0, -4], [44, 8]), ("leg2", [-4, 0, 3], [52, 8]), ("leg3", [2, 0, 3], [52, 12])]
    bones = [
        {"name": "body", "pivot": [0, 2, 0], "cubes": [cube([-3, 1, -6], [6, 3, 12], [0, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 2.5, -6], "cubes": [cube([-2.5, 1, -10], [5, 3, 4], [36, 0])]},
        {"name": "tail", "parent": "body", "pivot": [0, 2.5, 6], "cubes": [cube([-1.5, 1.5, 6], [3, 2, 10], [0, 15])]},
    ] + [{"name": n, "parent": "body", "pivot": [o[0] + 1, 2, o[2] + 1], "cubes": [cube(o, [2, 2, 2], uv)]} for n, o, uv in legs]

    def paint(img):
        stone, dark, ochre = (130, 126, 112), (96, 92, 84), (176, 140, 70)
        paint_box(img, (0, 0), (6, 3, 12), {"default": stone, "top": stone}, noise=14)
        paint_box(img, (36, 0), (5, 3, 4), {"default": stone}, noise=12)
        paint_box(img, (0, 15), (3, 2, 10), {"default": stone}, noise=12)
        for _, _, uv in legs:
            paint_box(img, uv, (2, 2, 2), {"default": dark}, noise=8)
        px = img.load()
        for _ in range(30):  # ochre lichen patches that blend into rock
            x, y = random.randint(0, 35), random.randint(0, 14)
            px[x, y] = m.jitter(ochre, 12)
        for x in range(12, 18):  # spined ridge down the back
            for y in range(0, 12, 2):
                px[x if x % 2 else x, y] = m.jitter(dark, 6)
        eyes(img, 40, 5, 2, (230, 200, 60, 255))

    anims = {f"animation.ponce.{name}.walk": {"loop": True, "bones": {
        "leg0": {"rotation": [swing(60, 50), 0, 0]}, "leg3": {"rotation": [swing(60, 50), 0, 0]},
        "leg1": {"rotation": [f"-{swing(60, 50)}", 0, 0]}, "leg2": {"rotation": [f"-{swing(60, 50)}", 0, 0]},
        "body": {"rotation": [0, f"math.sin(query.modified_distance_moved * 50) * 8 * query.modified_move_speed", 0]},
        "tail": {"rotation": [0, f"-math.sin(query.modified_distance_moved * 50) * 18 * query.modified_move_speed", 0]}}}}
    entity_files(ident, name, comps, bones, (64, 32), paint, anims, None, ("#827E70", "#B08C46"),
                 loot_table=m.loot(("ponce:lizard_scale", 1, 2, 1)), bounds=(1.5, 1))
    m.drop_item("lizard_scale", "§fLizard Scale", lambda img: (blob(img, 7.5, 7.5, 5.5, 5, (130, 126, 112, 255), noise=10),
                                                             blob(img, 6, 6, 2, 1.5, (176, 140, 70, 255), noise=8)))


# ================================================================ WIND SPRITE (Lv 18)

def wind_sprite():
    ident, name = "ponce:wind_sprite", "wind_sprite"
    comps = m.base_components(["sprite", "monster"], hp=45, damage=4, speed=0.28, box=(0.7, 0.9), loot=name)
    for k in ("minecraft:movement.basic", "minecraft:navigation.walk", "minecraft:jump.static",
              "minecraft:behavior.random_stroll", "minecraft:behavior.float"):
        comps.pop(k)
    comps.update({
        "minecraft:can_fly": {}, "minecraft:movement.hover": {}, "minecraft:flying_speed": {"value": 0.16},
        "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_path_from_air": True},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.4, "track_target": True, "cooldown_time": 1.6},
        **m.hostile_to_players(14),
        "minecraft:behavior.random_hover": {"priority": 8, "xz_dist": 10, "y_dist": 4, "y_offset": 0, "interval": 1, "hover_height": [2, 5]},
    })
    bones = [
        {"name": "body", "pivot": [0, 8, 0], "cubes": [cube([-2, 6, -2], [4, 4, 4], [0, 0]), cube([-1, 3, -1], [2, 3, 2], [0, 17])]},
        {"name": "ring", "parent": "body", "pivot": [0, 8, 0], "cubes": [cube([-4, 7.5, -4], [8, 1, 8], [0, 8])]},
    ]

    def paint(img):
        paint_box(img, (0, 0), (4, 4, 4), {"default": (230, 245, 255, 230)}, noise=6)
        paint_box(img, (0, 8), (8, 1, 8), {"default": (200, 230, 250, 120)}, noise=10)
        paint_box(img, (0, 17), (2, 3, 2), {"default": (210, 235, 250, 150)}, noise=8)

    anims = {f"animation.ponce.{name}.spin": {"loop": True, "bones": {
        "ring": {"rotation": [0, "query.anim_time * 360", "math.sin(query.anim_time * 120) * 15"]},
        "body": {"position": [0, "math.sin(query.anim_time * 140) * 1.5", 0]}}}}
    entity_files(ident, name, comps, bones, (32, 32), paint, anims, None, ("#C8E6FA", "#FFFFFF"),
                 loot_table=m.loot(("ponce:wind_essence", 1, 2, 1)), materials={"default": "entity_emissive_alpha"}, bounds=(1, 1.2))
    m.drop_item("wind_essence", "§bWind Essence", lambda img: [blob(img, 7.5 + dx, 7.5 + dy, 4 - abs(dx), 2, (210, 235, 250, 170), noise=6)
                                                             for dx, dy in ((-2, -3), (0, 0), (2, 3))])


# ================================================================ CRAG HAWK (Lv 19)

def crag_hawk():
    ident, name = "ponce:crag_hawk", "crag_hawk"
    comps = m.base_components(["hawk", "monster"], hp=40, damage=7, speed=0.3, box=(0.8, 0.6), loot=name)
    for k in ("minecraft:movement.basic", "minecraft:navigation.walk", "minecraft:jump.static",
              "minecraft:behavior.random_stroll", "minecraft:behavior.float"):
        comps.pop(k)
    comps.update({
        "minecraft:can_fly": {}, "minecraft:movement.hover": {}, "minecraft:flying_speed": {"value": 0.2},
        "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_path_from_air": True},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.8, "track_target": True, "cooldown_time": 2.0},
        **m.hostile_to_players(18),
        "minecraft:behavior.random_hover": {"priority": 8, "xz_dist": 14, "y_dist": 6, "y_offset": 2, "interval": 1, "hover_height": [5, 10]},
    })
    bones = [
        {"name": "body", "pivot": [0, 8, 0], "cubes": [cube([-2, 6, -3], [4, 4, 7], [0, 0]), cube([-1.5, 7, 4], [3, 0, 4], [24, 11])]},
        {"name": "head", "parent": "body", "pivot": [0, 9, -3], "cubes": [cube([-1.5, 8, -6], [3, 3, 3], [22, 0]), cube([-0.5, 8, -7.5], [1, 1, 2], [34, 0])]},
        {"name": "wing_l", "parent": "body", "pivot": [-2, 9, 0], "cubes": [cube([-9, 9, -2], [7, 0, 5], [0, 11])]},
        {"name": "wing_r", "parent": "body", "pivot": [2, 9, 0], "cubes": [cube([2, 9, -2], [7, 0, 5], [0, 16])]},
    ]

    def paint(img):
        brown, cream, dark = (122, 86, 56), (226, 206, 170), (70, 48, 32)
        paint_box(img, (0, 0), (4, 4, 7), {"default": brown, "bottom": cream}, noise=12)
        paint_box(img, (22, 0), (3, 3, 3), {"default": cream}, noise=8)
        paint_box(img, (34, 0), (1, 1, 2), {"default": (230, 180, 60)}, noise=4)
        for v in (11, 16):
            fill(img, 0, v, 24, 5, brown, noise=14)
            for x in range(0, 24, 4):  # dark flight-feather tips
                img.putpixel((x, v + 4), dark + (255,))
        fill(img, 24, 11, 14, 4, dark, noise=10)
        img.putpixel((24, 4), (20, 14, 10, 255))
        img.putpixel((27, 4), (20, 14, 10, 255))

    flap = "math.sin(query.anim_time * 600) * 30"
    anims = {f"animation.ponce.{name}.fly": {"loop": True, "bones": {
        "wing_l": {"rotation": [0, 0, flap]}, "wing_r": {"rotation": [0, 0, f"-{flap}"]},
        "body": {"position": [0, "math.sin(query.anim_time * 120) * 0.8", 0]}}}}
    entity_files(ident, name, comps, bones, (64, 32), paint, anims, None, ("#7A5638", "#E2CEAA"),
                 loot_table=m.loot(("ponce:hawk_feather", 1, 2, 1)), bounds=(2, 1))

    def feather(img):
        for i in range(10):
            img.putpixel((3 + i, 12 - i), (122, 86, 56, 255))
            if i > 1:
                img.putpixel((4 + i, 12 - i), (160, 120, 80, 255))
                img.putpixel((3 + i, 11 - i), (160, 120, 80, 255))
        img.putpixel((12, 3), (70, 48, 32, 255))
    m.drop_item("hawk_feather", "§fHawk Feather", feather)


# ================================================================ THUNDERHOOF (Floor 3 guardian)

def thunderhoof():
    ident, name = "ponce:thunderhoof", "thunderhoof"
    comps = m.base_components(["bull", "monster", "ponce_boss"], hp=2600, damage=10, speed=0.24, box=(3.2, 3.6), loot=name)
    for k in ("minecraft:despawn", "minecraft:behavior.random_stroll", "minecraft:pushable"):
        comps.pop(k)
    comps.update({
        "minecraft:scale": {"value": 2.8},
        "minecraft:boss": {"should_darken_sky": True, "hud_range": 48},
        "minecraft:persistent": {},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}, {"cause": "suffocation", "deals_damage": "no"}]},
        "minecraft:experience_reward": {"on_death": "150"},
        "minecraft:follow_range": {"value": 32, "max": 32},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True, "cooldown_time": 1.6},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 28, "entity_types": m.PLAYER_TARGET},
    })
    groups = {"ponce:enraged": {"minecraft:movement": {"value": 0.3}, "minecraft:attack": {"damage": 13}}}
    events = {"ponce:enrage": {"add": {"component_groups": ["ponce:enraged"]}}}
    write_json(f"{BP}/entities/{name}.json", m.bp_entity(ident, comps, groups, events))
    write_json(f"{BP}/loot_tables/entities/{name}.json", m.loot(
        ("ponce:thunder_horn", 1, 1, 1), ("ponce:highland_hide", 3, 5, 1), ("ponce:bull_horn", 2, 3, 1), ("minecraft:beef", 4, 8, 1)))
    write_json(f"{RP}/models/entity/{name}.geo.json", m.geometry(f"geometry.ponce.{name}", 64, 64, bull_bones(), bounds=(7, 6)))
    img = paint_bull((70, 74, 86), (40, 42, 52), (200, 220, 255), (120, 200, 255))
    px = img.load()
    for x, y in ((20, 3), (21, 4), (22, 5), (21, 6), (22, 7), (23, 8), (40, 4), (41, 5), (40, 6), (41, 7)):  # lightning marks
        px[x, y] = (150, 210, 255, 255)
    save(img, f"{RP}/textures/entity/{name}.png")
    write_json(f"{RP}/animations/{name}.animation.json", {"format_version": "1.8.0", "animations": bull_walk(name)})
    write_json(f"{RP}/entity/{name}.entity.json", m.rp_entity(
        ident, name, {"walk": f"animation.ponce.{name}.walk", "look_at_target": "animation.common.look_at_target"},
        ["walk", "look_at_target"], ("#464A56", "#96D2FF")))

    def thunder_horn(img):
        horn(img)
        for x, y in ((8, 7), (9, 6), (10, 5)):
            img.putpixel((x, y), (150, 210, 255, 255))

    def horn(img):
        for i, (x, y) in enumerate([(3, 12), (4, 11), (5, 10), (6, 9), (7, 8), (8, 7), (9, 6), (10, 5), (11, 4), (12, 4), (13, 3)]):
            img.putpixel((x, y), (200, 220, 255, 255) if i < 8 else (90, 100, 130, 255))
            img.putpixel((x, y + 1), (150, 170, 210, 255))
    m.drop_item("thunder_horn", "§bThunder Horn", thunder_horn)

    # Thunder Call: blown inside the Crown of Stones to challenge the guardian
    def call(img):
        horn(img)
        for x, y in ((5, 11), (6, 11), (5, 12)):
            img.putpixel((x, y), (168, 92, 44, 255))
    m.drop_item("thunder_call", "§bThunder Call", call, extra={
        "minecraft:max_stack_size": 1, "minecraft:cooldown": {"category": "ponce_horn", "duration": 2}})
    write_json(f"{BP}/recipes/thunder_call.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "ponce:thunder_call"}, "tags": ["crafting_table"],
        "pattern": ["BWB", "FBF", " W "],
        "key": {"B": {"item": "ponce:bull_horn"}, "W": {"item": "ponce:wind_essence"}, "F": {"item": "ponce:hawk_feather"}},
        "unlock": [{"item": "ponce:bull_horn"}], "result": {"item": "ponce:thunder_call"}}})


def resources():
    path = f"{RP}/textures/item_texture.json"
    data = json.load(open(path))
    data["texture_data"].update(m.ITEM_TEXTURES)
    write_json(path, data)
    sounds_path = f"{RP}/sounds.json"
    sounds = json.load(open(sounds_path))
    sounds["entity_sounds"]["entities"].update({
        "ponce:highland_bull": {"volume": 1.0, "pitch": [0.6, 0.8], "events": {
            "ambient": "mob.cow.say", "hurt": "mob.cow.hurt", "death": "mob.cow.hurt", "step": {"sound": "mob.cow.step", "volume": 0.4}}},
        "ponce:rock_lizard": {"volume": 0.8, "pitch": [1.2, 1.4], "events": {
            "hurt": "mob.silverfish.hit", "death": "mob.silverfish.kill", "step": {"sound": "mob.silverfish.step", "volume": 0.3}}},
        "ponce:wind_sprite": {"volume": 0.7, "pitch": [1.4, 1.7], "events": {
            "ambient": "mob.breeze.idle_ground", "hurt": "mob.breeze.hurt", "death": "mob.breeze.death"}},
        "ponce:crag_hawk": {"volume": 0.9, "pitch": [1.1, 1.3], "events": {
            "ambient": "mob.parrot.idle", "hurt": "mob.parrot.hurt", "death": "mob.parrot.death"}},
        "ponce:thunderhoof": {"volume": 2.0, "pitch": [0.4, 0.5], "events": {
            "ambient": "mob.ravager.ambient", "hurt": "mob.ravager.hurt", "death": "mob.ravager.death",
            "attack": "mob.ravager.bite", "step": {"sound": "mob.ravager.step", "volume": 1.0}}},
    })
    write_json(sounds_path, sounds)
    names = {"highland_bull": "Highland Bull", "rock_lizard": "Rock Lizard", "wind_sprite": "Wind Sprite",
             "crag_hawk": "Crag Hawk", "thunderhoof": "Thunderhoof, the Highland King"}
    langp = f"{RP}/texts/en_US.lang"
    lines = [l for l in open(langp).read().splitlines() if not any(f"ponce:{k}." in l for k in names)]
    for k, n in names.items():
        lines += [f"entity.ponce:{k}.name={n}", f"item.spawn_egg.entity.ponce:{k}.name={n} Spawn Egg"]
    with open(langp, "w") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    highland_bull()
    rock_lizard()
    wind_sprite()
    crag_hawk()
    thunderhoof()
    resources()
    print("Generated Floor 3 creatures.")
