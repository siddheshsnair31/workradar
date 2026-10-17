"""Capture the design screens from the built app (used for the UX design PDF and QA).
Usage: python3 scripts/screens.py <out_dir> [width]"""
import json, sys, os
from playwright.sync_api import sync_playwright

out = sys.argv[1] if len(sys.argv) > 1 else 'screens'
width = int(sys.argv[2]) if len(sys.argv) > 2 else 1440
os.makedirs(out, exist_ok=True)
url = 'file://' + os.path.abspath('dist/workradar-standalone.html')

SHOTS = [
    ('01-dashboard', '#/', 'normal', None),
    ('02-priority-feed', '#/feed?tab=attention', 'normal', None),
    ('03-item-detail', '#/item/i-01', 'normal', None),
    ('04-search', '#/search?q=blocked%20items', 'normal', None),
    ('05-search-start', '#/search', 'normal', None),
    ('06-empty-workspace', '#/', 'empty', None),
    ('07-sync-error', '#/', 'partial_error', None),
    ('08-outage', '#/', 'outage', None),
    ('09-search-no-results', '#/search?q=kubernetes%20migration', 'normal', None),
    ('10-assign-modal', '#/item/i-05', 'normal', 'assign'),
    ('11-snooze-menu', '#/feed', 'normal', 'snooze'),
]

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, route, mode, interaction in SHOTS:
        ctx = b.new_context(viewport={'width': width, 'height': 900}, device_scale_factor=2 if width < 600 else 1.5)
        ctx.add_init_script(f"localStorage.setItem('workradar:v1', JSON.stringify({{overlays:{{}}, settings:{{engine:'local', apiKey:'', model:'claude-sonnet-5-5', demoMode:'{mode}'}}}}))")
        page = ctx.new_page()
        page.on('pageerror', lambda e, n=name: errors.append(f'{n}: {e}'))
        page.on('console', lambda m, n=name: errors.append(f'{n}: console {m.text}') if m.type == 'error' and 'fonts.g' not in m.text else None)
        page.goto(url + route)
        page.wait_for_timeout(1100)
        if interaction == 'assign':
            page.click('.action-bar button:has-text("Assign")')
            page.wait_for_timeout(300)
        if interaction == 'snooze':
            page.locator('.row .actions button[title="Snooze"]').first.click()
            page.wait_for_timeout(300)
        full = interaction is None
        page.screenshot(path=f'{out}/{name}.png', full_page=full)
        ctx.close()
    b.close()
print(json.dumps(errors, indent=1) if errors else 'no errors')
