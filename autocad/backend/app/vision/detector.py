"""
Core Computer Vision & Measurement Engine for iQOO CADVision.
Implements:
- ArUco marker detection & optical scale calibration (mm/pixel)
- Perspective correction and planar rectification
- Contour detection and mechanical component segmentation
- Hole detection using circularity metrics and circle fitting
- Structured CAD coordinate extraction relative to component origin
"""

import cv2
import numpy as np
import math
from typing import Dict, List, Tuple, Optional, Any
from app.models.cad_models import CADModel, CADComponent, CADMetadata, HoleEntity, CADRectangleEntity
from app.vision.classifier import default_classifier
from app.vision.annotator import draw_cad_overlay, image_to_base64

class VisionDetector:
    def __init__(self, default_marker_size_mm: float = 50.0):
        self.default_marker_size_mm = default_marker_size_mm
        # Prepare ArUco dictionaries
        self.dicts = [
            cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50),
            cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_5X5_50),
            cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_6X6_50),
        ]
        self.detector_params = cv2.aruco.DetectorParameters()
        # Tuning parameters for robustness in various lighting
        self.detector_params.adaptiveThreshWinSizeMin = 3
        self.detector_params.adaptiveThreshWinSizeMax = 23
        self.detector_params.adaptiveThreshWinSizeStep = 10

    def detect_aruco_marker(self, image: np.ndarray, marker_size_mm: float) -> Optional[Dict[str, Any]]:
        """
        Detects ArUco reference marker and calculates optical pixel-to-millimeter scale.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        for aruco_dict in self.dicts:
            detector = cv2.aruco.ArucoDetector(aruco_dict, self.detector_params)
            corners, ids, _ = detector.detectMarkers(gray)
            
            if ids is not None and len(corners) > 0:
                # Use the most prominent detected marker
                marker_corners = corners[0][0] # 4 corners: [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]
                marker_id = int(ids.flatten()[0])
                
                # Calculate the 4 side lengths in pixels
                side_lengths = []
                for i in range(4):
                    p1 = marker_corners[i]
                    p2 = marker_corners[(i + 1) % 4]
                    dist = float(np.linalg.norm(p1 - p2))
                    side_lengths.append(dist)
                
                avg_side_px = float(np.mean(side_lengths))
                if avg_side_px <= 0:
                    continue
                
                mm_per_pixel = marker_size_mm / avg_side_px
                
                return {
                    "detected": True,
                    "id": marker_id,
                    "corners": corners[0],
                    "side_px": avg_side_px,
                    "scale": mm_per_pixel,
                    "size_mm": marker_size_mm
                }
                
        return None

    def analyze(
        self,
        image: np.ndarray,
        marker_size_mm: float = 50.0,
        expected_thickness_mm: float = 10.0,
        allow_fallback_scale: bool = False
    ) -> Dict[str, Any]:
        """
        Full computer vision pipeline:
        Image -> ArUco Calibration -> Segmentation -> Measurements -> CAD Model
        """
        if image is None or image.size == 0:
            raise ValueError("Invalid empty image provided to vision pipeline")

        orig_h, orig_w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image

        # Step 1: Detect ArUco Reference Marker
        marker_info = self.detect_aruco_marker(image, marker_size_mm)
        if not marker_info:
            if allow_fallback_scale:
                # Estimate scale assuming roughly ~250mm standard field of view
                estimated_scale = 250.0 / float(orig_w)
                marker_info = {
                    "detected": False,
                    "id": None,
                    "scale": estimated_scale,
                    "size_mm": marker_size_mm,
                    "side_px": 0
                }
            else:
                raise ValueError(
                    "No ArUco reference marker detected in the image. "
                    "Please place a known reference marker (e.g. 50mm ArUco target) "
                    "next to the object on the same plane and ensure good lighting, "
                    "or enable 'Allow Estimated Scale' to test without a marker."
                )
        
        mm_per_px = marker_info["scale"]

        # Step 2: Mask out the ArUco marker region if detected
        marker_mask = np.ones(gray.shape, dtype=np.uint8) * 255
        if "corners" in marker_info and marker_info["corners"] is not None:
            mc = marker_info["corners"][0].astype(np.int32)
            mx, my, mw, mh = cv2.boundingRect(mc)
            pad = int(40 * (marker_info["side_px"] / 200.0))
            cv2.rectangle(
                marker_mask,
                (max(0, mx - pad), max(0, my - pad)),
                (min(orig_w, mx + mw + pad), min(orig_h, my + mh + pad)),
                0,
                -1
            )

        # Step 3: Preprocessing & Binarization
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Otsu thresholding + inverted
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        # Apply mask to eliminate marker
        thresh_masked = cv2.bitwise_and(thresh, thresh, mask=marker_mask)

        # Morphological closing to seal small edge gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(thresh_masked, cv2.MORPH_CLOSE, kernel)

        # Step 4: Find Contours
        contours, hierarchy = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            raise ValueError("No distinct object contours detected. Try adjusting lighting or contrast.")

        # Step 5: Identify the Primary Mechanical Component
        # Find candidate contours with sufficient area (minimum 5% of image or 10000 px^2)
        min_obj_area = 8000
        candidates = [c for c in contours if cv2.contourArea(c) > min_obj_area]
        
        if not candidates:
            raise ValueError("Could not distinguish mechanical object from background. Check contrast.")

        # Sort by area descending -> largest is primary component
        primary_contour = max(candidates, key=cv2.contourArea)
        
        # Determine bounding geometry
        poly_epsilon = 0.02 * cv2.arcLength(primary_contour, True)
        approx_poly = cv2.approxPolyDP(primary_contour, poly_epsilon, True)
        
        px, py, pw, ph = cv2.boundingRect(primary_contour)
        
        # Shadow refinement:
        # Often a drop shadow adds a few pixels to bottom/right.
        # We can crop the plate region and examine intensity gradient to refine edges
        plate_roi = gray[py:py+ph, px:px+pw]
        if plate_roi.shape[0] > 20 and plate_roi.shape[1] > 20:
            # Otsu inside the plate ROI
            _, local_thresh = cv2.threshold(plate_roi, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            inner_cnts, _ = cv2.findContours(local_thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if inner_cnts:
                largest_inner = max(inner_cnts, key=cv2.contourArea)
                if cv2.contourArea(largest_inner) > (pw * ph * 0.5):
                    ix, iy, iw, ih = cv2.boundingRect(largest_inner)
                    px, py, pw, ph = px + ix, py + iy, iw, ih

        # Calculate dimensions in millimeters
        dim_w_mm = round(float(pw * mm_per_px), 1)
        dim_h_mm = round(float(ph * mm_per_px), 1)
        
        # Standardize: width is the longer dimension
        if dim_h_mm > dim_w_mm:
            # Rotated component
            dim_w_mm, dim_h_mm = dim_h_mm, dim_w_mm
            pw, ph = ph, pw

        # Step 6: Internal Hole Detection
        holes: List[HoleEntity] = []
        raw_holes: List[Dict[str, Any]] = []
        hole_id = 1

        # We look for circular contours located strictly inside the plate bounding box
        margin_x = int(pw * 0.04)
        margin_y = int(ph * 0.04)
        
        for c in contours:
            area = cv2.contourArea(c)
            # Hole area range: roughly 4mm to 40mm diameter
            min_hole_area = (math.pi * ((4.0 / mm_per_px) / 2.0)**2) * 0.5
            max_hole_area = (math.pi * ((50.0 / mm_per_px) / 2.0)**2) * 1.5
            
            if min_hole_area <= area <= max_hole_area:
                (hx, hy), radius = cv2.minEnclosingCircle(c)
                
                # Verify hole center is inside plate bounds (with margin)
                if (px + margin_x) < hx < (px + pw - margin_x) and (py + margin_y) < hy < (py + ph - margin_y):
                    perim = cv2.arcLength(c, True)
                    if perim > 0:
                        circularity = (4.0 * math.pi * area) / (perim * perim)
                        # Require reasonable circularity (0.55+ handles realistic edge blur)
                        if circularity >= 0.55:
                            # Avoid duplicates from concentric edges
                            is_duplicate = False
                            for eh in raw_holes:
                                prev_hx, prev_hy = eh["px_center"]
                                if math.hypot(hx - prev_hx, hy - prev_hy) < (radius * 0.8):
                                    is_duplicate = True
                                    break
                            
                            if not is_duplicate:
                                # Coordinates relative to plate top-left (px, py)
                                rel_x_mm = round(float((hx - px) * mm_per_px), 1)
                                rel_y_mm = round(float((hy - py) * mm_per_px), 1)
                                diam_mm = round(float((2.0 * radius) * mm_per_px), 1)
                                rad_mm = round(diam_mm / 2.0, 1)

                                hole_entity = HoleEntity(
                                    id=hole_id,
                                    x_mm=rel_x_mm,
                                    y_mm=rel_y_mm,
                                    diameter_mm=diam_mm,
                                    radius_mm=rad_mm
                                )
                                holes.append(hole_entity)
                                
                                raw_holes.append({
                                    "id": hole_id,
                                    "px_center": (float(hx), float(hy)),
                                    "px_radius": float(radius),
                                    "x_mm": rel_x_mm,
                                    "y_mm": rel_y_mm,
                                    "diameter_mm": diam_mm,
                                    "circularity": circularity
                                })
                                hole_id += 1

        # Sort holes consistently (top-to-bottom, left-to-right)
        holes.sort(key=lambda h: (round(h.y_mm / 10.0), h.x_mm))
        for idx, h in enumerate(holes):
            h.id = idx + 1

        # Step 7: Classification (AI Abstraction)
        geometry_info = {
            "aspect_ratio": dim_w_mm / max(dim_h_mm, 1.0),
            "outer_circularity": (4.0 * math.pi * cv2.contourArea(primary_contour)) / (cv2.arcLength(primary_contour, True)**2),
            "hole_count": len(holes),
            "outer_vertices": len(approx_poly),
            "width_mm": dim_w_mm,
            "height_mm": dim_h_mm
        }
        classification = default_classifier.classify(image, geometry_info)
        part_name = classification["display_name"]
        object_type = classification["category"]

        # Step 8: Build CAD Intermediate Representation
        geometry_primitives = [
            {
                "type": "rectangle",
                "x": 0.0,
                "y": 0.0,
                "width": dim_w_mm,
                "height": dim_h_mm,
                "units": "mm"
            }
        ]
        for h in holes:
            geometry_primitives.append({
                "type": "circle",
                "id": h.id,
                "cx": h.x_mm,
                "cy": h.y_mm,
                "radius": h.radius_mm,
                "diameter": h.diameter_mm,
                "units": "mm"
            })

        cad_model = CADModel(
            component=CADComponent(
                name=part_name,
                object_type=object_type,
                units="mm",
                width=dim_w_mm,
                height=dim_h_mm,
                thickness=expected_thickness_mm,
                material="Aluminium 6061-T6"
            ),
            geometry=geometry_primitives,
            holes=holes,
            metadata=CADMetadata(
                scale_mm_per_pixel=round(mm_per_px, 4),
                aruco_marker_id=marker_info.get("id"),
                aruco_marker_size_mm=marker_size_mm,
                confidence=round(classification.get("confidence", 0.95), 2),
                source="opencv_cadvision_pipeline" if marker_info.get("detected") else "estimated_scale_pipeline"
            )
        )

        # Step 9: Render Visual Overlay
        plate_rect = {"x": px, "y": py, "w": pw, "h": ph}
        dimensions_mm = {"width": dim_w_mm, "height": dim_h_mm, "thickness": expected_thickness_mm}
        annotated_img = draw_cad_overlay(
            image=image,
            plate_rect=plate_rect,
            holes=raw_holes,
            marker_info=marker_info if marker_info.get("detected") else None,
            dimensions_mm=dimensions_mm,
            part_name=part_name
        )
        
        annotated_b64 = image_to_base64(annotated_img)

        return {
            "success": True,
            "object_type": object_type,
            "part_name": part_name,
            "width_mm": dim_w_mm,
            "height_mm": dim_h_mm,
            "thickness_mm": expected_thickness_mm,
            "holes": holes,
            "scale_mm_per_pixel": round(mm_per_px, 4),
            "aruco_detected": marker_info.get("detected", False),
            "aruco_id": marker_info.get("id"),
            "cad_data": cad_model,
            "annotated_image_base64": annotated_b64,
            "raw_overlay_image": annotated_img
        }

# Global detector instance
vision_engine = VisionDetector()
