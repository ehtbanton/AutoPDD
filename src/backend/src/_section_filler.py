from gemini_interface import ask_gemini
from text_processing import assemble_user_prompt, assemble_system_prompt, is_valid_response, parse_ai_response_as_section, convert_quotes_to_section
from word_editor import fill_document_block_by_block, fill_document_from_json
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

    # Parse the AI response as JSON quotes
    quotes_json = parse_ai_response_as_section(response)

    # Convert quotes back to section format
    section_content = convert_quotes_to_section(quotes_json, infilling_info)

    return section_content


def fill_section_block_by_block(GEMINI_CLIENT, infilling_info, uploaded_files_cache, output_doc_path):
    """Fill a section using block-by-block approach with JSON quotes"""

    # Assemble prompts for Gemini
    system_prompt = assemble_system_prompt()
    user_prompt = assemble_user_prompt(infilling_info)

    # Ask Gemini for the content, with a few retries for validation
    response = ""
    quotes_json = None
    for i in range(3):  # Retry up to 3 times
        print(f"  > Gemini API Call (Attempt {i+1})...")
        sys.stdout.flush()
        response = ask_gemini(GEMINI_CLIENT, user_prompt, system_prompt, uploaded_files_cache)
        if is_valid_response(response, infilling_info):
            print("  > Valid response received from Gemini.")
            sys.stdout.flush()
            # Parse the AI response as JSON quotes
            quotes_json = parse_ai_response_as_section(response)
            break
        elif i < 2:
            print("  > Invalid response format, retrying...")
            sys.stdout.flush()
        else:
            print("  > Failed to get a valid response after 3 attempts.")
            sys.stdout.flush()
            # Don't exit, return the best response we have
            quotes_json = parse_ai_response_as_section(response)
            break

    if quotes_json and isinstance(quotes_json, dict) and "error" not in quotes_json:
        # Use the new block-by-block filling approach
        print("  > Filling document using block-by-block approach...")
        sys.stdout.flush()
        success = fill_document_block_by_block(output_doc_path, quotes_json)
        if success:
            print("  > Block-by-block filling completed successfully.")
            return quotes_json  # Return the JSON for status checking
        else:
            print("  > Block-by-block filling failed, falling back to section conversion.")
            sys.stdout.flush()

    # Fallback: Convert quotes back to section format (backwards compatibility)
    section_content = convert_quotes_to_section(quotes_json if quotes_json else {}, infilling_info)
    return section_content


def fill_document_with_json(GEMINI_CLIENT, infilling_info, uploaded_files_cache, output_doc_path):
    """Fill document using the streamlined JSON approach with direct text replacement"""

    # Assemble prompts for Gemini
    system_prompt = assemble_system_prompt()
    user_prompt = assemble_user_prompt(infilling_info)

    # Ask Gemini for the content, with a few retries for validation
    response = ""
    quotes_json = None
    for i in range(3):  # Retry up to 3 times
        print(f"  > Gemini API Call (Attempt {i+1})...")
        sys.stdout.flush()
        response = ask_gemini(GEMINI_CLIENT, user_prompt, system_prompt, uploaded_files_cache)
        if is_valid_response(response, infilling_info):
            print("  > Valid response received from Gemini.")
            sys.stdout.flush()
            # Parse the AI response as JSON quotes
            quotes_json = parse_ai_response_as_section(response)
            break
        elif i < 2:
            print("  > Invalid response format, retrying...")
            sys.stdout.flush()
        else:
            print("  > Failed to get a valid response after 3 attempts.")
            sys.stdout.flush()
            # Don't exit, return the best response we have
            quotes_json = parse_ai_response_as_section(response)
            break

    if quotes_json and isinstance(quotes_json, dict) and "error" not in quotes_json:
        # Use the new streamlined JSON filling approach
        print("  > Filling document using JSON replacement approach...")
        sys.stdout.flush()
        fill_result = fill_document_from_json(output_doc_path, quotes_json)

        if fill_result["success"]:
            print(f"  > JSON document filling completed successfully: {fill_result['message']}")
            # Return a structured result for status checking
            return {
                "type": "json_success",
                "data": quotes_json,
                "changes_made": fill_result["changes_made"],
                "message": fill_result["message"],
                "errors": fill_result["errors"]
            }
        else:
            print(f"  > JSON document filling failed: {fill_result['message']}")
            if fill_result["errors"]:
                for error in fill_result["errors"]:
                    print(f"  >   Error: {error}")
            print("  > Falling back to section conversion.")
            sys.stdout.flush()

    # Fallback: Convert quotes back to section format (backwards compatibility)
    section_content = convert_quotes_to_section(quotes_json if quotes_json else {}, infilling_info)
    return {
        "type": "section_fallback",
        "data": section_content,
        "message": "Used fallback section conversion approach"
    }


def refill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache):
    """Refill a section that previously had INFO_NOT_FOUND values"""
    
    # For now, use the same approach as fill_section
    # In the future, you might want to parse the existing content and only refill missing parts
    return fill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache)


def refill_section_targeted(GEMINI_CLIENT, current_section_content, uploaded_files_cache):
    """
    Future enhancement: Only refill the specific INFO_NOT_FOUND items in an existing section
    """
    system_prompt = assemble_system_prompt()

    user_prompt = f"""Please analyze this section content and find quotes to replace any "INFO_NOT_FOUND" values:

SECTION CONTENT TO UPDATE:
---
{current_section_content}
---

INSTRUCTIONS:
1. Identify all "INFO_NOT_FOUND" placeholders in the section
2. For each placeholder, search the source documents for exact, word-for-word quotes that can replace it
3. Return a JSON object with quotes only for the INFO_NOT_FOUND items
4. Use "INFO_NOT_FOUND" if no replacement quote can be found

Return only valid JSON with verbatim quotes from the source documents."""

    print(f"  > Gemini API Call for targeted refill...")
    sys.stdout.flush()
    response = ask_gemini(GEMINI_CLIENT, user_prompt, system_prompt, uploaded_files_cache)
    # Parse the AI response as JSON quotes
    quotes_json = parse_ai_response_as_section(response)

    # Convert quotes back to section format
    section_content = convert_quotes_to_section(quotes_json, current_section_content)

    return section_content