import json
import re

def retrieve_contents_list(template_text: str) -> str:
    return template_text[template_text.find("Contents"):template_text.find("CONTENTS_END")].strip()

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

def convert_word_tables_to_markdown(text):
    """Convert Word document table format to markdown tables"""
    lines = text.split('\n')
    result_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        # Check if this looks like a table row (starts and ends with |)
        if line.startswith('|') and line.endswith('|'):
            table_lines = []
            # Collect all consecutive table lines
            while i < len(lines) and lines[i].strip().startswith('|') and lines[i].strip().endswith('|'):
                table_lines.append(lines[i].strip())
                i += 1
            
            if len(table_lines) >= 2:  # We have at least header and separator
                # Add the table lines as-is (they're already in markdown format)
                result_lines.extend(table_lines)
            else:
                # Not a proper table, add as regular lines
                result_lines.extend(table_lines)
        else:
            result_lines.append(lines[i])
            i += 1
    
    return '\n'.join(result_lines)

def extract_section_format(infilling_info):
    """Extract the structural format/template of a section for the AI to follow"""
    # Convert any existing tables to markdown format
    markdown_content = convert_word_tables_to_markdown(infilling_info)
    
    # Create a template that shows the structure
    format_template = []
    lines = markdown_content.split('\n')
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            format_template.append("")
        elif stripped.startswith('#'):
            # Heading
            format_template.append(line)
        elif stripped.startswith('|') and stripped.endswith('|'):
            # Table row - preserve the structure but indicate it needs filling
            if '---' in stripped:
                format_template.append(line)  # Keep separator as-is
            else:
                # Replace content with placeholder indicators
                cells = [cell.strip() for cell in stripped.split('|')[1:-1]]
                if any(cell and not any(char.isalpha() for char in cell) for cell in cells[1:]):
                    # This looks like a data row (has empty or non-text cells)
                    new_cells = []
                    for i, cell in enumerate(cells):
                        if i == 0:
                            new_cells.append(cell)  # Keep row label
                        else:
                            new_cells.append("[TO_FILL]")  # Mark as needing content
                    format_template.append("| " + " | ".join(new_cells) + " |")
                else:
                    format_template.append(line)  # Keep header row as-is
        else:
            # Regular paragraph - check if it contains placeholders or looks like a template
            if any(marker in stripped for marker in ["[", "_____", "...", "TBD", "N/A"]):
                format_template.append("[PARAGRAPH_TO_FILL]")
            else:
                format_template.append(line)
    
    return '\n'.join(format_template)

def assemble_user_prompt(infilling_info):
    return f"""
Please analyze the following document template section and extract information using verbatim quotes from the provided source documents.

TEMPLATE SECTION TO ANALYZE:
---
{infilling_info}
---

INSTRUCTIONS:
1. Identify each piece of information requested in this template (table cells to fill, placeholders, paragraph content needed, etc.)
2. For each information request, search the source documents for exact, word-for-word quotes that answer it
3. Return a JSON object where:
   - Keys are descriptive names for each information request
   - Values are objects with "extracted_text" (verbatim quote), "source_document" (filename), and "page_number"
4. Use "INFO_NOT_FOUND" for extracted_text when no relevant quote can be found

Example output format:
{{
  "project_start_date": {{
    "extracted_text": "The project commenced on January 15, 2024",
    "source_document": "project_timeline.pdf",
    "page_number": 3
  }},
  "budget_amount": {{
    "extracted_text": "Total allocated budget is $2.5 million",
    "source_document": "financial_report.pdf",
    "page_number": 12
  }}
}}

Return only valid JSON with verbatim quotes from the source documents.
"""

def assemble_system_prompt():
    return """You are a document completion assistant. Your task is to identify information requests from template sections and find exact quotes from source documents.

PROCESS:
1. **PARSE TEMPLATE**: First, analyze the provided template to identify all individual questions or information requests (fields, table cells, paragraphs to fill)
2. **FIND QUOTES**: For each information request, search the source documents to find a direct, verbatim quote that answers it
3. **OUTPUT JSON**: Return a JSON object with this structure:

{
  "question_or_field_name": {
    "extracted_text": "exact quote from source document",
    "source_document": "document_name.pdf",
    "page_number": 42
  },
  "another_field": {
    "extracted_text": "another verbatim quote",
    "source_document": "document_name.pdf",
    "page_number": 15
  }
}

KEY REQUIREMENTS:
1. **VERBATIM QUOTES**: The "extracted_text" must be word-for-word quotes from the source documents
2. **COMPLETE INFORMATION**: Include source document name and page number for each quote
3. **FIELD IDENTIFICATION**: Use descriptive names for keys that clearly identify what information is being requested
4. **MISSING INFO**: If no quote can be found, use: {"extracted_text": "INFO_NOT_FOUND", "source_document": null, "page_number": null}
5. **VALID JSON**: Ensure your entire response is valid JSON format

Your entire response must be valid JSON containing the quote-based information extraction."""

def parse_ai_response_as_section(response_text):
    """Parse the AI response as JSON containing quotes and source information"""
    # Clean up any markdown code blocks if present
    response_cleaned = response_text.strip()
    if response_cleaned.startswith("```"):
        lines = response_cleaned.split('\n')
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].strip() == "```":
            lines = lines[:-1]
        response_cleaned = '\n'.join(lines)

    try:
        # Parse as JSON
        quotes_data = json.loads(response_cleaned)

        # Validate structure
        if not isinstance(quotes_data, dict):
            raise ValueError("Response is not a JSON object")

        # Validate each quote entry has required fields
        for key, value in quotes_data.items():
            if not isinstance(value, dict):
                raise ValueError(f"Entry {key} is not a dictionary")
            if "extracted_text" not in value:
                raise ValueError(f"Entry {key} missing extracted_text")
            if "source_document" not in value:
                raise ValueError(f"Entry {key} missing source_document")
            if "page_number" not in value:
                raise ValueError(f"Entry {key} missing page_number")

        return quotes_data

    except json.JSONDecodeError as e:
        # If JSON parsing fails, return error info
        return {
            "error": "Invalid JSON response",
            "details": str(e),
            "raw_response": response_cleaned[:500]  # First 500 chars for debugging
        }
    except ValueError as e:
        # If structure validation fails
        return {
            "error": "Invalid response structure",
            "details": str(e),
            "raw_response": response_cleaned[:500]
        }

def is_valid_response(response, infilling_info):
    """Validate that the response is valid JSON with quote structure"""
    try:
        # Try to parse as JSON
        response_cleaned = response.strip()
        if response_cleaned.startswith("```"):
            lines = response_cleaned.split('\n')
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].strip() == "```":
                lines = lines[:-1]
            response_cleaned = '\n'.join(lines)

        quotes_data = json.loads(response_cleaned)

        # Must be a dictionary
        if not isinstance(quotes_data, dict):
            return False

        # Must have at least one entry
        if len(quotes_data) == 0:
            return False

        # Each entry must have the required structure
        for key, value in quotes_data.items():
            if not isinstance(value, dict):
                return False
            if not all(field in value for field in ["extracted_text", "source_document", "page_number"]):
                return False

        return True

    except (json.JSONDecodeError, ValueError):
        return False

def convert_quotes_to_section(quotes_json, original_template):
    """Convert JSON quotes back to filled section format"""
    if not isinstance(quotes_json, dict):
        return original_template

    # If there's an error in the quotes_json, return original template
    if "error" in quotes_json:
        print(f"  > Error in AI response: {quotes_json.get('details', 'Unknown error')}")
        return original_template

    # Start with the original template
    result_content = original_template

    # Replace placeholders and empty fields with extracted text
    for field_name, quote_data in quotes_json.items():
        if isinstance(quote_data, dict) and "extracted_text" in quote_data:
            extracted_text = quote_data["extracted_text"]

            # Skip if no information was found
            if extracted_text == "INFO_NOT_FOUND":
                continue

            # Try to intelligently replace content in the template
            # This is a simplified approach - could be made more sophisticated

            # Look for common placeholder patterns
            placeholder_patterns = [
                "[TO_FILL]", "TBD", "N/A", "_____", "...",
                "[PARAGRAPH_TO_FILL]", "INFO_NOT_FOUND"
            ]

            # Replace first occurrence of any placeholder pattern
            replaced = False
            for pattern in placeholder_patterns:
                if pattern in result_content and not replaced:
                    result_content = result_content.replace(pattern, extracted_text, 1)
                    replaced = True
                    break

            # If no placeholder pattern found, try to find empty table cells
            if not replaced:
                # Look for empty cells in markdown tables (| | pattern)
                import re
                table_cell_pattern = r'\|\s*\|'
                if re.search(table_cell_pattern, result_content):
                    result_content = re.sub(table_cell_pattern, f'| {extracted_text} |', result_content, count=1)

    return result_content