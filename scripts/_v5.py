
import os, time
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", r"D:\Work\xianyu-auto-reply\runtime\browsers")
from playwright.sync_api import sync_playwright
bad = set(); errs = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
    pg.on("response", lambda r: bad.add(f"{r.status} {r.url}") if r.status >= 400 else None)
    pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    pg.goto("http://127.0.0.1:8089/", wait_until="domcontentloaded", timeout=60000); time.sleep(13)
    print("URL", pg.url, "HAS_DASH", "仪表盘" in pg.inner_text("body"))
    for path in ["/accounts", "/items", "/keywords", "/settings", "/personal-settings",
                 "/cards", "/orders", "/message-logs"]:
        pg.goto("http://127.0.0.1:8089" + path, wait_until="domcontentloaded", timeout=45000); time.sleep(3.5)
        print("PAGE", path, "len", len(pg.inner_text("body")))
    pg.screenshot(path=r"D:\Work\static-mode.png")
    b.close()
print("HTTP_ERRORS", len(bad))
for u in sorted(bad)[:6]: print("  ", u)
print("PAGE_ERRORS", len(errs))
for e in errs[:3]: print("  ", e)
