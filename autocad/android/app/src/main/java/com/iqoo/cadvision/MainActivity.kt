package com.iqoo.cadvision

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.iqoo.cadvision.databinding.ActivityMainBinding
import com.iqoo.cadvision.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            startActivity(Intent(this, CameraScannerActivity::class.java))
        } else {
            Toast.makeText(this, "Camera permission is required to scan objects", Toast.LENGTH_LONG).show()
        }
    }

    private val imagePickerLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let { handleImageSelected(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        ApiClient.init(this)

        setupListeners()
    }

    override fun onResume() {
        super.onResume()
        updateServerDisplay()
        checkBackendHealth()
    }

    private fun setupListeners() {
        binding.btnScanObject.setOnClickListener {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                startActivity(Intent(this, CameraScannerActivity::class.java))
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }

        binding.btnUploadImage.setOnClickListener {
            imagePickerLauncher.launch("image/*")
        }

        binding.btnViewHistory.setOnClickListener {
            startActivity(Intent(this, HistoryActivity::class.java))
        }

        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private fun updateServerDisplay() {
        binding.tvServerUrl.text = ApiClient.getServerUrl()
    }

    private fun checkBackendHealth() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val resp = ApiClient.getService().checkHealth()
                withContext(Dispatchers.Main) {
                    if (resp.isSuccessful) {
                        binding.tvServerStatus.text = getString(R.string.connected)
                        binding.tvServerStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.accent_green))
                    } else {
                        binding.tvServerStatus.text = getString(R.string.disconnected)
                        binding.tvServerStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.accent_magenta))
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.tvServerStatus.text = getString(R.string.disconnected)
                    binding.tvServerStatus.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.accent_magenta))
                }
            }
        }
    }

    private fun handleImageSelected(uri: Uri) {
        Toast.makeText(this, "Analyzing selected image...", Toast.LENGTH_SHORT).show()

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                // Copy URI stream to temp file
                val tempFile = File(cacheDir, "gallery_upload.jpg")
                contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(tempFile).use { output ->
                        input.copyTo(output)
                    }
                }

                val reqFile = tempFile.asRequestBody("image/jpeg".toMediaTypeOrNull())
                val body = MultipartBody.Part.createFormData("file", tempFile.name, reqFile)
                val markerSize = "50.0".toRequestBody("text/plain".toMediaTypeOrNull())
                val thickness = "10.0".toRequestBody("text/plain".toMediaTypeOrNull())

                val resp = ApiClient.getService().analyzeImage(body, markerSize, thickness)
                withContext(Dispatchers.Main) {
                    if (resp.isSuccessful && resp.body() != null) {
                        val result = resp.body()!!
                        val intent = Intent(this@MainActivity, CadResultActivity::class.java).apply {
                            putExtra("analysis_result", result)
                        }
                        startActivity(intent)
                    } else {
                        val error = resp.errorBody()?.string() ?: "Analysis failed"
                        Toast.makeText(this@MainActivity, "Detection failed: $error", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Connection error: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
