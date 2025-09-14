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
    return """You are a document completion assistant. Your task is to identify specific text in template sections that requests information, then find exact quotes from source documents to replace that text.

PROCESS:
1. **IDENTIFY REQUEST TEXT**: Look for sentences or phrases that clearly request information:
   - "A summary description of the technologies/measures to be implemented"
   - "The location of the project"
   - "An explanation of how the project is expected to generate GHG emission reductions"
   - Text ending with periods that describe what should be provided
   - Bullet points that describe required content

2. **USE EXACT TEXT AS KEYS**: Use the actual text from the template as your JSON keys, not simplified versions

3. **FIND QUOTES**: For each request, search source documents for verbatim quotes that answer it

4. **OUTPUT JSON**: Return JSON with this structure:

{
  "A summary description of the technologies/measures to be implemented by the project.": {
    "extracted_text": "exact quote from source document that describes technologies",
    "source_document": "document_name.pdf",
    "page_number": 42
  },
  "The location of the project.": {
    "extracted_text": "exact quote about project location",
    "source_document": "document_name.pdf",
    "page_number": 15
  }
}

CRITICAL REQUIREMENTS:
1. **USE ACTUAL TEMPLATE TEXT**: Your JSON keys must be the exact text from the template that describes what's needed
2. **VERBATIM QUOTES**: The "extracted_text" must be word-for-word quotes from source documents
3. **COMPLETE SENTENCES**: Use full sentences from the template as keys, not shortened versions
4. **MISSING INFO**: If no quote can be found, use: {"extracted_text": "INFO_NOT_FOUND", "source_document": null, "page_number": null}
5. **VALID JSON**: Ensure your entire response is valid JSON format

EXAMPLE: If the template says "An estimate of annual average and total reductions and removals." then use that EXACT text as your JSON key, don't simplify it to "annual_reductions".

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
    """Convert JSON quotes back to filled section format with intelligent replacement"""
    if not isinstance(quotes_json, dict):
        print(f"  > Warning: Expected dict for quotes, got {type(quotes_json)}")
        return original_template

    # If there's an error in the quotes_json, return original template
    if "error" in quotes_json:
        print(f"  > Error in AI response: {quotes_json.get('details', 'Unknown error')}")
        return original_template

    print(f"  > Converting {len(quotes_json)} quotes to section format")

    # Start with the original template
    result_content = original_template

    # Enhanced replacement strategy
    extracted_texts = []
    for field_name, quote_data in quotes_json.items():
        if isinstance(quote_data, dict) and "extracted_text" in quote_data:
            extracted_text = quote_data["extracted_text"]

            # Skip if no information was found
            if extracted_text == "INFO_NOT_FOUND":
                print(f"  > Skipping INFO_NOT_FOUND for {field_name}")
                continue

            extracted_texts.append({
                "field": field_name,
                "text": extracted_text,
                "source": quote_data.get("source_document", ""),
                "page": quote_data.get("page_number", "")
            })
            print(f"  > Found quote for {field_name}: '{extracted_text[:50]}...'")

    if not extracted_texts:
        print(f"  > No valid quotes found, returning original template")
        return original_template

    # Strategy 1: Replace common placeholder patterns
    placeholder_patterns = [
        "[TO_FILL]", "[FILL]", "TBD", "To be determined", "N/A", "Not available",
        "_____", "...", "___", "INFO_NOT_FOUND", "[PLACEHOLDER]", "[INSERT]",
        "[DESCRIPTION]", "[SUMMARY]", "[DETAILS]", "[INFORMATION]"
    ]

    replacements_made = 0
    for extract in extracted_texts:
        replaced = False

        # Try to replace placeholder patterns
        for pattern in placeholder_patterns:
            if pattern in result_content and not replaced:
                # Add source citation
                citation = ""
                if extract["source"] and extract["page"]:
                    citation = f" (Source: {extract['source']}, Page {extract['page']})"

                result_content = result_content.replace(pattern, extract["text"] + citation, 1)
                replaced = True
                replacements_made += 1
                print(f"  > Replaced '{pattern}' with quote from {extract['field']}")
                break

        # Strategy 2: Replace empty table cells
        if not replaced:
            import re
            # Look for empty cells in markdown tables
            empty_cell_patterns = [
                r'\|\s*\|',  # | |
                r'\|\s*TBD\s*\|',  # | TBD |
                r'\|\s*N/A\s*\|',  # | N/A |
                r'\|\s*\.\.\.\s*\|',  # | ... |
            ]

            for pattern in empty_cell_patterns:
                if re.search(pattern, result_content) and not replaced:
                    citation = ""
                    if extract["source"] and extract["page"]:
                        citation = f" (Source: {extract['source']}, Page {extract['page']})"

                    result_content = re.sub(pattern, f'| {extract["text"]}{citation} |', result_content, count=1)
                    replaced = True
                    replacements_made += 1
                    print(f"  > Replaced empty table cell with quote from {extract['field']}")
                    break

    print(f"  > Made {replacements_made} replacements in section content")

    # Strategy 3: If no replacements made, append quotes to end of section
    if replacements_made == 0 and extracted_texts:
        print(f"  > No placeholders found, appending quotes to section")
        result_content += "\n\n**Additional Information:**\n"
        for extract in extracted_texts:
            citation = ""
            if extract["source"] and extract["page"]:
                citation = f" (Source: {extract['source']}, Page {extract['page']})"

            result_content += f"\n• {extract['text']}{citation}"

        replacements_made = len(extracted_texts)
        print(f"  > Appended {replacements_made} quotes to section")

    return result_content