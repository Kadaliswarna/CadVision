package com.iqoo.cadvision

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.iqoo.cadvision.databinding.ActivityCameraScannerBinding
import com.iqoo.cadvision.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraScannerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCameraScannerBinding
    private var imageCapture: ImageCapture? = null
    private lateinit var cameraExecutor: ExecutorService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCameraScannerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        cameraExecutor = Executors.newSingleThreadExecutor()

        startCamera()
        setupListeners()
    }

    private fun setupListeners() {
        binding.btnBack.setOnClickListener {
            finish()
        }

        binding.btnReset.setOnClickListener {
            binding.cadOverlay.isObjectDetected = false
            binding.cadOverlay.detectedWidthMm = 0f
            binding.cadOverlay.detectedHeightMm = 0f
            binding.cadOverlay.invalidate()
            Toast.makeText(this, "Target reticle reset. Align object and marker.", Toast.LENGTH_SHORT).show()
        }

        binding.btnCapture.setOnClickListener {
            captureAndAnalyze()
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder()
                .build()
                .also {
                    it.setSurfaceProvider(binding.viewFinder.surfaceProvider)
                }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    cameraSelector,
                    preview,
                    imageCapture
                )
            } catch (exc: Exception) {
                Toast.makeText(this, "Camera binding failed: ${exc.localizedMessage}", Toast.LENGTH_LONG).show()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun captureAndAnalyze() {
        val imageCapture = imageCapture ?: return

        binding.progressBar.visibility = View.VISIBLE
        binding.btnCapture.isEnabled = false

        val photoFile = File(
            cacheDir,
            SimpleDateFormat("yyyy-MM-dd-HH-mm-ss-SSS", Locale.US).format(System.currentTimeMillis()) + ".jpg"
        )

        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        imageCapture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onError(exc: ImageCaptureException) {
                    binding.progressBar.visibility = View.GONE
                    binding.btnCapture.isEnabled = true
                    Toast.makeText(baseContext, "Capture failed: ${exc.message}", Toast.LENGTH_SHORT).show()
                }

                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    uploadPhotoToBackend(photoFile)
                }
            }
        )
    }

    private fun uploadPhotoToBackend(photoFile: File) {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val reqFile = photoFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
                val body = MultipartBody.Part.createFormData("file", photoFile.name, reqFile)
                val markerSize = "50.0".toRequestBody("text/plain".toMediaTypeOrNull())
                val thickness = "10.0".toRequestBody("text/plain".toMediaTypeOrNull())

                val resp = ApiClient.getService().analyzeImage(body, markerSize, thickness)

                withContext(Dispatchers.Main) {
                    binding.progressBar.visibility = View.GONE
                    binding.btnCapture.isEnabled = true

                    if (resp.isSuccessful && resp.body() != null) {
                        val result = resp.body()!!

                        // Update local overlay feedback
                        binding.cadOverlay.isObjectDetected = true
                        binding.cadOverlay.detectedWidthMm = result.widthMm
                        binding.cadOverlay.detectedHeightMm = result.heightMm
                        binding.cadOverlay.holeCount = result.holes.size
                        binding.cadOverlay.invalidate()

                        Toast.makeText(this@CameraScannerActivity, "Detected: ${result.widthMm}x${result.heightMm} mm", Toast.LENGTH_SHORT).show()

                        // Open CAD Result Screen
                        val intent = Intent(this@CameraScannerActivity, CadResultActivity::class.java).apply {
                            putExtra("analysis_result", result)
                        }
                        startActivity(intent)
                    } else {
                        val err = resp.errorBody()?.string() ?: "Measurement failed. Check marker alignment and lighting."
                        Toast.makeText(this@CameraScannerActivity, "CV Error: $err", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.progressBar.visibility = View.GONE
                    binding.btnCapture.isEnabled = true
                    Toast.makeText(this@CameraScannerActivity, "PC server unreachable: ${e.localizedMessage}. Check Wi-Fi.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
