"""
Integration tests for FastAPI endpoints.
"""

import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SAMPLE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sample_data", "mechanical_plate_mvp.png"))

def test_health_endpoint():
    """Verifies that the /api/health endpoint returns status, OpenCV version, and IP list."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "opencv_version" in data
    assert "local_network_ips" in data

def test_sample_data_endpoint():
    """Verifies that sample datasets are listed."""
    response = client.get("/api/sample-data")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    ids = [item["id"] for item in data]
    assert "mechanical-plate-mvp" in ids

def test_analyze_image_endpoint():
    """Tests the full upload and analysis pipeline via HTTP POST."""
    assert os.path.exists(SAMPLE_PATH), f"Sample image missing at {SAMPLE_PATH}"
    
    with open(SAMPLE_PATH, "rb") as f:
        response = client.post(
            "/api/analyze-image",
            files={"file": ("plate.png", f, "image/png")},
            data={"marker_size_mm": "50.0", "thickness_mm": "10.0"}
        )
    
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()
    assert data["success"] is True
    assert data["aruco_detected"] is True
    assert 118.0 <= data["width_mm"] <= 123.0
    assert 78.0 <= data["height_mm"] <= 83.0
    assert len(data["holes"]) == 4
    assert data["annotated_image_base64"].startswith("data:image/jpeg;base64,")

    # Generate DXF from returned CAD model
    cad_data = data["cad_data"]
    dxf_resp = client.post(
        "/api/generate-dxf",
        json={"cad_data": cad_data, "include_dimensions": True, "include_centerlines": True}
    )
    assert dxf_resp.status_code == 200
    dxf_data = dxf_resp.json()
    assert dxf_data["success"] is True
    assert dxf_data["filename"].endswith(".dxf")
    assert "download_url" in dxf_data

    # Download the DXF
    dl_resp = client.get(dxf_data["download_url"])
    assert dl_resp.status_code == 200
    assert len(dl_resp.content) > 5000

def test_measure_endpoint():
    """Verifies the /api/measure helper calculation."""
    payload = {
        "pixel_distance": 250.0,
        "reference_pixel_length": 250.0,
        "reference_real_length_mm": 50.0
    }
    response = client.post("/api/measure", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["measured_mm"] == 50.0
