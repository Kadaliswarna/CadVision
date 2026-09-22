"""
REST API Router for iQOO CADVision.
Implements endpoints:
- POST /api/analyze-image
- POST /api/measure
- POST /api/generate-cad
- POST /api/generate-dxf
- GET  /api/download/{filename}
- GET  /api/scans
- GET  /api/scans/{scan_id}
- GET  /api/sample-data
- GET  /api/health
"""

import os
import uuid
import socket
import cv2
import numpy as np
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.models.cad_models import (
    CADModel, CADComponent, CADMetadata, HoleEntity,
    AnalyzeImageResponse, GenerateDxfRequest, GenerateDxfResponse, ScanRecord
)
from app.vision.detector import vision_engine
from app.cad.dxf_exporter import dxf_generator, EXPORT_DIR
from app.db.database import save_scan, update_scan_dxf, get_all_scans, get_scan_by_id

router = APIRouter(prefix="/api", tags=["CADVision"])

# Look in root sample_data first, then fallback to backend/sample_data
root_sample_data = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "sample_data"))
backend_sample_data = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "sample_data"))
SAMPLE_DATA_DIR = root_sample_data if os.path.exists(root_sample_data) else backend_sample_data

# ----------------------------------------------------
# 1. Health Check & Network Info
# ----------------------------------------------------
@router.get("/health")
def health_check():
    """Returns system status, library versions, and local network IPs for phone connection."""
    # Discover local network IPs (e.g. 192.168.x.x)
    local_ips = []
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if not ip.startswith("127."):
                local_ips.append(ip)
    except Exception:
        local_ips.append("127.0.0.1")

    return {
        "status": "healthy",
        "service": "iQOO CADVision API",
        "version": "1.0.0",
        "opencv_version": cv2.__version__,
        "local_network_ips": local_ips,
        "recommended_android_server_url": f"http://{local_ips[0] if local_ips else '127.0.0.1'}:8000"
    }

# ----------------------------------------------------
# 2. Analyze Image
# ----------------------------------------------------
@router.post("/analyze-image", response_model=AnalyzeImageResponse)
async def analyze_image(
    file: UploadFile = File(...),
    marker_size_mm: float = Form(default=50.0),
    thickness_mm: float = Form(default=10.0),
    allow_fallback_scale: bool = Form(default=True)
):
    """
    Accepts an image from phone camera or web dashboard,
    runs OpenCV ArUco calibration and contour segmentation,
    returns detected dimensions, hole coordinates, CAD model, and visual overlay.
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file uploaded.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read image: {str(e)}")

    try:
        scan_id = str(uuid.uuid4())[:8]
        result = vision_engine.analyze(
            image=image,
            marker_size_mm=marker_size_mm,
            expected_thickness_mm=thickness_mm,
            allow_fallback_scale=allow_fallback_scale
        )

        # Create CAD model
        cad_data: CADModel = result["cad_data"]

        # Persist to SQLite Scan History
        save_scan(
            scan_id=scan_id,
            object_name=result["part_name"],
            object_type=result["object_type"],
            width_mm=result["width_mm"],
            height_mm=result["height_mm"],
            thickness_mm=result["thickness_mm"],
            hole_count=len(result["holes"]),
            holes=result["holes"],
            cad_data=cad_data,
            scale_mm_per_pixel=result["scale_mm_per_pixel"],
            aruco_id=result.get("aruco_id"),
            thumbnail_base64=result["annotated_image_base64"]
        )

        return AnalyzeImageResponse(
            success=True,
            scan_id=scan_id,
            message="Object and reference marker analyzed successfully.",
            object_type=result["object_type"],
            width_mm=result["width_mm"],
            height_mm=result["height_mm"],
            thickness_mm=result["thickness_mm"],
            holes=result["holes"],
            scale_mm_per_pixel=result["scale_mm_per_pixel"],
            aruco_detected=result["aruco_detected"],
            aruco_id=result.get("aruco_id"),
            cad_data=cad_data,
            annotated_image_base64=result["annotated_image_base64"]
        )

    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Vision pipeline processing error: {str(ex)}")

# ----------------------------------------------------
# 3. Measurement Endpoint (Pixel -> Millimeter)
# ----------------------------------------------------
class MeasureRequest(BaseModel):
    pixel_distance: float
    reference_pixel_length: float
    reference_real_length_mm: float = 50.0

class MeasureResponse(BaseModel):
    scale_mm_per_pixel: float
    measured_mm: float

@router.post("/measure", response_model=MeasureResponse)
def compute_measurement(req: MeasureRequest):
    """Calculates physical millimeter distance from pixel length using known reference."""
    if req.reference_pixel_length <= 0:
        raise HTTPException(status_code=400, detail="Reference pixel length must be positive.")
    scale = req.reference_real_length_mm / req.reference_pixel_length
    measured = req.pixel_distance * scale
    return MeasureResponse(
        scale_mm_per_pixel=round(scale, 5),
        measured_mm=round(measured, 2)
    )

# ----------------------------------------------------
# 4. Generate CAD JSON from Parameters
# ----------------------------------------------------
class GenerateCadParams(BaseModel):
    part_name: str = "Mechanical Plate"
    width_mm: float = 120.0
    height_mm: float = 80.0
    thickness_mm: float = 10.0
    holes: List[Dict[str, float]] = Field(default_factory=list) # [{x_mm, y_mm, diameter_mm}]

@router.post("/generate-cad", response_model=CADModel)
def generate_cad_model(params: GenerateCadParams):
    """Constructs or refines CAD intermediate representation from editable parameters."""
    hole_entities = []
    geometry_entities = [
        {"type": "rectangle", "x": 0.0, "y": 0.0, "width": params.width_mm, "height": params.height_mm}
    ]
    
    for idx, h in enumerate(params.holes):
        x = float(h.get("x_mm", 0.0))
        y = float(h.get("y_mm", 0.0))
        diam = float(h.get("diameter_mm", 15.0))
        rad = diam / 2.0
        hole_entity = HoleEntity(
            id=idx + 1,
            x_mm=x,
            y_mm=y,
            diameter_mm=diam,
            radius_mm=rad
        )
        hole_entities.append(hole_entity)
        geometry_entities.append({
            "type": "circle",
            "id": idx + 1,
            "cx": x,
            "cy": y,
            "radius": rad,
            "diameter": diam
        })

    return CADModel(
        component=CADComponent(
            name=params.part_name,
            width=params.width_mm,
            height=params.height_mm,
            thickness=params.thickness_mm
        ),
        geometry=geometry_entities,
        holes=hole_entities,
        metadata=CADMetadata(
            scale_mm_per_pixel=0.2,
            source="manual_cad_editor"
        )
    )

# ----------------------------------------------------
# 5. Generate DXF
# ----------------------------------------------------
@router.post("/generate-dxf", response_model=GenerateDxfResponse)
def generate_dxf(req: GenerateDxfRequest, scan_id: Optional[str] = None):
    """
    Translates CAD intermediate model into a physical, AutoCAD-compliant .dxf file.
    Includes layers: OUTLINE, HOLES, CENTERLINES, DIMENSIONS, TITLEBLOCK.
    """
    try:
        result = dxf_generator.export(
            cad_model=req.cad_data,
            include_dimensions=req.include_dimensions,
            include_centerlines=req.include_centerlines,
            include_titleblock=req.include_titleblock,
            dxf_version=req.dxf_version
        )

        filename = result["filename"]
        download_url = f"/api/download/{filename}"

        # If linked to a scan, update DB
        if scan_id:
            update_scan_dxf(scan_id, filename)

        return GenerateDxfResponse(
            success=True,
            filename=filename,
            download_url=download_url,
            file_size_bytes=result["file_size_bytes"],
            layers=result["layers"],
            entity_count=result["entity_count"],
            created_at=result["created_at"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DXF compilation failed: {str(e)}")

# ----------------------------------------------------
# 6. Download DXF File
# ----------------------------------------------------
@router.get("/download/{filename}")
def download_dxf(filename: str):
    """Streams generated DXF drawing file for download."""
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(EXPORT_DIR, safe_filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Requested DXF file not found.")

    return FileResponse(
        path=filepath,
        filename=safe_filename,
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
    )

# ----------------------------------------------------
# 7. Scan History
# ----------------------------------------------------
@router.get("/scans")
def list_scans():
    """Retrieves all past scan records from SQLite database."""
    return get_all_scans()

@router.get("/scans/{scan_id}")
def get_scan(scan_id: str):
    """Retrieves detailed scan record by ID."""
    scan = get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail=f"Scan with ID '{scan_id}' not found.")
    return scan

# ----------------------------------------------------
# 8. Sample Datasets for Hackathon 60s Demo
# ----------------------------------------------------
@router.get("/sample-data")
def list_sample_data():
    """Provides sample datasets and direct image URLs for testing and demoing."""
    samples = [
        {
            "id": "mechanical-plate-mvp",
            "name": "Mechanical Plate MVP (120x80mm)",
            "description": "Anodized aluminum plate, 120x80x10mm with 4x 15mm through-holes and 50mm ArUco reference marker.",
            "file": "mechanical_plate_mvp.png",
            "expected_width_mm": 120.0,
            "expected_height_mm": 80.0,
            "expected_thickness_mm": 10.0,
            "expected_holes": 4,
            "image_url": "/api/sample-image/mechanical_plate_mvp.png"
        },
        {
            "id": "circular-flange",
            "name": "Circular Flange Component (100mm OD)",
            "description": "Rotational flange, 100mm OD with 30mm central bore and 4x 10mm bolt circle holes.",
            "file": "circular_flange.png",
            "expected_width_mm": 100.0,
            "expected_height_mm": 100.0,
            "expected_thickness_mm": 12.0,
            "expected_holes": 5,
            "image_url": "/api/sample-image/circular_flange.png"
        },
        {
            "id": "aruco-marker-50mm",
            "name": "Printable 50mm ArUco Marker",
            "description": "Calibrated 50mm ArUco reference target (DICT_4X4_50 ID:0) ready to print or display on phone.",
            "file": "aruco_marker_50mm.png",
            "image_url": "/api/sample-image/aruco_marker_50mm.png"
        }
    ]
    return samples

@router.get("/sample-image/{filename}")
def get_sample_image(filename: str):
    """Serves sample image files."""
    safe_name = os.path.basename(filename)
    path = os.path.join(SAMPLE_DATA_DIR, safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Sample image not found.")
    return FileResponse(path=path, media_type="image/png")
