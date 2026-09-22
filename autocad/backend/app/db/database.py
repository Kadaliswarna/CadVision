"""
SQLite Database Layer for iQOO CADVision Scan History.
Stores scan metadata, physical dimensions, timestamps, thumbnails, and generated DXF references.
"""

import sqlite3
import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "cadvision.db"))

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the SQLite schema."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                scan_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                object_name TEXT NOT NULL,
                object_type TEXT NOT NULL,
                width_mm REAL NOT NULL,
                height_mm REAL NOT NULL,
                thickness_mm REAL NOT NULL,
                hole_count INTEGER NOT NULL,
                holes_json TEXT,
                cad_data_json TEXT,
                scale_mm_per_pixel REAL NOT NULL,
                aruco_id INTEGER,
                dxf_filename TEXT,
                thumbnail_base64 TEXT
            )
        """)
        conn.commit()

def save_scan(
    scan_id: str,
    object_name: str,
    object_type: str,
    width_mm: float,
    height_mm: float,
    thickness_mm: float,
    hole_count: int,
    holes: List[Any],
    cad_data: Dict[str, Any],
    scale_mm_per_pixel: float,
    aruco_id: Optional[int],
    thumbnail_base64: Optional[str] = None,
    dxf_filename: Optional[str] = None
) -> Dict[str, Any]:
    """Inserts a new scan record."""
    created_at = datetime.now(timezone.utc).isoformat()
    # Serialize holes and cad data
    holes_serializable = [h.model_dump() if hasattr(h, "model_dump") else (h.dict() if hasattr(h, "dict") else h) for h in holes]
    cad_serializable = cad_data.model_dump() if hasattr(cad_data, "model_dump") else (cad_data.dict() if hasattr(cad_data, "dict") else cad_data)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO scans (
                scan_id, created_at, object_name, object_type, width_mm, height_mm,
                thickness_mm, hole_count, holes_json, cad_data_json, scale_mm_per_pixel,
                aruco_id, dxf_filename, thumbnail_base64
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            scan_id,
            created_at,
            object_name,
            object_type,
            width_mm,
            height_mm,
            thickness_mm,
            hole_count,
            json.dumps(holes_serializable),
            json.dumps(cad_serializable),
            scale_mm_per_pixel,
            aruco_id,
            dxf_filename,
            thumbnail_base64
        ))
        conn.commit()

    return {
        "scan_id": scan_id,
        "created_at": created_at,
        "object_name": object_name,
        "width_mm": width_mm,
        "height_mm": height_mm,
        "thickness_mm": thickness_mm,
        "hole_count": hole_count,
        "dxf_filename": dxf_filename
    }

def update_scan_dxf(scan_id: str, dxf_filename: str):
    """Updates DXF filename for a scan."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE scans SET dxf_filename = ? WHERE scan_id = ?", (dxf_filename, scan_id))
        conn.commit()

def get_all_scans() -> List[Dict[str, Any]]:
    """Retrieves all scan records ordered by date descending."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT scan_id, created_at, object_name, object_type, width_mm, height_mm,
                   thickness_mm, hole_count, dxf_filename, thumbnail_base64
            FROM scans ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def get_scan_by_id(scan_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves a single scan record with full details."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM scans WHERE scan_id = ?", (scan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        data = dict(row)
        if data.get("holes_json"):
            data["holes"] = json.loads(data["holes_json"])
        if data.get("cad_data_json"):
            data["cad_data"] = json.loads(data["cad_data_json"])
        return data

# Initialize on module load
init_db()
