from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os
from io import StringIO
import threading
import logging

# Import functions from the refactored backend
from ___main import initialize, process_document, process_section, PDD_TARGETS, INITIALIZED

# Configure logging to capture print statements
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Thread lock for processing operations
processing_lock = threading.Lock()

@app.before_first_request
def setup_backend():
    """Initialize the backend when Flask starts."""
    try:
        initialize()
        logger.info("Backend initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize backend: {str(e)}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'initialized': INITIALIZED
    })

@app.route('/get-sections', methods=['GET'])
def get_sections():
    """Get all available section headings from the template."""
    try:
        if not INITIALIZED:
            return jsonify({'error': 'Backend not initialized'}), 500

        sections = [target[1] for target in PDD_TARGETS]
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
        if not INITIALIZED:
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
        if not INITIALIZED:
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
            process_section(section_name)
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

@app.route('/status', methods=['GET'])
def get_status():
    """Get current system status."""
    try:
        return jsonify({
            'initialized': INITIALIZED,
            'processing_in_progress': processing_lock.locked(),
            'available_sections_count': len(PDD_TARGETS) if INITIALIZED else 0
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
    print("  POST /process-all    - Process entire document")
    print("  POST /process-section - Process specific section (JSON: {'section_name': 'name'})")

    app.run(debug=True, host='0.0.0.0', port=5000)