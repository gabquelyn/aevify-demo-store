"""Capture the social card (/dev/og) to public/og.png.

Start the store in memory test mode first:
    STORE_TEST_MODE=memory npm run dev
then:
    python3 scripts/og-image.py
"""
import os
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3001")
OUT = Path(__file__).resolve().parent.parent / "public" / "og.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=2)
    page.goto(f"{BASE_URL}/dev/og", wait_until="networkidle")
    page.add_style_tag(content="nextjs-portal { display: none !important; }")  # dev badge
    page.wait_for_timeout(800)
    page.locator("#og").screenshot(path=str(OUT))
    browser.close()

# Render at 2x for sharp text, then scale to the standard 1200x630.
Image.open(OUT).convert("RGB").resize((1200, 630), Image.LANCZOS).save(OUT, optimize=True)
print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")
