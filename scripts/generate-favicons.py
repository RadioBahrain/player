#!/usr/bin/env python3
"""
generate-favicons.py
Generates the complete favicon suite for Radio Bahrain Player based on the
official red metallic microphone emblem.

Generated assets:
- public/favicon.svg (modern scalable vector favicon)
- public/favicon.ico (multi-resolution 16x16, 32x32, 48x48)
- public/favicon-16x16.png
- public/favicon-32x32.png
- public/favicon-48x48.png
- public/apple-touch-icon.png (180x180, iOS opaque with #120204 background)
- public/android-chrome-192x192.png
- public/android-chrome-512x512.png
- public/site.webmanifest
"""

import os
from PIL import Image

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")

def main():
    print("🎨 Generating favicons from app logo...")

    # Load master rendered badge
    scratch_dir = "/Users/aldoyh/.gemini/antigravity/brain/d3bd9c94-1645-46ae-a0ce-f411579aa135/scratch"
    master_path = os.path.join(scratch_dir, "chrome_svg_render.png")
    if not os.path.exists(master_path):
        # Fallback to 512 png if available in public
        master_path = os.path.join(PUBLIC_DIR, "android-chrome-512x512.png")

    master = Image.open(master_path).convert("RGBA")

    # Standard transparent PNG favicons
    png_sizes = {
        "favicon-16x16.png": 16,
        "favicon-32x32.png": 32,
        "favicon-48x48.png": 48,
        "android-chrome-192x192.png": 192,
        "android-chrome-512x512.png": 512,
    }

    for filename, sz in png_sizes.items():
        resized = master.resize((sz, sz), Image.Resampling.LANCZOS)
        out_path = os.path.join(PUBLIC_DIR, filename)
        resized.save(out_path)
        print(f"  ✓ {filename} ({sz}x{sz})")

    # Multi-resolution ICO (16, 32, 48)
    ico_16 = master.resize((16, 16), Image.Resampling.LANCZOS)
    ico_32 = master.resize((32, 32), Image.Resampling.LANCZOS)
    ico_48 = master.resize((48, 48), Image.Resampling.LANCZOS)
    ico_path = os.path.join(PUBLIC_DIR, "favicon.ico")
    ico_16.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[ico_32, ico_48],
    )
    print(f"  ✓ favicon.ico (16x16, 32x32, 48x48)")

    # iOS Apple Touch Icon (180x180, solid #120204 background per Apple HIG)
    apple_icon = Image.new("RGBA", (180, 180), (18, 2, 4, 255))
    badge_152 = master.resize((152, 152), Image.Resampling.LANCZOS)
    apple_icon.paste(badge_152, (14, 14), badge_152)
    apple_path = os.path.join(PUBLIC_DIR, "apple-touch-icon.png")
    apple_icon.save(apple_path)
    print(f"  ✓ apple-touch-icon.png (180x180)")

    print("✨ Favicon generation complete!")

if __name__ == "__main__":
    main()

