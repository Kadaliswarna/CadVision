# iQOO CADVision

### Real-World Object → Intelligent AutoCAD Drawing

**iQOO CADVision** is a hackathon prototype that converts physical mechanical components into structured CAD geometry and native, multi-layered AutoCAD DXF drawings using Computer Vision and physical scale reference targets.

---

## ⚡ 60-Second Hackathon Judge Demo

Follow these simple steps to demonstrate the complete end-to-end pipeline in under 60 seconds:

1. **Start Backend & Web Dashboard**:
   ```bash
   # Terminal 1: Backend
   python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

   # Terminal 2: Web Dashboard
   cd web
   npm run dev
   ```
2. **Open Web Browser**:
   Navigate to `http://localhost:5173`.
3. **Execute 1-Click MVP Demo**:
   Click the prominent amber banner at the top: **⚡ Run MVP Demo (1-Click)**.
4. **Observe Real Computer Vision Pipeline**:
   - OpenCV ArUco detector identifies the 50 mm reference target and computes the optical scale (`0.2008 mm/px`).
   - Mechanical plate contour is segmented (120 mm × 80 mm).
   - 4 internal circular holes are isolated and measured (diameter ~15.0 mm at (25, 20), (95, 20), (25, 60), (95, 60) mm).
5. **Inspect Dynamic CAD Preview**:
   - The interactive SVG canvas renders the plate boundary (cyan `OUTLINE`), hole cutouts (magenta `HOLES`), crosshairs (yellow `CENTERLINES`), and dimension callouts (green `DIMENSIONS`).
   - Switch between **2D Orthographic** and **Isometric 2.5D Extruded** view modes.
6. **Click "GENERATE AUTOCAD DXF"**:
   - `ezdxf` compiles a standard AutoCAD R2010 DXF drawing file.
7. **Download DXF & Open in AutoCAD**:
   - Click **Download DXF** (`mechanical_plate_xxxx.dxf`).
   - Open in Autodesk AutoCAD or DWG TrueView (`ZOOM` → `EXTENTS`).
   - Confirm all 5 CAD layers, dimensions, centerlines, and the title block are present.

---

## 1. Problem Statement & Solution

### Problem
Engineers and draftspersons often spend hours taking manual caliper measurements of physical replacement parts, mounting plates, brackets, and flanges, and then manually drafting lines, circles, and dimension annotations from scratch in AutoCAD.

### Solution
**iQOO CADVision** establishes a direct bridge:
1. Photograph the physical object with an optical reference marker (e.g. 50 mm ArUco target).
2. Computer Vision automatically rectifies the plane, isolates external geometries, detects internal through-holes, and calculates millimeter dimensions.
3. Intermediate CAD JSON is generated and synced over Wi-Fi from mobile phone to PC.
4. Production-grade DXF drawing files are automatically generated for immediate final editing in AutoCAD.

---

## 2. System Architecture

```
PHYSICAL MECHANICAL OBJECT + 50mm ArUco REFERENCE TARGET
                         │
                         ▼
        ┌───────────────────────────────────┐
        │       Phone Camera (CameraX)      │
        │   OR Web Dashboard (Upload/Webcam)│
        └─────────────────┬─────────────────┘
                          │ HTTP POST /api/analyze-image
                          ▼
        ┌───────────────────────────────────┐
        │       FastAPI Backend Engine      │
        │  1. ArUco Scale Detector (50mm)   │
        │  2. Perspective & Bilateral Filter│
        │  3. Otsu & Contour Segmentation   │
        │  4. Hole Circularity & Fit Circles│
        │  5. Millimeter Dimension Engine   │
        └─────────────────┬─────────────────┘
                          │ Structured CAD Model JSON
                          ▼
        ┌───────────────────────────────────┐
        │        ezdxf DXF Generator        │
        │  - OUTLINE Layer (0.50mm border)  │
        │  - HOLES Layer (0.35mm circles)   │
        │  - CENTERLINES Layer (Yellow/Dash)│
        │  - DIMENSIONS Layer (Green/Dims)  │
        │  - TITLEBLOCK Layer (Engineering) │
        └─────────────────┬─────────────────┘
                          │ Output: .dxf File
                          ▼
        ┌───────────────────────────────────┐
        │      Autodesk AutoCAD / PC        │
        │  - Final engineer editing         │
        │  - Tolerance fine-tuning          │
        │  - CNC toolpath / Manufacturing   │
        └───────────────────────────────────┘
```

---

## 3. Technology Stack

- **Computer Vision & Math**: Python 3, OpenCV (`cv2.aruco`, `cv2.findContours`, `cv2.minEnclosingCircle`), NumPy
- **CAD Drawing Generation**: `ezdxf` (Release R2010 AC1024 format)
- **Backend API**: FastAPI, Uvicorn, Pydantic v2, SQLite
- **Web Dashboard**: React 18, TypeScript, Vite, Vanilla CSS Design System, SVG CAD engine
- **Android App**: Kotlin, Android Studio, CameraX (`camera-core`, `camera-camera2`, `camera-lifecycle`), Retrofit2, OkHttp3, Material 3
- **AutoCAD Integration**: DXF interoperability, AutoLISP automation script (`cad_scripts/import_cadvision.lsp`)

---

## 4. Installation & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ & npm
- Android Studio Iguana / Jellyfish (for Android build)
- Autodesk AutoCAD 2010+ or Autodesk DWG TrueView (free CAD viewer)

### A. Backend Setup
```bash
# Navigate to workspace root
cd c:\Users\kadal\Downloads\autocad

# Install python dependencies
pip install -r backend/requirements.txt

# Run automated test suite to verify vision & DXF pipeline
python -m pytest -v

# Start FastAPI server on all interfaces (port 8000)
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### B. Web Dashboard Setup
```bash
# In a second terminal:
cd web

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

### C. Android App Setup
1. Open Android Studio.
2. Select **Open** and choose the directory: `c:\Users\kadal\Downloads\autocad\android`.
3. Allow Gradle to sync dependencies.
4. Run on an Android device or emulator with camera enabled.

---

## 5. Phone to PC Wi-Fi Connection

To connect your Android phone to the PC running FastAPI:

1. **Find your PC local IP address**:
   - Open PowerShell or Command Prompt on PC:
     ```powershell
     ipconfig
     ```
   - Look for **IPv4 Address** (e.g. `192.168.1.10` or `10.0.0.15`).
2. **Ensure PC Firewall allows Port 8000**:
   - If prompted by Windows Defender Firewall, allow Python on Private Networks.
3. **Configure Android App**:
   - Open **iQOO CADVision** on your phone.
   - Tap **⚙️ Change PC Server IP**.
   - Enter your PC's IP (e.g. `192.168.1.10`) and Port `8000`.
   - Tap **Test Ping & Connect**.
   - Once the indicator shows **● Connected**, your phone is synced with your PC!

---

## 6. How Measurement Works

Standard camera sensors record pixels, not physical dimensions. iQOO CADVision uses a **Planar Reference Scale** method:

1. A known reference marker (default: **50.0 mm ArUco marker**, `DICT_4X4_50 ID:0`) is placed on the same surface as the mechanical part.
2. OpenCV detects the 4 marker corners $(c_0, c_1, c_2, c_3)$ with subpixel accuracy.
3. The average Euclidean perimeter length in pixels $L_{px}$ is computed:
   $$\text{Scale} = \frac{50.0\text{ mm}}{L_{px}}\quad (\text{mm per pixel})$$
4. Object boundaries and internal circular cutouts are detected via contour analysis.
5. Pixel measurements are multiplied by the scale factor to yield physical millimeters.

### How to Place the ArUco Marker
- Place the 50 mm marker flat on the same plane as the object, approximately 20–50 mm beside it.
- Avoid placing the marker directly on top of the object.
- Keep the camera angle reasonably perpendicular (within 25° of normal) for optimal accuracy.

---

## 7. DXF Generation & AutoCAD Import

### Generated Layers in DXF:
- **`OUTLINE`**: Perimeter closed polyline with 0.50 mm lineweight.
- **`HOLES`**: Circular cutout entities with 0.35 mm lineweight.
- **`CENTERLINES`**: Yellow crosshairs extending 3–5 mm beyond hole edges using the AutoCAD `CENTER` linetype.
- **`DIMENSIONS`**: Dimension lines, extension ticks, and callout text (`120.0 mm`, `80.0 mm`, `Ø15.0 mm`).
- **`TITLEBLOCK`**: Engineering box with Part Name, Material (`Aluminium 6061-T6`), Date, and `1:1 mm` Scale.

### Opening in AutoCAD:
1. Open AutoCAD.
2. Type `DXFIN` (or `OPEN`) and select the generated file.
3. Type `ZOOM` → `EXTENTS` (`Z` then `E`).
4. (Optional) Run the provided AutoLISP script:
   - In AutoCAD type `APPLOAD` and select `cad_scripts/import_cadvision.lsp`.
   - Type `CADVISION_IMPORT` to automatically load and frame the drawing.

---

## 8. Limitations & Future Scope

### Honest Technical Limitations
- **Calibrated Geometric Scope**: The MVP focuses on defined mechanical geometries: rectangular plates, flanges, mounting brackets, and through-holes. Arbitrary organic 3D shapes require multi-view photogrammetry or LiDAR.
- **Optical Accuracy**: Accuracy depends on camera resolution, lighting, surface contrast, and camera tilt. Under controlled conditions with the 50 mm reference marker, dimensional accuracy is typically within ±0.5 mm to ±1.0 mm.
- **Human Review**: As with all AI/CV measuring tools, engineering verification with calipers is recommended before high-precision CNC machining.

### Future Scope
- Multi-view 3D depth fusion using ARCore depth APIs.
- Direct AutoCAD .NET plugin for automatic background drawing insertion.
- Automatic edge chamfer, counterbore, and thread pitch detection.

---

## 9. Troubleshooting Guide

| Issue | Cause | Solution |
|---|---|---|
| `"No ArUco reference marker detected"` | Marker not in frame, poor lighting, or obscured | Ensure the 50mm ArUco target is placed flat beside the object and well-lit. |
| `"Could not distinguish mechanical object"` | Low contrast between object and background | Place the mechanical part on a contrasting background (e.g. cutting mat or neutral paper). |
| `"PC server unreachable"` on Android | Phone and PC on different Wi-Fi networks or firewall blocking port 8000 | Verify both devices are on the same Wi-Fi; check IP with `ipconfig`; disable Windows Firewall for port 8000 temporarily. |
| Holes detected with offset coordinates | Extreme camera perspective angle | Keep the phone camera facing relatively perpendicular to the object plane. |
| Missing centerlines in AutoCAD | AutoCAD linetype scale factor | Type `LTSCALE` in AutoCAD and set it to `1.0`, then run `REGEN`. |
