"""
Visual CAD & AR Overlay Annotator for iQOO CADVision.
Renders professional engineering graphics, dimensional callouts, center marks,
and scale annotations directly on the camera/analyzed image.
"""

import cv2
import numpy as np
import base64
from typing import List, Dict, Any, Optional

def draw_cad_overlay(
    image: np.ndarray,
    plate_rect: Dict[str, int], # {x, y, w, h}
    holes: List[Dict[str, Any]], # [{x_mm, y_mm, diameter_mm, px_center, px_radius}]
    marker_info: Optional[Dict[str, Any]], # {corners, id, scale, size_mm}
    dimensions_mm: Dict[str, float], # {width, height, thickness}
    part_name: str = "Mechanical Plate"
) -> np.ndarray:
    """
    Renders an engineering CAD overlay on top of the image.
    """
    annotated = image.copy()
    overlay = annotated.copy()
    alpha = 0.25

    # 1. Annotate ArUco Marker
    if marker_info and "corners" in marker_info:
        corners = marker_info["corners"].astype(np.int32)
        cv2.polylines(annotated, [corners], isClosed=True, color=(0, 220, 0), thickness=2, lineType=cv2.LINE_AA)
        for pt in corners[0]:
            cv2.circle(annotated, tuple(pt), 4, (0, 255, 0), -1)
        
        # Label above marker
        top_left = corners[0][0]
        m_id = marker_info.get("id", 0)
        scale_val = marker_info.get("scale", 0.0)
        size_mm = marker_info.get("size_mm", 50.0)
        label_text = f"ArUco ID:{m_id} [{size_mm:.0f}mm] Scale: {scale_val:.3f} mm/px"
        
        cv2.rectangle(annotated, (top_left[0] - 5, top_left[1] - 28),
                      (top_left[0] + len(label_text) * 9, top_left[1] - 6), (20, 30, 20), -1)
        cv2.putText(annotated, label_text, (top_left[0], top_left[1] - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 120), 1, cv2.LINE_AA)

    # 2. Annotate Outer Plate Boundary
    px, py, pw, ph = plate_rect["x"], plate_rect["y"], plate_rect["w"], plate_rect["h"]
    w_mm = dimensions_mm.get("width", 120.0)
    h_mm = dimensions_mm.get("height", 80.0)

    # Shaded translucent fill
    cv2.rectangle(overlay, (px, py), (px + pw, py + ph), (255, 180, 0), -1)
    cv2.addWeighted(overlay, alpha, annotated, 1 - alpha, 0, annotated)

    # Outer border (Cyan engineering line)
    cv2.rectangle(annotated, (px, py), (px + pw, py + ph), (255, 235, 0), 2, cv2.LINE_AA)

    # Corner ticks
    tick_len = 15
    corners_list = [(px, py), (px + pw, py), (px, py + ph), (px + pw, py + ph)]
    for (cx, cy) in corners_list:
        cv2.circle(annotated, (cx, cy), 3, (0, 255, 255), -1)

    # Dimension Line: Horizontal Width (top of plate)
    dim_y = max(py - 30, 25)
    cv2.line(annotated, (px, dim_y), (px + pw, dim_y), (0, 220, 255), 2, cv2.LINE_AA)
    # Extension lines
    cv2.line(annotated, (px, py - 5), (px, dim_y - 8), (0, 220, 255), 1, cv2.LINE_AA)
    cv2.line(annotated, (px + pw, py - 5), (px + pw, dim_y - 8), (0, 220, 255), 1, cv2.LINE_AA)
    # Arrow heads
    cv2.arrowedLine(annotated, (px + 40, dim_y), (px, dim_y), (0, 220, 255), 2, tipLength=0.2)
    cv2.arrowedLine(annotated, (px + pw - 40, dim_y), (px + pw, dim_y), (0, 220, 255), 2, tipLength=0.2)
    # Width text pill
    w_label = f"W: {w_mm:.1f} mm"
    tw = len(w_label) * 11
    mid_x = px + pw // 2
    cv2.rectangle(annotated, (mid_x - tw // 2, dim_y - 12), (mid_x + tw // 2, dim_y + 12), (15, 20, 30), -1)
    cv2.rectangle(annotated, (mid_x - tw // 2, dim_y - 12), (mid_x + tw // 2, dim_y + 12), (0, 220, 255), 1)
    cv2.putText(annotated, w_label, (mid_x - tw // 2 + 6, dim_y + 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 255, 255), 1, cv2.LINE_AA)

    # Dimension Line: Vertical Height (right of plate)
    dim_x = px + pw + 35
    if dim_x < annotated.shape[1] - 80:
        cv2.line(annotated, (dim_x, py), (dim_x, py + ph), (0, 220, 255), 2, cv2.LINE_AA)
        cv2.line(annotated, (px + pw + 5, py), (dim_x + 8, py), (0, 220, 255), 1, cv2.LINE_AA)
        cv2.line(annotated, (px + pw + 5, py + ph), (dim_x + 8, py + ph), (0, 220, 255), 1, cv2.LINE_AA)
        cv2.arrowedLine(annotated, (dim_x, py + 35), (dim_x, py), (0, 220, 255), 2, tipLength=0.2)
        cv2.arrowedLine(annotated, (dim_x, py + ph - 35), (dim_x, py + ph), (0, 220, 255), 2, tipLength=0.2)
        # Height text pill
        h_label = f"H: {h_mm:.1f} mm"
        th = len(h_label) * 11
        mid_y = py + ph // 2
        cv2.rectangle(annotated, (dim_x - 10, mid_y - 14), (dim_x + th, mid_y + 12), (15, 20, 30), -1)
        cv2.rectangle(annotated, (dim_x - 10, mid_y - 14), (dim_x + th, mid_y + 12), (0, 220, 255), 1)
        cv2.putText(annotated, h_label, (dim_x - 5, mid_y + 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 255, 255), 1, cv2.LINE_AA)

    # 3. Annotate Holes
    for i, hole in enumerate(holes):
        hx = int(hole["px_center"][0])
        hy = int(hole["px_center"][1])
        hr = int(hole["px_radius"])
        diam_mm = hole.get("diameter_mm", 15.0)
        x_mm = hole.get("x_mm", 0.0)
        y_mm = hole.get("y_mm", 0.0)

        # Highlight circle (Magenta / Vibrant Red)
        cv2.circle(annotated, (hx, hy), hr, (0, 70, 255), 2, cv2.LINE_AA)
        
        # Center Crosshair
        ch_len = hr + 10
        cv2.line(annotated, (hx - ch_len, hy), (hx + ch_len, hy), (0, 255, 255), 1, cv2.LINE_AA)
        cv2.line(annotated, (hx, hy - ch_len), (hx, hy + ch_len), (0, 255, 255), 1, cv2.LINE_AA)
        cv2.circle(annotated, (hx, hy), 2, (0, 255, 255), -1)

        # Hole badge & dimensions
        tag = f"H{i+1}: Ø{diam_mm:.1f}mm"
        sub_tag = f"({x_mm:.1f}, {y_mm:.1f})"
        cv2.rectangle(annotated, (hx - 45, hy + hr + 8), (hx + 55, hy + hr + 38), (15, 18, 25), -1)
        cv2.rectangle(annotated, (hx - 45, hy + hr + 8), (hx + 55, hy + hr + 38), (0, 140, 255), 1)
        cv2.putText(annotated, tag, (hx - 42, hy + hr + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(annotated, sub_tag, (hx - 42, hy + hr + 34),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 220, 255), 1, cv2.LINE_AA)

    # 4. Technical HUD Header Bar
    hud_h = 44
    cv2.rectangle(annotated, (0, 0), (annotated.shape[1], hud_h), (10, 14, 22), -1)
    cv2.line(annotated, (0, hud_h), (annotated.shape[1], hud_h), (0, 200, 255), 1)
    
    cv2.putText(annotated, f"iQOO CADVision | DETECTED: {part_name.upper()}", (20, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 240, 255), 2, cv2.LINE_AA)
    
    hud_stats = f"Plate: {w_mm:.1f} x {h_mm:.1f} mm | Holes: {len(holes)} | Units: mm"
    cv2.putText(annotated, hud_stats, (annotated.shape[1] - len(hud_stats)*10 - 20, 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (200, 220, 240), 1, cv2.LINE_AA)

    return annotated

def image_to_base64(image: np.ndarray, format: str = ".jpg", quality: int = 90) -> str:
    """Encodes OpenCV image to Base64 data URL string."""
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    success, buffer = cv2.imencode(format, image, encode_params)
    if not success:
        raise ValueError("Failed to encode image to base64")
    b64_str = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/jpeg;base64,{b64_str}"
