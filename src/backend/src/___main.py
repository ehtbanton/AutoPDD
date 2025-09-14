# Welcome to AutoPDD!

# Todo list:
# - Fill in basic functionality (see detailed comments in this file).
# - Check possibility of using somebody's MCP protocol for LLM processing inputs/outputs
#       UPDATED STATUS:
#           Now using complete section generation approach instead of field-by-field JSON extraction.
#           AI generates complete section content that matches template structure, including markdown tables.
#           This should provide better consistency and easier content generation.

import os
import sys
from gemini_interface import setup_gemini, ask_gemini, upload_files_to_gemini
from context_manager import extract_text_from_folder
from text_processing import retrieve_contents_list, get_pdd_targets, find_target_location
from word_editor import load_word_doc_to_string, create_output_doc_from_template
from word_section_replacer import replace_section_content, check_for_info_not_found
from _section_filler import fill_section, refill_section, fill_section_block_by_block, fill_document_with_json

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Global variables to store initialized state
INITIALIZED = False
PROJECT_NAME = "prime_road"
OUTPUT_PATH = None
OUTPUT_TEXT = None
TEMPLATE_TEXT = None
CONTENTS_LIST = None
PDD_TARGETS = None
THERE_ARE_NEW_FILES = False
GEMINI_CLIENT = None
UPLOADED_FILES_CACHE = None

def initialize():
    """Perform all initial setup including loading template and context documents."""
    global INITIALIZED, PROJECT_NAME, OUTPUT_PATH, OUTPUT_TEXT, TEMPLATE_TEXT
    global CONTENTS_LIST, PDD_TARGETS, THERE_ARE_NEW_FILES, GEMINI_CLIENT, UPLOADED_FILES_CACHE

    if INITIALIZED:
        print("System already initialized.")
        return

    print("Initializing AutoPDD...")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.abspath(os.path.join(script_dir, '..'))

    template_doc_folder = os.path.join(backend_dir, "pdd_template")
    context_folder = os.path.join(backend_dir, "provided_documents")
    output_doc_folder = os.path.join(backend_dir, "auto_pdd_output")

    OUTPUT_PATH = create_output_doc_from_template(PROJECT_NAME)
    OUTPUT_TEXT = load_word_doc_to_string(output_doc_folder)
    TEMPLATE_TEXT = load_word_doc_to_string(template_doc_folder)
    CONTENTS_LIST = retrieve_contents_list(TEMPLATE_TEXT)
    PDD_TARGETS = get_pdd_targets(CONTENTS_LIST)

    THERE_ARE_NEW_FILES = extract_text_from_folder(context_folder)
    GEMINI_CLIENT = setup_gemini()
    UPLOADED_FILES_CACHE = upload_files_to_gemini([os.path.join(context_folder, "all_context.txt")])

    INITIALIZED = True
    print("Initialization complete!")

def _process_single_target(target_idx, target, force_process=False):
    """Process a single target section."""
    if not INITIALIZED:
        raise RuntimeError("System not initialized. Call initialize() first.")

    start_marker = target[1]

    if target_idx + 1 < len(PDD_TARGETS):
        end_marker = PDD_TARGETS[target_idx + 1][1]
    else:
        end_marker = "Appendix"

    # Get the template section content
    template_start_loc = find_target_location(target, TEMPLATE_TEXT)
    template_end_loc = find_target_location(PDD_TARGETS[target_idx + 1], TEMPLATE_TEXT) if target_idx + 1 < len(PDD_TARGETS) else -1
    infilling_info = TEMPLATE_TEXT[template_start_loc:template_end_loc] if template_end_loc != -1 else TEMPLATE_TEXT[template_start_loc:]

    # Check current output status (only if not forcing)
    response = None
    section_status = ""
    current_section_content = ""

    if not force_process:
        output_start_loc = find_target_location(target, OUTPUT_TEXT) if OUTPUT_TEXT else -1
        output_end_loc = find_target_location(PDD_TARGETS[target_idx + 1], OUTPUT_TEXT) if OUTPUT_TEXT and target_idx + 1 < len(PDD_TARGETS) else -1

        if OUTPUT_TEXT and output_start_loc != -1:
            current_section_content = OUTPUT_TEXT[output_start_loc:output_end_loc] if output_end_loc != -1 else OUTPUT_TEXT[output_start_loc:]
            if current_section_content and len(current_section_content.split("\n")) > 2:
                section_status = current_section_content.split("\n")[2]

        # Determine what action to take (only if not forcing)
        if "SECTION_COMPLETE" in section_status:
            print(f"\nSection '{start_marker}' is already complete. Skipping...")
            sys.stdout.flush()
            return

        if "SECTION_ATTEMPTED" in section_status:
            if not THERE_ARE_NEW_FILES:
                print(f"\nSection '{start_marker}' has previously been attempted and no new files are available. Skipping...")
                sys.stdout.flush()
                return
            print(f"\nSection '{start_marker}' has previously been attempted, but there are new files! Retrying...")
            sys.stdout.flush()
            response = refill_section(GEMINI_CLIENT, infilling_info, UPLOADED_FILES_CACHE)

    # Generate section content (always runs if force_process=True)
    if not response:
        print(f"\n{'='*20}\nProcessing section: {start_marker}\n{'='*20}")
        if force_process:
            print("Force processing requested - bypassing status checks")
        sys.stdout.flush()

        # Use the new streamlined JSON replacement approach by default
        try:
            response = fill_document_with_json(GEMINI_CLIENT, infilling_info, UPLOADED_FILES_CACHE, OUTPUT_PATH)
        except Exception as e:
            print(f"  > JSON replacement approach failed: {e}")
            print("  > Falling back to traditional section filling...")
            sys.stdout.flush()
            response = fill_section(GEMINI_CLIENT, infilling_info, UPLOADED_FILES_CACHE)

    print("\n--- AI Generated Section Content ---")

    # Handle structured response format
    if isinstance(response, dict):
        if response.get("type") == "json_success":
            print(f"✓ JSON Success: {response['message']}")
            print(f"  Changes made: {response['changes_made']}")
            if response.get("errors"):
                print(f"  Warnings: {len(response['errors'])} issues encountered")
                for error in response["errors"][:3]:  # Show first 3 errors
                    print(f"    - {error}")
        elif response.get("type") == "section_fallback":
            print(f"→ Fallback: {response['message']}")
            print(f"  Section content length: {len(response['data'])} chars")
        else:
            print(response)
    else:
        print(response)

    print("----------------------------------------\n")
    sys.stdout.flush()

    if not response:
        print(f"CRITICAL: No content generated for section '{start_marker}'. Skipping update.")
        replace_section_content(OUTPUT_PATH, start_marker, end_marker, "", "SECTION_FAILED_GENERATION")
        return

    # Determine section status based on response type and content
    final_status = "SECTION_COMPLETE"

    if isinstance(response, dict):
        if response.get("type") == "json_success":
            # Check if there were any INFO_NOT_FOUND items or errors
            data = response.get("data", {})
            info_not_found = any(
                item.get("extracted_text") == "INFO_NOT_FOUND"
                for item in data.values()
                if isinstance(item, dict)
            )
            has_errors = len(response.get("errors", [])) > 0

            if info_not_found or has_errors:
                final_status = "SECTION_ATTEMPTED"
            else:
                final_status = "SECTION_COMPLETE"

            print(f"  > JSON approach used - content already inserted into document.")
            print(f"Section status determined as: {final_status}")

            # Only update section status marker (content already replaced)
            replace_section_content(OUTPUT_PATH, start_marker, end_marker, "", final_status)

        elif response.get("type") == "section_fallback":
            # Check traditional section content for INFO_NOT_FOUND
            section_content = response.get("data", "")
            info_not_found = check_for_info_not_found(section_content)
            final_status = "SECTION_ATTEMPTED" if info_not_found else "SECTION_COMPLETE"

            print(f"Section status determined as: {final_status}")
            print(f"  > Using traditional section replacement approach.")

            # Replace the entire section content
            replace_section_content(OUTPUT_PATH, start_marker, end_marker, section_content, final_status)
        else:
            # Handle unexpected response format
            final_status = "SECTION_ATTEMPTED"
            print(f"Warning: Unexpected response format. Status: {final_status}")
            replace_section_content(OUTPUT_PATH, start_marker, end_marker, str(response), final_status)
    else:
        # Handle string response (legacy)
        info_not_found = check_for_info_not_found(response)
        final_status = "SECTION_ATTEMPTED" if info_not_found else "SECTION_COMPLETE"

        print(f"Section status determined as: {final_status}")
        section_content = response if isinstance(response, str) else str(response)
        replace_section_content(OUTPUT_PATH, start_marker, end_marker, section_content, final_status)

    print(f"✓ Section '{start_marker}' processing complete with status: {final_status}")
    sys.stdout.flush()

def process_document():
    """Process the entire document by iterating through all sections."""
    if not INITIALIZED:
        raise RuntimeError("System not initialized. Call initialize() first.")

    for target_idx, target in enumerate(PDD_TARGETS):
        _process_single_target(target_idx, target)

    print(f"\nProcessing complete. The final document has been saved at: {OUTPUT_PATH}\n")
    sys.stdout.flush()

def process_section(section_name: str, force_process: bool = False):
    """Process a single, specific section by name."""
    if not INITIALIZED:
        raise RuntimeError("System not initialized. Call initialize() first.")

    # Find the target that matches the section name
    target_found = False
    for target_idx, target in enumerate(PDD_TARGETS):
        if target[1] == section_name or section_name in target[1]:
            print(f"Found section: {target[1]}")
            _process_single_target(target_idx, target, force_process)
            target_found = True
            break

    if not target_found:
        print(f"Section '{section_name}' not found. Available sections:")
        for target in PDD_TARGETS:
            print(f"  - {target[1]}")

def get_initialized_status():
    """Get current initialization status."""
    return INITIALIZED

def get_current_pdd_targets():
    """Get current PDD_TARGETS list."""
    return PDD_TARGETS

def get_all_globals():
    """Get all current global state for debugging."""
    return {
        'INITIALIZED': INITIALIZED,
        'PDD_TARGETS_COUNT': len(PDD_TARGETS) if PDD_TARGETS else 0,
        'OUTPUT_PATH': OUTPUT_PATH,
        'PROJECT_NAME': PROJECT_NAME
    }

def main_interactive_loop():
    """Interactive command loop that waits for user commands."""
    print("\nAutoPDD Interactive Mode")
    print("Commands:")
    print("  'process_all' - Process entire document")
    print("  'process <section_name>' - Process specific section")
    print("  'list' - List available sections")
    print("  'quit' - Exit the program")

    while True:
        try:
            command = input("\nEnter command: ").strip()

            if command.lower() == 'quit':
                print("Exiting AutoPDD...")
                break
            elif command.lower() == 'process_all':
                process_document()
            elif command.lower() == 'list':
                print("Available sections:")
                for target in PDD_TARGETS:
                    print(f"  - {target[1]}")
            elif command.lower().startswith('process '):
                section_name = command[8:].strip()  # Remove 'process ' prefix
                process_section(section_name)
            else:
                print("Unknown command. Available commands: process_all, process <section>, list, quit")

        except KeyboardInterrupt:
            print("\nExiting AutoPDD...")
            break
        except Exception as e:
            print(f"Error: {e}")

# Main execution
if __name__ == "__main__":
    initialize()
    main_interactive_loop()