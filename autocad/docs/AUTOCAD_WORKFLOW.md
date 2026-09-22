# AutoCAD Workflow & Interoperability Architecture

This document describes how **iQOO CADVision** communicates with Autodesk AutoCAD.

---

## 1. MVP: DXF Interoperability (Implemented & Fully Working)

In the MVP release, interoperability is established through standardized **AutoCAD Release 2010 DXF (AC1024)** files generated dynamically by Python's `ezdxf` engine.

### Why DXF for the MVP?
- **Zero software lock-in**: Does not require AutoCAD to be installed on the phone or cloud server.
- **Universal compatibility**: Opens natively in AutoCAD (2010 through 2026+), Autodesk DWG TrueView, Fusion 360, SolidWorks, LibreCAD, and CNC CAM software.
- **Layer preservation**: Preserves critical engineering layers (`OUTLINE`, `HOLES`, `CENTERLINES`, `DIMENSIONS`, `TITLEBLOCK`).

### Standard AutoCAD Layer Specifications

| Layer Name | Color | Lineweight | Linetype | Description |
|---|---|---|---|---|
| `OUTLINE` | White / Cyan | 0.50 mm | Continuous | Component outer boundary polyline |
| `HOLES` | Red / Magenta | 0.35 mm | Continuous | Through-hole and cutout circles |
| `CENTERLINES` | Yellow | 0.18 mm | CENTER | Hole crosshairs extending past hole perimeter |
| `DIMENSIONS` | Green | 0.25 mm | Continuous | Linear dimensions, extension lines, and callout text |
| `TITLEBLOCK` | Blue | 0.25 mm | Continuous | Engineering drawing border, material, and metadata |

### Step-by-Step Engineer Workflow in AutoCAD:
1. Generate the DXF via phone or web dashboard (`POST /api/generate-dxf`).
2. Download the `.dxf` file to your PC.
3. Open Autodesk AutoCAD:
   - Method A: Double-click the `.dxf` file or use `File` → `Open`.
   - Method B: In an open drawing, type `DXFIN` and select the file.
   - Method C: Type `APPLOAD`, load `cad_scripts/import_cadvision.lsp`, and type `CADVISION_IMPORT`.
4. Type `ZOOM` → `EXTENTS` (`Z` → `E`) to center the drawing.
5. The engineer can now make final modifications, add chamfers, prepare G-code toolpaths, or integrate into a larger assembly!

---

## 2. Advanced Version: Direct AutoCAD Automation (Future Roadmap)

For advanced automated production environments, iQOO CADVision includes an extensible integration blueprint:

### Architecture Options:
1. **AutoCAD .NET API (`accoreconsole.exe`)**:
   - AutoCAD provides `accoreconsole.exe` (headless AutoCAD console).
   - The FastAPI backend can run `accoreconsole.exe /s cad_scripts/cadvision.scr /i component.dxf` in the background to automatically convert DXF directly to native `.dwg` without opening the GUI.
2. **AutoCAD Web API / Autodesk Platform Services (APS / Forge)**:
   - Cloud-based translation using the Model Derivative API to render interactive 3D WebGL models in browser or mobile without desktop AutoCAD.
3. **AutoLISP Extension**:
   - The provided `cad_scripts/import_cadvision.lsp` can be added to the engineer's `acad.lsp` startup suite to automatically import incoming drawings from a designated watch folder.
