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
from _section_filler import fill_section, refill_section

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# --- 1. SETUP ---
project_name = "prime_road"
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(script_dir, '..'))

template_doc_folder = os.path.join(backend_dir, "pdd_template")
context_folder = os.path.join(backend_dir, "provided_documents")#, project_name)
output_doc_folder = os.path.join(backend_dir, "auto_pdd_output")

output_path = create_output_doc_from_template(project_name)
output_text = load_word_doc_to_string(output_doc_folder)
template_text = load_word_doc_to_string(template_doc_folder)
contents_list = retrieve_contents_list(template_text)
pdd_targets = get_pdd_targets(contents_list)

there_are_new_files = extract_text_from_folder(context_folder)
GEMINI_CLIENT = setup_gemini()
uploaded_files_cache = upload_files_to_gemini([os.path.join(context_folder, "all_context.txt")])

# --- 2. MAIN PROCESSING LOOP ---
for target_idx, target in enumerate(pdd_targets):
    start_marker = target[1]

    if target_idx + 1 < len(pdd_targets):
        end_marker = pdd_targets[target_idx + 1][1]
    else:
        end_marker = "Appendix"

    # Get the template section content
    template_start_loc = find_target_location(target, template_text)
    template_end_loc = find_target_location(pdd_targets[target_idx + 1], template_text) if target_idx + 1 < len(pdd_targets) else -1
    infilling_info = template_text[template_start_loc:template_end_loc] if template_end_loc != -1 else template_text[template_start_loc:]

    # Check current output status
    output_start_loc = find_target_location(target, output_text) if output_text else -1
    output_end_loc = find_target_location(pdd_targets[target_idx + 1], output_text) if output_text and target_idx + 1 < len(pdd_targets) else -1
    
    response = None
    section_status = ""
    current_section_content = ""
    
    if output_text and output_start_loc != -1:
        current_section_content = output_text[output_start_loc:output_end_loc] if output_end_loc != -1 else output_text[output_start_loc:]
        if current_section_content and len(current_section_content.split("\n")) > 2:
            section_status = current_section_content.split("\n")[2]

    # Determine what action to take
    if "SECTION_COMPLETE" in section_status:
        print(f"\nSection '{start_marker}' is already complete. Skipping...")
        sys.stdout.flush()
        continue
    
    if "SECTION_ATTEMPTED" in section_status:
        if not there_are_new_files:
            print(f"\nSection '{start_marker}' has previously been attempted and no new files are available. Skipping...")
            sys.stdout.flush()
            continue
        print(f"\nSection '{start_marker}' has previously been attempted, but there are new files! Retrying...")
        sys.stdout.flush()
        response = refill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache)
    
    # Generate section content
    if not response:
        print(f"\n{'='*20}\nProcessing section: {start_marker}\n{'='*20}")
        sys.stdout.flush()
        response = fill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache)

    print("\n--- AI Generated Section Content ---")
    print(response)
    print("----------------------------------------\n")
    sys.stdout.flush()

    if not response or response.strip() == "":
        print(f"CRITICAL: No content generated for section '{start_marker}'. Skipping update.")
        replace_section_content(output_path, start_marker, end_marker, "", "SECTION_FAILED_GENERATION")
        continue

    # Check if there are any INFO_NOT_FOUND markers in the response
    info_not_found = check_for_info_not_found(response)
    final_status = "SECTION_ATTEMPTED" if info_not_found else "SECTION_COMPLETE"
    
    print(f"Section status determined as: {final_status}")
    sys.stdout.flush()
    
    # Replace the section content in the Word document
    replace_section_content(output_path, start_marker, end_marker, response, final_status)

print(f"\nProcessing complete. The final document has been saved at: {output_path}\n")
sys.stdout.flush()