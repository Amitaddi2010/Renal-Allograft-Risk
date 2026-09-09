"""
prepare_about_images.py — build the About-section portraits in ../images/.

    python tools/prepare_about_images.py

Takes the three supplied photographs, crops each to the person, downscales to a
web-sized portrait and writes a progressive JPEG. Re-runnable: it always rebuilds
from the sources, so a crop box can be edited and the script simply run again.

The Amit source is a marketing poster ("Research Innovate Build" plus a column of
stat tiles). The crop removes that furniture at the pixel level rather than hiding
it with CSS, so the shipped asset carries no baked-in text — the same figures are
rendered as live cards on the page instead.

Crop boxes are (left, top, right, bottom) in source pixels.
"""
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: python -m pip install Pillow")

SRC_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "images")

# name -> (source file, crop box, output size)

# Every box is 4:5, matching the card frame, so the browser never crops a second
# time and all three portraits share one head-and-shoulders framing.
JOBS = {
    "heera-singh.jpg": (
        "Heera Singh.jpg",
        (150, 55, 470, 455),         # 600x600 event photo: pull in so the staircase falls away
        (560, 700),
    ),
    "amit-raj-saraswat.jpg": (
        "Amit raj saraswat.jpeg",
        # 1024x1536 poster. The script lettering runs to about x=324 and the divider before
        # the stat column sits near x=696, so the box is held between 340 and 690 to keep
        # both out of frame entirely.
        (340, 50, 690, 488),
        (560, 700),
    ),
    # Supplied as a letterboxed screenshot: the photo sits at (48, 74)-(648, 599),
    # and this 4:5 box is centred on the face inside that region.
    "dr-ritu-aggarwal.jpg": (
        os.path.join(os.path.expanduser("~"), "Pictures", "Screenshots", "Screenshot 2026-09-09 101909.png"),
        (140, 74, 560, 599),
        (560, 700),
    ),
    "dr-siddhartha-sharma.jpg": (
        "Dr Siddhartha Sharma.jpeg",
        (230, 28, 950, 928),         # 1179x1009 headshot: 4:5 box centred on the face
        (560, 700),
    ),
}


def build(out_name, src_name, box, size):
    src_path = src_name if os.path.isabs(src_name) else os.path.join(SRC_DIR, src_name)
    if not os.path.exists(src_path):
        print("  MISSING source: %s" % src_path)
        return False
    with Image.open(src_path) as im:
        original = im.size
        if box is None:                                   # centre the largest 4:5 box
            w, h = im.size
            target = size[0] / float(size[1])
            if w / float(h) > target:                     # too wide: trim the sides
                nw = int(h * target); left = (w - nw) // 2
                box = (left, 0, left + nw, h)
            else:                                         # too tall: trim top and bottom
                nh = int(w / target); top = int((h - nh) * 0.35)   # bias upward, faces sit high
                box = (0, top, w, top + nh)
        im = im.convert("RGB").crop(box)
        cropped = im.size
        im = im.resize(size, Image.LANCZOS)
        out_path = os.path.join(OUT_DIR, out_name)
        im.save(out_path, "JPEG", quality=82, optimize=True, progressive=True)
    kb = os.path.getsize(out_path) / 1024.0
    print("  %-26s %s -> crop %s -> %s  (%.0f kB)" % (out_name, original, cropped, size, kb))
    return True


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("writing to %s" % os.path.normpath(OUT_DIR))
    ok = sum(build(out, src, box, size) for out, (src, box, size) in JOBS.items())
    print("%d of %d images written" % (ok, len(JOBS)))
    return 0 if ok == len(JOBS) else 1


if __name__ == "__main__":
    sys.exit(main())
