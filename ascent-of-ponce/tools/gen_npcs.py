#!/usr/bin/env python3
"""Generates the quest-giver NPCs: behavior + client entity files and
placeholder skins on the standard humanoid (player-shaped) model.

Run from the add-on folder:  python3 tools/gen_npcs.py
Their quests, dialogue and shops live in behavior_pack/scripts/quests_data.js.
"""
import json
import os
import random
from PIL import Image

BP, RP = "behavior_pack", "resource_pack"
random.seed(23)

SKIN = (224, 172, 140)

# key, display name, egg colors, look
NPCS = [
    ("npc_guild", "Marla, the Guildmistress", ("#AA2828", "#E0AC8C"),
     {"hair": (150, 70, 40), "shirt": (170, 40, 40), "trim": (220, 180, 60), "pants": (90, 60, 40), "boots": (50, 36, 28), "eyes": (60, 140, 70)}),
    ("npc_smith", "Old Bram, the Smith", ("#5A5A5E", "#8C5A32"),
     {"hair": (170, 170, 170), "beard": (190, 190, 190), "shirt": (110, 110, 116), "apron": (120, 78, 44),
      "pants": (60, 56, 52), "boots": (40, 32, 28), "eyes": (60, 80, 120), "skin": (200, 150, 115)}),
    ("npc_warden", "Ysolde, the Marsh Warden", ("#3C5A3C", "#78E6C8"),
     {"hair": (30, 70, 70), "shirt": (60, 90, 56), "trim": (120, 230, 200), "pants": (70, 60, 44), "boots": (40, 46, 34), "eyes": (60, 160, 140)}),
    ("npc_cook", "Pip, the Cook", ("#F0F0F0", "#3C64B4"),
     {"hair": (240, 240, 240), "hat": True, "shirt": (235, 235, 230), "pants": (60, 100, 180), "boots": (60, 40, 30),
      "eyes": (90, 60, 40), "cheeks": (235, 140, 140)}),
]


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def jitter(c, n=6):
    d = random.randint(-n, n)
    return tuple(max(0, min(255, v + d)) for v in c[:3]) + (255,)


def faces(u, v, w, h, d):
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d), "right": (u, v + d, d, h),
            "front": (u + d, v + d, w, h), "left": (u + d + w, v + d, d, h), "back": (u + 2 * d + w, v + d, w, h)}


def fill(img, rect, color, rows=None):
    x, y, w, h = rect
    for j in range(h):
        if rows and not (rows[0] <= j < rows[1]):
            continue
        for i in range(w):
            img.putpixel((x + i, y + j), jitter(color))


def skin(look):
    """64x64 texture in the standard humanoid (player skin) layout."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    sk = look.get("skin", SKIN)
    head = faces(0, 0, 8, 8, 8)
    for f in head.values():
        fill(img, f, sk)
    fill(img, head["top"], look["hair"])
    for f in ("right", "left", "back"):
        fill(img, head[f], look["hair"], rows=(0, 3 if f != "back" else 6))
    fill(img, head["front"], look["hair"], rows=(0, 2))
    if look.get("hat"):  # chef's hat
        for f in ("right", "left", "back", "front"):
            fill(img, head[f], (250, 250, 250), rows=(0, 3))
    fx, fy = head["front"][:2]
    for ex in (fx + 1, fx + 5):
        img.putpixel((ex, fy + 4), (250, 250, 250, 255))
        img.putpixel((ex + 1, fy + 4), look["eyes"] + (255,))
    if "beard" in look:
        for f in ("front", "right", "left"):
            fill(img, head[f], look["beard"], rows=(6, 8))
        fill(img, (fx + 2, fy + 5, 4, 1), look["beard"])
    else:
        fill(img, (fx + 3, fy + 6, 2, 1), (170, 90, 80))
    if "cheeks" in look:
        img.putpixel((fx + 1, fy + 5), look["cheeks"] + (255,))
        img.putpixel((fx + 6, fy + 5), look["cheeks"] + (255,))

    body = faces(16, 16, 8, 12, 4)
    for f in body.values():
        fill(img, f, look["shirt"])
    if "trim" in look:
        fill(img, (body["front"][0] + 3, body["front"][1], 2, 12), look["trim"])
        fill(img, body["front"], look["trim"], rows=(9, 10))
    if "apron" in look:
        bx, by = body["front"][:2]
        fill(img, (bx + 1, by + 2, 6, 10), look["apron"])

    for uv in ((40, 16), (32, 48)):  # arms
        for name, f in faces(*uv, 4, 12, 4).items():
            fill(img, f, look["shirt"])
            if name not in ("top",):
                fill(img, f, look.get("skin", SKIN), rows=(9, 12) if name != "bottom" else (0, 4))
    for uv in ((0, 16), (16, 48)):  # legs
        for name, f in faces(*uv, 4, 12, 4).items():
            fill(img, f, look["pants"])
            if name != "top":
                fill(img, f, look["boots"], rows=(9, 12) if name != "bottom" else (0, 4))
    return img


def main():
    lang = []
    for key, name, egg, look in NPCS:
        ident = f"ponce:{key}"
        write_json(f"{BP}/entities/{key}.json", {"format_version": "1.21.40", "minecraft:entity": {
            "description": {"identifier": ident, "is_spawnable": True, "is_summonable": True},
            "components": {
                "minecraft:type_family": {"family": ["ponce_npc", "npc"]},
                "minecraft:health": {"value": 20, "max": 20},
                "minecraft:damage_sensor": {"triggers": [{"cause": "all", "deals_damage": "no"}]},
                "minecraft:collision_box": {"width": 0.6, "height": 1.8},
                "minecraft:physics": {},
                "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
                "minecraft:knockback_resistance": {"value": 1},
                "minecraft:movement": {"value": 0},
                "minecraft:movement.basic": {},
                "minecraft:persistent": {},
                "minecraft:fire_immune": {},
                "minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False},
                "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
                "minecraft:behavior.look_at_player": {"priority": 1, "look_distance": 8, "probability": 1.0},
                "minecraft:behavior.random_look_around": {"priority": 2},
            },
        }})
        write_json(f"{RP}/entity/{key}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {
            "description": {
                "identifier": ident,
                "materials": {"default": "entity_alphatest"},
                "textures": {"default": f"textures/entity/{key}"},
                "geometry": {"default": "geometry.humanoid.custom"},
                "render_controllers": ["controller.render.default"],
                "animations": {"look_at_target": "animation.common.look_at_target"},
                "scripts": {"animate": ["look_at_target"]},
                "spawn_egg": {"base_color": egg[0], "overlay_color": egg[1]},
            }}})
        os.makedirs(f"{RP}/textures/entity", exist_ok=True)
        skin(look).save(f"{RP}/textures/entity/{key}.png")
        lang += [f"entity.{ident}.name={name}", f"item.spawn_egg.entity.{ident}.name={name} Spawn Egg"]

    langp = f"{RP}/texts/en_US.lang"
    lines = [l for l in open(langp).read().splitlines() if ":npc_" not in l]
    with open(langp, "w") as f:
        f.write("\n".join(lines + lang) + "\n")
    print(f"Generated {len(NPCS)} NPCs.")


if __name__ == "__main__":
    main()
