#!/usr/bin/env python3
"""
PaddleOCR script for Shop Titans Guild Tracker
Provides high-accuracy OCR for game UI text extraction
"""

import sys
import json
import os
from pathlib import Path

# Suppress PaddleOCR logs BEFORE importing (critical!)
os.environ['FLAGS_log_level'] = '3'  # Only fatal errors
os.environ['GLOG_minloglevel'] = '3'  # Google logging level

# Suppress PaddleOCR's verbose logging to avoid corrupting JSON output
os.environ['FLAGS_print_model_stats'] = '0'
os.environ['FLAGS_eager_delete_tensor_gb'] = '0'

# Redirect PaddleOCR logs to stderr to keep stdout clean for JSON
import logging
logging.basicConfig(level=logging.ERROR, stream=sys.stderr)

# Set ppocr logger to ERROR level to suppress DEBUG messages
ppocr_logger = logging.getLogger('ppocr')
ppocr_logger.setLevel(logging.ERROR)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "No image path provided",
            "text": "",
            "confidence": 0
        }))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # Check if image exists
    if not os.path.exists(image_path):
        print(json.dumps({
            "success": False,
            "error": f"Image not found: {image_path}",
            "text": "",
            "confidence": 0
        }))
        sys.exit(1)
    
    try:
        # Import PaddleOCR (do this after arg validation for faster error feedback)
        from paddleocr import PaddleOCR
        
        # Disable PaddleOCR's internal logging completely
        # Note: PaddleOCR 3.x has different logging structure than 2.x
        # We've already set environment variables and logging level at the top
        # which should suppress most logs
        
        # Try GPU first, fallback to CPU if GPU initialization fails
        device = 'cpu'
        ocr = None
        
        # Try GPU first
        try:
            print("Attempting to initialize PaddleOCR with GPU...", file=sys.stderr)
            ocr = PaddleOCR(
                use_textline_orientation=True,
                lang='en',
                device='gpu',
                text_det_thresh=0.1,
                text_det_box_thresh=0.3,
                text_recognition_batch_size=6,
                enable_mkldnn=False,  # Disable MKLDNN to avoid compatibility issues
                use_tensorrt=False    # Disable TensorRT to avoid compatibility issues
            )
            device = 'gpu'
            print("✅ GPU initialization successful! Using GPU acceleration.", file=sys.stderr)
        except AttributeError as attr_error:
            # PaddlePaddle version compatibility issue
            print(f"⚠️ GPU initialization failed (compatibility issue): {str(attr_error)[:100]}", file=sys.stderr)
            print("⚠️ Falling back to CPU with compatibility mode...", file=sys.stderr)
            ocr = None
        except Exception as gpu_error:
            print(f"⚠️ GPU initialization failed: {str(gpu_error)[:100]}", file=sys.stderr)
            print("⚠️ Falling back to CPU...", file=sys.stderr)
            ocr = None
        
        # If GPU failed, try CPU
        if ocr is None:
            try:
                ocr = PaddleOCR(
                    use_textline_orientation=True,
                    lang='en',
                    device='cpu',
                    text_det_thresh=0.1,
                    text_det_box_thresh=0.3,
                    text_recognition_batch_size=6,
                    enable_mkldnn=False,  # Disable MKLDNN to avoid compatibility issues
                    use_tensorrt=False    # Disable TensorRT
                )
                device = 'cpu'
                print("✅ CPU initialization successful.", file=sys.stderr)
            except AttributeError as attr_error:
                # Still failing - try minimal config
                print(f"⚠️ CPU initialization failed, trying minimal config: {str(attr_error)[:100]}", file=sys.stderr)
                ocr = PaddleOCR(
                    lang='en',
                    device='cpu'
                )
                device = 'cpu'
                print("✅ CPU initialization successful (minimal config).", file=sys.stderr)
        
        # Perform OCR
        # Note: PaddleOCR 3.x uses .predict() instead of .ocr()
        # but .ocr() still works with a deprecation warning
        result = ocr.ocr(image_path)
        
        if not result or len(result) == 0:
            print(json.dumps({
                "success": True,
                "text": "",
                "confidence": 0,
                "lines": []
            }))
            sys.exit(0)
        
        # Extract text and confidence from results
        # PaddleOCR 3.x returns OCRResult objects (dict-like) with rec_texts, rec_scores, rec_polys
        lines = []
        all_text = []
        total_confidence = 0
        
        # result[0] is an OCRResult object (dict-like)
        ocr_result = result[0]
        
        # PaddleOCR 3.x: OCRResult is dict-like, access with .get()
        if isinstance(ocr_result, dict) or hasattr(ocr_result, 'get'):
            rec_texts = ocr_result.get('rec_texts', [])
            rec_scores = ocr_result.get('rec_scores', [])
            rec_polys = ocr_result.get('rec_polys', [])
            
            for i, (text, confidence) in enumerate(zip(rec_texts, rec_scores)):
                all_text.append(text)
                total_confidence += confidence
                
                # Get bounding box if available
                bbox = rec_polys[i].tolist() if i < len(rec_polys) else []
                
                lines.append({
                    "text": text,
                    "confidence": confidence * 100,  # Convert to percentage
                    "bbox": bbox
                })
        else:
            # Fallback: try old format (PaddleOCR 2.x compatibility)
            for line in result[0]:
                if len(line) >= 2:
                    bbox = line[0]
                    text_info = line[1]
                    
                    if len(text_info) >= 2:
                        text = text_info[0]
                        confidence = text_info[1]
                        
                        all_text.append(text)
                        total_confidence += confidence
                        
                        lines.append({
                            "text": text,
                            "confidence": confidence * 100,
                            "bbox": bbox
                        })
        
        # Calculate average confidence
        avg_confidence = (total_confidence / len(lines) * 100) if lines else 0
        
        # Join all text with newlines (similar to Tesseract output)
        full_text = '\n'.join(all_text)
        
        # Return result as JSON
        output = {
            "success": True,
            "text": full_text,
            "confidence": round(avg_confidence, 2),
            "lines": lines,
            "engine": "PaddleOCR",
            "device": device  # Show whether GPU or CPU was used
        }
        
        print(json.dumps(output, ensure_ascii=False))
        sys.exit(0)
        
    except ImportError as e:
        error_details = f"PaddleOCR not installed: {str(e)}\nRun: pip install paddleocr paddlepaddle"
        print(json.dumps({
            "success": False,
            "error": error_details,
            "text": "",
            "confidence": 0
        }), file=sys.stderr)
        print(json.dumps({
            "success": False,
            "error": error_details,
            "text": "",
            "confidence": 0
        }))
        sys.exit(1)
        
    except Exception as e:
        import traceback
        error_details = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        print(json.dumps({
            "success": False,
            "error": error_details,
            "text": "",
            "confidence": 0
        }), file=sys.stderr)
        print(json.dumps({
            "success": False,
            "error": f"{type(e).__name__}: {str(e)}",
            "text": "",
            "confidence": 0
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()

