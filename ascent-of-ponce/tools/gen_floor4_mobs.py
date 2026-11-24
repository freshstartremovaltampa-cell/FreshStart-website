#!/usr/bin/env python3
"""Generates the Floor 4 (Frozen Peaks) creatures: Frost Wolf, Glacier Beetle,
Rime Troll, Ice Wraith, and the guardian Rimegrasp, the Frost Giant. Also their
drops, the Frost Sigil that summons the guardian, and lang entries.

Run from the add-on folder after gen_mobs.py:  python3 tools/gen_floor4_mobs.py
Floor 4 mobs have no natural spawn rules: the floor's spawner places them.
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
random.seed(404)
cube, paint_box, fill, blob, eyes, write_json = m.cube, m.paint_box, m.fill, m.blob, m.eyes, m.write_json

ICE, ICE_DARK, SNOW = (170, 214, 240), (110, 160, 200), (238, 244, 250)


def walker_anims(name, amp=45, head=True):
    bones = {"leg0": {"rotation": [swing(amp), 0, 0]}, "leg3": {"rotation": [swing(amp), 0, 0]},
             "leg1": {"rotation": [f"-{swing(amp)}", 0, 0]}, "leg2": {"rotation": [f"-{swing(amp)}", 0, 0]}}
    if head:
        bones["head"] = {"rotation": ["math.sin(query.anim_time * 60) * 3", 0, 0]}
    return {f"animation.ponce.{name}.walk": {"loop": True, "bones": bones}}


# ================================================================ FROST WOLF (Lv 22)

def frost_wolf():
    ident, name = "ponce:frost_wolf", "frost_wolf"
    comps = m.base_components(["frost_wolf", "monster"], hp=70, damage=8, speed=0.32, box=(0.8, 0.9), loot=name)
    comps.update({
        # Hunts in packs: hurting one brings the rest
        "minecraft:behavior.hurt_by_target": {"priority": 1, "alert_same_type": True},
        "minecraft:behavior.leap_at_target": {"priority": 2, "yd": 0.4, "must_be_on_ground": True},
        "minecraft:behavior.melee_attack": {"priority": 3, "speed_multiplier": 1.5, "track_target": True, "cooldown_time": 1.0},
        **m.hostile_to_players(16),
    })
    legs = [("leg0", [-3, 0, -5], [0, 20]), ("leg1", [1, 0, -5], [8, 20]), ("leg2", [-3, 0, 4], [16, 20]), ("leg3", [1, 0, 4], [24, 20])]
    bones = [
        {"name": "body", "pivot": [0, 8, 0], "cubes": [cube([-3, 6, -6], [6, 6, 12], [0, 0]), cube([-1, 8, 6], [2, 2, 7], [36, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 10, -6], "cubes": [
            cube([-3, 8, -11], [6, 6, 5], [36, 10]), cube([-1.5, 8, -14], [3, 3, 3], [36, 22]),
            cube([-3, 14, -9], [2, 2, 1], [48, 22]), cube([1, 14, -9], [2, 2, 1], [48, 26])]},
    ] + [{"name": n, "parent": "body", "pivot": [o[0] + 1, 6, o[2] + 1], "cubes": [cube(o, [2, 6, 2], uv)]} for n, o, uv in legs]

    def paint(img):
        fur, grey = (226, 234, 242), (150, 164, 180)
        paint_box(img, (0, 0), (6, 6, 12), {"default": fur, "top": grey}, noise=14)
        paint_box(img, (36, 0), (2, 2, 7), {"default": fur}, noise=10)
        paint_box(img, (36, 10), (6, 6, 5), {"default": fur, "top": grey}, noise=12)
        paint_box(img, (36, 22), (3, 3, 3), {"default": fur}, noise=8)
        for uv in ((48, 22), (48, 26)):
            paint_box(img, uv, (2, 2, 1), {"default": grey}, noise=8)
        for _, _, uv in legs:
            paint_box(img, uv, (2, 6, 2), {"default": fur, "bottom": grey}, noise=10)
        eyes(img, 42, 17, 3, (110, 200, 255, 255))
        img.putpixel((40, 25), (40, 40, 50, 255))

    anims = walker_anims(name, 50)
    anims[f"animation.ponce.{name}.walk"]["bones"]["body"] = {"rotation": [0, 0, 0]}
    entity_files(ident, name, comps, bones, (64, 32), paint, anims, None, ("#E2EAF2", "#6EC8FF"),
                 loot_table=m.loot(("ponce:frost_pelt", 1, 2, 1), ("ponce:wolf_fang", 0, 1, 1), ("minecraft:mutton", 0, 2, 1)), bounds=(1.5, 1.2))
    m.drop_item("frost_pelt", "§fFrost Pelt", lambda img: (fill(img, 3, 3, 10, 10, (226, 234, 242, 255), noise=16),
                                                         [img.putpixel((x, random.randint(3, 12)), (150, 164, 180, 255)) for x in range(3, 13, 2)]))

    def fang(img):
        for i, (x, y) in enumerate([(6, 3), (6, 4), (7, 5), (7, 6), (7, 7), (8, 8), (8, 9), (8, 10), (9, 11), (9, 12)]):
            img.putpixel((x, y), (240, 240, 230, 255))
            img.putpixel((x + 1, y), (200, 205, 200, 255) if i < 8 else (240, 240, 230, 255))
    m.drop_item("wolf_fang", "§fWolf Fang", fang)


# ================================================================ GLACIER BEETLE (Lv 23)

def glacier_beetle():
    ident, name = "ponce:glacier_beetle", "glacier_beetle"
    comps = m.base_components(["beetle", "monster"], hp=95, damage=9, speed=0.2, box=(1.2, 0.8), loot=name)
    comps.update({
        # An ice shell: hits deal 40% less damage (the script also checks this family)
        "minecraft:knockback_resistance": {"value": 0.8},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.3, "track_target": True, "cooldown_time": 1.6},
        **m.hostile_to_players(10),
    })
    comps["minecraft:type_family"]["family"].append("ponce_armored")
    legs = [("leg0", [-6, 0, -4], [0, 22]), ("leg1", [4, 0, -4], [6, 22]), ("leg2", [-6, 0, 3], [12, 22]), ("leg3", [4, 0, 3], [18, 22])]
    bones = [
        {"name": "body", "pivot": [0, 4, 0], "cubes": [cube([-5, 2, -6], [10, 5, 12], [0, 0]), cube([-4, 7, -5], [8, 2, 10], [44, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 4, -6], "cubes": [
            cube([-3, 2, -10], [6, 4, 4], [24, 22]), cube([-4, 3, -13], [2, 1, 4], [44, 12]), cube([2, 3, -13], [2, 1, 4], [44, 17])]},
    ] + [{"name": n, "parent": "body", "pivot": [o[0] + 1, 3, o[2] + 0.5], "cubes": [cube(o, [2, 3, 1], uv)]} for n, o, uv in legs]

    def paint(img):
        paint_box(img, (0, 0), (10, 5, 12), {"default": (70, 90, 120), "top": ICE}, noise=12)
        paint_box(img, (44, 0), (8, 2, 10), {"default": ICE, "top": (220, 240, 255)}, noise=14)
        paint_box(img, (24, 22), (6, 4, 4), {"default": (60, 76, 100)}, noise=10)
        for uv in ((44, 12), (44, 17)):
            paint_box(img, uv, (2, 1, 4), {"default": ICE_DARK}, noise=8)
        for _, _, uv in legs:
            paint_box(img, uv, (2, 3, 1), {"default": (50, 60, 80)}, noise=8)
        eyes(img, 28, 27, 2, (150, 230, 255, 255))

    entity_files(ident, name, comps, bones, (128, 32), paint, walker_anims(name, 40), None, ("#465A78", "#AAD6F0"),
                 loot_table=m.loot(("ponce:glacier_shell", 1, 1, 1), ("ponce:frost_shard", 0, 2, 1)), bounds=(2, 1))
    m.drop_item("glacier_shell", "§bGlacier Shell", lambda img: (blob(img, 7.5, 8, 6, 5, (70, 90, 120, 255), noise=10),
                                                               blob(img, 7.5, 6.5, 4.5, 3, (170, 214, 240, 255), noise=12)))
    m.drop_item("frost_shard", "§bFrost Shard", lambda img: [img.putpixel((x, y), (190, 230, 250, 255) if (x + y) % 3 else (240, 250, 255, 255))
                                                              for y in range(3, 13) for x in range(8 - (y - 3) // 3, 9 + (y - 3) // 3)])


# ================================================================ RIME TROLL (Lv 24)

def rime_troll():
    ident, name = "ponce:rime_troll", "rime_troll"
    comps = m.base_components(["troll", "monster"], hp=180, damage=13, speed=0.2, box=(1.2, 2.6), loot=name)
    comps.update({
        "minecraft:knockback_resistance": {"value": 0.9},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.2, "track_target": True, "cooldown_time": 2.2},
        **m.hostile_to_players(14),
    })
    bones = [
        {"name": "body", "pivot": [0, 18, 0], "cubes": [cube([-7, 14, -4], [14, 14, 8], [0, 0])]},
        {"name": "head", "parent": "body", "pivot": [0, 28, -2], "cubes": [cube([-4, 26, -8], [8, 7, 7], [44, 0]), cube([-2, 26, -10], [4, 3, 2], [74, 0])]},
        {"name": "arm_l", "parent": "body", "pivot": [8, 26, 0], "cubes": [cube([7, 6, -3], [5, 20, 6], [0, 22])]},
        {"name": "arm_r", "parent": "body", "pivot": [-8, 26, 0], "cubes": [cube([-12, 6, -3], [5, 20, 6], [22, 22])]},
        {"name": "leg0", "parent": "body", "pivot": [-3.5, 14, 0], "cubes": [cube([-6, 0, -3], [5, 14, 6], [44, 22])]},
        {"name": "leg1", "parent": "body", "pivot": [3.5, 14, 0], "cubes": [cube([1, 0, -3], [5, 14, 6], [66, 22])]},
    ]

    def paint(img):
        hide, frost = (110, 130, 140), (210, 232, 245)
        paint_box(img, (0, 0), (14, 14, 8), {"default": hide, "top": frost}, noise=16)
        paint_box(img, (44, 0), (8, 7, 7), {"default": hide, "top": frost}, noise=12)
        paint_box(img, (74, 0), (4, 3, 2), {"default": (90, 104, 110)}, noise=8)
        for uv in ((0, 22), (22, 22)):
            paint_box(img, uv, (5, 20, 6), {"default": hide}, noise=14)
        for uv in ((44, 22), (66, 22)):
            paint_box(img, uv, (5, 14, 6), {"default": (90, 104, 110)}, noise=12)
        px = img.load()
        for _ in range(160):  # rime crusted on the shoulders and back
            x, y = random.randint(0, 43), random.randint(0, 12)
            px[x, y] = m.jitter(frost, 10)
        eyes(img, 51, 9, 4, (120, 220, 255, 255))
        for x in (52, 57):  # tusks
            px[x, 12] = px[x, 13] = (240, 236, 220, 255)

    anims = {f"animation.ponce.{name}.walk": {"loop": True, "bones": {
        "leg0": {"rotation": [swing(30), 0, 0]}, "leg1": {"rotation": [f"-{swing(30)}", 0, 0]},
        "arm_l": {"rotation": [f"-{swing(20)}", 0, 0]}, "arm_r": {"rotation": [swing(20), 0, 0]}}}}
    entity_files(ident, name, comps, bones, (128, 64), paint, anims, None, ("#6E828C", "#D2E8F5"),
                 loot_table=m.loot(("ponce:troll_tusk", 1, 1, 1), ("ponce:frost_shard", 1, 2, 1)), bounds=(2, 3))

    def tusk(img):
        for i in range(9):
            img.putpixel((4 + i, 12 - i), (240, 236, 220, 255))
            img.putpixel((5 + i, 12 - i), (210, 204, 186, 255))
    m.drop_item("troll_tusk", "§fTroll Tusk", tusk)


# ================================================================ ICE WRAITH (Lv 25)

def ice_wraith():
    ident, name = "ponce:ice_wraith", "ice_wraith"
    comps = m.base_components(["wraith", "monster"], hp=55, damage=6, speed=0.26, box=(0.8, 1.6), loot=name)
    for k in ("minecraft:movement.basic", "minecraft:navigation.walk", "minecraft:jump.static",
              "minecraft:behavior.random_stroll", "minecraft:behavior.float"):
        comps.pop(k)
    comps.update({
        "minecraft:can_fly": {}, "minecraft:movement.hover": {}, "minecraft:flying_speed": {"value": 0.16},
        "minecraft:navigation.hover": {"can_path_over_water": True, "can_sink": False, "can_path_from_air": True},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}]},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.4, "track_target": True, "cooldown_time": 1.6},
        **m.hostile_to_players(16),
        "minecraft:behavior.random_hover": {"priority": 8, "xz_dist": 10, "y_dist": 4, "y_offset": 0, "interval": 1, "hover_height": [2, 5]},
    })
    bones = [
        {"name": "body", "pivot": [0, 12, 0], "cubes": [cube([-3, 8, -2], [6, 10, 4], [0, 0]), cube([-2, 2, -1.5], [4, 6, 3], [0, 14])]},
        {"name": "head", "parent": "body", "pivot": [0, 18, 0], "cubes": [cube([-3, 18, -3], [6, 6, 6], [20, 0])]},
        {"name": "arm_l", "parent": "body", "pivot": [3, 17, 0], "cubes": [cube([3, 9, -1], [2, 8, 2], [14, 14])]},
        {"name": "arm_r", "parent": "body", "pivot": [-3, 17, 0], "cubes": [cube([-5, 9, -1], [2, 8, 2], [22, 14])]},
    ]

    def paint(img):
        paint_box(img, (0, 0), (6, 10, 4), {"default": (190, 225, 245, 190)}, noise=10)
        paint_box(img, (0, 14), (4, 6, 3), {"default": (190, 225, 245, 110)}, noise=10)
        paint_box(img, (20, 0), (6, 6, 6), {"default": (220, 240, 252, 210)}, noise=8)
        for uv in ((14, 14), (22, 14)):
            paint_box(img, uv, (2, 8, 2), {"default": (190, 225, 245, 170)}, noise=8)
        for x in (27, 30):
            img.putpixel((x, 9), (40, 120, 200, 255))
            img.putpixel((x, 10), (40, 120, 200, 255))

    anims = {f"animation.ponce.{name}.float": {"loop": True, "bones": {
        "body": {"position": [0, "math.sin(query.anim_time * 100) * 1.2", 0]},
        "arm_l": {"rotation": ["-60 + math.sin(query.anim_time * 140) * 10", 0, 0]},
        "arm_r": {"rotation": ["-60 - math.sin(query.anim_time * 140) * 10", 0, 0]}}}}
    entity_files(ident, name, comps, bones, (64, 32), paint, anims, None, ("#BEE1F5", "#2878C8"),
                 loot_table=m.loot(("ponce:frost_essence", 1, 2, 1)), materials={"default": "entity_emissive_alpha"}, bounds=(1, 2))
    m.drop_item("frost_essence", "§bFrost Essence", lambda img: (blob(img, 7.5, 7.5, 5, 5, (190, 225, 245, 180), noise=8),
                                                               blob(img, 7.5, 7.5, 2.5, 2.5, (240, 250, 255, 255), noise=4)))


# ================================================================ RIMEGRASP, THE FROST GIANT (Floor 4 guardian)

def frost_giant():
    """A huge humanoid with an ice-headed club. The synced property ponce:pose (0 idle, 1 breath, 2 slam)
    raises his arms as a visible telegraph for the scripted attacks."""
    ident, name = "ponce:frost_giant", "frost_giant"
    comps = m.base_components(["giant", "monster", "ponce_boss"], hp=3400, damage=14, speed=0.22, box=(2.4, 7.5), loot=name)
    for k in ("minecraft:despawn", "minecraft:behavior.random_stroll", "minecraft:pushable", "minecraft:behavior.look_at_player"):
        comps.pop(k)
    comps.update({
        "minecraft:scale": {"value": 2.6},
        "minecraft:boss": {"should_darken_sky": True, "hud_range": 48},
        "minecraft:persistent": {},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:damage_sensor": {"triggers": [{"cause": "fall", "deals_damage": "no"}, {"cause": "suffocation", "deals_damage": "no"},
                                                 {"cause": "freezing", "deals_damage": "no"}]},
        "minecraft:experience_reward": {"on_death": "180"},
        "minecraft:follow_range": {"value": 40, "max": 40},
        "minecraft:behavior.hurt_by_target": {"priority": 1},
        "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.1, "track_target": True, "cooldown_time": 2.0},
        "minecraft:behavior.nearest_attackable_target": {
            "priority": 3, "must_see": False, "reselect_targets": True, "within_radius": 32, "entity_types": m.PLAYER_TARGET},
        "minecraft:behavior.look_at_player": {"priority": 4, "look_distance": 32},
    })
    groups = {"ponce:enraged": {"minecraft:attack": {"damage": 18}, "minecraft:movement": {"value": 0.27}}}
    events = {"ponce:enrage": {"add": {"component_groups": ["ponce:enraged"]}}}
    ent = m.bp_entity(ident, comps, groups, events)
    ent["minecraft:entity"]["description"]["properties"] = {"ponce:pose": {"type": "int", "range": [0, 2], "default": 0, "client_sync": True}}
    write_json(f"{BP}/entities/{name}.json", ent)
    write_json(f"{BP}/loot_tables/entities/{name}.json", m.loot(
        ("ponce:frozen_heart", 1, 1, 1), ("ponce:frost_shard", 4, 6, 1), ("ponce:frost_essence", 2, 3, 1), ("ponce:frost_pelt", 2, 4, 1)))

    bones = [
        {"name": "body", "pivot": [0, 14, 0], "cubes": [cube([-7, 14, -4], [14, 14, 8], [0, 0]), cube([-7.5, 12, -4.5], [15, 3, 9], [0, 52])]},
        {"name": "head", "parent": "body", "pivot": [0, 28, 0], "cubes": [
            cube([-4, 28, -4], [8, 8, 8], [44, 0]),
            cube([-4, 24, -5], [8, 6, 1], [100, 32]),  # long frosty beard
            cube([-5, 35, -5], [10, 2, 10], [44, 16])]},  # crown of ice
        {"name": "arm_l", "parent": "body", "pivot": [9, 26, 0], "cubes": [cube([7, 12, -2.5], [5, 15, 5], [0, 22])]},
        {"name": "arm_r", "parent": "body", "pivot": [-9, 26, 0], "cubes": [cube([-12, 12, -2.5], [5, 15, 5], [20, 22])]},
        {"name": "club", "parent": "arm_r", "pivot": [-9.5, 13, 0], "cubes": [
            cube([-10.5, 11.5, -13], [2, 2, 14], [90, 0]),
            cube([-12.5, 9.5, -19], [6, 6, 6], [90, 16])]},
        {"name": "leg0", "parent": "body", "pivot": [-3.5, 14, 0], "cubes": [cube([-6.5, 0, -3], [6, 14, 6], [40, 32])]},
        {"name": "leg1", "parent": "body", "pivot": [3.5, 14, 0], "cubes": [cube([0.5, 0, -3], [6, 14, 6], [64, 32])]},
    ]
    img = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
    skin, fur, belt = (150, 190, 214), (220, 228, 236), (90, 70, 56)
    paint_box(img, (0, 0), (14, 14, 8), {"default": fur, "top": fur}, noise=14)
    paint_box(img, (0, 52), (15, 3, 9), {"default": belt}, noise=10)
    paint_box(img, (44, 0), (8, 8, 8), {"default": skin, "top": (240, 246, 252)}, noise=10)
    paint_box(img, (100, 32), (8, 6, 1), {"default": (240, 246, 252)}, noise=10)
    paint_box(img, (44, 16), (10, 2, 10), {"default": ICE, "top": (220, 240, 255)}, noise=12)
    for uv in ((0, 22), (20, 22)):
        paint_box(img, uv, (5, 15, 5), {"default": skin}, noise=10)
        fill(img, uv[0], uv[1] + 5 + 9, 20, 3, fur, noise=8)  # fur cuffs
    for uv in ((40, 32), (64, 32)):
        paint_box(img, uv, (6, 14, 6), {"default": fur, "bottom": (60, 50, 44)}, noise=12)
    paint_box(img, (90, 0), (2, 2, 14), {"default": (100, 76, 54)}, noise=8)
    paint_box(img, (90, 16), (6, 6, 6), {"default": ICE, "top": (230, 245, 255)}, noise=14)
    px = img.load()
    fx, fy = 52, 8  # face
    px[fx + 1, fy + 3] = px[fx + 2, fy + 3] = px[fx + 5, fy + 3] = px[fx + 6, fy + 3] = (60, 170, 255, 255)
    for x in range(fx + 1, fx + 7):  # heavy frosted brow
        px[x, fy + 2] = (240, 246, 252, 255)
    save(img, f"{RP}/textures/entity/{name}.png")
    write_json(f"{RP}/models/entity/{name}.geo.json", m.geometry(f"geometry.ponce.{name}", 128, 64, bones, bounds=(6, 10)))

    write_json(f"{RP}/animations/{name}.animation.json", {"format_version": "1.8.0", "animations": {
        f"animation.ponce.{name}.walk": {"loop": True, "bones": {
            "leg0": {"rotation": [swing(28), 0, 0]}, "leg1": {"rotation": [f"-{swing(28)}", 0, 0]},
            "arm_l": {"rotation": [f"-{swing(18)}", 0, 0]}, "arm_r": {"rotation": [f"-30 + {swing(18)}", 0, 0]}}},
        f"animation.ponce.{name}.breath": {"loop": True, "bones": {
            "head": {"rotation": [-20, 0, 0]}, "arm_l": {"rotation": [-40, 0, -20]}, "arm_r": {"rotation": [-40, 0, 20]}}},
        f"animation.ponce.{name}.slam": {"loop": True, "bones": {
            "arm_r": {"rotation": [-170, 0, 0]}, "arm_l": {"rotation": [-150, 0, 0]}}},
    }})
    write_json(f"{RP}/animation_controllers/{name}.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        f"controller.animation.ponce.{name}": {"initial_state": "idle", "states": {
            "idle": {"transitions": [{"breath": "query.property('ponce:pose') == 1"}, {"slam": "query.property('ponce:pose') == 2"}]},
            "breath": {"animations": ["breath"], "transitions": [{"idle": "query.property('ponce:pose') != 1"}]},
            "slam": {"animations": ["slam"], "transitions": [{"idle": "query.property('ponce:pose') != 2"}]},
        }}}})
    write_json(f"{RP}/entity/{name}.entity.json", m.rp_entity(
        ident, name,
        {"walk": f"animation.ponce.{name}.walk", "breath": f"animation.ponce.{name}.breath", "slam": f"animation.ponce.{name}.slam",
         "pose": f"controller.animation.ponce.{name}", "look_at_target": "animation.common.look_at_target"},
        ["walk", "pose", "look_at_target"], ("#96BED6", "#E6F0FA")))

    m.drop_item("frozen_heart", "§bFrozen Heart", lambda img: (blob(img, 7.5, 8, 5.5, 5, (110, 180, 230, 255), noise=10),
                                                             blob(img, 6.5, 7, 2.5, 2, (230, 245, 255, 255), noise=6)))

    # Frost Sigil: raised inside the Frozen Cirque to challenge the guardian
    def sigil(img):
        for i in range(12):
            img.putpixel((7, 2 + i), (200, 230, 250, 255))
            img.putpixel((8, 2 + i), (150, 200, 235, 255))
        for d in range(1, 5):
            for (x, y) in ((7 - d, 7 - d), (8 + d, 7 - d), (7 - d, 7 + d), (8 + d, 7 + d)):
                img.putpixel((x, y), (220, 240, 255, 255))
    m.drop_item("frost_sigil", "§bFrost Sigil", sigil, extra={
        "minecraft:max_stack_size": 1, "minecraft:cooldown": {"category": "ponce_horn", "duration": 2}})
    write_json(f"{BP}/recipes/frost_sigil.json", {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": "ponce:frost_sigil"}, "tags": ["crafting_table"],
        "pattern": ["SES", "PTP", " S "],
        "key": {"S": {"item": "ponce:frost_shard"}, "E": {"item": "ponce:frost_essence"}, "P": {"item": "ponce:frost_pelt"},
                "T": {"item": "ponce:troll_tusk"}},
        "unlock": [{"item": "ponce:frost_shard"}], "result": {"item": "ponce:frost_sigil"}}})


def resources():
    path = f"{RP}/textures/item_texture.json"
    data = json.load(open(path))
    data["texture_data"].update(m.ITEM_TEXTURES)
    write_json(path, data)
    sounds_path = f"{RP}/sounds.json"
    sounds = json.load(open(sounds_path))
    sounds["entity_sounds"]["entities"].update({
        "ponce:frost_wolf": {"volume": 1.0, "pitch": [0.9, 1.1], "events": {
            "ambient": "mob.wolf.growl", "hurt": "mob.wolf.hurt", "death": "mob.wolf.death", "step": {"sound": "mob.wolf.step", "volume": 0.3}}},
        "ponce:glacier_beetle": {"volume": 0.8, "pitch": [0.7, 0.9], "events": {
            "hurt": "mob.spider.say", "death": "mob.spider.death", "step": {"sound": "mob.spider.step", "volume": 0.3}}},
        "ponce:rime_troll": {"volume": 1.2, "pitch": [0.6, 0.7], "events": {
            "ambient": "mob.polarbear.warning", "hurt": "mob.polarbear.hurt", "death": "mob.polarbear.death",
            "step": {"sound": "mob.polarbear.step", "volume": 0.6}}},
        "ponce:ice_wraith": {"volume": 0.8, "pitch": [1.2, 1.4], "events": {
            "ambient": "mob.vex.ambient", "hurt": "mob.vex.hurt", "death": "mob.vex.death"}},
        "ponce:frost_giant": {"volume": 2.0, "pitch": [0.4, 0.5], "events": {
            "ambient": "mob.irongolem.say", "hurt": "mob.irongolem.hit", "death": "mob.irongolem.death",
            "step": {"sound": "mob.irongolem.walk", "volume": 1.0}}},
    })
    write_json(sounds_path, sounds)
    names = {"frost_wolf": "Frost Wolf", "glacier_beetle": "Glacier Beetle", "rime_troll": "Rime Troll",
             "ice_wraith": "Ice Wraith", "frost_giant": "Rimegrasp, the Frost Giant"}
    langp = f"{RP}/texts/en_US.lang"
    lines = [l for l in open(langp).read().splitlines() if not any(f"ponce:{k}." in l for k in names)]
    for k, n in names.items():
        lines += [f"entity.ponce:{k}.name={n}", f"item.spawn_egg.entity.ponce:{k}.name={n} Spawn Egg"]
    with open(langp, "w") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    frost_wolf()
    glacier_beetle()
    rime_troll()
    ice_wraith()
    frost_giant()
    resources()
    print("Generated Floor 4 creatures.")
