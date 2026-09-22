"""
DXF Generator for iQOO CADVision using ezdxf.
Creates production-grade, multi-layered AutoCAD DXF files complete with:
- OUTLINE layer (outer boundary polyline)
- HOLES layer (circular cutouts)
- CENTERLINES layer (crosshairs with CENTER linetype)
- DIMENSIONS layer (linear dimensions & callout annotations)
- TITLEBLOCK layer (engineering border, part metadata & title block)
"""

import os
import uuid
import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import ezdxf
from ezdxf.enums import TextEntityAlignment
from app.models.cad_models import CADModel, GenerateDxfResponse

EXPORT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports"))
os.makedirs(EXPORT_DIR, exist_ok=True)

class DxfExporter:
    def __init__(self, output_dir: str = EXPORT_DIR):
        self.output_dir = output_dir

    def export(
        self,
        cad_model: CADModel,
        filename: Optional[str] = None,
        include_dimensions: bool = True,
        include_centerlines: bool = True,
        include_titleblock: bool = True,
        dxf_version: str = "R2010"
    ) -> Dict[str, Any]:
        """
        Generates a valid AutoCAD DXF file from CAD intermediate representation.
        """
        if not filename:
            safe_name = cad_model.component.name.lower().replace(" ", "_").replace("/", "_")
            unique_suffix = uuid.uuid4().hex[:6]
            filename = f"{safe_name}_{unique_suffix}.dxf"
        elif not filename.lower().endswith(".dxf"):
            filename = f"{filename}.dxf"

        filepath = os.path.join(self.output_dir, filename)

        # Create DXF Document
        doc = ezdxf.new(dxfversion=dxf_version, setup=True)
        msp = doc.modelspace()

        # Set drawing units to Millimeters (AutoCAD $INSUNITS = 4)
        doc.header['$INSUNITS'] = 4
        doc.header['$MEASUREMENT'] = 1 # Metric

        # Setup Standard CAD Layers
        layers = [
            ("OUTLINE", 7, 50, "Continuous"),      # White/Black, 0.50mm
            ("HOLES", 1, 35, "Continuous"),        # Red, 0.35mm
            ("CENTERLINES", 2, 18, "CENTER"),      # Yellow, 0.18mm
            ("DIMENSIONS", 3, 25, "Continuous"),   # Green, 0.25mm
            ("ANNOTATIONS", 4, 25, "Continuous"),  # Cyan, 0.25mm
            ("TITLEBLOCK", 5, 25, "Continuous"),   # Blue, 0.25mm
        ]

        for layer_name, color, lineweight, linetype in layers:
            if layer_name not in doc.layers:
                doc.layers.add(
                    name=layer_name,
                    color=color,
                    lineweight=lineweight,
                    linetype=linetype
                )

        entity_count = 0
        w = float(cad_model.component.width)
        h = float(cad_model.component.height)
        t = float(cad_model.component.thickness)
        part_name = cad_model.component.name

        # ----------------------------------------------------
        # 1. OUTLINE Layer: Outer Plate Boundary
        # ----------------------------------------------------
        # Standard rectangular perimeter (0,0) to (w,h)
        # Note: In CAD, Y points upwards
        # We map image Y downwards to CAD standard Y upwards
        outer_points = [
            (0.0, 0.0),
            (w, 0.0),
            (w, h),
            (0.0, h)
        ]
        msp.add_lwpolyline(
            outer_points,
            close=True,
            dxfattribs={"layer": "OUTLINE", "lineweight": 50}
        )
        entity_count += 1

        # ----------------------------------------------------
        # 2. HOLES Layer & CENTERLINES Layer
        # ----------------------------------------------------
        for hole in cad_model.holes:
            # Map coordinates: x stays x, y is inverted to CAD Y (h - y_mm)
            cad_x = float(hole.x_mm)
            cad_y = float(h - hole.y_mm)
            radius = float(hole.radius_mm)

            # Circular Cutout
            msp.add_circle(
                center=(cad_x, cad_y),
                radius=radius,
                dxfattribs={"layer": "HOLES", "lineweight": 35}
            )
            entity_count += 1

            # Centerlines
            if include_centerlines:
                ext = max(3.0, radius * 0.4)
                # Horizontal centerline
                msp.add_line(
                    (cad_x - radius - ext, cad_y),
                    (cad_x + radius + ext, cad_y),
                    dxfattribs={"layer": "CENTERLINES", "linetype": "CENTER", "lineweight": 18}
                )
                # Vertical centerline
                msp.add_line(
                    (cad_x, cad_y - radius - ext),
                    (cad_x, cad_y + radius + ext),
                    dxfattribs={"layer": "CENTERLINES", "linetype": "CENTER", "lineweight": 18}
                )
                entity_count += 2

        # ----------------------------------------------------
        # 3. DIMENSIONS Layer
        # ----------------------------------------------------
        if include_dimensions:
            # Overall Width Dimension (Bottom: Y = -15)
            dim_y = -15.0
            msp.add_line((0.0, 0.0), (0.0, dim_y - 2.0), dxfattribs={"layer": "DIMENSIONS"})
            msp.add_line((w, 0.0), (w, dim_y - 2.0), dxfattribs={"layer": "DIMENSIONS"})
            msp.add_line((0.0, dim_y), (w, dim_y), dxfattribs={"layer": "DIMENSIONS"})
            # Arrow ticks
            msp.add_line((0.0, dim_y - 2.0), (4.0, dim_y + 2.0), dxfattribs={"layer": "DIMENSIONS"})
            msp.add_line((w - 4.0, dim_y - 2.0), (w, dim_y + 2.0), dxfattribs={"layer": "DIMENSIONS"})
            # Dimension Text
            msp.add_text(
                f"{w:.1f} mm",
                dxfattribs={"layer": "DIMENSIONS", "height": 3.5}
            ).set_placement((w / 2.0, dim_y + 1.5), align=TextEntityAlignment.BOTTOM_CENTER)
            entity_count += 6

            # Overall Height Dimension (Left: X = -15)
            dim_x = -15.0
            msp.add_line((0.0, 0.0), (dim_x - 2.0, 0.0), dxfattribs={"layer": "DIMENSIONS"})
            msp.add_line((0.0, h), (dim_x - 2.0, h), dxfattribs={"layer": "DIMENSIONS"})
            msp.add_line((dim_x, 0.0), (dim_x, h), dxfattribs={"layer": "DIMENSIONS"})
            # Arrow ticks
            msp.add_line((dim_x - 2.0, 0.0), (dim_x + 2.0, 4.0), dxfattribs={"layer": "DIMENSIONS"})
            msp.add_line((dim_x - 2.0, h - 4.0), (dim_x + 2.0, h), dxfattribs={"layer": "DIMENSIONS"})
            # Height text (rotated 90 deg)
            msp.add_text(
                f"{h:.1f} mm",
                dxfattribs={"layer": "DIMENSIONS", "height": 3.5, "rotation": 90.0}
            ).set_placement((dim_x - 1.5, h / 2.0), align=TextEntityAlignment.BOTTOM_CENTER)
            entity_count += 6

            # Hole Callout Annotation
            if cad_model.holes:
                avg_diam = sum(hole.diameter_mm for hole in cad_model.holes) / len(cad_model.holes)
                first_hole = cad_model.holes[0]
                hx = float(first_hole.x_mm)
                hy = float(h - first_hole.y_mm)
                hr = float(first_hole.radius_mm)

                # Leader line from first hole
                p_on_circle = (hx + hr * 0.707, hy + hr * 0.707)
                p_elbow = (hx + hr + 12.0, hy + hr + 12.0)
                p_end = (p_elbow[0] + 18.0, p_elbow[1])
                msp.add_line(p_on_circle, p_elbow, dxfattribs={"layer": "DIMENSIONS"})
                msp.add_line(p_elbow, p_end, dxfattribs={"layer": "DIMENSIONS"})
                callout_txt = f"{len(cad_model.holes)}X %%C{avg_diam:.1f} THRU"
                msp.add_text(
                    callout_txt,
                    dxfattribs={"layer": "DIMENSIONS", "height": 3.0}
                ).set_placement((p_elbow[0] + 1.0, p_elbow[1] + 1.0), align=TextEntityAlignment.BOTTOM_LEFT)
                entity_count += 3

        # ----------------------------------------------------
        # 4. TITLEBLOCK Layer: Engineering Border & Part Info
        # ----------------------------------------------------
        if include_titleblock:
            tb_w = 95.0
            tb_h = 42.0
            tb_x = max(w + 25.0, 140.0)
            tb_y = 0.0

            # Outer title block box
            msp.add_lwpolyline(
                [
                    (tb_x, tb_y),
                    (tb_x + tb_w, tb_y),
                    (tb_x + tb_w, tb_y + tb_h),
                    (tb_x, tb_y + tb_h)
                ],
                close=True,
                dxfattribs={"layer": "TITLEBLOCK", "lineweight": 35}
            )
            entity_count += 1

            # Internal dividers
            msp.add_line((tb_x, tb_y + 28.0), (tb_x + tb_w, tb_y + 28.0), dxfattribs={"layer": "TITLEBLOCK"})
            msp.add_line((tb_x, tb_y + 14.0), (tb_x + tb_w, tb_y + 14.0), dxfattribs={"layer": "TITLEBLOCK"})
            msp.add_line((tb_x + 48.0, tb_y), (tb_x + 48.0, tb_y + 14.0), dxfattribs={"layer": "TITLEBLOCK"})
            entity_count += 3

            # Title block texts
            date_str = datetime.now().strftime("%Y-%m-%d")
            msp.add_text("iQOO CADVision v1.0", dxfattribs={"layer": "TITLEBLOCK", "height": 3.2}).set_placement(
                (tb_x + 4.0, tb_y + 34.0), align=TextEntityAlignment.BOTTOM_LEFT)
            msp.add_text("AI Real-World -> CAD System", dxfattribs={"layer": "TITLEBLOCK", "height": 2.2}).set_placement(
                (tb_x + 4.0, tb_y + 29.5), align=TextEntityAlignment.BOTTOM_LEFT)
            msp.add_text(f"PART: {part_name.upper()}", dxfattribs={"layer": "TITLEBLOCK", "height": 2.8}).set_placement(
                (tb_x + 4.0, tb_y + 21.0), align=TextEntityAlignment.BOTTOM_LEFT)
            msp.add_text(f"SIZE: {w:.1f} x {h:.1f} x {t:.1f} mm", dxfattribs={"layer": "TITLEBLOCK", "height": 2.4}).set_placement(
                (tb_x + 4.0, tb_y + 16.0), align=TextEntityAlignment.BOTTOM_LEFT)
            msp.add_text(f"MATERIAL: {cad_model.component.material}", dxfattribs={"layer": "TITLEBLOCK", "height": 2.0}).set_placement(
                (tb_x + 4.0, tb_y + 7.5), align=TextEntityAlignment.BOTTOM_LEFT)
            msp.add_text(f"DATE: {date_str}", dxfattribs={"layer": "TITLEBLOCK", "height": 2.0}).set_placement(
                (tb_x + 52.0, tb_y + 7.5), align=TextEntityAlignment.BOTTOM_LEFT)
            msp.add_text("UNITS: MM | SCALE 1:1", dxfattribs={"layer": "TITLEBLOCK", "height": 2.0}).set_placement(
                (tb_x + 4.0, tb_y + 2.5), align=TextEntityAlignment.BOTTOM_LEFT)
            msp.add_text("STATUS: RELEASED", dxfattribs={"layer": "TITLEBLOCK", "height": 2.0}).set_placement(
                (tb_x + 52.0, tb_y + 2.5), align=TextEntityAlignment.BOTTOM_LEFT)
            entity_count += 8

        # Save DXF File
        doc.saveas(filepath)
        file_size = os.path.getsize(filepath)

        return {
            "success": True,
            "filename": filename,
            "filepath": filepath,
            "file_size_bytes": file_size,
            "layers": [layer[0] for layer in layers],
            "entity_count": entity_count,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

# Global DXF exporter instance
dxf_generator = DxfExporter()
