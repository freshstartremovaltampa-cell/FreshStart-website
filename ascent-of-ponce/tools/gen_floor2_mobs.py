#!/usr/bin/env python3
"""Generates the Floor 2 (Misty Marsh) creatures: Bog Frog, Will-o'-Wisp,
Mire Shambler, Marsh Gator, and the Mire Hydra (a body plus head entities that
ride it; see scripts/multihead.js). Also their drops, the Mire Lure that
summons the hydra, and the marsh fog.

Run from the add-on folder after gen_mobs.py:  python3 tools/gen_floor2_mobs.py
Floor 2 mobs have no natural spawn rules: the floor's spawner places them.
"""
import json
import os
import random
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_mobs as m  # noqa: E402  (shared helpers)

BP, RP = m.BP, m.RP
random.seed(202)
cube, paint_box, fill, blob, eyes, write_json = m.cube, m.paint_box, m.fill, m.blob, m.eyes, m.write_json


def save(img, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


def entity_files(ident, name, comps, bones, tex_size, painter, anims, scripts, egg, loot_table=None,
                 groups=None, events=None, materials=None, bounds=(2, 2), controller="controller.render.default"):
    write_json(f"{BP}/entities/{name}.json", m.bp_entity(ident, comps, groups, events))
    if loot_table is not None:
        write_json(f"{BP}/loot_tables/entities/{name}.json", loot_table)
    write_json(f"{RP}/models/entity/{name}.geo.json", m.geometry(f"geometry.ponce.{name}", *tex_size, bones, bounds=bounds))
    img = Image.new("RGBA", tex_size, (0, 0, 0, 0))
    painter(img)
    save(img, f"{RP}/textures/entity/{name}.png")
    write_json(f"{RP}/animations/{name}.animation.json", {"format_version": "1.8.0", "animations": anims})
    write_json(f"{RP}/entity/{name}.entity.json", m.rp_entity(
        ident, name, {k.split(".")[-1]: k for k in anims} | {"look_at_target": "animation.common.look_at_target"},
        [k.split(".")[-1] for k in anims] + ["look_at_target"], egg, materials=materials, controller=controller))


def swing(amp, speed=38.17):
    return f"math.cos(query.modified_distance_moved * {speed}) * {amp} * query.modified_move_speed"


# ================================================================ BOG FROG (Lv 8)

def bog_frog():
    ident, name = "ponce:bog_frog", "bog_frog"
    comps = m.base_components(["frog_beast", "monster"], hp=40, damage=6, speed=0.24, box=(0.9, 0.7), loot=name)
    comps.pop("minecraft:despawn")
    comps.update({
        "minecraft:despawn": {"despawn_from_distance": {"min_distance": 48, "max_distance": 96}},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.leap_at_target": {"priority": 2, "yd": 0.45, "must_be_on_ground": True},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.2, "track_target": True},
        "minecraft:navigation.walk": {"avoid_water": False, "can_path_over_water": True, "can_swim": True},
        "minecraft:underwater_movement": {"value": 0.15},
        **m.hostile_to_players(10),
    })
    bones = [
        {"name": "body", "pivot": [0, 4, 0], "cubes": [cube([-4, 2, -4], [8, 5, 8], [0, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 6, -4], "cubes": [
            cube([-3.5, 5, -6], [7, 4, 4], [32, 0]),
            cube([-3.5, 8, -5], [2, 2, 2], [0, 13]), cube([1.5, 8, -5], [2, 2, 2], [8, 13])]},
        {"name": "leg_bl", "parent": "body", "pivot": [-3.5, 3, 2], "cubes": [cube([-5, 0, 0], [3, 3, 5], [16, 13])]},
        {"name": "leg_br", "parent": "body", "pivot": [3.5, 3, 2], "cubes": [cube([2, 0, 0], [3, 3, 5], [32, 13])]},
        {"name": "leg_fl", "parent": "body", "pivot": [-3, 2, -3], "cubes": [cube([-4, 0, -4], [2, 2, 2], [0, 17])]},
        {"name": "leg_fr", "parent": "body", "pivot": [3, 2, -3], "cubes": [cube([2, 0, -4], [2, 2, 2], [48, 13])]},
    ]

    def paint(img):
        skin, spot, belly = (88, 118, 52), (60, 80, 36), (200, 190, 120)
        paint_box(img, (0, 0), (8, 5, 8), {"default": skin, "bottom": belly}, noise=12)
        paint_box(img, (32, 0), (7, 4, 4), {"default": skin, "bottom": belly}, noise=10)
        for uv in ([0, 13], [8, 13]):
            paint_box(img, uv, (2, 2, 2), {"default": (230, 200, 60)}, noise=6)
        for uv, size in (([16, 13], (3, 3, 5)), ([32, 13], (3, 3, 5)), ([0, 17], (2, 2, 2)), ([48, 13], (2, 2, 2))):
            paint_box(img, uv, size, {"default": skin}, noise=10)
        px = img.load()
        for _ in range(14):  # dark spots on the back
            x, y = random.randint(8, 15), random.randint(0, 7)
            px[x, y] = spot + (255,)
        px[1, 15] = px[9, 15] = (10, 10, 10, 255)  # pupils on the front of the eye bumps
        for x in range(36, 43):
            px[x, 7] = (60, 30, 30, 255)  # wide mouth line

    hop = "math.abs(math.sin(query.modified_distance_moved * 20)) * 3 * query.modified_move_speed"
    anims = {f"animation.ponce.{name}.hop": {"loop": True, "bones": {
        "body": {"position": [0, hop, 0]},
        "leg_bl": {"rotation": [f"-{hop} * 20", 0, 0]}, "leg_br": {"rotation": [f"-{hop} * 20", 0, 0]}}}}
    entity_files(ident, name, comps, bones, (64, 32), paint, anims, None, ("#587834", "#E6C83C"),
                 loot_table=m.loot(("ponce:frog_legs", 1, 2, 1), ("ponce:frog_skin", 0, 2, 1)), bounds=(1.2, 1))

    m.drop_item("frog_skin", "§fFrog Skin", lambda img: (fill(img, 3, 4, 10, 8, (88, 118, 52, 255), noise=14),
                                                     [img.putpixel((random.randint(4, 11), random.randint(5, 10)), (60, 80, 36, 255)) for _ in range(6)]))
    m.drop_item("frog_legs", "§fRaw Frog Legs", lambda img: (blob(img, 6, 9, 2, 4.5, (220, 160, 150, 255)), blob(img, 10, 9, 2, 4.5, (220, 160, 150, 255))),
                extra={"minecraft:food": {"nutrition": 3, "saturation_modifier": 0.3},
                       "minecraft:use_modifiers": {"use_duration": 1.6, "movement_modifier": 0.35}, "minecraft:use_animation": "eat"})


# ================================================================ WILL-O'-WISP (Lv 10)

def will_o_wisp():
    ident, name = "ponce:will_o_wisp", "will_o_wisp"
    comps = m.base_components(["wisp", "monster"], hp=30, damage=5, speed=0.25, box=(0.6, 0.6), loot=name)
    for k in ("minecraft:movement.basic", "minecraft:navigation.walk", "minecraft:jump.static",
              "minecraft:behavior.random_stroll", "minecraft:behavior.float"):
        comps.pop(k)
    comps.update({
        "minecraft:attack": {"damage": 5, "effect_name": "slowness", "effect_duration": 3},
        "minecraft:can_fly": {}, "minecraft:movement.hover": {}, "minecraft:flying_speed": {"value": 0.13},
        "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_path_from_air": True, "avoid_water": False},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}, {"cause": "drowning", "deals_damage": "no"}]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.3, "track_target": True, "cooldown_time": 1.5},
        **m.hostile_to_players(12),
        "minecraft:behavior.random_hover": {"priority": 8, "xz_dist": 8, "y_dist": 3, "y_offset": -1, "interval": 1, "hover_height": [1, 3]},
    })
    bones = [{"name": "body", "pivot": [0, 7, 0], "cubes": [cube([-2, 6, -2], [4, 4, 4], [0, 0])]},
             {"name": "shell", "parent": "body", "pivot": [0, 7, 0], "cubes": [cube([-3, 5, -3], [6, 6, 6], [0, 8])]}]

    def paint(img):
        paint_box(img, (0, 0), (4, 4, 4), {"default": (220, 255, 235, 255)}, noise=6)
        paint_box(img, (0, 8), (6, 6, 6), {"default": (120, 230, 200, 120)}, noise=10)

    anims = {f"animation.ponce.{name}.float": {"loop": True, "bones": {
        "body": {"position": [0, "math.sin(query.anim_time * 160) * 1.2", 0], "rotation": [0, "query.anim_time * 90", 0]},
        "shell": {"scale": "1 + math.sin(query.anim_time * 400) * 0.12"}}}}
    entity_files(ident, name, comps, bones, (32, 32), paint, anims, None, ("#78E6C8", "#DCFFEB"),
                 loot_table=m.loot(("ponce:wisp_essence", 1, 2, 1)), materials={"default": "entity_emissive_alpha"}, bounds=(1, 1))

    m.drop_item("wisp_essence", "§bWisp Essence", lambda img: (blob(img, 7.5, 7.5, 5, 5, (120, 230, 200, 150), noise=8),
                                                            blob(img, 7.5, 7.5, 2.5, 2.5, (230, 255, 240, 255), noise=4)))


# ================================================================ MIRE SHAMBLER (Lv 11)

def mire_shambler():
    ident, name = "ponce:mire_shambler", "mire_shambler"
    comps = m.base_components(["shambler", "monster"], hp=60, damage=7, speed=0.18, box=(0.8, 2.0), loot=name)
    comps.update({
        "minecraft:attack": {"damage": 7, "effect_name": "poison", "effect_duration": 3},
        "minecraft:navigation.walk": {"avoid_water": False, "can_path_over_water": True, "can_walk_in_lava": False},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True, "cooldown_time": 1.2},
        **m.hostile_to_players(14),
    })
    bones = [
        {"name": "body", "pivot": [0, 16, 0], "cubes": [cube([-4, 10, -3], [8, 12, 6], [0, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 22, 0], "cubes": [
            cube([-3, 22, -4], [6, 6, 6], [28, 0]),
            cube([-2, 28, -1], [1, 4, 1], [48, 18]), cube([1, 28, 0], [1, 4, 1], [52, 18])]},
        {"name": "arm_l", "parent": "body", "pivot": [-5.5, 21, 0], "cubes": [cube([-7, 6, -2], [3, 16, 3], [0, 18])]},
        {"name": "arm_r", "parent": "body", "pivot": [5.5, 21, 0], "cubes": [cube([4, 6, -2], [3, 16, 3], [12, 18])]},
        {"name": "leg_l", "parent": "body", "pivot": [-2, 10, 0], "cubes": [cube([-3.5, 0, -2], [3, 10, 3], [24, 18])]},
        {"name": "leg_r", "parent": "body", "pivot": [2, 10, 0], "cubes": [cube([0.5, 0, -2], [3, 10, 3], [36, 18])]},
    ]

    def paint(img):
        moss, mud, reed = (70, 84, 44), (92, 70, 46), (150, 140, 70)
        paint_box(img, (0, 0), (8, 12, 6), {"default": mud, "top": moss}, noise=18)
        paint_box(img, (28, 0), (6, 6, 6), {"default": moss}, noise=16)
        for uv in ([0, 18], [12, 18]):
            paint_box(img, uv, (3, 16, 3), {"default": mud, "top": moss}, noise=16)
        for uv in ([24, 18], [36, 18]):
            paint_box(img, uv, (3, 10, 3), {"default": mud}, noise=14)
        for uv in ([48, 18], [52, 18]):
            paint_box(img, uv, (1, 4, 1), {"default": reed}, noise=8)
        px = img.load()
        for _ in range(60):  # hanging moss streaks
            x, y = random.randint(0, 27), random.randint(6, 17)
            px[x, y] = m.jitter(moss, 12)
        eyes(img, 35, 8, 3, (255, 190, 60, 255))

    anims = {f"animation.ponce.{name}.walk": {"loop": True, "bones": {
        "leg_l": {"rotation": [swing(40), 0, 0]}, "leg_r": {"rotation": [f"-{swing(40)}", 0, 0]},
        "arm_l": {"rotation": [f"-{swing(30)} - 10", 0, 0]}, "arm_r": {"rotation": [f"{swing(30)} - 10", 0, 0]},
        "body": {"rotation": [0, 0, "math.sin(query.anim_time * 90) * 3"]}}}}
    entity_files(ident, name, comps, bones, (64, 64), paint, anims, None, ("#46542C", "#FFBE3C"),
                 loot_table=m.loot(("ponce:bog_moss", 1, 3, 1)), bounds=(1.5, 2.5))

    m.drop_item("bog_moss", "§fBog Moss", lambda img: (blob(img, 7.5, 8.5, 6, 4.5, (70, 84, 44, 255), noise=16),
                                                     blob(img, 6, 7, 2, 1.5, (110, 130, 70, 255), noise=8)))


# ================================================================ MARSH GATOR (Lv 12)

def marsh_gator():
    ident, name = "ponce:marsh_gator", "marsh_gator"
    comps = m.base_components(["gator", "monster"], hp=80, damage=10, speed=0.16, box=(1.4, 0.8), loot=name)
    comps.update({
        "minecraft:knockback_resistance": {"value": 0.6},
        "minecraft:navigation.walk": {"avoid_water": False, "can_path_over_water": True, "can_swim": True},
        "minecraft:underwater_movement": {"value": 0.2},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.8, "track_target": True, "cooldown_time": 1.4},
        **m.hostile_to_players(8),  # ambush: only notices you up close
    })
    legs = [("leg0", [-6, 0, -6], [52, 0]), ("leg1", [3, 0, -6], [52, 6]), ("leg2", [-6, 0, 4], [52, 12]), ("leg3", [3, 0, 4], [52, 18])]
    bones = [
        {"name": "body", "pivot": [0, 4, 0], "cubes": [cube([-4, 2, -8], [8, 5, 18], [0, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 4, -8], "cubes": [
            cube([-3, 2, -18], [6, 4, 10], [0, 23]),
            cube([-3, 6, -14], [2, 1, 2], [32, 23]), cube([1, 6, -14], [2, 1, 2], [40, 23])]},
        {"name": "tail", "parent": "body", "pivot": [0, 4.5, 10], "cubes": [
            cube([-2.5, 3, 10], [5, 3, 12], [0, 37]), cube([-1.5, 3.5, 22], [3, 2, 8], [34, 37])]},
    ] + [{"name": n, "parent": "body", "pivot": [o[0] + 1.5, 3, o[2] + 1.5], "cubes": [cube(o, [3, 3, 3], uv)]} for n, o, uv in legs]

    def paint(img):
        olive, dark, belly = (60, 76, 42), (40, 50, 30), (150, 150, 104)
        paint_box(img, (0, 0), (8, 5, 18), {"default": olive, "top": dark, "bottom": belly}, noise=14)
        paint_box(img, (0, 23), (6, 4, 10), {"default": olive, "top": dark, "bottom": belly}, noise=12)
        for uv in ([32, 23], [40, 23]):
            paint_box(img, uv, (2, 1, 2), {"default": (200, 180, 60)}, noise=6)
        paint_box(img, (0, 37), (5, 3, 12), {"default": olive, "top": dark}, noise=12)
        paint_box(img, (34, 37), (3, 2, 8), {"default": olive, "top": dark}, noise=10)
        for _, _, uv in legs:
            paint_box(img, uv, (3, 3, 3), {"default": dark}, noise=8)
        px = img.load()
        for x in range(10, 26, 2):  # teeth along the snout sides
            px[x, 33] = (240, 235, 220, 255)
        for x in range(8, 16, 2):  # ridged back
            for y in range(0, 18, 3):
                px[x, y] = (30, 38, 24, 255)

    anims = {f"animation.ponce.{name}.walk": {"loop": True, "bones": {
        "leg0": {"rotation": [swing(40), 0, 0]}, "leg3": {"rotation": [swing(40), 0, 0]},
        "leg1": {"rotation": [f"-{swing(40)}", 0, 0]}, "leg2": {"rotation": [f"-{swing(40)}", 0, 0]},
        "tail": {"rotation": [0, "math.sin(query.anim_time * 120) * 12", 0]}}}}
    entity_files(ident, name, comps, bones, (64, 64), paint, anims, None, ("#3C4C2A", "#C8B43C"),
                 loot_table=m.loot(("ponce:gator_hide", 1, 1, 1), ("ponce:gator_tooth", 0, 2, 1)), bounds=(2.5, 1))

    m.drop_item("gator_hide", "§fGator Hide", lambda img: (fill(img, 3, 3, 10, 10, (60, 76, 42, 255), noise=12),
                                                         [img.putpixel((x, y), (40, 50, 30, 255)) for x in range(4, 13, 3) for y in range(4, 13, 3)]))

    def tooth(img):
        for i, w in enumerate([3, 3, 2, 2, 2, 1, 1]):
            for dx in range(w):
                img.putpixel((7 + dx, 4 + i), (240, 235, 220, 255))
        img.putpixel((7, 11), (200, 190, 170, 255))
    m.drop_item("gator_tooth", "§fGator Tooth", tooth)


# ================================================================ MIRE HYDRA (Floor 2 guardian)
# The body carries three head entities as riders. Each head has its own
# health; scripts/multihead.js handles severing, regrowth and defeat.

HEAD_HP = 250  # kept modest: the challenge is felling all heads together, not chewing through health
SEATS = [[-1.3, 3.5, -1.5], [0, 3.9, -2.0], [1.3, 3.5, -1.5]]


def mire_hydra():
    ident, name = "ponce:mire_hydra", "mire_hydra"
    comps = m.base_components(["hydra", "monster", "ponce_boss", "ponce_untargetable"], hp=HEAD_HP * 3, damage=6, speed=0.12,
                              box=(3.0, 3.0), loot=name)
    for k in ("minecraft:despawn", "minecraft:behavior.random_stroll", "minecraft:pushable"):
        comps.pop(k)
    comps.update({
        "minecraft:scale": {"value": 2.0},
        "minecraft:boss": {"should_darken_sky": True, "hud_range": 48},
        "minecraft:persistent": {},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        # The body can't be hurt: only its heads can. Its health mirrors the heads (set by script).
        "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
        "minecraft:navigation.walk": {"avoid_water": False, "can_path_over_water": True, "can_swim": True},
        "minecraft:experience_reward": {"on_death": "120"},
        "minecraft:rideable": {
            "seat_count": 3, "family_types": ["hydra_head"], "pull_in_entities": False, "rider_can_interact": False,
            "interact_text": " ", "seats": [{"position": p} for p in SEATS],
        },
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 24, "entity_types": m.PLAYER_TARGET},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.0, "track_target": True, "cooldown_time": 2.5},
    })
    bones = [
        {"name": "body", "pivot": [0, 12, 0], "cubes": [
            cube([-8, 6, -10], [16, 12, 22], [0, 0]),
            cube([-1, 18, -8], [2, 2, 18], [76, 40]),  # back spines
        ]},
        {"name": "neck_l", "parent": "body", "pivot": [-5, 16, -8], "rotation": [-15, 0, 20], "cubes": [cube([-7, 16, -10], [4, 14, 4], [76, 22])]},
        {"name": "neck_m", "parent": "body", "pivot": [0, 17, -9], "rotation": [-20, 0, 0], "cubes": [cube([-2, 17, -11], [4, 16, 4], [92, 22])]},
        {"name": "neck_r", "parent": "body", "pivot": [5, 16, -8], "rotation": [-15, 0, -20], "cubes": [cube([3, 16, -10], [4, 14, 4], [108, 22])]},
        {"name": "tail", "parent": "body", "pivot": [0, 10, 12], "cubes": [
            cube([-4, 7, 12], [8, 6, 16], [0, 34]), cube([-2, 8, 28], [4, 4, 10], [48, 34])]},
    ] + [{"name": n, "parent": "body", "pivot": [o[0] + 2.5, 6, o[2] + 2.5], "cubes": [cube(o, [5, 6, 5], uv)]}
         for n, o, uv in [("leg0", [-9, 0, -8], [76, 0]), ("leg1", [4, 0, -8], [96, 0]), ("leg2", [-9, 0, 6], [76, 11]), ("leg3", [4, 0, 6], [96, 11])]]

    def paint(img):
        scale, dark, belly = (48, 96, 76), (30, 64, 50), (160, 170, 120)
        paint_box(img, (0, 0), (16, 12, 22), {"default": scale, "top": dark, "bottom": belly}, noise=14)
        paint_box(img, (76, 40), (2, 2, 18), {"default": (200, 190, 150)}, noise=8)
        for uv, h in (([76, 22], 14), ([92, 22], 16), ([108, 22], 14)):
            paint_box(img, uv, (4, h, 4), {"default": scale, "top": (120, 30, 30)}, noise=12)  # red top = severed stump
        paint_box(img, (0, 34), (8, 6, 16), {"default": scale, "top": dark}, noise=12)
        paint_box(img, (48, 34), (4, 4, 10), {"default": scale, "top": dark}, noise=10)
        for uv in ([76, 0], [96, 0], [76, 11], [96, 11]):
            paint_box(img, uv, (5, 6, 5), {"default": dark}, noise=10)
        px = img.load()
        for x in range(22, 38, 3):  # scale pattern on the back
            for y in range(0, 22, 3):
                px[x, y] = (70, 130, 100, 255)

    anims = {f"animation.ponce.{name}.walk": {"loop": True, "bones": {
        "leg0": {"rotation": [swing(30), 0, 0]}, "leg3": {"rotation": [swing(30), 0, 0]},
        "leg1": {"rotation": [f"-{swing(30)}", 0, 0]}, "leg2": {"rotation": [f"-{swing(30)}", 0, 0]},
        "tail": {"rotation": [0, "math.sin(query.anim_time * 60) * 15", 0]}}}}
    write_json(f"{BP}/entities/{name}.json", m.bp_entity(ident, comps))
    write_json(f"{BP}/loot_tables/entities/{name}.json", m.loot(
        ("ponce:hydra_fang", 1, 2, 1), ("ponce:hydra_scale", 2, 4, 1), ("ponce:gator_hide", 1, 2, 1)))
    write_json(f"{RP}/models/entity/{name}.geo.json", m.geometry(f"geometry.ponce.{name}", 128, 64, bones, bounds=(6, 5)))
    img = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
    paint(img)
    save(img, f"{RP}/textures/entity/{name}.png")
    write_json(f"{RP}/animations/{name}.animation.json", {"format_version": "1.8.0", "animations": anims})
    write_json(f"{RP}/entity/{name}.entity.json", m.rp_entity(ident, name, {"walk": f"animation.ponce.{name}.walk"}, ["walk"], ("#30604C", "#A0AA78")))

    # Heads: one biter type and one acid-spitter type (the middle head)
    for hname, tint in (("hydra_head", (48, 96, 76)), ("hydra_head_acid", (90, 120, 40))):
        hident = f"ponce:{hname}"
        hcomps = {
            "minecraft:type_family": {"family": ["hydra_head", "ponce_boss_part", "monster", "mob"]},
            "minecraft:health": {"value": HEAD_HP, "max": HEAD_HP},
            "minecraft:collision_box": {"width": 1.2, "height": 1.2},
            "minecraft:scale": {"value": 1.6},
            "minecraft:physics": {},
            "minecraft:knockback_resistance": {"value": 1.0},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:persistent": {},
            "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
            "minecraft:damage_sensor": {"triggers": [
                {"cause": "fall", "deals_damage": "no"}, {"cause": "suffocation", "deals_damage": "no"},
                {"cause": "drowning", "deals_damage": "no"}, {"cause": "entity_explosion", "deals_damage": "no"}]},
            "minecraft:movement": {"value": 0},
            "minecraft:movement.basic": {},
            "minecraft:loot": {"table": "loot_tables/empty.json"},
            "minecraft:behavior.look_at_player": {"priority": 1, "look_distance": 24, "probability": 1.0},
        }
        hbones = [
            {"name": "head", "pivot": [0, 3, 0], "cubes": [
                cube([-4, 0, -5], [8, 6, 8], [0, 0]),
                cube([-3, 1, -11], [6, 4, 6], [32, 0]),
                cube([-4, 6, -2], [2, 3, 2], [0, 14]), cube([2, 6, -2], [2, 3, 2], [8, 14]),
                cube([-2.5, -6, -2], [5, 6, 5], [0, 20])]},
            {"name": "jaw", "parent": "head", "pivot": [0, 1, -5], "cubes": [cube([-3, -1, -10], [6, 2, 6], [32, 10])]},
        ]

        def hpaint(img, tint=tint):
            dark = tuple(max(0, c - 25) for c in tint)
            paint_box(img, (0, 0), (8, 6, 8), {"default": tint, "top": dark}, noise=12)
            paint_box(img, (32, 0), (6, 4, 6), {"default": tint, "top": dark, "bottom": (150, 40, 40)}, noise=10)
            paint_box(img, (32, 10), (6, 2, 6), {"default": tint, "top": (150, 40, 40)}, noise=10)
            for uv in ([0, 14], [8, 14]):
                paint_box(img, uv, (2, 3, 2), {"default": (220, 210, 180)}, noise=6)
            paint_box(img, (0, 20), (5, 6, 5), {"default": tint}, noise=12)
            px = img.load()
            for x in (9, 14):  # glowing eyes on the head front
                px[x, 10] = (255, 220, 60, 255)
                px[x, 11] = (255, 220, 60, 255)
            for x in range(33, 37):  # teeth
                px[x + 5, 9] = (240, 235, 220, 255)

        write_json(f"{BP}/entities/{hname}.json", m.bp_entity(hident, hcomps))
        write_json(f"{RP}/models/entity/{hname}.geo.json", m.geometry(f"geometry.ponce.{hname}", 64, 32, hbones, bounds=(2, 2)))
        img = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
        hpaint(img)
        save(img, f"{RP}/textures/entity/{hname}.png")
        write_json(f"{RP}/animations/{hname}.animation.json", {"format_version": "1.8.0", "animations": {
            f"animation.ponce.{hname}.snap": {"loop": True, "bones": {
                "jaw": {"rotation": ["math.max(0, math.sin(query.anim_time * 150)) * 30", 0, 0]},
                "head": {"rotation": ["math.sin(query.anim_time * 70) * 6", 0, 0]}}}}})
        write_json(f"{RP}/entity/{hname}.entity.json", m.rp_entity(
            hident, hname, {"snap": f"animation.ponce.{hname}.snap", "look_at_target": "animation.common.look_at_target"},
            ["snap", "look_at_target"], ("#30604C", "#FFDC3C")))

    def fang(img):
        for i, w in enumerate([3, 3, 3, 2, 2, 2, 1, 1, 1]):
            for dx in range(w):
                img.putpixel((6 + dx, 3 + i), (235, 240, 200, 255) if i < 6 else (160, 220, 90, 255))
    m.drop_item("hydra_fang", "§aHydra Fang", fang)
    m.drop_item("hydra_scale", "§aHydra Scale", lambda img: (blob(img, 7.5, 7.5, 5.5, 6, (48, 96, 76, 255), noise=8),
                                                           blob(img, 6.5, 6, 2, 2, (90, 150, 120, 255), noise=6)))

    # Mire Lure: blown inside the Hydra Pool to call the guardian
    def lure(img):
        blob(img, 7.5, 9, 5, 4, (60, 76, 42, 255), noise=10)
        blob(img, 7.5, 6, 2.5, 2.5, (120, 230, 200, 255), noise=6)
        for x, y in ((5, 10), (10, 10), (7, 12)):
            img.putpixel((x, y), (240, 235, 220, 255))
    m.drop_item("mire_lure", "§aMire Lure", lure, extra={
        "minecraft:max_stack_size": 1, "minecraft:cooldown": {"category": "ponce_horn", "duration": 2}})
    write_json(f"{BP}/recipes/mire_lure.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "ponce:mire_lure"}, "tags": ["crafting_table"],
        "pattern": ["TWT", "WSW", "TWT"],
        "key": {"T": {"item": "ponce:gator_tooth"}, "W": {"item": "ponce:wisp_essence"}, "S": {"item": "ponce:frog_skin"}},
        "unlock": [{"item": "ponce:gator_tooth"}], "result": {"item": "ponce:mire_lure"}}})


def resources():
    path = f"{RP}/textures/item_texture.json"
    data = json.load(open(path))
    data["texture_data"].update(m.ITEM_TEXTURES)
    write_json(path, data)

    sounds_path = f"{RP}/sounds.json"
    sounds = json.load(open(sounds_path))
    sounds["entity_sounds"]["entities"].update({
        "ponce:bog_frog": {"volume": 0.9, "pitch": [0.6, 0.8], "events": {
            "ambient": "mob.frog.ambient", "hurt": "mob.frog.hurt", "death": "mob.frog.death", "step": {"sound": "mob.frog.step", "volume": 0.3}}},
        "ponce:will_o_wisp": {"volume": 0.6, "pitch": [1.6, 1.9], "events": {
            "ambient": "mob.allay.idle", "hurt": "mob.allay.hurt", "death": "mob.allay.death"}},
        "ponce:mire_shambler": {"volume": 1.0, "pitch": [0.5, 0.7], "events": {
            "ambient": "mob.drowned.say", "hurt": "mob.drowned.hurt", "death": "mob.drowned.death", "step": {"sound": "mob.drowned.step", "volume": 0.4}}},
        "ponce:marsh_gator": {"volume": 1.0, "pitch": [0.5, 0.7], "events": {
            "hurt": "mob.hoglin.hurt", "death": "mob.hoglin.death", "attack": "mob.hoglin.attack", "step": {"sound": "mob.turtle.step", "volume": 0.4}}},
        "ponce:mire_hydra": {"volume": 2.0, "pitch": [0.4, 0.5], "events": {
            "ambient": "mob.enderdragon.growl", "step": {"sound": "mob.ravager.step", "volume": 0.8}}},
        "ponce:hydra_head": {"volume": 1.5, "pitch": [0.5, 0.7], "events": {
            "hurt": "mob.ravager.hurt", "death": "mob.ravager.death", "ambient": "mob.ravager.ambient"}},
        "ponce:hydra_head_acid": {"volume": 1.5, "pitch": [0.6, 0.8], "events": {
            "hurt": "mob.ravager.hurt", "death": "mob.ravager.death", "ambient": "mob.ravager.ambient"}},
    })
    write_json(sounds_path, sounds)

    # Mist for the marsh (pushed onto players by script while they're on Floor 2)
    write_json(f"{RP}/fogs/marsh_fog.json", {"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": "ponce:marsh_fog"},
        "distance": {
            "air": {"fog_start": 10, "fog_end": 64, "fog_color": "#A7B8AC", "render_distance_type": "fixed"},
            "water": {"fog_start": 0, "fog_end": 10, "fog_color": "#4C6656", "render_distance_type": "fixed"},
        }}})

    names = {"bog_frog": "Bog Frog", "will_o_wisp": "Will-o'-Wisp", "mire_shambler": "Mire Shambler", "marsh_gator": "Marsh Gator",
             "mire_hydra": "Mire Hydra", "hydra_head": "Hydra Head", "hydra_head_acid": "Hydra Head (Acid)"}
    langp = f"{RP}/texts/en_US.lang"
    lines = [l for l in open(langp).read().splitlines() if not any(f"ponce:{k}." in l for k in names)]
    for k, n in names.items():
        lines += [f"entity.ponce:{k}.name={n}", f"item.spawn_egg.entity.ponce:{k}.name={n} Spawn Egg"]
    with open(langp, "w") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    bog_frog()
    will_o_wisp()
    mire_shambler()
    marsh_gator()
    mire_hydra()
    resources()
    print("Generated Floor 2 creatures.")
