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
    section_format = extract_section_format(infilling_info)

    return f"""
Please fill in the following document section using information from the provided source documents.

SECTION TO COMPLETE:
---
{infilling_info}
---

IMPORTANT INSTRUCTIONS:
1. Your output should follow the EXACT same structure and formatting as the section above
2. For each piece of information, use the format: "<infotype>: <info> (<source>, Page X)"
   - <infotype>: The type or category of information (e.g., "Project Name", "Budget", "Timeline", "Risk Level")
   - <info>: The actual information from the source documents
   - <source>: The filename with page number (e.g., "requirements.pdf, Page 5", "design_doc.docx, Page 2")
   - ALWAYS include page numbers when available in the source documents
3. Examples:
   - "Project Name: Advanced Traffic Management System (requirements.pdf, Page 1)"
   - "Budget: $2.5 million (budget_report.xlsx, Page 1)"
   - "Primary Risk: Weather delays during construction (risk_assessment.pdf, Page 3)"
4. For tables: each cell should contain data in this format
5. For paragraphs: each sentence or fact should follow this structure
6. If you cannot find information for a specific field, use "<infotype>: INFO_NOT_FOUND"
7. Maintain all headings, paragraph structure, and table formatting exactly as shown
8. Do not add any content outside the section structure provided

Your response should be the completed section, ready to replace the original template section.
"""

def assemble_system_prompt():
    return """You are a document completion assistant. Your task is to fill in template sections with information from provided source documents.

KEY REQUIREMENTS:
1. **PRESERVE EXACT STRUCTURE**: Your output must maintain the identical structure of the input section
2. **MARKDOWN TABLES**: Keep all tables in markdown format (| column | column |)
3. **NO ADDITIONAL CONTENT**: Do not add explanations, comments, or content outside the section structure
4. **STRUCTURED FORMAT**: Every piece of information must follow the format "<infotype>: <info> (<source>)"
   - <infotype>: The category/type of the information being provided
   - <info>: The actual data/information from source documents
   - <source>: Source filename with optional page number
5. **MISSING INFO**: Use "<infotype>: INFO_NOT_FOUND" when specific information cannot be found in source documents
6. **MAINTAIN FORMATTING**: Keep all headings, spacing, and structural elements exactly as provided
7. **CONSISTENT SOURCING**: Every factual claim, data point, and piece of information must include its source in parentheses

Your entire response should be the completed section, properly formatted and ready for direct insertion into the document."""

def parse_ai_response_as_section(response_text):
    """Parse the AI response as complete section content rather than JSON"""
    # Clean up any markdown code blocks if present
    response_cleaned = response_text.strip()
    if response_cleaned.startswith("```"):
        lines = response_cleaned.split('\n')
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].strip() == "```":
            lines = lines[:-1]
        response_cleaned = '\n'.join(lines)
    
    return response_cleaned.strip()

def is_valid_response(response, infilling_info):
    """Validate that the response maintains the expected structure"""
    # Basic validation - check if response has similar structure to input
    response_lines = len(response.split('\n'))
    info_lines = len(infilling_info.split('\n'))

    # Allow more flexibility for responses with source citations (they'll be longer)
    if response_lines < info_lines * 0.5 or response_lines > info_lines * 3:
        return False

    # Check for markdown table consistency if original had tables
    info_has_tables = '|' in infilling_info
    response_has_tables = '|' in response

    if info_has_tables and not response_has_tables:
        return False

    return True