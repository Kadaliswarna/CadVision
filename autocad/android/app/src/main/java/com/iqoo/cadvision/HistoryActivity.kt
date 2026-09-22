package com.iqoo.cadvision

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.iqoo.cadvision.databinding.ActivityHistoryBinding
import com.iqoo.cadvision.models.ScanRecord
import com.iqoo.cadvision.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HistoryActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHistoryBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHistoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.rvScans.layoutManager = LinearLayoutManager(this)

        setupListeners()
        loadScans()
    }

    private fun setupListeners() {
        binding.btnHistoryBack.setOnClickListener {
            finish()
        }
    }

    private fun loadScans() {
        binding.historyProgressBar.visibility = View.VISIBLE
        binding.tvEmptyHistory.visibility = View.GONE

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val resp = ApiClient.getService().getScans()
                withContext(Dispatchers.Main) {
                    binding.historyProgressBar.visibility = View.GONE
                    if (resp.isSuccessful && resp.body() != null) {
                        val scans = resp.body()!!
                        if (scans.isEmpty()) {
                            binding.tvEmptyHistory.visibility = View.VISIBLE
                        } else {
                            binding.rvScans.adapter = ScanAdapter(scans)
                        }
                    } else {
                        binding.tvEmptyHistory.visibility = View.VISIBLE
                        binding.tvEmptyHistory.text = "Failed to load scans from PC"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.historyProgressBar.visibility = View.GONE
                    binding.tvEmptyHistory.visibility = View.VISIBLE
                    binding.tvEmptyHistory.text = "Server connection error: ${e.localizedMessage}"
                }
            }
        }
    }

    inner class ScanAdapter(private val items: List<ScanRecord>) :
        RecyclerView.Adapter<ScanAdapter.ScanViewHolder>() {

        inner class ScanViewHolder(val view: View) : RecyclerView.ViewHolder(view) {
            val tvName: TextView = view.findViewById(android.R.id.text1)
            val tvDetails: TextView = view.findViewById(android.R.id.text2)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ScanViewHolder {
            val view = LayoutInflater.from(parent.context)
                .inflate(android.R.layout.simple_list_item_2, parent, false)
            return ScanViewHolder(view)
        }

        override fun onBindViewHolder(holder: ScanViewHolder, position: Int) {
            val item = items[position]
            holder.tvName.text = item.objectName
            holder.tvName.setTextColor(getColor(R.color.accent_cyan))
            holder.tvDetails.text = "${String.format("%.1f", item.widthMm)} x ${String.format("%.1f", item.heightMm)} mm | ${item.holeCount} holes\nDXF: ${item.dxfFilename ?: "None"}"
            holder.tvDetails.setTextColor(getColor(R.color.text_secondary))

            holder.view.setOnClickListener {
                item.dxfFilename?.let { dxf ->
                    val url = "${ApiClient.getServerUrl()}/api/download/$dxf"
                    val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(browserIntent)
                } ?: Toast.makeText(this@HistoryActivity, "No DXF generated for this scan yet", Toast.LENGTH_SHORT).show()
            }
        }

        override fun getItemCount(): Int = items.size
    }
}
