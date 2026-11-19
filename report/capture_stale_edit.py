import asyncio
import base64
import json
import os
import subprocess
import time
import urllib.request
import websockets

user_data_dir = os.path.abspath('report/.chrome_profile_stale')

async def capture_stale():
    proc = subprocess.Popen([
        r'C:\Program Files\Google\Chrome\Application\chrome.exe',
        '--remote-debugging-port=9232',
        '--headless=new',
        f'--user-data-dir={user_data_dir}',
        '--window-size=1600,1000',
        '--force-device-scale-factor=1.5',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        'about:blank'
    ])
    time.sleep(2)
    try:
        tabs = json.loads(urllib.request.urlopen('http://127.0.0.1:9232/json').read())
        ws_url = tabs[0]['webSocketDebuggerUrl']
        async with websockets.connect(ws_url, max_size=30*1024*1024) as ws:
            msg_id = 0
            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                await ws.send(json.dumps({'id': msg_id, 'method': method, 'params': params or {}}))
                while True:
                    resp = json.loads(await ws.recv())
                    if resp.get('id') == msg_id:
                        return resp.get('result', {})

            await send('Page.enable')
            await send('Page.navigate', {'url': 'http://127.0.0.1:5173/?lab=true#lab'})
            await asyncio.sleep(4)
            
            # Click on an editable sequence base or button in the alignment editor to trigger draft modification
            eval_res = await send('Runtime.evaluate', {
                'expression': '''
                (function() {
                    // Find any nucleotide button in alignment editor to click
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const editBtn = buttons.find(b => b.title && b.title.includes('Click to edit') || b.innerText === 'G' || b.innerText === 'A');
                    if (editBtn) {
                        editBtn.click();
                        return 'clicked base';
                    }
                    return 'no edit base found';
                })()
                ''',
                'returnByValue': True
            })
            print('Base click:', eval_res)
            await asyncio.sleep(1)

            # Let's take screenshot of the interactive editor
            res = await send('Page.captureScreenshot', {'format': 'png'})
            data = base64.b64decode(res['data'])
            with open('report/assets/screenshots/workstation_interactive_editor.png', 'wb') as f:
                f.write(data)
            print('Saved workstation_interactive_editor.png:', len(data))
    finally:
        proc.terminate()

if __name__ == '__main__':
    asyncio.run(capture_stale())
