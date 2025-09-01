# Welcome to AutoPDD!

# Todo list:
# - Fill in basic functionality (see detailed comments in this file).
# - Check possibility of using somebody's MCP protocol for LLM processing inputs/outputs
#       WE ARE HERE. Current status: 
#           We are text-only. Yay! But there's A) a lot of unnecessary context being provided, and B) inconsistent infilling.
#           The app now has the ability to process info only if needed, and call out if it requires more context.

#           Functionality is basic rn - just redo a section if it wasn't previously completed. This ought to be fixed so we just re-check only
#           any new files for only any INFO_NOT_FOUNDs. And then also more mechanical context use in general.
#           
#           So, may be worth investigating MCP. What we want is hard-coded ways for Gemini to get what it needs in a single prompt:
#               - List of info requested
#               - Consistently structured output
#               - Locations of any info it has found (for checking during development - as hallucinations are bound to happen)
#           
#           I'm going to also start looking at algorithmic methods to improve attention with longer contexts.

import os
from gemini_interface import setup_gemini, ask_gemini, upload_files_to_gemini
from context_manager import extract_text_from_folder
from text_processing import retrieve_contents_list, get_pdd_targets, find_target_location, cleanup_response, assemble_system_prompt, assemble_user_prompt, is_valid_response
from word_editor import load_word_doc_to_string, create_output_doc_from_template, replace_section_in_word_doc
from _section_filler import fill_section, refill_section

os.system('cls' if os.name == 'nt' else 'clear')

# --- 1. SETUP ---
project_name = "prime_road"

# Create the single output document from the template if it doesn't exist yet
output_path = create_output_doc_from_template(project_name)
output_text = load_word_doc_to_string("auto_pdd_output")

# Load the template's structure into a string for analysis and for generating prompts
template_text = load_word_doc_to_string("pdd_template")
contents_list = retrieve_contents_list(template_text)
pdd_targets = get_pdd_targets(contents_list)

there_are_new_files = extract_text_from_folder(f"provided_documents/{project_name}")
GEMINI_CLIENT = setup_gemini()
uploaded_files_cache = upload_files_to_gemini([f"provided_documents/{project_name}/all_context.txt"])

# --- 2. MAIN PROCESSING LOOP ---
for target_idx, target in enumerate(pdd_targets):
    # 'target' is a tuple: (section_heading, subheading, subheading_idx, page_num)
    start_marker = target[1]  # The subheading title is our start marker for replacement

    # Determine the end marker to define the section's boundaries
    if target_idx + 1 < len(pdd_targets):
        end_marker = pdd_targets[target_idx + 1][1]
    else:
        # For the last section, use a known final heading like "Appendix". Adjust if your template differs.
        end_marker = "Appendix" 

    # Get the original placeholder text from the template to create the user prompt
    template_start_loc = find_target_location(target, template_text)
    template_end_loc = find_target_location(pdd_targets[target_idx + 1], template_text) if target_idx + 1 < len(pdd_targets) else -1
    infilling_info = template_text[template_start_loc:template_end_loc] if template_end_loc != -1 else template_text[template_start_loc:]

    output_start_loc = find_target_location(target, output_text)
    output_end_loc = find_target_location(pdd_targets[target_idx + 1], output_text) if target_idx + 1 < len(pdd_targets) else -1
    #print(f"Section:\n {output_text[output_start_loc:output_end_loc]}")
    
    response = None
    section_status = output_text[output_start_loc:output_end_loc].split("\n")[2]
    if("SECTION_COMPLETE" in section_status):
        print(f"\nSection '{start_marker}' is already complete. Skipping...")
        continue
    if("SECTION_ATTEMPTED" in section_status):
        if(not there_are_new_files):
            print(f"\nSection '{start_marker}' has previously been attempted and no new files are available. Skipping...")
            continue
        print(f"\nSection '{start_marker}' has previously been attempted, but there are new files! Retrying...")
        response = refill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache)
    if not response:
        print(f"\n{'='*20}\nProcessing section: {start_marker}\n{'='*20}")
        response = fill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache)

    print("\n--- Response ---")
    print(response)
    print("-----------------------\n")

    response = cleanup_response(response)

    print("\n--- Revised response ---")
    print(response)
    print("-----------------------\n")


    if("INFO_NOT_FOUND" not in response):
        response = "SECTION_COMPLETE\n\n"+response
        print("SECTION_COMPLETE")
    else:
        response = "SECTION_ATTEMPTED\n\n"+response
        print("SECTION_ATTEMPTED")
    replace_section_in_word_doc(output_path, start_marker, end_marker, response)

    user_input = input("\nPress Enter to continue to the next section, or 'q' to quit: ")
    if user_input.lower() == 'q':
        break

print(f"\nProcessing complete. The final document has been saved at: {output_path}\n")



