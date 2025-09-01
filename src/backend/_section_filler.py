
from gemini_interface import ask_gemini
from text_processing import assemble_user_prompt, assemble_system_prompt, is_valid_response


def fill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache):

    # Assemble prompts for Gemini
    system_prompt = assemble_system_prompt()
    user_prompt = assemble_user_prompt(infilling_info)
    # Ask Gemini for the content, with a few retries for validation
    response = ""
    for i in range(3):  # Retry up to 3 times
        print(f"  > Gemini API Call (Attempt {i+1})...")
        response = ask_gemini(GEMINI_CLIENT, user_prompt, system_prompt, uploaded_files_cache)
        if is_valid_response(response, infilling_info):
            print("  > Valid response received from Gemini.")
            break
        elif i < 2:
            print("  > Invalid response format, retrying...")
        else:
            print("  > Failed to get a valid response after 3 attempts.")
            exit()
    return response


def refill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache):
    # For now just call fill_section
    return fill_section(GEMINI_CLIENT, infilling_info, uploaded_files_cache)



def refill_section_deprecated(GEMINI_CLIENT, infilling_info, uploaded_files_cache):
    # Returns a pseudo-response...
    system_prompt = "Search through all user-provided files. In the user prompt, wherever you see 'INFO_NOT_FOUND: <info type>', replace it with the relevant information. Then respond with text identical to the user prompt but with as many replacements made as possible, if you are able to find that info in the provided context. Only respond with this edited user prompt and include no other text in your response."
    user_prompt = assemble_user_prompt(infilling_info)
    print(f"  > Gemini API Call for section refill...")
    response = ask_gemini(GEMINI_CLIENT, user_prompt, system_prompt, uploaded_files_cache)
    return response




