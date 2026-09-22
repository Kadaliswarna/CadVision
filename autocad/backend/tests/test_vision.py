"""
Tests for OpenCV computer vision, ArUco calibration, and geometric detection.
"""

import os
import cv2
import pytest
import numpy as np
from app.vision.detector import VisionDetector

SAMPLE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sample_data", "mechanical_plate_mvp.png"))

@pytest.fixture
def detector():
    return VisionDetector(default_marker_size_mm=50.0)

@pytest.fixture
def sample_plate_image():
    assert os.path.exists(SAMPLE_PATH), f"Sample image not found at {SAMPLE_PATH}"
    img = cv2.imread(SAMPLE_PATH)
    assert img is not None, "Failed to decode sample image"
    return img

def test_aruco_marker_detection(detector, sample_plate_image):
    """Verifies that ArUco marker is correctly located and scale is calculated."""
    marker_info = detector.detect_aruco_marker(sample_plate_image, marker_size_mm=50.0)
    assert marker_info is not None, "ArUco marker should be detected"
    assert marker_info["detected"] is True
    assert marker_info["id"] == 0
    # Ground truth is ~0.20 mm/px (250 px for 50 mm)
    assert 0.19 <= marker_info["scale"] <= 0.21, f"Scale {marker_info['scale']} out of expected range"

def test_mechanical_plate_analysis(detector, sample_plate_image):
    """Verifies end-to-end analysis of MVP mechanical plate."""
    res = detector.analyze(sample_plate_image, marker_size_mm=50.0, expected_thickness_mm=10.0)
    assert res["success"] is True
    assert "Mechanical Plate" in res["part_name"]
    
    # Ground truth: 120mm x 80mm. Allow realistic CV tolerance +/- 2%
    assert 118.0 <= res["width_mm"] <= 123.0, f"Detected width {res['width_mm']} out of range"
    assert 78.0 <= res["height_mm"] <= 83.0, f"Detected height {res['height_mm']} out of range"
    
    # Ground truth: 4 holes with 15mm diameter
    holes = res["holes"]
    assert len(holes) == 4, f"Expected 4 holes, got {len(holes)}"
    
    for h in holes:
        assert 13.5 <= h.diameter_mm <= 16.5, f"Hole diameter {h.diameter_mm} out of range"
        # Coordinates must be within plate bounds
        assert 0.0 < h.x_mm < res["width_mm"]
        assert 0.0 < h.y_mm < res["height_mm"]

def test_missing_aruco_marker_error(detector):
    """Verifies that analyzing an image without an ArUco marker raises a clear error."""
    blank_img = np.ones((400, 400, 3), dtype=np.uint8) * 200
    with pytest.raises(ValueError) as excinfo:
        detector.analyze(blank_img, marker_size_mm=50.0)
    assert "No ArUco reference marker detected" in str(excinfo.value)
