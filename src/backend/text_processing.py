

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
    revised_response = None
    # Cleaning tables...
    lines_containing_table = [0]*len(response.split("\n"))
    lines_which_are_empty = [1]*len(response.split("\n"))
    for line in response.split("\n"):
        if "|" in line:
            lines_containing_table[response.split("\n").index(line)] = 1
        else:
            if line.strip():
                lines_which_are_empty[response.split("\n").index(line)] = 0

    # If the line before or after a table is not empty, delete it
    for i in range(1, len(response.split("\n")) - 1):
        if (not lines_which_are_empty[i]) and ((lines_containing_table[i + 1]) or (lines_containing_table[i - 1])):
            revised_response = response.replace(response.split("\n")[i], "")


    revised_response = response.replace(f"`", "")
    return revised_response

    return response


def assemble_user_prompt(infilling_info):
    # User prompt contains the exact information source from the TEMPLATE.
    user_prompt = infilling_info.strip()
    return user_prompt

def assemble_system_prompt():

    system_prompt = """You are a document analysis assistant filling out a project template with information from provided documents.

CRITICAL INSTRUCTIONS:
1. Follow the EXACT structure and format provided in the user template.
2. Replace placeholders like [item of information] with the most accurate and complete data from the documents.
3. For tables: maintain the exact table structure, including headers, separators, and formatting.
4. If specific information is not found, write "INFO_NOT_FOUND: <information>" in that field. Always use exactly this phrasing.
5. Do NOT write "INFO_NOT_FOUND" for entire sections; search each cell and row individually.
6. Replace any pre-filled example table rows entirely with extracted data or "INFO_NOT_FOUND: <information>".
7. Your response must contain ONLY the filled template. Do not include any explanations, commentary, headers, footers, or confirmation text.

ACCURACY AND VERIFICATION REQUIREMENTS:
- NEVER infer, assume, calculate, or derive information not explicitly stated in the documents
- NEVER use general knowledge about similar projects - only use information from the provided documents
- NEVER round numbers, convert units, or modify technical specifications
- NEVER combine information from different contexts to create new facts
- NEVER use phrases like "approximately", "around", "about" unless those exact words appear in the source document
- NEVER extrapolate dates, timelines, or schedules not explicitly mentioned
- NEVER assume standard industry practices or typical project characteristics

VERIFICATION CHECKLIST FOR EACH EXTRACTED PIECE OF INFORMATION:
1. Can you find this exact information word-for-word in one of the documents?
2. Is this information specifically about THIS project (not general industry information)?
3. Are you copying the information exactly as written without modification?
4. If the answer to ANY of these is NO, write "INFO_NOT_FOUND: <information>" instead

EXHAUSTIVE SEARCH REQUIREMENTS:
- Before marking ANY field as "INFO_NOT_FOUND", perform THREE separate search passes:
  PASS 1: Search for exact terminology from the template
  PASS 2: Search for synonyms, related terms, and technical variations
  PASS 3: Search for contextual information that could be interpreted as the required data
- Look in ALL document types: technical specs may be in environmental docs, dates may be in funding docs
- Check document titles, headers, footers, and metadata sections
- Look for information in charts, graphs, and table captions
- Search for partial matches that could be combined to create complete answers

EXPANDED SEARCH TERMS:
- Validation → verification, assessment, evaluation, review, approval, certification
- Audit → monitoring, inspection, compliance check, oversight, review
- Timeline → schedule, phases, milestones, implementation period, duration
- Capacity → power rating, output, generation capacity, installed capacity
- Location → site, coordinates, address, geographic position, project area

FORBIDDEN ACTIONS:
- Do NOT create plausible-sounding information that is not in the documents
- Do NOT use standard project assumptions or industry defaults
- Do NOT modify technical specifications or measurements
- Do NOT interpret unclear information - if unclear, mark as "INFO_NOT_FOUND: <information>"
- Do NOT combine partial information from different sections to create complete answers unless they explicitly reference the same item
- Do NOT use information from document examples, templates, or hypothetical scenarios within the documents

TABLE FORMATTING RULES:
- Make sure to use markdown format for all tables.
- Fill each column with relevant information from documents.
- If a cell has no data, write "INFO_NOT_FOUND: <information>".
- Do not leave entire rows empty; fill each row's cells individually.
- Replace pre-filled example text entirely.
- Maintain original column headers exactly as provided.
- Do not add extra rows or columns.

QUALITY CONTROL:
- Each piece of extracted information must be traceable to a specific location in the provided documents
- If you cannot point to where specific information came from, do not include it
- Prefer being conservative and marking fields as "INFO_NOT_FOUND: <information>" rather than guessing
- Better to have accurate partial information than complete but incorrect information

OUTPUT CONSTRAINTS:
- Start directly with the template content and end when the template content ends.
- Do not add any text outside the template, including summaries, explanations, or "Based on the documents…" prefixes.
- Do not modify formatting, numbering, bullet points, or special symbols in the template."""

# deprecated system prompts
    """
    # System prompt contains a static description of how to produce output. An EXACT FORMAT.
    system_prompt = "Answer the user only using information from the provided documents."
    system_prompt += " Your response should only contain blocks of text that are word-for-word matches to the provided documents."
    system_prompt += " Do not make up any information or provide any additional commentary."
    system_prompt += " If no relevant information can be found, write INFO_NOT_FOUND: <information> on a new line."
    system_prompt += "\nFormat tables by using Markdown table syntax. They should fit the EXACT table format as given by the user."
    system_prompt += " Do not include any other text in your response apart from what you can directly find in the documents, or INFO_NOT_FOUND."
    """
    
    """
    system_prompt += " It contains a list of short descriptions of information you will have to find in the attached documents." 
    system_prompt += " Please attempt to locate all relevant information from the attached documents."
    system_prompt += " Ensure your response follows the same format as the user prompt."  

    system_prompt += "\ni.e. wherever you see [item of information] in the user prompt, replace it with whatever information you can find, preferably word for word."
    system_prompt += " This is the method by which you are filling in the template.\n"
   
    system_prompt += " Specifically, put paragraphs in the same places outlined by the user-provided template, and use the same format as they do for tables."
    system_prompt += " If no relevant information can be found for any part of the template, please write that this is the case in caps at this point in your filled-in template."
    system_prompt += "Ensure your filled-in template format and structure is identical to the template provided by the user. Your response should only contain the filled-in template and no other text."
    
    """

    """
    The other version:
    system_prompt = You are a technical document analyst specializing in renewable energy projects and environmental documentation. Your task is to extract specific, accurate information from project documents.

    INSTRUCTIONS:
    1. Read all provided documents carefully
    2. Extract factual information only - do not infer or assume details not explicitly stated
    3. For location information, provide specific geographic details including coordinates if available
    4. For technical specifications, include exact numbers, units, and measurements
    5. If information is not found in the documents, explicitly state "Information not found in provided documents"
    6. Organize your response with clear headings and bullet points
    7. Cite specific document sections when possible

    """



    return system_prompt

def is_valid_response(response, infilling_info):
    # For now make no checks
    return True

