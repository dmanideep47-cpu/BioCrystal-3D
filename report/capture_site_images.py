import subprocess, os, time
from PIL import Image

chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
out_dir = os.path.abspath('report/assets/screenshots')
os.makedirs(out_dir, exist_ok=True)

def capture(url, out_name, delay_sec=2):
    out_file = os.path.join(out_dir, out_name)
    cmd = [
        chrome,
        '--headless',
        '--disable-gpu',
        f'--virtual-time-budget={int(delay_sec * 1000)}',
        f'--screenshot={out_file}',
        '--window-size=1440,900',
        url
    ]
    subprocess.run(cmd, capture_output=True, text=True)
    if os.path.exists(out_file):
        print(f"Captured: {out_name} ({os.path.getsize(out_file)} bytes)")
    else:
        print(f"Failed to capture: {out_name}")

print("Capturing live screenshots from running BioCrystal 3D server...")
capture('http://127.0.0.1:5173/', 'landing_hero.png', delay_sec=2)
capture('http://127.0.0.1:5173/#lab', 'workstation_full.png', delay_sec=4)

# Create specific crops if workstation_full exists
full_path = os.path.join(out_dir, 'workstation_full.png')
if os.path.exists(full_path):
    im = Image.open(full_path)
    w, h = im.size
    
    # Crop 1: Alignment and mutation results (upper half / center)
    crop1 = im.crop((260, 50, w - 20, 550))
    crop1.save(os.path.join(out_dir, 'alignment_results_crop.png'))
    
    # Crop 2: 3D structure and biophysics
    crop2 = im.crop((260, 300, w - 20, h - 20))
    crop2.save(os.path.join(out_dir, 'structure_crop.png'))
    
    # Crop 3: Primary interpretation / telemetry summary
    crop3 = im.crop((260, 50, w - 20, 350))
    crop3.save(os.path.join(out_dir, 'telemetry_crop.png'))
    print("Crops generated successfully!")
