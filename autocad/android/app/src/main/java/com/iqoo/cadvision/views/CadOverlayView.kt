package com.iqoo.cadvision.views

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View

class CadOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val cyanPaint = Paint().apply {
        color = Color.parseColor("#00F0FF")
        strokeWidth = 4f
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    private val amberPaint = Paint().apply {
        color = Color.parseColor("#FFB800")
        strokeWidth = 3f
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    private val textPaint = Paint().apply {
        color = Color.parseColor("#F0F4FC")
        textSize = 34f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        isAntiAlias = true
    }

    private val hudBgPaint = Paint().apply {
        color = Color.parseColor("#B3070A11")
        style = Paint.Style.FILL
    }

    var detectedWidthMm: Float = 0f
    var detectedHeightMm: Float = 0f
    var holeCount: Int = 0
    var isObjectDetected: Boolean = false

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()

        // 1. Central Camera Target Reticle (Plate Framing Box)
        val boxW = w * 0.75f
        val boxH = h * 0.45f
        val left = (w - boxW) / 2f
        val top = (h - boxH) / 2f - 40f
        val right = left + boxW
        val bottom = top + boxH

        // Draw outer corner brackets
        val bracketLen = 50f
        // Top-Left
        canvas.drawLine(left, top, left + bracketLen, top, cyanPaint)
        canvas.drawLine(left, top, left, top + bracketLen, cyanPaint)
        // Top-Right
        canvas.drawLine(right - bracketLen, top, right, top, cyanPaint)
        canvas.drawLine(right, top, right, top + bracketLen, cyanPaint)
        // Bottom-Left
        canvas.drawLine(left, bottom, left + bracketLen, bottom, cyanPaint)
        canvas.drawLine(left, bottom, left, bottom - bracketLen, cyanPaint)
        // Bottom-Right
        canvas.drawLine(right - bracketLen, bottom, right, bottom, cyanPaint)
        canvas.drawLine(right, bottom, right, bottom - bracketLen, cyanPaint)

        // 2. ArUco Marker Target Frame (Left side guidance)
        val markerSize = 120f
        val mLeft = left - 30f
        val mTop = top + 40f
        val mRight = mLeft + markerSize
        val mBottom = mTop + markerSize

        canvas.drawRect(mLeft, mTop, mRight, mBottom, amberPaint)
        val markerLabelPaint = Paint(textPaint).apply {
            textSize = 22f
            color = Color.parseColor("#FFB800")
        }
        canvas.drawText("ArUco 50mm", mLeft, mTop - 10f, markerLabelPaint)

        // 3. Central crosshairs
        val cx = left + boxW / 2f
        val cy = top + boxH / 2f
        val chLen = 25f
        canvas.drawLine(cx - chLen, cy, cx + chLen, cy, cyanPaint)
        canvas.drawLine(cx, cy - chLen, cx, cy + chLen, cyanPaint)

        // 4. Live Dimensions HUD Overlay
        if (isObjectDetected && detectedWidthMm > 0f) {
            val hudRect = RectF(40f, bottom + 40f, w - 40f, bottom + 190f)
            canvas.drawRoundRect(hudRect, 16f, 16f, hudBgPaint)

            canvas.drawText("✓ Mechanical Plate Detected", 65f, bottom + 85f, Paint(textPaint).apply {
                color = Color.parseColor("#00F0FF")
                textSize = 32f
            })

            val statsText = "Length: ${String.format("%.1f", detectedWidthMm)} mm | Width: ${String.format("%.1f", detectedHeightMm)} mm"
            canvas.drawText(statsText, 65f, bottom + 125f, textPaint)

            val holesText = "Holes: $holeCount through-holes detected (Ø15 mm)"
            canvas.drawText(holesText, 65f, bottom + 165f, Paint(textPaint).apply {
                color = Color.parseColor("#94A3B8")
                textSize = 26f
            })
        } else {
            // Default reticle label
            canvas.drawText("Align component & ArUco marker in frame", left + 20f, bottom + 45f, Paint(textPaint).apply {
                textSize = 24f
                color = Color.parseColor("#94A3B8")
            })
        }
    }
}
