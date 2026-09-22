;;; ==========================================================================
;;; iQOO CADVision - AutoCAD AutoLISP Automation Script
;;; Automates import, viewport framing, and layer verification for DXF drawings.
;;; ==========================================================================

(defun c:CADVISION_IMPORT (/ dxfPath doc acadApp)
  (princ "\n[iQOO CADVision] Initializing DXF Automation Import...")
  
  ;; Prompt user for DXF file path or browse
  (setq dxfPath (getfiled "Select iQOO CADVision DXF Drawing" "" "dxf" 4))
  
  (if (and dxfPath (findfile dxfPath))
    (progn
      (princ (strcat "\n[iQOO CADVision] Loading: " dxfPath))
      
      ;; Import DXF into active drawing session
      (command "_.DXFIN" dxfPath)
      
      ;; Frame drawing to extents
      (command "_.ZOOM" "_E")
      
      ;; Verify created layers
      (princ "\n[iQOO CADVision] Verifying layers:")
      (foreach layer '("OUTLINE" "HOLES" "CENTERLINES" "DIMENSIONS" "TITLEBLOCK")
        (if (tblsearch "LAYER" layer)
          (princ (strcat "\n  ✓ Layer found: " layer))
          (princ (strcat "\n  ! Layer missing: " layer))
        )
      )
      
      ;; Set linetype scale for centerlines
      (setvar "LTSCALE" 1.0)
      (command "_.REGEN")
      
      (princ "\n[iQOO CADVision] Drawing successfully imported and ready for final engineering edits.\n")
    )
    (princ "\n[iQOO CADVision] Import cancelled or file not found.\n")
  )
  (princ)
)

(defun c:CADVISION_INFO ()
  (alert 
    (strcat
      "iQOO CADVision AutoCAD Integration\n\n"
      "Architecture:\n"
      "  Physical Object -> Android Camera -> Computer Vision -> DXF Engine -> AutoCAD\n\n"
      "Standard:\n"
      "  AutoCAD R2010 DXF (AC1024) with full entity modelspace support.\n\n"
      "Commands:\n"
      "  CADVISION_IMPORT : Prompts for DXF and loads directly with layer inspection.\n"
    )
  )
  (princ)
)

(princ "\n[iQOO CADVision AutoLISP loaded. Type CADVISION_IMPORT to begin.]\n")
(princ)
