package com.iqoo.cadvision

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.iqoo.cadvision.databinding.ActivitySettingsBinding
import com.iqoo.cadvision.network.ApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Load existing IP & port
        binding.etServerIp.setText(ApiClient.getServerIp(this))
        binding.etServerPort.setText(ApiClient.getServerPort(this))

        setupListeners()
    }

    private fun setupListeners() {
        binding.btnSettingsBack.setOnClickListener {
            finish()
        }

        binding.btnTestPing.setOnClickListener {
            testConnection()
        }

        binding.btnSaveSettings.setOnClickListener {
            saveAndExit()
        }
    }

    private fun testConnection() {
        val ip = binding.etServerIp.text.toString().trim()
        val port = binding.etServerPort.text.toString().trim()

        if (ip.isEmpty() || port.isEmpty()) {
            Toast.makeText(this, "Please enter valid IP and port", Toast.LENGTH_SHORT).show()
            return
        }

        binding.btnTestPing.isEnabled = false
        binding.tvPingResult.text = "Pinging $ip:$port..."
        binding.tvPingResult.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))

        ApiClient.setServer(ip, port, this)

        val startTime = System.currentTimeMillis()
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val resp = ApiClient.getService().checkHealth()
                val latency = System.currentTimeMillis() - startTime

                withContext(Dispatchers.Main) {
                    binding.btnTestPing.isEnabled = true
                    if (resp.isSuccessful) {
                        binding.tvPingResult.text = "● Connected (${latency}ms) | Server: ${resp.body()?.get("service")}"
                        binding.tvPingResult.setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.accent_green))
                    } else {
                        binding.tvPingResult.text = "○ Server responded with HTTP ${resp.code()}"
                        binding.tvPingResult.setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.accent_magenta))
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    binding.btnTestPing.isEnabled = true
                    binding.tvPingResult.text = "○ Connection failed: ${e.localizedMessage}"
                    binding.tvPingResult.setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.accent_magenta))
                }
            }
        }
    }

    private fun saveAndExit() {
        val ip = binding.etServerIp.text.toString().trim()
        val port = binding.etServerPort.text.toString().trim()

        if (ip.isNotEmpty() && port.isNotEmpty()) {
            ApiClient.setServer(ip, port, this)
            Toast.makeText(this, "PC server configured: $ip:$port", Toast.LENGTH_SHORT).show()
            finish()
        }
    }
}
