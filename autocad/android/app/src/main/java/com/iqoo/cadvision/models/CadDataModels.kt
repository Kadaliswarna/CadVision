package com.iqoo.cadvision.models

import com.google.gson.annotations.SerializedName
import java.io.Serializable

data class HoleEntity(
    @SerializedName("id") val id: Int,
    @SerializedName("x_mm") val xMm: Float,
    @SerializedName("y_mm") val yMm: Float,
    @SerializedName("diameter_mm") val diameterMm: Float,
    @SerializedName("radius_mm") val radiusMm: Float,
    @SerializedName("type") val type: String = "circle"
) : Serializable

data class CADComponent(
    @SerializedName("name") val name: String,
    @SerializedName("object_type") val objectType: String,
    @SerializedName("units") val units: String = "mm",
    @SerializedName("width") val width: Float,
    @SerializedName("height") val height: Float,
    @SerializedName("thickness") val thickness: Float = 10.0f,
    @SerializedName("material") val material: String = "Aluminium 6061-T6"
) : Serializable

data class CADMetadata(
    @SerializedName("timestamp") val timestamp: String?,
    @SerializedName("scale_mm_per_pixel") val scaleMmPerPixel: Float,
    @SerializedName("aruco_marker_id") val arucoMarkerId: Int?,
    @SerializedName("aruco_marker_size_mm") val arucoMarkerSizeMm: Float = 50.0f,
    @SerializedName("confidence") val confidence: Float = 0.95f,
    @SerializedName("source") val source: String = "android_cadvision"
) : Serializable

data class CADModel(
    @SerializedName("component") val component: CADComponent,
    @SerializedName("geometry") val geometry: List<Map<String, Any>>,
    @SerializedName("holes") val holes: List<HoleEntity>,
    @SerializedName("metadata") val metadata: CADMetadata
) : Serializable

data class AnalyzeImageResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("scan_id") val scanId: String,
    @SerializedName("message") val message: String,
    @SerializedName("object_type") val objectType: String,
    @SerializedName("width_mm") val widthMm: Float,
    @SerializedName("height_mm") val heightMm: Float,
    @SerializedName("thickness_mm") val thicknessMm: Float,
    @SerializedName("holes") val holes: List<HoleEntity>,
    @SerializedName("scale_mm_per_pixel") val scaleMmPerPixel: Float,
    @SerializedName("aruco_detected") val arucoDetected: Boolean,
    @SerializedName("aruco_id") val arucoId: Int?,
    @SerializedName("cad_data") val cadData: CADModel,
    @SerializedName("annotated_image_base64") val annotatedImageBase64: String
) : Serializable

data class GenerateDxfRequest(
    @SerializedName("cad_data") val cadData: CADModel,
    @SerializedName("include_dimensions") val includeDimensions: Boolean = true,
    @SerializedName("include_centerlines") val includeCenterlines: Boolean = true,
    @SerializedName("include_titleblock") val includeTitleblock: Boolean = true,
    @SerializedName("dxf_version") val dxfVersion: String = "R2010"
)

data class GenerateDxfResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("filename") val filename: String,
    @SerializedName("download_url") val downloadUrl: String,
    @SerializedName("file_size_bytes") val fileSizeBytes: Long,
    @SerializedName("layers") val layers: List<String>,
    @SerializedName("entity_count") val entityCount: Int,
    @SerializedName("created_at") val createdAt: String
) : Serializable

data class ScanRecord(
    @SerializedName("scan_id") val scanId: String,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("object_name") val objectName: String,
    @SerializedName("object_type") val objectType: String,
    @SerializedName("width_mm") val widthMm: Float,
    @SerializedName("height_mm") val heightMm: Float,
    @SerializedName("thickness_mm") val thicknessMm: Float,
    @SerializedName("hole_count") val holeCount: Int,
    @SerializedName("dxf_filename") val dxfFilename: String?,
    @SerializedName("thumbnail_base64") val thumbnailBase64: String?
) : Serializable
