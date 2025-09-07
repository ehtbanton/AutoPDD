import json

def retrieve_contents_list(template_text: str) -> str:
    return template_text[template_text.find("Contents"):template_text.find("Appendix")].strip()

def get_pdd_targets(contents_list):
    pdd_targets = []
    section_heading = ""
    for line in contents_list.splitlines():
        if line.strip() and not line.startswith("Contents"):
            if "." not in line.split()[0]:
                section_heading = " ".join(line.split()[1:-1])
            else:
                subheading = " ".join(line.split()[1:-1])
                subheading_idx = line.split()[0]
                page_num = line.split()[-1]
                pdd_targets.append((section_heading, subheading, subheading_idx, page_num))
    return pdd_targets

def find_target_location(target,template_text):
    char_count = 0
    start_location = -1
    for line in template_text.splitlines():
        if line.strip() == target[1]:
            start_location = char_count + line.find(target[1])
            break
        char_count += len(line) + 1
    if start_location == -1: start_location = template_text.find(target[1])
    return start_location

def assemble_user_prompt(infilling_info):
    return f"""
Analyze the following section from a document template. For each field, placeholder, or table cell, find the corresponding information in the provided source documents.

Template Section to Extract Data For:
---
{infilling_info}
---

Your task is to return a single JSON object as instructed in the system prompt.
"""

def assemble_system_prompt():
    system_prompt = """You are a document analysis assistant. Your entire output MUST BE A SINGLE, VALID JSON OBJECT with a flat key-value structure.

CRITICAL JSON RULES:
1.  **JSON ONLY:** Your response MUST start with `{` and end with `}`. Do not include any text or markdown outside the JSON object.
2.  **FLAT STRUCTURE:** Do NOT nest JSON objects or use lists. Every piece of information must be a direct key-value pair in the main JSON object.
3.  **VALUE OBJECT:** The value for every key MUST be an object containing exactly two keys: "value" and "source".
4.  **MISSING INFORMATION:** If information is not found, the "value" must be the string "INFO_NOT_FOUND", and the "source" must be "N/A".

KEY NAMING CONVENTIONS:
-   **For simple paragraphs or placeholders:** The JSON key should be a concise description of the information requested (e.g., "Organization name").
-   **For TABLES:** This is critical. For each cell in a table that needs to be filled, create a unique key by combining the table's main title, the context from the cell's row (usually the text in the first column), and the text from the cell's column header.
    -   **FORMAT:** "Table Title: Row Context - Column Header"
    -   **EXAMPLE:** For the 'Audit History' table, a cell in the 'Validation' row under the 'Period' column should have the key "Audit History: Validation/verification - Period".
-   **For 2-COLUMN KEY-VALUE TABLES:** For simple tables with a label in the first column and a value in the second, the key should be the label from the first column.
    -   **EXAMPLE:** For a row with "Sectoral scope" in the first column, the key should simply be "Sectoral scope".

EXAMPLE OF A PERFECT (FLAT) RESPONSE:
{
  "Organization name": { "value": "Prime Road Alternative (Cambodia) Company Limited", "source": "doc1.pdf" },
  "Audit History: Validation/verification - Period": { "value": "24-March-2021", "source": "doc2.pdf" },
  "Audit History: Validation/verification - Program": { "value": "VCS", "source": "doc2.pdf" },
  "Sectoral scope": { "value": "Energy", "source": "doc1.pdf" }
}
"""
    return system_prompt

def parse_ai_json_response(response_text):
    """Safely parses the AI's string response into a Python dictionary."""
    try:
        response_cleaned = response_text.strip()
        if response_cleaned.startswith("```json"):
            response_cleaned = response_cleaned[7:]
        if response_cleaned.endswith("```"):
            response_cleaned = response_cleaned[:-3]
        return json.loads(response_cleaned)
    except json.JSONDecodeError:
        print("  > !!! CRITICAL PARSE ERROR: AI did not return valid JSON.")
        return None

def is_valid_response(response, infilling_info):
    return True