"""
prepare_about_images.py — build the About-section portraits in ../images/.

    python tools/prepare_about_images.py

Takes the three supplied photographs, crops each to the person, downscales to a
web-sized portrait and writes a progressive JPEG. Re-runnable: it always rebuilds
from the sources, so a crop box can be edited and the script simply run again.

The Amit source is a marketing poster ("Research Innovate Build" plus a column of
stat tiles). The lettering ends just short of his ear and the tiles begin just past
his hair, so a crop that avoids both clips the head. Instead the crop is widened to
a normal head-and-shoulders frame and the furniture inside it is painted out: the
lettering is filled from the surrounding navy blur, the tile edges and heading from
the white backdrop. The shipped asset carries no baked-in text — the same figures
are rendered as live cards on the page instead. Retouching needs numpy.

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

# name -> (source file, crop box, output size[, retouch function name])

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
        # 1024x1536 poster. Head spans about x 335-640, y 95-465; the script lettering
        # reaches x=321 and the stat tiles start at x=690. The 456 x 570 box is centred
        # on the head and retouch_poster() paints out what it takes in from either side.
        (262, 30, 718, 600),
        (560, 700),
        "retouch_poster",
    ),
    "dr-ritu-aggarwal.jpg": (
        "Dr. Ritu Aggarwal.png",
        (160, 105, 720, 805),        # 896x1195: 560 x 700 head-and-shoulders, lanyard below frame centre
        (560, 700),
    ),
    # Head-and-shoulders to match the other cards; the box stops well above the
    # bottom-right corner, so the watermark in the supplied file is cropped out.
    # 704x1521 phone export with black letterbox bars: the photo occupies y 241-1310.
    # The box stays inside that band, so neither the bars nor the corner mark show.
    "prof-ranjana-minz.jpg": (
        "Prof. Ranjana W Minz.png",
        (41, 282, 670, 1068),        # 629 x 786 = 4:5, centred on the face
        (560, 700),
    ),
    "dr-lekha-rani.jpg": (
        "unnamed.jpg",
        (196, 116, 684, 726),        # 488 x 610 = 4:5, head-and-shoulders like the others
        (560, 700),
    ),
    "dr-siddhartha-sharma.jpg": (
        "Dr Siddhartha Sharma.jpeg",
        (230, 28, 950, 928),         # 1179x1009 headshot: 4:5 box centred on the face
        (560, 700),
    ),
}


def _blur(img, r):
    """Approximate Gaussian blur of a float array (three box passes per axis)."""
    import numpy as np

    def box(a, k, axis):
        pad = [(0, 0)] * a.ndim
        pad[axis] = (k + 1, k)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
        n = c.shape[axis]
        return (np.take(c, np.arange(2 * k + 1, n), axis=axis) -
                np.take(c, np.arange(0, n - 2 * k - 1), axis=axis)) / (2 * k + 1)

    k = max(1, int(r / 1.7))
    for _ in range(3):
        img = box(box(img, k, 0), k, 1)
    return img


def retouch_poster(im, box):
    """Paint the poster's lettering (left) and stat tiles (right) out of the crop box."""
    import numpy as np
    from PIL import ImageFilter

    a = np.asarray(im.convert("RGB")).astype(np.float64)
    h, w = a.shape[:2]
    lum = a @ np.array([0.299, 0.587, 0.114])
    rows = np.arange(h)[:, None]

    # Left: script lettering and the gold rule on dark navy. A stroke is anything
    # clearly brighter than the local median; strokes are grown a little to catch
    # their anti-aliased edges, then filled from nearby navy by normalised
    # convolution. Only the navy panel is sampled, never the face.
    region = np.zeros((h, w), bool)
    region[50:410, box[0] - 30:330] = True
    median = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.MedianFilter(31)), dtype=np.float64)
    hole = region & (lum > median + 18)
    hole = region & (np.asarray(Image.fromarray((hole * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0)
    known = np.zeros((h, w), bool)
    known[0:460, 0:330] = True
    known &= ~hole
    for step in range(1, 7):
        wt = _blur(known.astype(np.float64), 14 * step)
        for c in range(3):
            est = _blur(a[..., c] * known, 14 * step) / np.maximum(wt, 1e-4)
            a[..., c] = np.where(hole & ~known & (wt > 1e-4), est, a[..., c])
        known |= hole & (wt > 0.05)

    # Right: tile edges, the heading's first letters and icon tips on a near-white
    # backdrop. The backdrop is estimated per row from bright pixels just left of
    # the tiles, carried across rows where there are none, and painted over
    # everything at x >= 686 except the jacket.
    band, bright = a[:, 655:685, :], lum[:, 655:685] > 238
    white = np.full((h, 3), np.nan)
    for y in range(h):
        if bright[y].sum() >= 4:
            white[y] = band[y][bright[y]].mean(axis=0)
    have = np.where(~np.isnan(white[:, 0]))[0]
    for c in range(3):
        white[:, c] = np.interp(np.arange(h), have, white[have, c])
        white[:, c] = _blur(np.tile(white[:, c:c + 1], (1, 8)), 8)[:, 4]
    paint = np.zeros((h, w), bool)
    paint[0:box[3] + 2, 686:box[2] + 2] = True
    paint &= ~((rows >= 530) & (lum < 120))
    for x in range(686, box[2] + 2):
        a[paint[:, x], x, :] = white[paint[:, x]]

    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def build(out_name, src_name, box, size, retouch=None):
    src_path = src_name if os.path.isabs(src_name) else os.path.join(SRC_DIR, src_name)
    if not os.path.exists(src_path):
        print("  MISSING source: %s" % src_path)
        return False
    with Image.open(src_path) as im:
        original = im.size
        if retouch:
            im = globals()[retouch](im, box)
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
    ok = sum(build(out, *job) for out, job in JOBS.items())
    print("%d of %d images written" % (ok, len(JOBS)))
    return 0 if ok == len(JOBS) else 1


if __name__ == "__main__":
    sys.exit(main())
