package com.iqoo.cadvision.views

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import com.iqoo.cadvision.models.HoleEntity

class VectorCadView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val outlinePaint = Paint().apply {
        color = Color.parseColor("#00F0FF")
        strokeWidth = 5f
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    private val fillPaint = Paint().apply {
        color = Color.parseColor("#1500F0FF")
        style = Paint.Style.FILL
    }

    private val holePaint = Paint().apply {
        color = Color.parseColor("#FF2A85")
        strokeWidth = 4f
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    private val holeFillPaint = Paint().apply {
        color = Color.parseColor("#070A11")
        style = Paint.Style.FILL
    }

    private val centerlinePaint = Paint().apply {
        color = Color.parseColor("#FFB800")
        strokeWidth = 2.5f
        style = Paint.Style.STROKE
        isAntiAlias = true
        pathEffect = DashPathEffect(floatArrayOf(10f, 6f), 0f)
    }

    private val dimPaint = Paint().apply {
        color = Color.parseColor("#00E676")
        strokeWidth = 2.5f
        style = Paint.Style.STROKE
        isAntiAlias = true
    }

    private val textPaint = Paint().apply {
        color = Color.parseColor("#00E676")
        textSize = 28f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        isAntiAlias = true
    }

    private var plateWidthMm = 120f
    private var plateHeightMm = 80f
    private var holes: List<HoleEntity> = emptyList()

    fun setGeometry(widthMm: Float, heightMm: Float, holesList: List<HoleEntity>) {
        this.plateWidthMm = widthMm
        this.plateHeightMm = heightMm
        this.holes = holesList
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()

        val padding = 90f
        val availW = w - padding * 2f
        val availH = h - padding * 2f

        val scale = minOf(availW / plateWidthMm, availH / plateHeightMm)
        val drawW = plateWidthMm * scale
        val drawH = plateHeightMm * scale

        val originX = (w - drawW) / 2f
        val originY = (h - drawH) / 2f

        // 1. Draw Plate Outline
        val plateRect = RectF(originX, originY, originX + drawW, originY + drawH)
        canvas.drawRect(plateRect, fillPaint)
        canvas.drawRect(plateRect, outlinePaint)

        // 2. Draw Holes and Centerlines
        for (hole in holes) {
            val hx = originX + hole.xMm * scale
            val hy = originY + hole.yMm * scale
            val hr = hole.radiusMm * scale

            // Cutout
            canvas.drawCircle(hx, hy, hr, holeFillPaint)
            canvas.drawCircle(hx, hy, hr, holePaint)

            // Centerlines
            val ext = hr + 18f
            canvas.drawLine(hx - ext, hy, hx + ext, hy, centerlinePaint)
            canvas.drawLine(hx, hy - ext, hx, hy + ext, centerlinePaint)
        }

        // 3. Dimension Line: Width (Top)
        val dimY = originY - 35f
        canvas.drawLine(originX, dimY, originX + drawW, dimY, dimPaint)
        canvas.drawLine(originX, originY - 5f, originX, dimY - 10f, dimPaint)
        canvas.drawLine(originX + drawW, originY - 5f, originX + drawW, dimY - 10f, dimPaint)
        val wLabel = "${String.format("%.1f", plateWidthMm)} mm"
        val tw = textPaint.measureText(wLabel)
        canvas.drawText(wLabel, originX + (drawW - tw) / 2f, dimY - 10f, textPaint)

        // 4. Dimension Line: Height (Left)
        val dimX = originX - 35f
        canvas.drawLine(dimX, originY, dimX, originY + drawH, dimPaint)
        canvas.drawLine(originX - 5f, originY, dimX - 10f, originY, dimPaint)
        canvas.drawLine(originX - 5f, originY + drawH, dimX - 10f, originY + drawH, dimPaint)
        val hLabel = "${String.format("%.1f", plateHeightMm)} mm"
        val th = textPaint.measureText(hLabel)
        canvas.save()
        canvas.rotate(-90f, dimX - 12f, originY + drawH / 2f)
        canvas.drawText(hLabel, dimX - 12f - th / 2f, originY + drawH / 2f, textPaint)
        canvas.restore()
    }
}
