#!/usr/bin/env python3
"""Generates the work displays: small models that sit on top of the Smithing Forge
and the Cooking Pot while you work, so the job shows in the world, not just on a bar.

  ponce:forge_work    a blade blank on the forge. 9 sections (tip to tang) whose height
                      follows the synced properties ponce:s0..s8 (thickness 0-5); the whole
                      blade glows by ponce:heat (0 dull, 1 cherry, 2 orange, 3 yellow, 4 white).
  ponce:cook_display  what's cooking, by ponce:dish (0 grill, 1 stew, 2 bake, 3 roast):
                      the skewer turns (ponce:side), the stew swirls (ponce:stir, degrees) and
                      shows ingredients as they go in (ponce:added) in its own colour
                      (ponce:soup), the tart fills (ponce:fill), and food browns by ponce:cook (0-10).

The scripts (forging.js, cooking.js) spawn, update and remove them.
Run from the add-on folder after gen_mobs.py:  python3 tools/gen_displays.py
"""
import os
import random
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_mobs as m  # noqa: E402  (shared helpers)
from gen_floor2_mobs import save  # noqa: E402

BP, RP = m.BP, m.RP
random.seed(808)
cube, paint_box, fill, write_json = m.cube, m.paint_box, m.fill, m.write_json


def display_entity(ident, props):
    return {"format_version": "1.21.40", "minecraft:entity": {
        "description": {"identifier": ident, "is_spawnable": False, "is_summonable": True, "properties": props},
        "components": {
            "minecraft:type_family": {"family": ["ponce_display", "ponce_untargetable", "inanimate"]},
            "minecraft:health": {"value": 1, "max": 1},
            "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
            # A tiny box so it never gets in the way of hitting the forge or pot underneath
            "minecraft:collision_box": {"width": 0.01, "height": 0.01},
            "minecraft:physics": {"has_gravity": False, "has_collision": False},
            "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
            "minecraft:knockback_resistance": {"value": 1},
            "minecraft:fire_immune": {},
            "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
        },
    }}


def client_entity(ident, name, animations, scripts, controller):
    return {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": ident,
        "materials": {"default": "entity_alphatest"},
        "textures": {"default": f"textures/entity/{name}"},
        "geometry": {"default": f"geometry.ponce.{name}"},
        "render_controllers": [controller],
        "animations": animations,
        "scripts": {"animate": scripts},
    }}}


def render_controller(name, overlay):
    return {"format_version": "1.8.0", "render_controllers": {f"controller.render.ponce.{name}": {
        "geometry": "Geometry.default",
        "materials": [{"*": "Material.default"}],
        "textures": ["Texture.default"],
        "overlay_color": overlay,
        "is_hurt_color": {},
        "on_fire_color": {},
    }}}


def prop(name):
    return f"query.property('ponce:{name}')"


# ================================================================ FORGE: the blade blank

def forge_work():
    ident, name = "ponce:forge_work", "forge_work"
    props = {f"ponce:s{i}": {"type": "int", "range": [0, 5], "default": 5, "client_sync": True} for i in range(9)}
    props["ponce:heat"] = {"type": "int", "range": [0, 4], "default": 2, "client_sync": True}
    write_json(f"{BP}/entities/{name}.json", display_entity(ident, props))

    # Sections run along the model's x axis, tip at -x. The script turns the entity to face the way
    # the smith faces, so the tip is on their left, matching the on-screen outline.
    bones = [{"name": "blade", "pivot": [0, 0, 0]}]
    for i in range(9):
        x = -9 + 2 * i
        bones.append({"name": f"s{i}", "parent": "blade", "pivot": [x + 1, 0, 0], "cubes": [cube([x, 0, -1.5], [2, 5, 3], [0, 0])]})
    bones.append({"name": "grip", "parent": "blade", "pivot": [9, 1, 0], "cubes": [cube([9, 0.5, -1], [4, 2, 2], [0, 12])]})

    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    paint_box(img, (0, 0), (2, 5, 3), {"default": (128, 130, 136), "top": (170, 172, 178)}, noise=10)
    paint_box(img, (0, 12), (4, 2, 2), {"default": (96, 64, 40)}, noise=8)
    save(img, f"{RP}/textures/entity/{name}.png")
    write_json(f"{RP}/models/entity/{name}.geo.json", m.geometry(f"geometry.ponce.{name}", 32, 32, bones, bounds=(2, 1)))
    write_json(f"{RP}/animations/{name}.animation.json", {"format_version": "1.8.0", "animations": {
        f"animation.ponce.{name}.shape": {"loop": True, "bones": {
            f"s{i}": {"scale": [1, f"math.max(0.06, {prop(f's{i}')} / 5)", 1]} for i in range(9)}},
    }})
    h = prop("heat")
    write_json(f"{RP}/render_controllers/{name}.render_controllers.json", render_controller(name, {
        # dull grey, cherry red, orange, yellow, white-hot
        "r": f"{h} == 1 ? 0.8 : 1.0",
        "g": f"{h} == 1 ? 0.1 : ({h} == 2 ? 0.45 : ({h} == 3 ? 0.85 : 1.0))",
        "b": f"{h} == 4 ? 0.9 : ({h} == 3 ? 0.2 : 0.05)",
        "a": f"{h} == 0 ? 0.0 : 0.3 + {h} * 0.1",
    }))
    write_json(f"{RP}/entity/{name}.entity.json", client_entity(
        ident, name, {"shape": f"animation.ponce.{name}.shape"}, ["shape"], f"controller.render.ponce.{name}"))


# ================================================================ POT: what's cooking

SOUPS = [(118, 78, 44), (84, 104, 48), (140, 60, 40), (196, 150, 70)]  # hare, gumbo, highland, broth


def cook_display():
    ident, name = "ponce:cook_display", "cook_display"
    props = {
        "ponce:dish": {"type": "int", "range": [0, 3], "default": 1, "client_sync": True},
        "ponce:side": {"type": "int", "range": [0, 2], "default": 0, "client_sync": True},
        "ponce:stir": {"type": "int", "range": [0, 359], "default": 0, "client_sync": True},
        "ponce:added": {"type": "int", "range": [0, 3], "default": 0, "client_sync": True},
        "ponce:soup": {"type": "int", "range": [0, 3], "default": 0, "client_sync": True},
        "ponce:fill": {"type": "int", "range": [0, 10], "default": 0, "client_sync": True},
        "ponce:cook": {"type": "int", "range": [0, 10], "default": 0, "client_sync": True},
    }
    write_json(f"{BP}/entities/{name}.json", display_entity(ident, props))

    def ring(top, h, uv):  # a square rim around a 12x12 opening
        return [cube([-7, top, -7], [14, h, 1], uv), cube([-7, top, 6], [14, h, 1], uv),
                cube([-7, top, -6], [1, h, 12], uv), cube([6, top, -6], [1, h, 12], uv)]

    bones = [
        # Grill: a stick across the pot with three chunks of meat that turn with the skewer
        {"name": "grill", "pivot": [0, 0, 0], "cubes": [cube([-8, 3, -0.5], [16, 1, 1], [0, 60])]},
        {"name": "meat", "parent": "grill", "pivot": [0, 3.5, 0], "cubes": [
            cube([-6, 1.5, -2], [3, 4, 4], [0, 0]), cube([-1.5, 1.5, -2], [3, 4, 4], [0, 0]), cube([3, 1.5, -2], [3, 4, 4], [0, 0])]},
        # Stew: the pot's rim, a surface of soup in one of four colours, ingredients that swirl when stirred
        {"name": "stew", "pivot": [0, 0, 0], "cubes": ring(0, 2, [96, 40])},
    ]
    for k, uv in enumerate([[0, 16], [48, 16], [0, 30], [48, 30]]):
        bones.append({"name": f"soup{k}", "parent": "stew", "pivot": [0, 0, 0], "cubes": [cube([-6, 0.2, -6], [12, 1, 12], uv)]})
    bones.append({"name": "swirl", "parent": "stew", "pivot": [0, 1.2, 0]})
    for k, (x, z, uv) in enumerate([(3, 0, [96, 0]), (-2, 2.5, [104, 0]), (-2, -3, [112, 0])], start=1):
        bones.append({"name": f"bit{k}", "parent": "swirl", "pivot": [x, 1.5, z], "cubes": [cube([x - 1, 1, z - 1], [2, 1.2, 2], uv)]})
    bones += [
        # Bake: a tin, and the tart filling that rises as the batter is whisked
        {"name": "bake", "pivot": [0, 0, 0], "cubes": ring(0, 1.5, [96, 40])},
        {"name": "filling", "parent": "bake", "pivot": [0, 0.2, 0], "cubes": [cube([-6, 0.2, -6], [12, 2, 12], [0, 44])]},
        # Roast: a joint of meat with the bone sticking out
        {"name": "roast", "pivot": [0, 0, 0], "cubes": [
            cube([-4, 0, -3], [8, 5, 6], [56, 44]), cube([4, 2, -0.75], [4, 1.5, 1.5], [96, 30]), cube([-6, 2, -0.75], [2, 1.5, 1.5], [96, 30])]},
    ]

    img = Image.new("RGBA", (128, 64), (0, 0, 0, 0))
    paint_box(img, (0, 0), (3, 4, 4), {"default": (190, 96, 96), "top": (210, 120, 110)}, noise=12)
    px = img.load()
    for x in range(4, 7):  # grill marks on one face, so you can see the skewer turn
        for y in range(4, 8, 2):
            px[x, y] = (60, 30, 20, 255)
    paint_box(img, (0, 60), (16, 1, 1), {"default": (130, 96, 58)}, noise=8)
    for (u, v), col in zip([(0, 16), (48, 16), (0, 30), (48, 30)], SOUPS):
        paint_box(img, (u, v), (12, 1, 12), {"default": col, "top": col}, noise=10)
    for (u, v), col in zip([(96, 0), (104, 0), (112, 0)], [(230, 120, 40), (90, 140, 60), (220, 200, 150)]):
        paint_box(img, (u, v), (2, 1, 2), {"default": col}, noise=8)
    paint_box(img, (96, 40), (14, 2, 1), {"default": (70, 70, 76)}, noise=8)
    paint_box(img, (0, 44), (12, 2, 12), {"default": (210, 180, 120), "top": (190, 90, 140)}, noise=12)
    paint_box(img, (56, 44), (8, 5, 6), {"default": (176, 92, 80), "top": (196, 110, 96)}, noise=14)
    paint_box(img, (96, 30), (4, 1, 1), {"default": (236, 230, 214)}, noise=6)
    save(img, f"{RP}/textures/entity/{name}.png")
    write_json(f"{RP}/models/entity/{name}.geo.json", m.geometry(f"geometry.ponce.{name}", 128, 64, bones, bounds=(2, 1)))

    dish = prop("dish")
    show = lambda n: [f"{dish} == {n} ? 1 : 0"] * 3  # noqa: E731
    bones_anim = {
        "grill": {"scale": show(0)}, "stew": {"scale": show(1)}, "bake": {"scale": show(2)}, "roast": {"scale": show(3)},
        "meat": {"rotation": [f"{prop('side')} * 120", 0, 0]},
        "swirl": {"rotation": [0, prop("stir"), 0]},
        "filling": {"scale": [1, f"math.max(0.05, {prop('fill')} / 10)", 1]},
    }
    for k in range(4):
        bones_anim[f"soup{k}"] = {"scale": [f"{prop('soup')} == {k} ? 1 : 0"] * 3}
    for k in range(1, 4):
        bones_anim[f"bit{k}"] = {"scale": [f"{prop('added')} >= {k} ? 1 : 0"] * 3}
    write_json(f"{RP}/animations/{name}.animation.json", {"format_version": "1.8.0", "animations": {
        f"animation.ponce.{name}.show": {"loop": True, "bones": bones_anim}}})
    c = prop("cook")
    write_json(f"{RP}/render_controllers/{name}.render_controllers.json", render_controller(name, {
        # browning: golden brown as it cooks, almost black when burnt (10)
        "r": f"{c} >= 10 ? 0.08 : 0.45", "g": f"{c} >= 10 ? 0.06 : 0.25", "b": f"{c} >= 10 ? 0.05 : 0.05",
        "a": f"{c} >= 10 ? 0.75 : {c} * 0.055",
    }))
    write_json(f"{RP}/entity/{name}.entity.json", client_entity(
        ident, name, {"show": f"animation.ponce.{name}.show"}, ["show"], f"controller.render.ponce.{name}"))


if __name__ == "__main__":
    forge_work()
    cook_display()
    print("Generated the forge and pot work displays.")
