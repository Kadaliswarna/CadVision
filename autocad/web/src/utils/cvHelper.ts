import type { Geometry } from '../types/geometry';

// Declare cv as any since it's loaded via CDN
declare var cv: any;

export async function waitForOpenCV(): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      if (typeof cv !== 'undefined' && cv.Mat) {
        resolve();
      } else if (attempts > 60) {
        reject(new Error("OpenCV.js failed to load. Please check your network connection."));
      } else {
        attempts++;
        setTimeout(check, 100);
      }
    };
    check();
  });
}

export type DetectionState = 'OBJECT_DETECTED' | 'POTENTIAL_OBJECT_DETECTED' | 'NO_OBJECT_FOUND' | 'IMAGE_QUALITY_LOW';

export interface ImageQualityMetrics {
  score: number; // 0-100
  brightness: number; // 0-255
  contrast: number; // stddev
  blurVariance: number; // laplacian variance
  isLowQuality: boolean;
  statusText: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'LOW';
  reasons: string[];
  suggestions: string[];
}

export interface AnalysisConfidence {
  objectConfidence: number; // 0-100
  geometryConfidence: number; // 0-100
  imageQuality: number; // 0-100
  overallConfidence: number; // 0-100
  overallStatus: 'READY FOR CAD' | 'POTENTIAL CAD GEOMETRY' | 'LOW CONFIDENCE';
}

export interface AnalysisResult {
  geometries: Geometry[];
  debugImageBase64?: string;
  detectionState: DetectionState;
  detectedCategory: string;
  confidence: AnalysisConfidence;
  quality: ImageQualityMetrics;
  scaleVerified: boolean;
  scaleMmPerPixel: number;
  stats: {
    imageWidth: number;
    imageHeight: number;
    contoursFound: number;
    contoursRejected: number;
    mainObjectFound: boolean;
    circlesDetected: number;
    rectanglesDetected: number;
    polygonsDetected: number;
    scaleStatus: string;
  };
  outerShapeDescription: string;
  internalFeaturesDescription: string;
}

export interface ManualROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Evaluates image quality prior to detection:
 * - Brightness (mean)
 * - Contrast (standard deviation)
 * - Sharpness / Blur (Laplacian variance)
 */
export function evaluateImageQuality(grayMat: any): ImageQualityMetrics {
  const meanMat = new cv.Mat();
  const stdMat = new cv.Mat();
  cv.meanStdDev(grayMat, meanMat, stdMat);
  const brightness = meanMat.data64F[0];
  const contrast = stdMat.data64F[0];
  meanMat.delete();
  stdMat.delete();

  // Blur evaluation using Laplacian variance
  const laplacian = new cv.Mat();
  cv.Laplacian(grayMat, laplacian, cv.CV_64F);
  const lapMean = new cv.Mat();
  const lapStd = new cv.Mat();
  cv.meanStdDev(laplacian, lapMean, lapStd);
  const blurVariance = lapStd.data64F[0] ** 2;
  laplacian.delete();
  lapMean.delete();
  lapStd.delete();

  const reasons: string[] = [];
  const suggestions: string[] = [];
  let isLowQuality = false;

  // Too dark
  if (brightness < 30) {
    reasons.push("Image is extremely dark");
    suggestions.push("Improve lighting or move to a brighter environment");
    isLowQuality = true;
  }
  // Too bright / washed out
  else if (brightness > 238 && contrast < 18) {
    reasons.push("Image is overexposed or washed out");
    suggestions.push("Reduce glare or avoid direct reflections");
    isLowQuality = true;
  }

  // Extremely low contrast / uniform blank image
  if (contrast < 12) {
    reasons.push("Image has virtually no contrast or edges");
    suggestions.push("Place the component on a contrasting, plain background");
    isLowQuality = true;
  }

  // Extreme blur
  if (blurVariance < 30 && contrast > 15) {
    reasons.push("Image is significantly blurry or out of focus");
    suggestions.push("Hold the camera steady and tap to focus on the object");
    isLowQuality = true;
  }

  if (isLowQuality) {
    suggestions.push("Keep the entire component visible within the frame");
    suggestions.push("Move closer to the object and avoid extreme angles");
  }

  // Calculate quality score 0-100
  let qualityScore = 100;
  if (brightness < 45) qualityScore -= (45 - brightness) * 1.5;
  if (brightness > 210) qualityScore -= (brightness - 210) * 1.2;
  if (contrast < 30) qualityScore -= (30 - contrast) * 1.5;
  if (blurVariance < 120) qualityScore -= Math.min(40, (120 - blurVariance) * 0.35);
  qualityScore = Math.max(10, Math.min(98, Math.round(qualityScore)));

  const statusText: ImageQualityMetrics['statusText'] =
    isLowQuality ? 'LOW' : qualityScore > 75 ? 'EXCELLENT' : qualityScore > 55 ? 'GOOD' : 'ACCEPTABLE';

  return {
    score: qualityScore,
    brightness: Math.round(brightness),
    contrast: Math.round(contrast),
    blurVariance: Math.round(blurVariance),
    isLowQuality,
    statusText,
    reasons,
    suggestions
  };
}

/**
 * Classifies an engineering object based on geometric features
 */
function classifyEngineeringObject(
  aspectRatio: number,
  circularity: number,
  outerVertices: number,
  holeCount: number,
  widthMm: number,
  heightMm: number
): { category: string; confidence: number; outerDesc: string; internalDesc: string } {
  let category = "Mechanical Component";
  let confidence = 0.75;
  let outerDesc = "Rectangular Bounds";
  let internalDesc = holeCount > 0 ? `${holeCount} Internal Hole${holeCount > 1 ? 's' : ''}` : "Solid Interior";

  // 1. High Circularity (> 0.78 and aspect ratio near 1.0)
  if (circularity > 0.78 && aspectRatio >= 0.80 && aspectRatio <= 1.25) {
    outerDesc = "Circular Profile";
    if (holeCount >= 1) {
      category = holeCount >= 3 ? "Circular Flange (Multi-Hole)" : "Flange / Pipe Coupling / Washer";
      confidence = 0.92;
    } else {
      category = "Cylindrical Part / Shaft End / Round Stock";
      confidence = 0.88;
    }
    return { category, confidence, outerDesc, internalDesc };
  }

  // 2. High Aspect Ratio (> 2.3) -> Shaft, Rod, Bracket, Pipe, Wall
  if (aspectRatio > 2.3) {
    if (holeCount >= 1) {
      category = "Mounting Bracket / Structural Link";
      confidence = 0.90;
      outerDesc = "Elongated Plate / Bracket";
    } else if (widthMm > 600 || heightMm > 600) {
      category = "Wall / Architectural Element";
      confidence = 0.82;
      outerDesc = "Architectural Wall Profile";
    } else {
      category = "Shaft / Pipe / Structural Rod";
      confidence = 0.85;
      outerDesc = "Elongated Profile";
    }
    return { category, confidence, outerDesc, internalDesc };
  }

  // 3. Hexagonal or Octagonal Shape (Bolt head, nut)
  if (outerVertices === 6 || outerVertices === 8) {
    outerDesc = `${outerVertices}-sided Polygon`;
    if (holeCount >= 1) {
      category = "Hex Nut / Threaded Fastener";
      confidence = 0.93;
    } else {
      category = "Hex Bolt Head / Machine Fastener";
      confidence = 0.89;
    }
    return { category, confidence, outerDesc, internalDesc };
  }

  // 4. Multi-toothed or Star-like (> 9 vertices)
  if (outerVertices > 9 && circularity > 0.5) {
    category = "Gear / Sprocket / Spline Component";
    confidence = 0.86;
    outerDesc = "Gear Tooth Profile";
    return { category, confidence, outerDesc, internalDesc };
  }

  // 5. Standard Rectangular / Plate Geometry (1.0 <= aspect <= 2.3)
  if (outerVertices === 4 || outerVertices === 5) {
    outerDesc = "Rectangular Outline";
    if (holeCount >= 1) {
      category = holeCount === 1 ? "Single-Hole Mounting Plate" : `Mechanical Plate (${holeCount} Holes)`;
      confidence = 0.94;
    } else if (widthMm > 700 && heightMm > 700) {
      category = "Door / Window Panel Geometry";
      confidence = 0.84;
    } else {
      category = "Rectangular Machine Block / Base Plate";
      confidence = 0.88;
    }
    return { category, confidence, outerDesc, internalDesc };
  }

  // 6. Generic Geometric Component
  if (holeCount > 0) {
    category = `CAD Component (${holeCount} Cutouts)`;
    confidence = 0.80;
  } else {
    category = "Mechanical Geometric Profile";
    confidence = 0.76;
  }

  return { category, confidence, outerDesc, internalDesc };
}

/**
 * Full Multi-Strategy Computer Vision Analysis Pipeline
 */
export async function analyzeImage(
  imgElement: HTMLImageElement,
  mmPerPixel: number = 0.5,
  manualROI?: ManualROI | null
): Promise<AnalysisResult> {
  console.log("[CADVision] Image received");
  await waitForOpenCV();

  const rawSrc = cv.imread(imgElement);
  let src = new cv.Mat();

  // If manual ROI is provided, crop to selected bounding box
  if (manualROI && manualROI.width > 20 && manualROI.height > 20) {
    const rx = Math.max(0, Math.min(rawSrc.cols - 10, Math.round(manualROI.x)));
    const ry = Math.max(0, Math.min(rawSrc.rows - 10, Math.round(manualROI.y)));
    const rw = Math.max(10, Math.min(rawSrc.cols - rx, Math.round(manualROI.width)));
    const rh = Math.max(10, Math.min(rawSrc.rows - ry, Math.round(manualROI.height)));
    const rect = new cv.Rect(rx, ry, rw, rh);
    src = rawSrc.roi(rect).clone();
    rawSrc.delete();
  } else {
    src = rawSrc;
  }

  // Scale down for processing if too large to prevent UI lag while preserving high quality
  const MAX_DIM = 800;
  let scale = 1.0;
  if (src.cols > MAX_DIM || src.rows > MAX_DIM) {
    scale = MAX_DIM / Math.max(src.cols, src.rows);
    const dsize = new cv.Size(Math.round(src.cols * scale), Math.round(src.rows * scale));
    cv.resize(src, src, dsize, 0, 0, cv.INTER_AREA);
  }

  const effectiveMmPerPixel = mmPerPixel / scale;
  const totalImageArea = src.cols * src.rows;

  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

  // 1. Evaluate Image Quality
  const quality = evaluateImageQuality(gray);
  console.log(`[CADVision] Image quality: ${quality.statusText} (Score: ${quality.score}%)`);

  // If image is essentially empty/flat or pitch dark, return low quality state
  if (quality.isLowQuality && quality.contrast < 10) {
    console.log("[CADVision] Image quality too low for CAD extraction");
    const emptyStats = {
      imageWidth: src.cols,
      imageHeight: src.rows,
      contoursFound: 0,
      contoursRejected: 0,
      mainObjectFound: false,
      circlesDetected: 0,
      rectanglesDetected: 0,
      polygonsDetected: 0,
      scaleStatus: "Scale not verified"
    };

    const emptyConfidence: AnalysisConfidence = {
      objectConfidence: 0,
      geometryConfidence: 0,
      imageQuality: quality.score,
      overallConfidence: quality.score * 0.2,
      overallStatus: 'LOW CONFIDENCE'
    };

    src.delete(); gray.delete(); blurred.delete();
    return {
      geometries: [],
      detectionState: 'IMAGE_QUALITY_LOW',
      detectedCategory: 'Low Quality Image',
      confidence: emptyConfidence,
      quality,
      scaleVerified: false,
      scaleMmPerPixel: effectiveMmPerPixel,
      stats: emptyStats,
      outerShapeDescription: "None",
      internalFeaturesDescription: "None"
    };
  }

  console.log("[CADVision] Object detection started");

  // 2. Multi-Strategy Segmentation to isolate the main object
  // Strategy A: Otsu Binarization (Regular)
  const threshOtsu = new cv.Mat();
  cv.threshold(blurred, threshOtsu, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);

  // Strategy B: Inverted Otsu Binarization (for dark parts on light background)
  const threshOtsuInv = new cv.Mat();
  cv.threshold(blurred, threshOtsuInv, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

  // Strategy C: Dilated Canny Edges with Morphological Closing
  const edges = new cv.Mat();
  cv.Canny(blurred, edges, 35, 110, 3, false);
  const morphKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
  const dilatedEdges = new cv.Mat();
  cv.dilate(edges, dilatedEdges, morphKernel, new cv.Point(-1, -1), 2);
  cv.morphologyEx(dilatedEdges, dilatedEdges, cv.MORPH_CLOSE, morphKernel);

  // Strategy D: Adaptive Thresholding
  const threshAdaptive = new cv.Mat();
  cv.adaptiveThreshold(blurred, threshAdaptive, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 15, 3);
  cv.morphologyEx(threshAdaptive, threshAdaptive, cv.MORPH_CLOSE, morphKernel);

  // Close Otsu maps to seal small gaps
  const closedOtsu = new cv.Mat();
  const closedOtsuInv = new cv.Mat();
  cv.morphologyEx(threshOtsu, closedOtsu, cv.MORPH_CLOSE, morphKernel);
  cv.morphologyEx(threshOtsuInv, closedOtsuInv, cv.MORPH_CLOSE, morphKernel);

  // Collect candidate masks in priority order
  const candidateMasks = [closedOtsuInv, closedOtsu, dilatedEdges, threshAdaptive];

  let bestContour: any = null;
  let bestContourArea = 0;
  let bestContourRect: any = null;
  let totalContoursFound = 0;

  for (const mask of candidateMasks) {
    const maskContours = new cv.MatVector();
    const maskHierarchy = new cv.Mat();
    cv.findContours(mask, maskContours, maskHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    totalContoursFound += maskContours.size();

    for (let i = 0; i < maskContours.size(); ++i) {
      const cnt = maskContours.get(i);
      const area = cv.contourArea(cnt);
      const rect = cv.boundingRect(cnt);

      // Must be between 2.5% and 94% of the frame (avoids background frame borders)
      const isReasonableSize = area > (totalImageArea * 0.025) && area < (totalImageArea * 0.94);
      // Ensure it is not merely touching all 4 image borders
      const touchesBorders = (rect.x <= 2 && rect.y <= 2 && (rect.x + rect.width >= src.cols - 2) && (rect.y + rect.height >= src.rows - 2));

      if (isReasonableSize && !touchesBorders) {
        if (area > bestContourArea) {
          bestContourArea = area;
          bestContour = cnt;
          bestContourRect = rect;
        }
      }
    }

    maskContours.delete();
    maskHierarchy.delete();

    // If we found a confident prominent component (> 8% area), proceed with this strategy
    if (bestContourArea > totalImageArea * 0.08) {
      break;
    }
  }

  // Cleanup segmentation temporary mats
  threshOtsu.delete();
  threshOtsuInv.delete();
  closedOtsu.delete();
  closedOtsuInv.delete();
  edges.delete();
  dilatedEdges.delete();
  threshAdaptive.delete();
  morphKernel.delete();

  // 3. Fallback Geometry Detection: If no single contour was > 2.5%, check for any cluster or dominant bounding box
  if (!bestContour) {
    console.log("[CADVision] Standard segmentation uncertain — running fallback geometry detection");
    const edgesFallback = new cv.Mat();
    cv.Canny(blurred, edgesFallback, 25, 80);
    const fallbackContours = new cv.MatVector();
    const fallbackHierarchy = new cv.Mat();
    cv.findContours(edgesFallback, fallbackContours, fallbackHierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let combinedX1 = Infinity, combinedY1 = Infinity, combinedX2 = -Infinity, combinedY2 = -Infinity;
    let edgePointCount = 0;

    for (let i = 0; i < fallbackContours.size(); ++i) {
      const cnt = fallbackContours.get(i);
      const area = cv.contourArea(cnt);
      if (area > 50 || cnt.rows > 10) {
        const r = cv.boundingRect(cnt);
        combinedX1 = Math.min(combinedX1, r.x);
        combinedY1 = Math.min(combinedY1, r.y);
        combinedX2 = Math.max(combinedX2, r.x + r.width);
        combinedY2 = Math.max(combinedY2, r.y + r.height);
        edgePointCount += cnt.rows;
      }
    }

    fallbackContours.delete();
    fallbackHierarchy.delete();
    edgesFallback.delete();

    const fallbackW = combinedX2 - combinedX1;
    const fallbackH = combinedY2 - combinedY1;
    const fallbackArea = fallbackW * fallbackH;

    if (edgePointCount > 25 && fallbackArea > (totalImageArea * 0.04) && fallbackArea < (totalImageArea * 0.96)) {
      bestContourRect = { x: combinedX1, y: combinedY1, width: fallbackW, height: fallbackH };
      bestContourArea = fallbackArea * 0.7; // Estimated fill
    }
  }

  // If still completely no geometry found:
  if (!bestContour && !bestContourRect) {
    console.log("[CADVision] No usable geometry detected in frame");
    const noObjStats = {
      imageWidth: src.cols,
      imageHeight: src.rows,
      contoursFound: totalContoursFound,
      contoursRejected: totalContoursFound,
      mainObjectFound: false,
      circlesDetected: 0,
      rectanglesDetected: 0,
      polygonsDetected: 0,
      scaleStatus: "Scale not verified"
    };

    const lowConfidence: AnalysisConfidence = {
      objectConfidence: 15,
      geometryConfidence: 10,
      imageQuality: quality.score,
      overallConfidence: 12,
      overallStatus: 'LOW CONFIDENCE'
    };

    src.delete(); gray.delete(); blurred.delete();

    // Check if image quality was the actual culprit
    const finalState: DetectionState = quality.isLowQuality ? 'IMAGE_QUALITY_LOW' : 'NO_OBJECT_FOUND';

    return {
      geometries: [],
      detectionState: finalState,
      detectedCategory: 'No Usable Object',
      confidence: lowConfidence,
      quality,
      scaleVerified: false,
      scaleMmPerPixel: effectiveMmPerPixel,
      stats: noObjStats,
      outerShapeDescription: "None",
      internalFeaturesDescription: "None"
    };
  }

  console.log("[CADVision] Geometry detection started");

  // 4. Geometry Extraction: Outer Profile
  const geometries: Geometry[] = [];
  const dst = src.clone(); // Overlay visualizer

  let outerCircularity = 0;
  let outerVertices = 4;
  let isCircleProfile = false;

  const objX = bestContourRect.x;
  const objY = bestContourRect.y;
  const objW = bestContourRect.width;
  const objH = bestContourRect.height;
  const aspectRatio = Math.max(objW, objH) / Math.max(1, Math.min(objW, objH));

  if (bestContour) {
    const perimeter = cv.arcLength(bestContour, true);
    if (perimeter > 0) {
      outerCircularity = (4 * Math.PI * bestContourArea) / (perimeter * perimeter);
    }
    const approx = new cv.Mat();
    const epsilon = 0.025 * perimeter;
    cv.approxPolyDP(bestContour, approx, epsilon, true);
    outerVertices = approx.rows;
    approx.delete();
  }

  // If outer shape is strongly circular
  if (outerCircularity > 0.78 && Math.abs(objW - objH) / Math.max(objW, objH) < 0.18) {
    isCircleProfile = true;
    const centerRadius = Math.round(Math.min(objW, objH) / 2);
    const centerX = objX + objW / 2;
    const centerY = objY + objH / 2;

    geometries.push({
      id: generateId(),
      type: 'circle',
      cx: centerX * effectiveMmPerPixel,
      cy: centerY * effectiveMmPerPixel,
      radius: centerRadius * effectiveMmPerPixel
    });

    // Draw outer green circle
    cv.circle(dst, new cv.Point(centerX, centerY), centerRadius, new cv.Scalar(0, 230, 118, 255), 3);
  } else {
    // Add primary bounding rectangle
    geometries.push({
      id: generateId(),
      type: 'rectangle',
      x: objX * effectiveMmPerPixel,
      y: objY * effectiveMmPerPixel,
      width: objW * effectiveMmPerPixel,
      height: objH * effectiveMmPerPixel
    });

    // Draw main object boundary in Green
    const pt1 = new cv.Point(objX, objY);
    const pt2 = new cv.Point(objX + objW, objY + objH);
    cv.rectangle(dst, pt1, pt2, new cv.Scalar(0, 230, 118, 255), 3, cv.LINE_8, 0);

    // Draw subtle corner crosshairs
    const armLen = 14;
    cv.line(dst, new cv.Point(objX, objY), new cv.Point(objX + armLen, objY), new cv.Scalar(0, 229, 255, 255), 2);
    cv.line(dst, new cv.Point(objX, objY), new cv.Point(objX, objY + armLen), new cv.Scalar(0, 229, 255, 255), 2);
    cv.line(dst, new cv.Point(objX + objW, objY + objH), new cv.Point(objX + objW - armLen, objY + objH), new cv.Scalar(0, 229, 255, 255), 2);
    cv.line(dst, new cv.Point(objX + objW, objY + objH), new cv.Point(objX + objW, objY + objH - armLen), new cv.Scalar(0, 229, 255, 255), 2);
  }

  // 5. Internal Hole and Feature Detection inside Object ROI
  let circlesDetected = 0;
  const colorCircle = new cv.Scalar(0, 229, 255, 255); // Cyan for holes
  const colorCenter = new cv.Scalar(242, 169, 0, 255); // Amber for centerlines

  // Crop ROI grayscale for local feature analysis
  const roiRect = new cv.Rect(
    Math.max(0, objX),
    Math.max(0, objY),
    Math.min(gray.cols - Math.max(0, objX), objW),
    Math.min(gray.rows - Math.max(0, objY), objH)
  );

  if (roiRect.width > 20 && roiRect.height > 20) {
    const roiGray = gray.roi(roiRect);
    const roiBlurred = new cv.Mat();
    cv.GaussianBlur(roiGray, roiBlurred, new cv.Size(5, 5), 0);

    // Multi-threshold inside ROI to find dark/light holes
    const roiThresh1 = new cv.Mat();
    const roiThresh2 = new cv.Mat();
    cv.threshold(roiBlurred, roiThresh1, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.threshold(roiBlurred, roiThresh2, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    const holeContours1 = new cv.MatVector();
    const holeHier1 = new cv.Mat();
    const holeContours2 = new cv.MatVector();
    const holeHier2 = new cv.Mat();

    cv.findContours(roiThresh1, holeContours1, holeHier1, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
    cv.findContours(roiThresh2, holeContours2, holeHier2, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    const detectedHolesRaw: { cx: number; cy: number; r: number }[] = [];
    const minHoleArea = Math.max(30, (roiRect.width * roiRect.height) * 0.003);
    const maxHoleArea = (roiRect.width * roiRect.height) * 0.45;

    const inspectHoleContours = (cnts: any) => {
      for (let i = 0; i < cnts.size(); ++i) {
        const cnt = cnts.get(i);
        const area = cv.contourArea(cnt);

        if (area >= minHoleArea && area <= maxHoleArea) {
          const circle = cv.minEnclosingCircle(cnt);
          const circleArea = Math.PI * circle.radius * circle.radius;
          const circularity = area / Math.max(1, circleArea);

          // Hole center must be well inside the object boundary (not the outer edge itself)
          const margin = circle.radius * 0.6;
          const isInterior =
            circle.center.x > margin &&
            circle.center.x < roiRect.width - margin &&
            circle.center.y > margin &&
            circle.center.y < roiRect.height - margin;

          if (isInterior && circularity > 0.52 && circle.radius > 4) {
            const globalCx = roiRect.x + circle.center.x;
            const globalCy = roiRect.y + circle.center.y;

            // Check duplicate
            const isDup = detectedHolesRaw.some(
              h => Math.hypot(h.cx - globalCx, h.cy - globalCy) < Math.max(h.r, circle.radius) * 0.75
            );

            if (!isDup) {
              detectedHolesRaw.push({ cx: globalCx, cy: globalCy, r: circle.radius });
            }
          }
        }
      }
    };

    inspectHoleContours(holeContours1);
    inspectHoleContours(holeContours2);

    holeContours1.delete(); holeHier1.delete();
    holeContours2.delete(); holeHier2.delete();
    roiThresh1.delete(); roiThresh2.delete();
    roiBlurred.delete(); roiGray.delete();

    // Register detected holes
    for (const h of detectedHolesRaw) {
      circlesDetected++;
      geometries.push({
        id: generateId(),
        type: 'circle',
        cx: h.cx * effectiveMmPerPixel,
        cy: h.cy * effectiveMmPerPixel,
        radius: h.r * effectiveMmPerPixel
      });

      // Draw hole circle and center crosshair
      cv.circle(dst, new cv.Point(h.cx, h.cy), Math.round(h.r), colorCircle, 2);
      const arm = 6;
      cv.line(dst, new cv.Point(h.cx - arm, h.cy), new cv.Point(h.cx + arm, h.cy), colorCenter, 1);
      cv.line(dst, new cv.Point(h.cx, h.cy - arm), new cv.Point(h.cx, h.cy + arm), colorCenter, 1);
    }
  }

  // 6. Classification & Confidence Scoring
  const widthMm = objW * effectiveMmPerPixel;
  const heightMm = objH * effectiveMmPerPixel;
  const classification = classifyEngineeringObject(
    aspectRatio,
    outerCircularity,
    outerVertices,
    circlesDetected,
    widthMm,
    heightMm
  );

  console.log(`[CADVision] Contours detected: ${geometries.length}`);
  console.log(`[CADVision] Circles detected: ${circlesDetected}`);

  // Confidence calculations
  const objectAreaRatio = bestContourArea / totalImageArea;
  const objectConfidence = Math.min(0.98, Math.max(0.40, classification.confidence * (0.6 + Math.min(0.4, objectAreaRatio * 2))));
  const geometryConfidence = Math.min(0.98, Math.max(0.45, 0.70 + (circlesDetected > 0 ? 0.15 : 0.05) + (isCircleProfile ? 0.10 : 0.05)));
  const overallScore = Math.round(
    objectConfidence * 35 +
    geometryConfidence * 35 +
    (quality.score / 100) * 30
  );

  console.log(`[CADVision] Object confidence: ${objectConfidence.toFixed(2)}`);
  console.log("[CADVision] Potential CAD geometry found");
  console.log("[CADVision] Entering CAD analysis");

  const confidence: AnalysisConfidence = {
    objectConfidence: Math.round(objectConfidence * 100),
    geometryConfidence: Math.round(geometryConfidence * 100),
    imageQuality: quality.score,
    overallConfidence: overallScore,
    overallStatus: overallScore >= 68 ? 'READY FOR CAD' : overallScore >= 40 ? 'POTENTIAL CAD GEOMETRY' : 'LOW CONFIDENCE'
  };

  // Determine Detection State:
  // STATE 1: OBJECT DETECTED (High confidence, clear geometry)
  // STATE 2: POTENTIAL OBJECT DETECTED (Geometric structure present, allows user confirmation)
  // STATE 3: NO USABLE OBJECT
  let detectionState: DetectionState = 'OBJECT_DETECTED';
  if (overallScore < 52 || objectAreaRatio < 0.04) {
    detectionState = 'POTENTIAL_OBJECT_DETECTED';
  }

  // Render debug overlay base64
  const canvas = document.createElement('canvas');
  cv.imshow(canvas, dst);
  const debugImageBase64 = canvas.toDataURL('image/jpeg', 0.90);

  // Clean OpenCV Mats
  src.delete();
  gray.delete();
  blurred.delete();
  dst.delete();

  return {
    geometries,
    debugImageBase64,
    detectionState,
    detectedCategory: classification.category,
    confidence,
    quality,
    scaleVerified: false,
    scaleMmPerPixel: effectiveMmPerPixel,
    stats: {
      imageWidth: roiRect.width,
      imageHeight: roiRect.height,
      contoursFound: totalContoursFound,
      contoursRejected: Math.max(0, totalContoursFound - geometries.length),
      mainObjectFound: true,
      circlesDetected,
      rectanglesDetected: isCircleProfile ? 0 : 1,
      polygonsDetected: geometries.filter(g => g.type === 'polygon' || g.type === 'triangle').length,
      scaleStatus: "Scale not verified (0.5 mm/px assumed)"
    },
    outerShapeDescription: classification.outerDesc,
    internalFeaturesDescription: classification.internalDesc
  };
}
