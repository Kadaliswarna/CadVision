package com.iqoo.cadvision

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.iqoo.cadvision.databinding.ActivityCadResultBinding
import com.iqoo.cadvision.models.AnalyzeImageResponse
import com.iqoo.cadvision.models.GenerateDxfRequest
import com.iqoo.cadvision.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CadResultActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCadResultBinding
    private var analysisResult: AnalyzeImageResponse? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCadResultBinding.inflate(layoutInflater)
        setContentView(binding.root)

        @Suppress("DEPRECATION")
        analysisResult = intent.getSerializableExtra("analysis_result") as? AnalyzeImageResponse

        displayResult()
        setupListeners()
    }

    private fun displayResult() {
        val res = analysisResult ?: return

        binding.tvPartTitle.text = res.cadData.component.name
        binding.tvLength.text = "${String.format("%.1f", res.widthMm)} mm"
        binding.tvWidth.text = "${String.format("%.1f", res.heightMm)} mm"

        // Set Vector CAD Drawing
        binding.vectorCadView.setGeometry(res.widthMm, res.heightMm, res.holes)

        // Holes list format
        if (res.holes.isNotEmpty()) {
            val sb = StringBuilder()
            res.holes.forEach { h ->
                sb.append("Hole ${h.id}: (${String.format("%.1f", h.xMm)}, ${String.format("%.1f", h.yMm)}) mm | Ø${String.format("%.1f", h.diameterMm)} mm\n")
            }
            binding.tvHolesList.text = sb.toString().trimEnd()
        } else {
            binding.tvHolesList.text = "No internal cutouts detected."
        }
    }

    private fun setupListeners() {
        binding.btnResultBack.setOnClickListener {
            finish()
        }

        binding.btnGenerateDxf.setOnClickListener {
            generateDxfOnPc()
        }
    }

    private fun generateDxfOnPc() {
        val res = analysisResult ?: return

        binding.btnGenerateDxf.isEnabled = false
        binding.btnGenerateDxf.text = "Generating AutoCAD DXF..."

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val req = GenerateDxfRequest(
                    cadData = res.cadData,
                    includeDimensions = true,
                    includeCenterlines = true,
                    includeTitleblock = true,
                    dxfVersion = "R2010"
                )

                val dxfResp = ApiClient.getService().generateDxf(req)

                withContext(Dispatchers.Main) {
                    binding.btnGenerateDxf.isEnabled = true
                    binding.btnGenerateDxf.text = getString(R.string.generate_dxf)

                    if (dxfResp.isSuccessful && dxfResp.body() != null) {
                        val body = dxfResp.body()!!
                        binding.tvDxfStatus.visibility = View.VISIBLE
                        binding.tvDxfStatus.text = "✓ CAD generated successfully\n${body.filename}\nAvailable on PC: ${body.downloadUrl}"
                        Toast.makeText(this@CadResultActivity, "DXF Generated: ${body.filename}", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(this@CadResultActivity, "DXF generation failed on PC server", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.btnGenerateDxf.isEnabled = true
                    binding.btnGenerateDxf.text = getString(R.string.generate_dxf)
                    Toast.makeText(this@CadResultActivity, "Network error: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
