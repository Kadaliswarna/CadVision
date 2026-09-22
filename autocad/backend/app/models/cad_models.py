"""
Pydantic data models for iQOO CADVision.
Defines CAD intermediate representation, geometric primitives, and API schemas.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime, timezone

class HoleEntity(BaseModel):
    id: int
    x_mm: float = Field(..., description="Center X position relative to plate top-left in millimeters")
    y_mm: float = Field(..., description="Center Y position relative to plate top-left in millimeters")
    diameter_mm: float = Field(..., description="Hole diameter in millimeters")
    radius_mm: float = Field(..., description="Hole radius in millimeters")
    type: Literal["circle"] = "circle"

class CADRectangleEntity(BaseModel):
    type: Literal["rectangle"] = "rectangle"
    x: float = 0.0
    y: float = 0.0
    width: float = Field(..., description="Width in millimeters")
    height: float = Field(..., description="Height in millimeters")

class CADCircleEntity(BaseModel):
    type: Literal["circle"] = "circle"
    cx: float
    cy: float
    radius: float
    diameter: float

class CADComponent(BaseModel):
    name: str = "Mechanical Plate"
    object_type: str = "mechanical_plate"
    units: str = "mm"
    width: float = Field(..., description="Outer component width in mm")
    height: float = Field(..., description="Outer component height/length in mm")
    thickness: float = Field(default=10.0, description="Part material thickness in mm")
    material: str = "Aluminium 6061-T6"

class CADMetadata(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    scale_mm_per_pixel: float
    aruco_marker_id: Optional[int] = None
    aruco_marker_size_mm: float = 50.0
    confidence: float = 0.95
    source: str = "opencv_ar_pipeline"
    model_version: str = "iQOO CADVision v1.0"

class CADModel(BaseModel):
    component: CADComponent
    geometry: List[dict] = Field(..., description="Geometric primitives (rectangle, circle, etc.)")
    holes: List[HoleEntity] = Field(default_factory=list)
    metadata: CADMetadata

class AnalyzeImageResponse(BaseModel):
    success: bool
    scan_id: str
    message: str
    object_type: str
    width_mm: float
    height_mm: float
    thickness_mm: float
    holes: List[HoleEntity]
    scale_mm_per_pixel: float
    aruco_detected: bool
    aruco_id: Optional[int]
    cad_data: CADModel
    annotated_image_base64: str

class GenerateDxfRequest(BaseModel):
    cad_data: CADModel
    include_dimensions: bool = True
    include_centerlines: bool = True
    include_titleblock: bool = True
    dxf_version: str = "R2010"

class GenerateDxfResponse(BaseModel):
    success: bool
    filename: str
    download_url: str
    file_size_bytes: int
    layers: List[str]
    entity_count: int
    created_at: str

class ScanRecord(BaseModel):
    scan_id: str
    created_at: str
    object_name: str
    width_mm: float
    height_mm: float
    thickness_mm: float
    hole_count: int
    dxf_filename: Optional[str] = None
    thumbnail_base64: Optional[str] = None
