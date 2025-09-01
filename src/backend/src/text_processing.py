

def retrieve_contents_list(template_text: str) -> str:
    return template_text[template_text.find("Contents"):template_text.find("Appendix")].strip()


def get_pdd_targets(contents_list):

    pdd_targets = []
    section_heading = ""
    for line in contents_list.splitlines():
        if line.strip() and not line.startswith("Contents"):
            #print(line)
            if "." not in line.split()[0]:
                section_heading = " ".join(line.split()[1:-1])
            else:
                subheading = " ".join(line.split()[1:-1])
                subheading_idx = line.split()[0]
                page_num = line.split()[-1]
                # section heading, subheading title, subheading idx, page num
                pdd_targets.append((section_heading, subheading, subheading_idx, page_num))
    return pdd_targets


def find_target_location(target,template_text):
    char_count = 0
    start_location = -1
    for line in template_text.splitlines():
        if line.strip() == target[1]:  # Found the line containing only target[1]
            start_location = char_count + line.find(target[1])
            break
        char_count += len(line) + 1  # +1 for the newline character
    
    if start_location == -1:
        start_location = template_text.find(target[1])  # Fallback to original method
    return start_location


def cleanup_response(response):
    # Remove markdown code block fences
    if response.strip().startswith("```markdown"):
        response = response[len("```markdown"):].strip()
    if response.strip().startswith("```"):
        response = response[len("```"):].strip()
    if response.strip().endswith("```"):
        response = response[:-len("```")].strip()
    
    return response


def assemble_user_prompt(infilling_info):
    # User prompt contains the exact information source from the TEMPLATE.
    user_prompt = infilling_info.strip()
    return user_prompt

def assemble_system_prompt():

    system_prompt = """You are a document analysis assistant filling out a project template with information from provided documents. Your task is to act as a highly precise data extraction tool.

CRITICAL INSTRUCTIONS:
1.  **Adhere Strictly to Template Format:** Your primary goal is to replicate the EXACT structure, formatting, and layout of the user-provided template. This includes all headings, subheadings, bullet points, numbering, and table structures. Do not add, remove, or alter any structural elements.
2.  **Fill Placeholders:** Replace placeholders like `[item of information]` or example text with the most accurate and complete data found in the source documents.
3.  **Handle Tables with Precision:**
    *   Maintain the exact table structure: headers, number of rows/columns, and markdown formatting must be identical to the template.
    *   Replace ALL pre-filled example rows entirely with extracted data. Do not modify or append to them.
    *   If you find multiple items for a table, create a new row for each item.
4.  **Mandatory "INFO_NOT_FOUND" Protocol:** If, after an exhaustive search, specific information for a field or cell is not found, you MUST write "INFO_NOT_FOUND: <description of missing information>" in that exact spot.
    *   Apply this to every single field. Do NOT write "INFO_NOT_FOUND" for an entire section or table at once. Each cell must be individually assessed.
5.  **Direct Output Only:** Your response MUST contain ONLY the filled template. Do NOT include any explanations, commentary, headers, footers, apologies, or confirmation text (e.g., "Here is the filled template:"). Start directly with the first line of the template content and end with the last line.

ACCURACY AND VERIFICATION REQUIREMENTS (NON-NEGOTIABLE):
-   **No Inference or Assumption:** NEVER infer, assume, calculate, or derive information not explicitly stated in the source documents. If a number requires calculation, mark it as "INFO_NOT_FOUND".
-   **No External Knowledge:** NEVER use general knowledge, industry standards, or information from similar projects. Use ONLY the provided documents.
-   **No Data Modification:** NEVER round numbers, convert units, summarize text, or modify technical specifications. Copy data verbatim.
-   **No Fact Creation:** NEVER combine information from different contexts to create new facts. A statement must exist in its entirety in the source.
-   **No Vague Language:** NEVER use words like "approximately," "around," or "about" unless those exact words appear in the source document.
-   **No Extrapolation:** NEVER extrapolate dates, timelines, or schedules.

EXHAUSTIVE SEARCH PROTOCOL:
-   Before marking ANY field as "INFO_NOT_FOUND", you MUST perform the following three search passes through ALL provided documents:
    1.  **Pass 1 (Exact Terminology):** Search for the exact terms and phrases used in the template.
    2.  **Pass 2 (Synonyms & Variations):** Search for synonyms, related terms, and technical variations (e.g., for "Capacity," search "power rating," "output," "generation capacity," "installed capacity").
    3.  **Pass 3 (Contextual Search):** Search for contextual information that could logically contain the required data, even if the wording is different. Check all document types (e.g., technical specs may be in environmental reports).
-   **Search Everywhere:** Check document titles, headers, footers, tables, charts, graphs, captions, and metadata sections.

FORBIDDEN ACTIONS:
-   **Do NOT** invent plausible-sounding information.
-   **Do NOT** use standard project assumptions or industry defaults.
-   **Do NOT** interpret unclear or ambiguous information. If it's not clear, it's "INFO_NOT_FOUND."
-   **Do NOT** combine partial information from different sentences to create a complete answer unless they explicitly refer to the same subject in the same context.

OUTPUT CONSTRAINTS:
-   Start your response directly with the first word of the filled-in template.
-   End your response directly with the last word of the filled-in template.
-   Do not wrap your response in markdown code blocks (e.g., ```markdown ... ```).
"""
    return system_prompt

def is_valid_response(response, infilling_info):
    """
    Checks if the response from Gemini is valid.
    A valid response should not be empty and should not be identical to the prompt.
    """
    if not response or not response.strip():
        print("  > Validation failed: Response is empty.")
        return False
    
    # Check if the response is just a repeat of the input info, which indicates failure
    if response.strip() == infilling_info.strip():
        print("  > Validation failed: Response is identical to the input prompt.")
        return False
        
    # Check if the response contains common failure indicators
    error_phrases = [
        "I am unable to",
        "I cannot",
        "I'm sorry",
        "I am not able to",
        "Unfortunately, I cannot fulfill this request"
    ]
    if any(phrase in response for phrase in error_phrases):
        print("  > Validation failed: Response contains a failure phrase.")
        return False

    return True

