# App icon, adaptive icon and splash images for mobile/assets, in the final Jade Palengke colours.
# Run from this folder: python3 -I app_assets.py  (writes SVGs to app-assets/; render them with render_png.py)
import os
exec(open("recolor.py").read().split("for key, p in D.items():")[0])   # D, rings(), y_receipt(), sticker(), svg()

p = D["B"]
# sticker y (y_receipt at cx=50, plus the 26-unit sticker spread and 7-unit shadow) spans x -26..133, y 52..283
BOX_H, BOX_CX, BOX_CY = 231, 53.5, 167.5

def place(body, h, cx=512, cy=512, box=(BOX_H, BOX_CX, BOX_CY)):
    s = h / box[0]
    return f'<g transform="translate({cx - s * box[1]:.1f} {cy - s * box[2]:.1f}) scale({s:.4f})">{body}</g>'

def y_sticker(shadow):
    return sticker(y_receipt(50, p["ink"]), p["edge"], p["ink"], shadow)

field = f'<rect width="1024" height="1024" fill="{p["ground"]}"/>' + rings(p, 1024, 1024, 40, 16, 160)
os.makedirs("app-assets", exist_ok=True)
files = {
    # legacy/iOS icon: full bleed, the system applies its own mask
    "icon": (1024, field + place(y_sticker(p["ink"]), 720)),
    # adaptive icon: y kept inside the 66% safe circle; the ring field is the separate background layer
    "adaptive-icon": (1024, place(y_sticker(p["ink"]), 500)),
    "adaptive-icon-background": (1024, field),
    # themed (monochrome) icon: Android uses alpha only, so the bare letter at the same size and position
    # (the bare y spans x 0..100, y 78..250, so it is scaled up to roughly the sticker's visual size)
    "adaptive-icon-monochrome": (1024, place(y_receipt(50, "#000000"), 440, box=(172, 50, 164))),
    # splash: Android 12+ crops the image to a centred circle, so the y stays well inside it
    "splash-icon": (512, place(y_sticker(p["ink"]), 260, 256, 256)),
    "splash-icon-dark": (512, place(y_sticker(p["dshadow"]), 260, 256, 256)),
}
for name, (size, body) in files.items():
    open(f"app-assets/{name}.svg", "w").write(svg(body, size, size, f"yaga {name}"))
print("ok")
