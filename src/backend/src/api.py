from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
from io import StringIO
import threading
import logging

# Import functions from the refactored backend
from ___main import initialize, process_document, process_section, get_initialized_status, get_current_pdd_targets, get_all_globals
from text_processing import find_target_location
from word_editor import load_word_doc_to_string
import os

# Configure logging to capture print statements
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Thread lock for processing operations
processing_lock = threading.Lock()

def get_section_status(section_name):
    """Get the status of a specific section from the output document."""
    try:
        if not INITIALIZED or not OUTPUT_PATH:
            return 'untouched'

        # Get the current output text
        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_dir = os.path.abspath(os.path.join(script_dir, '..'))
        output_doc_folder = os.path.join(backend_dir, "auto_pdd_output")

        current_output_text = load_word_doc_to_string(output_doc_folder)
        if not current_output_text:
            return 'untouched'

        # Find the section in PDD_TARGETS to get the target info
        target = None
        target_idx = None
        for idx, pdd_target in enumerate(PDD_TARGETS):
            if pdd_target[1] == section_name:
                target = pdd_target
                target_idx = idx
                break

        if not target:
            return 'untouched'

        # Find section location in output document
        output_start_loc = find_target_location(target, current_output_text)
        if output_start_loc == -1:
            return 'untouched'

        # Find end location
        output_end_loc = -1
        if target_idx + 1 < len(PDD_TARGETS):
            next_target = PDD_TARGETS[target_idx + 1]
            output_end_loc = find_target_location(next_target, current_output_text)

        # Extract section content
        current_section_content = ""
        if output_end_loc != -1:
            current_section_content = current_output_text[output_start_loc:output_end_loc]
        else:
            current_section_content = current_output_text[output_start_loc:]

        if not current_section_content or len(current_section_content.split("\n")) <= 2:
            return 'untouched'

        # Get section status from the third line (following the pattern from ___main.py)
        section_status_line = current_section_content.split("\n")[2] if len(current_section_content.split("\n")) > 2 else ""

        if "SECTION_COMPLETE" in section_status_line:
            return 'complete'
        elif "SECTION_ATTEMPTED" in section_status_line:
            return 'attempted'
        else:
            return 'untouched'

    except Exception as e:
        logger.error(f"Error getting section status for '{section_name}': {str(e)}")
        return 'untouched'

# Initialize backend when the module is imported (only once)
try:
    initialize()
    logger.info("Backend initialized successfully on startup")
except Exception as e:
    logger.error(f"Failed to initialize backend on startup: {str(e)}")
    # Don't raise here, let the app start and handle errors in endpoints

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    initialized = get_initialized_status()
    pdd_targets = get_current_pdd_targets()
    globals_info = get_all_globals()

    logger.info(f"Health check - INITIALIZED: {initialized}, PDD_TARGETS count: {len(pdd_targets) if pdd_targets else 'None'}")
    logger.info(f"All globals: {globals_info}")

    return jsonify({
        'status': 'healthy',
        'initialized': initialized,
        'pdd_targets_count': len(pdd_targets) if pdd_targets else 0,
        'globals': globals_info
    })

@app.route('/get-sections', methods=['GET'])
def get_sections():
    """Get all available section headings from the template with their status."""
    try:
        initialized = get_initialized_status()
        if not initialized:
            logger.warning("Get sections called but backend not initialized")
            return jsonify({'error': 'Backend not initialized'}), 500

        pdd_targets = get_current_pdd_targets()
        logger.info(f"Get sections called - returning {len(pdd_targets)} sections")
        sections = []
        for target in pdd_targets:
            section_name = target[1]
            # For now, return all sections as 'untouched' status
            # TODO: Implement proper status detection
            sections.append({
                'name': section_name,
                'status': 'untouched'
            })

        logger.info(f"Successfully returning {len(sections)} sections to frontend")
        return jsonify({
            'success': True,
            'sections': sections,
            'count': len(sections)
        })
    except Exception as e:
        logger.error(f"Error getting sections: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/process-all', methods=['POST'])
def process_all():
    """Process the entire document."""
    if not processing_lock.acquire(blocking=False):
        return jsonify({'error': 'Another processing operation is already in progress'}), 409

    try:
        initialized = get_initialized_status()
        if not initialized:
            return jsonify({'error': 'Backend not initialized'}), 500

        # Capture stdout to return processing logs
        old_stdout = sys.stdout
        log_capture = StringIO()
        sys.stdout = log_capture

        try:
            process_document()
            processing_log = log_capture.getvalue()
        finally:
            sys.stdout = old_stdout

        return jsonify({
            'success': True,
            'message': 'Document processing completed',
            'log': processing_log
        })

    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        processing_lock.release()

@app.route('/process-section', methods=['POST'])
def process_section_endpoint():
    """Process a specific section."""
    if not processing_lock.acquire(blocking=False):
        return jsonify({'error': 'Another processing operation is already in progress'}), 409

    try:
        initialized = get_initialized_status()
        if not initialized:
            return jsonify({'error': 'Backend not initialized'}), 500

        # Get section name from JSON payload
        data = request.get_json()
        if not data or 'section_name' not in data:
            return jsonify({'error': 'section_name is required in JSON payload'}), 400

        section_name = data['section_name']
        if not section_name.strip():
            return jsonify({'error': 'section_name cannot be empty'}), 400

        # Capture stdout to return processing logs
        old_stdout = sys.stdout
        log_capture = StringIO()
        sys.stdout = log_capture

        try:
            # Force process when called via API (user clicked button)
            process_section(section_name, force_process=True)
            processing_log = log_capture.getvalue()
        finally:
            sys.stdout = old_stdout

        # Check if section was found (basic validation)
        section_found = not processing_log.startswith(f"Section '{section_name}' not found")

        return jsonify({
            'success': section_found,
            'message': f'Section "{section_name}" processing completed' if section_found else f'Section "{section_name}" not found',
            'section_name': section_name,
            'log': processing_log
        })

    except Exception as e:
        logger.error(f"Error processing section: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        processing_lock.release()

@app.route('/reinitialize', methods=['POST'])
def reinitialize_backend():
    """Reinitialize the backend to refresh template and sections."""
    try:
        logger.info("Reinitializing backend...")
        initialize()

        return jsonify({
            'success': True,
            'message': 'Backend reinitialized successfully',
            'initialized': INITIALIZED,
            'sections_count': len(PDD_TARGETS) if INITIALIZED else 0
        })
    except Exception as e:
        logger.error(f"Error reinitializing backend: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/status', methods=['GET'])
def get_status():
    """Get current system status."""
    try:
        initialized = get_initialized_status()
        pdd_targets = get_current_pdd_targets()
        return jsonify({
            'initialized': initialized,
            'processing_in_progress': processing_lock.locked(),
            'available_sections_count': len(pdd_targets) if initialized else 0
        })
    except Exception as e:
        logger.error(f"Error getting status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("Starting AutoPDD Flask API...")
    print("Available endpoints:")
    print("  GET  /health         - Health check")
    print("  GET  /status         - System status")
    print("  GET  /get-sections   - Get available sections")
    print("  POST /reinitialize   - Reinitialize backend (refresh sections)")
    print("  POST /process-all    - Process entire document")
    print("  POST /process-section - Process specific section (JSON: {'section_name': 'name'})")

    app.run(debug=True, host='0.0.0.0', port=5000)