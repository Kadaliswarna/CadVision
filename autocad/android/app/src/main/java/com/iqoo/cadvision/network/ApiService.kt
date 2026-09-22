package com.iqoo.cadvision.network

import com.iqoo.cadvision.models.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @GET("/api/health")
    suspend fun checkHealth(): Response<Map<String, Any>>

    @Multipart
    @POST("/api/analyze-image")
    suspend fun analyzeImage(
        @Part file: MultipartBody.Part,
        @Part("marker_size_mm") markerSizeMm: RequestBody,
        @Part("thickness_mm") thicknessMm: RequestBody
    ): Response<AnalyzeImageResponse>

    @POST("/api/generate-dxf")
    suspend fun generateDxf(
        @Body request: GenerateDxfRequest
    ): Response<GenerateDxfResponse>

    @GET("/api/scans")
    suspend fun getScans(): Response<List<ScanRecord>>

    @Streaming
    @GET("/api/download/{filename}")
    suspend fun downloadDxf(
        @Path("filename") filename: String
    ): Response<ResponseBody>
}
