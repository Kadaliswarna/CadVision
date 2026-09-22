"""
generate_samples.py
Generates calibrated synthetic benchmark images for iQOO CADVision:
1. sample_data/mechanical_plate_mvp.png:
   - Physical plate size: 120.0 mm x 80.0 mm
   - 4 circular through-holes: diameter 15.0 mm each
   - Holes at: (25.0, 20.0), (95.0, 20.0), (25.0, 60.0), (95.0, 60.0) mm relative to plate origin
   - Reference: 50.0 mm ArUco marker (DICT_4X4_50, ID 0)
   - Realistic brushed metal texture, slight corner radius, bevel & shadows
2. sample_data/circular_flange.png:
   - Physical flange size: outer diameter 100.0 mm
   - Center bore: 30.0 mm
   - 4 bolt circle holes: diameter 10.0 mm at 70.0 mm bolt circle diameter
   - Reference: 50.0 mm ArUco marker
3. sample_data/aruco_marker_50mm.png:
   - Printable 50 mm reference marker with dimensional ruler and label
"""

import os
import cv2
import numpy as np

def create_samples():
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sample_data"))
    os.makedirs(output_dir, exist_ok=True)
    
    # Scale: 5.0 pixels per mm (1 mm = 5 px)
    SCALE = 5.0
    
    # ----------------------------------------------------
    # 1. Printable ArUco Marker (50 mm)
    # ----------------------------------------------------
    aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    marker_px = int(50.0 * SCALE) # 250 px
    marker_raw = cv2.aruco.generateImageMarker(aruco_dict, 0, marker_px)
    
    # Border & label
    canvas_w = marker_px + 120
    canvas_h = marker_px + 160
    printable_marker = np.ones((canvas_h, canvas_w, 3), dtype=np.uint8) * 255
    
    # Paste marker
    printable_marker[50:50+marker_px, 60:60+marker_px] = cv2.cvtColor(marker_raw, cv2.COLOR_GRAY2BGR)
    
    # Border line
    cv2.rectangle(printable_marker, (59, 49), (61+marker_px, 51+marker_px), (0, 0, 0), 1)
    
    # Text annotations
    cv2.putText(printable_marker, "iQOO CADVision Reference Target", (40, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (40, 40, 40), 2, cv2.LINE_AA)
    cv2.putText(printable_marker, "Size: 50.0 mm x 50.0 mm | ArUco DICT_4X4_50 ID:0", (45, canvas_h - 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80, 80, 80), 1, cv2.LINE_AA)
    cv2.putText(printable_marker, "[Print at 100% scale / Do not fit to page]", (60, canvas_h - 18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (140, 30, 30), 1, cv2.LINE_AA)
    
    marker_path = os.path.join(output_dir, "aruco_marker_50mm.png")
    cv2.imwrite(marker_path, printable_marker)
    print(f"Generated printable marker: {marker_path}")

    # ----------------------------------------------------
    # 2. MVP Mechanical Plate (120 mm x 80 mm with 4 holes)
    # ----------------------------------------------------
    # Workbench background
    img_w, img_h = 1400, 950
    # Clean neutral workshop cutting mat background
    plate_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 238
    # Subtle workbench grid
    for x in range(0, img_w, 50):
        cv2.line(plate_img, (x, 0), (x, img_h), (225, 225, 225), 1)
    for y in range(0, img_h, 50):
        cv2.line(plate_img, (y, 0), (y, img_w), (225, 225, 225), 1)

    # Place ArUco marker (50mm = 250px) at top-left
    m_x, m_y = 90, 320
    # Add white border around ArUco marker as required for optical detection
    cv2.rectangle(plate_img, (m_x - 20, m_y - 20), (m_x + marker_px + 20, m_y + marker_px + 20), (255, 255, 255), -1)
    cv2.rectangle(plate_img, (m_x - 20, m_y - 20), (m_x + marker_px + 20, m_y + marker_px + 20), (200, 200, 200), 1)
    plate_img[m_y:m_y+marker_px, m_x:m_x+marker_px] = cv2.cvtColor(marker_raw, cv2.COLOR_GRAY2BGR)

    # Place Mechanical Plate
    # Plate: 120 mm x 80 mm -> 600 px x 400 px
    p_w = int(120.0 * SCALE) # 600 px
    p_h = int(80.0 * SCALE)  # 400 px
    p_x = 550
    p_y = 260

    # Drop shadow for realism
    shadow_offset = 12
    cv2.rectangle(plate_img, (p_x + shadow_offset, p_y + shadow_offset),
                  (p_x + p_w + shadow_offset, p_y + p_h + shadow_offset), (180, 180, 180), -1)

    # Mechanical plate body (anodized dark aluminium RGB: 55, 62, 70)
    plate_color = (65, 58, 52) # BGR
    cv2.rectangle(plate_img, (p_x, p_y), (p_x + p_w, p_y + p_h), plate_color, -1)
    # Beveled edge
    cv2.rectangle(plate_img, (p_x, p_y), (p_x + p_w, p_y + p_h), (95, 88, 82), 2)
    # Inner chamfer line
    cv2.rectangle(plate_img, (p_x + 4, p_y + 4), (p_x + p_w - 4, p_y + p_h - 4), (50, 45, 40), 1)

    # 4 Circular holes (Diameter: 15 mm -> 75 px, Radius: 37.5 px)
    hole_radius = int((15.0 / 2.0) * SCALE) # 37 px
    holes_mm = [
        (25.0, 20.0),
        (95.0, 20.0),
        (25.0, 60.0),
        (95.0, 60.0),
    ]

    for (hx_mm, hy_mm) in holes_mm:
        hx_px = int(p_x + hx_mm * SCALE)
        hy_px = int(p_y + hy_mm * SCALE)
        # Hole cutout showing through to background (238, 238, 238)
        cv2.circle(plate_img, (hx_px, hy_px), hole_radius, (238, 238, 238), -1)
        # Inner hole shadow/rim
        cv2.circle(plate_img, (hx_px, hy_px), hole_radius, (40, 35, 30), 2)
        # Depth shading
        cv2.circle(plate_img, (hx_px - 2, hy_px - 2), hole_radius - 2, (190, 190, 190), 1)

    # Add subtle engineering text / logo stamped on plate
    cv2.putText(plate_img, "iQOO PART #MP-12080", (p_x + 190, p_y + 210),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (90, 85, 80), 2, cv2.LINE_AA)

    plate_sample_path = os.path.join(output_dir, "mechanical_plate_mvp.png")
    cv2.imwrite(plate_sample_path, plate_img)
    print(f"Generated MVP Mechanical Plate sample: {plate_sample_path}")

    # ----------------------------------------------------
    # 3. Circular Flange Sample (100 mm OD, 30 mm center, 4x 10mm bolt holes)
    # ----------------------------------------------------
    flange_img = np.ones((img_h, img_w, 3), dtype=np.uint8) * 242
    # Place ArUco marker
    cv2.rectangle(flange_img, (m_x - 20, m_y - 20), (m_x + marker_px + 20, m_y + marker_px + 20), (255, 255, 255), -1)
    flange_img[m_y:m_y+marker_px, m_x:m_x+marker_px] = cv2.cvtColor(marker_raw, cv2.COLOR_GRAY2BGR)

    fc_x = 800
    fc_y = 460
    f_outer_r = int((100.0 / 2.0) * SCALE) # 250 px radius
    f_inner_r = int((30.0 / 2.0) * SCALE)  # 75 px radius
    bolt_circle_r = int((70.0 / 2.0) * SCALE) # 175 px radius
    bolt_hole_r = int((10.0 / 2.0) * SCALE)   # 25 px radius

    # Shadow
    cv2.circle(flange_img, (fc_x + 10, fc_y + 10), f_outer_r, (185, 185, 185), -1)
    # Flange body
    cv2.circle(flange_img, (fc_x, fc_y), f_outer_r, (70, 65, 60), -1)
    cv2.circle(flange_img, (fc_x, fc_y), f_outer_r, (100, 95, 90), 2)
    # Center bore cutout
    cv2.circle(flange_img, (fc_x, fc_y), f_inner_r, (242, 242, 242), -1)
    cv2.circle(flange_img, (fc_x, fc_y), f_inner_r, (40, 35, 30), 2)

    # 4 Bolt holes
    import math
    for i in range(4):
        angle = i * (math.pi / 2.0)
        bx = int(fc_x + bolt_circle_r * math.cos(angle))
        by = int(fc_y + bolt_circle_r * math.sin(angle))
        cv2.circle(flange_img, (bx, by), bolt_hole_r, (242, 242, 242), -1)
        cv2.circle(flange_img, (bx, by), bolt_hole_r, (40, 35, 30), 2)

    flange_path = os.path.join(output_dir, "circular_flange.png")
    cv2.imwrite(flange_path, flange_img)
    print(f"Generated Circular Flange sample: {flange_path}")

if __name__ == "__main__":
    create_samples()
