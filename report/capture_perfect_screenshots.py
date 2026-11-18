import asyncio
import base64
import json
import os
import subprocess
import time
import urllib.request
import websockets
from PIL import Image

out_dir = os.path.abspath('report/assets/screenshots')
os.makedirs(out_dir, exist_ok=True)

chrome_exe = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
user_data_dir = os.path.abspath('report/.chrome_profile')
os.makedirs(user_data_dir, exist_ok=True)

async def capture_all():
    # 1. Start Chrome with remote debugging
    cmd = [
        chrome_exe,
        '--remote-debugging-port=9222',
        '--headless=new',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        f'--user-data-dir={user_data_dir}',
        '--window-size=1920,1080',
        '--force-device-scale-factor=1.5',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        'about:blank'
    ]
    proc = subprocess.Popen(cmd)
    print("Chrome launched with remote debugging on port 9222...")
    time.sleep(3)

    try:
        # Get websocket debugger URL
        tabs_url = "http://127.0.0.1:9222/json"
        req = urllib.request.urlopen(tabs_url)
        tabs = json.loads(req.read().decode('utf-8'))
        ws_url = tabs[0]['webSocketDebuggerUrl']
        print(f"Connecting to CDP WebSocket: {ws_url}")

        async with websockets.connect(ws_url, max_size=20*1024*1024) as ws:
            msg_id = 0

            async def send_cmd(method, params=None):
                nonlocal msg_id
                msg_id += 1
                msg = {'id': msg_id, 'method': method, 'params': params or {}}
                await ws.send(json.dumps(msg))
                while True:
                    resp = json.loads(await ws.recv())
                    if resp.get('id') == msg_id:
                        return resp.get('result', {})

            async def screenshot(filename):
                res = await send_cmd('Page.captureScreenshot', {'format': 'png'})
                img_data = base64.b64decode(res['data'])
                f_path = os.path.join(out_dir, filename)
                with open(f_path, 'wb') as f:
                    f.write(img_data)
                print(f"Captured: {filename} ({len(img_data)} bytes)")
                return f_path

            await send_cmd('Page.enable')
            await send_cmd('DOM.enable')

            # -----------------------------------------------------------------
            # 1. Landing Page
            # -----------------------------------------------------------------
            print("Navigating to Landing Page...")
            await send_cmd('Page.navigate', {'url': 'http://127.0.0.1:5173/'})
            await asyncio.sleep(4)
            await screenshot('landing_page_full.png')

            # -----------------------------------------------------------------
            # 2. Lab Workstation (Results & Edit default)
            # -----------------------------------------------------------------
            print("Navigating to Workstation #lab...")
            await send_cmd('Page.navigate', {'url': 'http://127.0.0.1:5173/#lab'})
            await asyncio.sleep(5) # wait for KRAS benchmark to auto-analyze
            await screenshot('workstation_results_full.png')

            # -----------------------------------------------------------------
            # 3. 3D Structure Subtab
            # -----------------------------------------------------------------
            print("Switching to 3D Structure subtab...")
            await send_cmd('Runtime.evaluate', {
                'expression': '''
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const btn = buttons.find(b => b.innerText && b.innerText.includes('3D Structure'));
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
                '''
            })
            await asyncio.sleep(4) # allow WebGL 3Dmol/Three.js to render
            await screenshot('workstation_3d_structure.png')

            # -----------------------------------------------------------------
            # 4. Translation Subtab
            # -----------------------------------------------------------------
            print("Switching to Translation subtab...")
            await send_cmd('Runtime.evaluate', {
                'expression': '''
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const btn = buttons.find(b => b.innerText && b.innerText.includes('Translation'));
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
                '''
            })
            await asyncio.sleep(2)
            await screenshot('workstation_translation.png')

            # -----------------------------------------------------------------
            # 5. Clinical Report View
            # -----------------------------------------------------------------
            print("Navigating to Report View...")
            await send_cmd('Runtime.evaluate', {
                'expression': '''
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const btn = buttons.find(b => b.innerText && b.innerText.trim() === 'Report');
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
                '''
            })
            await asyncio.sleep(3)
            await screenshot('workstation_report_view.png')

            # -----------------------------------------------------------------
            # 6. Sequence Input Workspace (Analyze tab)
            # -----------------------------------------------------------------
            print("Navigating to Analyze tab...")
            await send_cmd('Runtime.evaluate', {
                'expression': '''
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const btn = buttons.find(b => b.innerText && b.innerText.trim() === 'Analyze');
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
                '''
            })
            await asyncio.sleep(3)
            await screenshot('workstation_analyze_input.png')

            # -----------------------------------------------------------------
            # 7. Dual Variant Comparison Mode
            # -----------------------------------------------------------------
            print("Switching to Dual Variant Comparison mode...")
            await send_cmd('Runtime.evaluate', {
                'expression': '''
                (function() {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const btn = buttons.find(b => b.innerText && b.innerText.includes('Dual Variant Comparison'));
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
                '''
            })
            await asyncio.sleep(2)
            await screenshot('workstation_dual_variant_mode.png')

    finally:
        print("Terminating Chrome process...")
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except:
            proc.kill()

if __name__ == '__main__':
    asyncio.run(capture_all())
