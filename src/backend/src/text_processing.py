
import json


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


def assemble_user_prompt(infilling_info):
    # This now provides the raw section text as precise context for the AI.
    return f"""
Analyze the following section from a document template. For each field, placeholder, or table cell, find the corresponding information in the provided source documents.

Template Section to Extract Data For:
---
{infilling_info}
---

Your task is to return a single JSON object as instructed in the system prompt.
"""

def assemble_system_prompt():
    """
    Assembles the system prompt with clear instructions for a flat JSON structure.
    """
    system_prompt = """You are a document analysis assistant. Your entire output MUST BE A SINGLE, VALID JSON OBJECT with a flat key-value structure.

CRITICAL JSON RULES:
1.  **JSON ONLY:** Your response MUST start with `{` and end with `}`. Do not include any text or markdown outside the JSON object.
2.  **FLAT STRUCTURE:** Do NOT nest JSON objects or use lists. Every piece of information must be a direct key-value pair in the main JSON object.
3.  **VALUE OBJECT:** The value for every key MUST be an object containing exactly two keys: `"value"` and `"source"`.
4.  **MISSING INFORMATION:** If information is not found, the `"value"` must be the string "INFO_NOT_FOUND", and the `"source"` must be "N/A".

KEY NAMING CONVENTIONS:
-   **For simple paragraphs or placeholders:** The JSON key should be a concise description of the information requested (e.g., "[Project Title]").
-   **For TABLES:** This is critical. For each cell in a table that needs to be filled, create a unique key by combining the table's main title, the context from the cell's row (usually the text in the first column), and the text from the cell's column header.
    -   **FORMAT:** `"Table Title: Row Context - Column Header"`
    -   **EXAMPLE:** For the 'Audit History' table, a cell in the 'Validation' row under the 'Period' column should have the key `"Audit History: Validation/verification - Period"`.
-   **For 2-COLUMN KEY-VALUE TABLES:** For simple tables with a label in the first column and a value in the second, the key should be the label from the first column.
    -   **EXAMPLE:** For a row with "Sectoral scope" in the first column, the key should simply be `"Sectoral scope"`.

EXAMPLE OF A PERFECT (FLAT) RESPONSE:
{
  "[Project Title]": { "value": "Prime Road Alternative (Cambodia) Company Limited", "source": "doc1.pdf" },
  "Audit History: Validation/verification - Period": { "value": "24-March-2021", "source": "doc2.pdf" },
  "Audit History: Validation/verification - Program": { "value": "VCS", "source": "doc2.pdf" },
  "Sectoral scope": { "value": "Energy", "source": "doc1.pdf" }
}
"""

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

def parse_ai_json_response(response_text):
    """Safely parses the AI's string response into a Python dictionary."""
    try:
        # Clean the response by removing markdown code blocks if they exist
        response_cleaned = response_text.strip()
        if response_cleaned.startswith("```json"):
            response_cleaned = response_cleaned[7:]
        if response_cleaned.endswith("```"):
            response_cleaned = response_cleaned[:-3]
        
        return json.loads(response_cleaned)
    except json.JSONDecodeError:
        print(f"  > !!! CRITICAL PARSE ERROR: AI did not return valid JSON.")
        return None
    except Exception as e:
        print(f"  > !!! An unexpected error occurred during JSON parsing: {e}")
        return None