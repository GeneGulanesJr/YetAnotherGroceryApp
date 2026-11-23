# Round 1: logo C ("Full shop") in three finished treatments, plus the receipt-y app icon for each.
# Concept-stage note: holes are painted in the ground colour; production masters will use real (evenodd) holes.
W = 30
ADV = 128
X0 = 50

def svg(body, w, h, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><title>{title}</title>{body}</svg>\n'

def st(d, c, w=W, cap="round"):
    return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="{cap}" stroke-linejoin="round"/>'

def ring(cx, c):
    return f'<circle cx="{cx}" cy="128" r="35" fill="none" stroke="{c}" stroke-width="{W}"/>'

def y_receipt(cx, ink, top=93):
    u = f"M {cx-35} {top} V 128 A 35 35 0 0 0 {cx+35} 128"
    tail = f"M {cx+35} {top} V 200 A 35 35 0 0 1 {cx} 235 H {cx-14}"
    x = cx - 14
    tear = (f"M {x} {235-W/2} L {x-12} {235-W/2+5} L {x} {235-W/2+10} L {x-12} 235 "
            f"L {x} {235+W/2-10} L {x-12} {235+W/2-5} L {x} {235+W/2} Z")
    return st(u, ink) + st(tail, ink, cap="butt") + f'<path d="{tear}" fill="{ink}"/>' + st(f"M {cx+35} {top} V 150", ink)

def coin_a(cx, ink, detail):
    return ring(cx, ink) + st(f"M {cx+35} 93 V 163", ink) + f'<circle cx="{cx}" cy="128" r="35" fill="none" stroke="{detail}" stroke-width="5"/>'

def lens_g(cx, ink, glass, glint):
    return (ring(cx, ink) + st(f"M {cx+35} 93 V 200 A 35 35 0 0 1 {cx} 235 H {cx-22}", ink)
            + f'<circle cx="{cx}" cy="128" r="12" fill="{glass}"/>'
            + f'<circle cx="{cx}" cy="128" r="6.5" fill="none" stroke="{glint}" stroke-width="2.5"/>'
            + f'<circle cx="{cx-5}" cy="122.5" r="3.2" fill="{glint}"/>')

def tag_a(cx, ink, tagc, hole):
    x, h = cx + 35, W / 2
    tag = f"M {x-h} 163 V 78 L {x} 56 L {x+h} 78 V 163 A {h} {h} 0 0 1 {x-h} 163 Z"
    return ring(cx, ink) + f'<path d="{tag}" fill="{tagc}"/>' + f'<circle cx="{x}" cy="80" r="7.5" fill="{hole}"/>'

def word(ink, detail, glass, glint, tagc, hole):
    return (y_receipt(X0, ink) + coin_a(X0 + ADV, ink, detail) + lens_g(X0 + 2 * ADV, ink, glass, glint)
            + tag_a(X0 + 3 * ADV, ink, tagc, hole))

WW, WH = 494, 256
PAD = 40

def sticker(body, edge, outline, shadow):
    # die-cut sticker: thick edge colour around the letters, an outline round that, then a hard offset shadow
    halo = body.replace('stroke-width="30"', 'stroke-width="30"')  # same geometry, widened per layer below
    def widen(b, extra, colour):
        b = b.replace('stroke-width="30"', f'stroke-width="{30+extra}"').replace('stroke-width="5"', 'stroke-width="0"')
        b = b.replace('stroke-width="2.5"', 'stroke-width="0"')
        import re
        b = re.sub(r'(stroke|fill)="#[0-9A-Fa-f]{6}"', lambda m: f'{m.group(1)}="{colour}"', b)
        b = re.sub(r'<path d="([^"]+)" fill="([^"]+)"/>', lambda m: f'<path d="{m.group(1)}" fill="{m.group(2)}" stroke="{colour}" stroke-width="{extra}" stroke-linejoin="round"/>', b)
        b = re.sub(r'<circle ([^>]*?) fill="([^"]+)"/>', '', b)  # inner details stay on the face only
        return b
    # edge = 30+40 so it closes each counter fully; the outline shows 6 units outside it
    return (f'<g transform="translate(7 7)">{widen(body, 52, shadow)}</g>' + widen(body, 52, outline)
            + widen(body, 40, edge) + body)

def framed(inner, bg, w=WW + 2 * PAD, h=WH + 2 * PAD):
    return f'<rect width="{w}" height="{h}" rx="36" fill="{bg}"/><g transform="translate({PAD} {PAD})">{inner}</g>'

def app_icon(ink, bg, extra=""):
    # receipt y alone, centred on a 256 tile
    return (f'<rect width="256" height="256" rx="56" fill="{bg}"/>{extra}'
            f'<g transform="translate(62 -64) scale(1.15)">{y_receipt(50, ink)}</g>')

BUB = dict(bg="#FFD9EA", ink="#2B0A1E")
designs = {
    # 1: ink on Bubblegum, details in white
    "d1-bubblegum": (framed(word(BUB["ink"], "#FFD9EA", "#2B0A1E", "#FFFFFF", BUB["ink"], "#FFD9EA"), BUB["bg"]),
                     app_icon(BUB["ink"], BUB["bg"])),
    # 2: die-cut sticker on Bubblegum (white edge, ink outline, hard shadow) — the app's own sticker language
    "d2-sticker": (framed(sticker(word("#2B0A1E", "#FFFFFF", "#2B0A1E", "#FFFFFF", "#2B0A1E", "#FFFFFF"), "#FFFFFF", "#2B0A1E", "#2B0A1E"), BUB["bg"]),
                   app_icon("#2B0A1E", "#FFFFFF")),
    # 3: Night market: white letters, pink icons
    "d3-night": (framed(word("#FFFFFF", "#FF5C9A", "#FF5C9A", "#17151F", "#FFFFFF", "#17151F"), "#17151F"),
                 app_icon("#FFFFFF", "#17151F")),
}
for name, (wm, icon) in designs.items():
    open(f"{name}.svg", "w").write(svg(wm, WW + 2 * PAD, WH + 2 * PAD, f"yaga logo, {name}"))
    open(f"{name}-icon.svg", "w").write(svg(icon, 256, 256, f"yaga app icon, {name}"))
print("ok")
