from gemini_interface import ask_gemini
from text_processing import assemble_user_prompt, assemble_system_prompt, is_valid_response, parse_ai_response_as_section
import sys


def fill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache):
    """Fill a section by having AI generate complete section content"""
    
    # Assemble prompts for Gemini
    system_prompt = assemble_system_prompt()
    user_prompt = assemble_user_prompt(infilling_info)
    
    # Ask Gemini for the content, with a few retries for validation
    response = ""
    for i in range(3):  # Retry up to 3 times
        print(f"  > Gemini API Call (Attempt {i+1})...")
        sys.stdout.flush()
        response = ask_gemini(GEMINI_CLIENT, user_prompt, system_prompt, uploaded_files_cache)
        if is_valid_response(response, infilling_info):
            print("  > Valid response received from Gemini.")
            sys.stdout.flush()
            break
        elif i < 2:
            print("  > Invalid response format, retrying...")
            sys.stdout.flush()
        else:
            print("  > Failed to get a valid response after 3 attempts.")
            sys.stdout.flush()
            # Don't exit, return the best response we have
            break
    
    return parse_ai_response_as_section(response)


def refill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache):
    """Refill a section that previously had INFO_NOT_FOUND values"""
    
    # For now, use the same approach as fill_section
    # In the future, you might want to parse the existing content and only refill missing parts
    return fill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache)


def refill_section_targeted(GEMINI_CLIENT, current_section_content, uploaded_files_cache):
    """
    Future enhancement: Only refill the specific INFO_NOT_FOUND items in an existing section
    """
    system_prompt = """You are tasked with updating a document section that contains some "INFO_NOT_FOUND" placeholders.

Replace ONLY the "INFO_NOT_FOUND" values with appropriate information from the provided source documents. 
Leave all other content exactly as it is.

Return the complete updated section with INFO_NOT_FOUND values replaced where possible."""

    user_prompt = f"""Please update this section by replacing any "INFO_NOT_FOUND" values with information from the source documents:

---
{current_section_content}
---

Only change the "INFO_NOT_FOUND" values. Keep everything else identical."""

    print(f"  > Gemini API Call for targeted refill...")
    sys.stdout.flush()
    response = ask_gemini(GEMINI_CLIENT, user_prompt, system_prompt, uploaded_files_cache)
    return parse_ai_response_as_section(response)