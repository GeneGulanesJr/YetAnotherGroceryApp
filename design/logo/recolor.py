# Round 3: the approved d2 sticker wordmark recoloured in the three researched directions (money-grocery-research.md §4).
# Only colours and backgrounds change; geometry comes unchanged from designs.py (word, sticker, framed, app_icon transform).
import math
exec(open("designs.py").read().split("BUB = dict")[0])     # word(), sticker(), framed(), y_receipt(), svg()

D = {
    "A": dict(name="Sukli Resibo", ground="#FAF3E1", ink="#0F4D3A", edge="#FFFFFF", accent="#C8963E",
              pattern="#F0E6C8", dark="#121816", dshadow="#26332D"),
    "B": dict(name="Jade Palengke", ground="#1E8F86", ink="#0A1412", edge="#FFF6DC", accent="#E3F08A",
              pattern="#1A8178", dark="#0F2226", dshadow="#1F4A47"),
    "C": dict(name="Kalamansi", ground="#E3F08A", ink="#14170F", edge="#FFFFFF", accent="#E3F08A",
              pattern="#CEE06A", dark="#14170F", dshadow="#2E3520"),
}
CW, CH = 720, 420

def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]

def ratio(a, b):
    a, b = sorted([lum(a), lum(b)])
    return (b + .05) / (a + .05)

def face(p):
    # coin rim, lens glint and tag hole take the accent; lens glass and tag stay ink, as in d2
    return word(p["ink"], p["accent"], p["ink"], p["accent"], p["ink"], p["accent"])

def wm(p, dark=False):
    return sticker(face(p), p["edge"], p["ink"], p["dshadow"] if dark else p["ink"])

def rosette(p):
    # A: one guilloche rosette bleeding off the lower right, 9 wavy rings 18 px apart; alternate rings in antiphase
    # with amplitude > half the spacing so neighbours cross and weave (spec said 6·sin(24θ+0.4k), which read as hair)
    out = ""
    for k in range(9):
        pts = " ".join(f"{610 + (150 + 18 * k + 11 * math.sin(36 * t + math.pi * k)) * math.cos(t):.1f},"
                       f"{380 + (150 + 18 * k + 11 * math.sin(36 * t + math.pi * k)) * math.sin(t):.1f}"
                       for t in [i * 2 * math.pi / 720 for i in range(720)])
        out += f'<polygon points="{pts}" fill="none" stroke="{p["pattern"]}" stroke-width="2.5"/>'
    return out

def rings(p, w, h, r=14, sw=5, g=56):
    # B: tone-on-tone coin rings on a half-drop grid, running off every edge
    return "".join(f'<circle cx="{i * g + (g // 2 if j % 2 else 0)}" cy="{j * g}" r="{r - sw / 2}" fill="none" '
                   f'stroke="{p["pattern"]}" stroke-width="{sw}"/>'
                   for j in range(h // g + 2) for i in range(-1, w // g + 2))

def citrus(p):
    # C: one big coin/calamansi ring with 12 radial cuts, right side bleeding off
    cx, cy = 560, 210
    band = (f'<path fill-rule="evenodd" fill="{p["pattern"]}" d="M {cx - 250} {cy} a 250 250 0 1 0 500 0 a 250 250 0 1 0 -500 0 '
            f'M {cx - 196} {cy} a 196 196 0 1 0 392 0 a 196 196 0 1 0 -392 0 Z"/>')
    cuts = "".join(f'<line x1="{cx + 190 * math.cos(a):.1f}" y1="{cy + 190 * math.sin(a):.1f}" x2="{cx + 256 * math.cos(a):.1f}" '
                   f'y2="{cy + 256 * math.sin(a):.1f}" stroke="{p["ground"]}" stroke-width="6"/>'
                   for a in [i * math.pi / 6 + math.pi / 12 for i in range(12)])
    return band + cuts

PATTERN = {"A": rosette, "B": lambda p: rings(p, CW, CH), "C": citrus}

def on_bg(key, p):
    body = (f'<rect width="{CW}" height="{CH}" fill="{p["ground"]}"/>{PATTERN[key](p)}'
            f'<g transform="translate(98 82) rotate(-3 247 128)">{wm(p)}</g>')
    return f'<clipPath id="frame"><rect width="{CW}" height="{CH}" rx="36"/></clipPath><g clip-path="url(#frame)">{body}</g>'

def icon(key, p):
    # same tile as designs.app_icon; the sticker y is wider than the bare y, so it is scaled to fit the tile
    extra = ""
    if key == "B":   # uniform repeat survives adaptive-icon masks
        extra = f'<clipPath id="tile"><rect width="256" height="256" rx="56"/></clipPath><g clip-path="url(#tile)">{rings(p, 256, 256, 10, 4, 40)}</g>'
    y = sticker(y_receipt(50, p["ink"]), p["edge"], p["ink"], p["ink"])
    return f'<rect width="256" height="256" rx="56" fill="{p["ground"]}"/>{extra}<g transform="translate(92 -2) scale(0.78)">{y}</g>'

for key, p in D.items():
    # self-check: the contrast floors from the brief
    assert ratio(p["ink"], p["ground"]) >= 4.5 and ratio(p["ink"], p["edge"]) >= 4.5, key
    assert ratio(p["accent"], p["ink"]) >= 3 and ratio(p["edge"], p["dark"]) >= 3, key
    assert ratio(p["pattern"], p["ground"]) <= 1.25, key
    n = f"h-{key}"
    open(f"{n}-bg.svg", "w").write(svg(on_bg(key, p), CW, CH, f"yaga logo, {p['name']}, on background"))
    open(f"{n}-plain.svg", "w").write(svg(framed(wm(p), p["ground"]), WW + 2 * PAD, WH + 2 * PAD, f"yaga logo, {p['name']}"))
    open(f"{n}-dark.svg", "w").write(svg(framed(wm(p, True), p["dark"]), WW + 2 * PAD, WH + 2 * PAD, f"yaga logo, {p['name']}, dark"))
    open(f"{n}-icon.svg", "w").write(svg(icon(key, p), 256, 256, f"yaga app icon, {p['name']}"))
    print(key, " ".join(f"{a}/{b}={ratio(p[a], p[b]):.2f}" for a, b in
                        [("ink", "ground"), ("ink", "edge"), ("edge", "ground"), ("accent", "ink"), ("pattern", "ground"), ("edge", "dark")]))
