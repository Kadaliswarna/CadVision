export interface Hole {
  id: number;
  x_mm: number;
  y_mm: number;
  diameter_mm: number;
  radius_mm: number;
  type?: string;
}

export interface CADComponent {
  name: string;
  object_type: string;
  units: string;
  width: number;
  height: number;
  thickness: number;
  material: string;
}

export interface CADMetadata {
  timestamp: string;
  scale_mm_per_pixel: number;
  aruco_marker_id?: number;
  aruco_marker_size_mm: number;
  confidence: number;
  source: string;
}

export interface CADModel {
  component: CADComponent;
  geometry: any[];
  holes: Hole[];
  metadata: CADMetadata;
}

export interface AnalysisResult {
  success: boolean;
  scan_id: string;
  message: string;
  object_type: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  holes: Hole[];
  scale_mm_per_pixel: number;
  aruco_detected: boolean;
  aruco_id?: number;
  cad_data: CADModel;
  annotated_image_base64: string;
}

export interface DxfResult {
  success: boolean;
  filename: string;
  download_url: string;
  file_size_bytes: number;
  layers: string[];
  entity_count: number;
  created_at: string;
}

export interface ScanRecord {
  scan_id: string;
  created_at: string;
  object_name: string;
  object_type: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  hole_count: number;
  dxf_filename?: string;
  thumbnail_base64?: string;
}
