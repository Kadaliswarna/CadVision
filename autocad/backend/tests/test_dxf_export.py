"""
Tests for DXF export functionality using ezdxf.
"""

import os
import pytest
import ezdxf
from app.models.cad_models import CADModel, CADComponent, CADMetadata, HoleEntity
from app.cad.dxf_exporter import DxfExporter

@pytest.fixture
def sample_cad_model():
    return CADModel(
        component=CADComponent(
            name="Test Plate",
            width=120.0,
            height=80.0,
            thickness=10.0,
            material="Aluminium 6061-T6"
        ),
        geometry=[
            {"type": "rectangle", "width": 120.0, "height": 80.0}
        ],
        holes=[
            HoleEntity(id=1, x_mm=25.0, y_mm=20.0, diameter_mm=15.0, radius_mm=7.5),
            HoleEntity(id=2, x_mm=95.0, y_mm=20.0, diameter_mm=15.0, radius_mm=7.5),
            HoleEntity(id=3, x_mm=25.0, y_mm=60.0, diameter_mm=15.0, radius_mm=7.5),
            HoleEntity(id=4, x_mm=95.0, y_mm=60.0, diameter_mm=15.0, radius_mm=7.5),
        ],
        metadata=CADMetadata(
            scale_mm_per_pixel=0.20,
            aruco_marker_id=0
        )
    )

def test_dxf_file_generation(tmp_path, sample_cad_model):
    """Verifies that DXF file is generated with all expected layers and entities."""
    exporter = DxfExporter(output_dir=str(tmp_path))
    res = exporter.export(sample_cad_model, filename="output_test.dxf")
    
    assert res["success"] is True
    filepath = res["filepath"]
    assert os.path.exists(filepath)
    assert os.path.getsize(filepath) > 5000

    # Read back DXF with ezdxf
    doc = ezdxf.readfile(filepath)
    layer_names = [l.dxf.name for l in doc.layers]
    
    # Required AutoCAD layers
    assert "OUTLINE" in layer_names
    assert "HOLES" in layer_names
    assert "CENTERLINES" in layer_names
    assert "DIMENSIONS" in layer_names
    assert "TITLEBLOCK" in layer_names

    # Check entities in modelspace
    msp = doc.modelspace()
    entities = list(msp)
    assert len(entities) >= 30, f"Expected at least 30 entities, got {len(entities)}"

    # Check circles count
    circles = [e for e in entities if e.dxftype() == "CIRCLE"]
    assert len(circles) == 4, f"Expected 4 CIRCLE entities for holes, got {len(circles)}"
