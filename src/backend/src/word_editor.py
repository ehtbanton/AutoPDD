import docx
import os
import shutil
import json
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.oxml import OxmlElement # <--- ADD THIS IMPORT
from docx.text.paragraph import Paragraph # <--- ADD THIS IMPORT
from docx.shared import RGBColor, Pt
import sys
import os

# --- HELPER FUNCTIONS ---
def _iter_block_items(parent):
    if isinstance(parent, docx.document.Document):
        parent_elm = parent.element.body
    elif isinstance(parent, docx.table._Cell):
        parent_elm = parent._tc
    else:
        raise ValueError("Parent must be a Document or _Cell object")
    
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield docx.text.paragraph.Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield docx.table.Table(child, parent)

def load_word_doc_to_string(folder_path):
    filename = None
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
         return f"Error: Directory not found or is not a directory at '{folder_path}'"
    try:
        for f in os.listdir(folder_path):
            if f.lower().endswith('.docx') and not f.startswith('~$'):
                filename = os.path.join(folder_path, f)
                break
    except FileNotFoundError:
        return f"Error: Directory not found at '{folder_path}'"
    if not filename:
        return f"Error: No .docx file found in the directory '{folder_path}'"
    try:
        document = docx.Document(filename)
        full_text_blocks = []
        for block in _iter_block_items(document):
            if isinstance(block, docx.text.paragraph.Paragraph):
                if block.text.strip():
                    full_text_blocks.append(block.text)
            elif isinstance(block, docx.table.Table):
                if not block.rows: continue
                table_lines = ["| " + " | ".join(cell.text.replace('\n', ' ').strip() for cell in block.rows[0].cells) + " |"]
                table_lines.append("| " + " | ".join(['---'] * len(block.rows[0].cells)) + " |")
                for row in block.rows[1:]:
                    table_lines.append("| " + " | ".join(cell.text.replace('\n', ' ').strip() for cell in row.cells) + " |")
                full_text_blocks.append("\n".join(table_lines))
        return "\n\n".join(full_text_blocks)
    except Exception as e:
        return f"Error processing file '{os.path.basename(filename)}': {e}"

def create_output_doc_from_template(project_name):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.abspath(os.path.join(script_dir, '..'))
    template_folder = os.path.join(backend_dir, "pdd_template")
    output_folder = os.path.join(backend_dir, "auto_pdd_output")
    
    if not os.path.isdir(template_folder):
        os.makedirs(template_folder)
        print(f"Created template directory: {template_folder}")
        raise FileNotFoundError(f"Error: Template directory was missing. Please upload a template .docx file to this folder and try again.")

    template_path = next((os.path.join(template_folder, f) for f in os.listdir(template_folder) if f.lower().endswith('.docx') and not f.startswith('~$')), None)
    
    if not template_path:
        raise FileNotFoundError(f"Error: No .docx template found in '{template_folder}'")

    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    output_path = os.path.join(output_folder, f"AutoPDD_{project_name}.docx")
    if not os.path.exists(output_path):
        shutil.copy(template_path, output_path)
        print(f"Created output document at: {output_path}")
    else:
        print(f"Output document already exists at: {output_path}. This file will be updated.")
    return output_path

def replace_section_in_word_doc(doc_path, start_marker, end_marker, ai_markdown_text, status):
    doc = docx.Document(doc_path)
    all_blocks = list(_iter_block_items(doc))

    start_index, end_index = -1, len(all_blocks)
    for i, block in enumerate(all_blocks):
        if isinstance(block, docx.text.paragraph.Paragraph):
            if block.text.strip() == start_marker:
                start_index = i
            elif start_index != -1 and block.text.strip() == end_marker:
                end_index = i
                break
    
    if start_index == -1:
        print(f"  > WARNING: Start marker '{start_marker}' not found.")
        return

    # Delete existing content
    for i in range(end_index - 1, start_index, -1):
        element = doc.element.body[i]
        doc.element.body.remove(element)

    # This will require a robust markdown parsing logic
    # and then creating new docx elements.
    # ...

    doc.save(doc_path)


def replace_paragraph_text(doc, old_text, new_text):
    """
    Finds and replaces the text in a paragraph, preserving the original formatting.
    This function iterates through all paragraphs in the document, including those within tables.
    """
    for p in doc.paragraphs:
        if p.text.strip() == old_text.strip():
            # Clear existing runs in the paragraph
            for run in p.runs:
                run.clear()
            # Add a new run with the new text, preserving the paragraph's style
            p.add_run(new_text)
            return True # Indicate success

    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    if p.text.strip() == old_text.strip():
                        for run in p.runs:
                            run.clear()
                        p.add_run(new_text)
                        return True # Indicate success
    return False # Indicate that the text was not found


def fill_document_block_by_block(doc_path, quotes_json):
    """
    Fill document block-by-block using JSON quotes data.
    Each question becomes a subheading with the answer inserted after it.
    """
    if not isinstance(quotes_json, dict):
        print(f"Error: Expected dictionary, got {type(quotes_json)}")
        return False

    try:
        doc = docx.Document(doc_path)

        # Track if any changes were made
        changes_made = False

        # Iterate through each question/answer pair in the JSON
        for question_key, quote_data in quotes_json.items():
            if not isinstance(quote_data, dict) or 'extracted_text' not in quote_data:
                print(f"Warning: Invalid quote data for {question_key}")
                continue

            extracted_text = quote_data.get('extracted_text', '')
            source_document = quote_data.get('source_document', '')
            page_number = quote_data.get('page_number', '')

            # Skip if no information was found
            if extracted_text == "INFO_NOT_FOUND":
                continue

            # Find a good location to insert this content
            # Look for the question text or similar patterns in the document
            insertion_point = find_insertion_point(doc, question_key)

            if insertion_point:
                # Insert the question as a subheading if not already present
                question_paragraph = insert_question_subheading(doc, insertion_point, question_key)

                # Insert the answer text after the question
                answer_paragraph = insert_answer_with_source(doc, question_paragraph,
                                                           extracted_text, source_document, page_number)
                changes_made = True
                print(f"  > Inserted content for: {question_key[:50]}...")
            else:
                print(f"  > Warning: Could not find insertion point for: {question_key[:50]}...")

        if changes_made:
            doc.save(doc_path)
            print(f"Document updated successfully: {doc_path}")
            return True
        else:
            print("No changes made to document")
            return False

    except Exception as e:
        print(f"Error filling document block-by-block: {e}")
        import traceback
        traceback.print_exc()
        return False


def find_insertion_point(doc, question_key):
    """
    Find the best insertion point for a question/answer pair.
    Looks for placeholder text, empty cells, or similar question text.
    """
    # Clean the question key for better matching
    cleaned_question = question_key.replace('_', ' ').lower().strip()

    # Search through paragraphs for placeholder patterns or similar text
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip().lower()

        # Look for placeholder patterns
        if any(pattern in text for pattern in ['[to_fill]', 'tbd', 'n/a', '_____', '...', 'info_not_found']):
            return paragraph

        # Look for similar question text (partial matching)
        if len(cleaned_question) > 10 and cleaned_question in text:
            return paragraph

    # Search through tables for empty cells or placeholder patterns
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    text = paragraph.text.strip().lower()

                    if any(pattern in text for pattern in ['[to_fill]', 'tbd', 'n/a', '_____', '...', 'info_not_found']):
                        return paragraph

                    # Check for empty or minimal content cells
                    if len(text) == 0 or (len(text) < 10 and not text.isalpha()):
                        return paragraph

    return None


def insert_question_subheading(doc, insertion_point, question_text):
    """
    Insert a question as a subheading at the specified insertion point.
    Returns the created paragraph.
    """
    # Get the parent element to insert after
    if hasattr(insertion_point, '_element'):
        parent_element = insertion_point._element.getparent()

        # Create new paragraph element for the question
        question_para_element = OxmlElement("w:p")
        insertion_point._element.addnext(question_para_element)
        question_para = Paragraph(question_para_element, doc)

        # Format as a subheading (bold, slightly larger)
        run = question_para.add_run(question_text.replace('_', ' ').title())
        run.bold = True

        return question_para

    return None


def insert_answer_with_source(doc, question_paragraph, answer_text, source_document, page_number):
    """
    Insert answer text after the question paragraph with embedded source information.
    """
    if not question_paragraph or not hasattr(question_paragraph, '_element'):
        return None

    # Create new paragraph for the answer
    answer_para_element = OxmlElement("w:p")
    question_paragraph._element.addnext(answer_para_element)
    answer_para = Paragraph(answer_para_element, doc)

    # Add the main answer text
    main_run = answer_para.add_run(answer_text)

    # Add source information as a smaller, gray text run
    if source_document and page_number:
        source_run = answer_para.add_run(f" (Source: {source_document}, Page {page_number})")
        source_run.font.size = Pt(9)
        source_run.font.color.rgb = RGBColor(128, 128, 128)  # Gray color
        source_run.italic = True

    # Add hidden text with structured source data for frontend parsing
    if source_document and page_number:
        hidden_run = answer_para.add_run()
        hidden_run.text = f"{{\"source\":\"{source_document}\",\"page\":{page_number}}}"
        hidden_run.font.hidden = True

    return answer_para


def fill_document_from_json(doc_path, json_data):
    """
    Fill Word document by replacing keys with extracted_text and embedding metadata as comments.

    Args:
        doc_path (str): Path to the Word document
        json_data (dict): JSON data with structure:
                         {"question_key": {"extracted_text": "...", "source_document": "...", "page_number": ...}}

    Returns:
        dict: {"success": bool, "changes_made": int, "errors": list, "message": str}
    """
    result = {
        "success": False,
        "changes_made": 0,
        "errors": [],
        "message": ""
    }

    if not isinstance(json_data, dict):
        result["errors"].append(f"Expected dictionary, got {type(json_data)}")
        result["message"] = "Invalid input data format"
        return result

    if "error" in json_data:
        result["errors"].append(f"AI response error: {json_data.get('details', 'Unknown error')}")
        result["message"] = "AI generated error response"
        return result

    if not doc_path or not os.path.exists(doc_path):
        result["errors"].append(f"Document not found at: {doc_path}")
        result["message"] = "Document file not accessible"
        return result

    try:
        doc = docx.Document(doc_path)
        changes_made = 0
        not_found_items = []
        replaced_items = []

        # Iterate through each question/answer pair in the JSON
        for question_key, quote_data in json_data.items():
            if not isinstance(quote_data, dict) or 'extracted_text' not in quote_data:
                result["errors"].append(f"Invalid quote data structure for '{question_key}'")
                continue

            extracted_text = quote_data.get('extracted_text', '')
            source_document = quote_data.get('source_document', '')
            page_number = quote_data.get('page_number', '')

            # Handle INFO_NOT_FOUND cases
            if extracted_text == "INFO_NOT_FOUND":
                not_found_items.append(question_key)
                print(f"  > No information found for: {question_key}")
                continue

            if not extracted_text or not extracted_text.strip():
                result["errors"].append(f"Empty extracted text for '{question_key}'")
                continue

            # Clean the question key for better matching
            cleaned_question = question_key.replace('_', ' ').strip()

            # Try to find and replace the question text in the document
            try:
                replaced = replace_text_with_metadata(doc, cleaned_question, extracted_text,
                                                    source_document, page_number)

                if replaced:
                    changes_made += 1
                    replaced_items.append(question_key)
                    print(f"  > ✓ Replaced '{question_key}' with extracted text")
                else:
                    result["errors"].append(f"Could not find text to replace for '{question_key}'")
                    print(f"  > ✗ Could not find text to replace for '{question_key}'")

            except Exception as e:
                result["errors"].append(f"Error replacing '{question_key}': {str(e)}")
                print(f"  > Error replacing '{question_key}': {e}")

        # Save document if changes were made
        if changes_made > 0:
            try:
                doc.save(doc_path)
                result["success"] = True
                result["changes_made"] = changes_made
                result["message"] = f"Successfully updated {changes_made} items in document"
                print(f"✓ Document updated successfully: {changes_made} replacements made")

                if not_found_items:
                    result["message"] += f". {len(not_found_items)} items had no source information"

            except Exception as save_error:
                result["errors"].append(f"Failed to save document: {str(save_error)}")
                result["message"] = "Changes made but failed to save document"
                return result
        else:
            result["message"] = "No changes made to document"
            if not_found_items:
                result["message"] += f" ({len(not_found_items)} items had no source information)"

        # Log summary
        print(f"  Summary: {changes_made} replaced, {len(not_found_items)} not found, {len(result['errors'])} errors")

        return result

    except Exception as e:
        result["errors"].append(f"Document processing error: {str(e)}")
        result["message"] = "Failed to process document"
        print(f"✗ Critical error filling document: {e}")
        import traceback
        traceback.print_exc()
        return result


def replace_text_with_metadata(doc, search_text, replacement_text, source_document, page_number):
    """
    Find and replace text in the document, then add metadata as a comment.

    Returns:
        bool: True if text was found and replaced, False otherwise
    """
    search_text_lower = search_text.lower().strip()
    replaced = False

    # Search through all paragraphs
    for paragraph in doc.paragraphs:
        if search_text_lower in paragraph.text.lower():
            # Replace the text
            paragraph.text = replacement_text

            # Add comment with metadata
            if source_document and page_number:
                add_comment_to_paragraph(paragraph, source_document, page_number)

            replaced = True
            break

    # If not found in paragraphs, search through tables
    if not replaced:
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for paragraph in cell.paragraphs:
                        if search_text_lower in paragraph.text.lower():
                            # Replace the text
                            paragraph.text = replacement_text

                            # Add comment with metadata
                            if source_document and page_number:
                                add_comment_to_paragraph(paragraph, source_document, page_number)

                            replaced = True
                            break
                    if replaced:
                        break
                if replaced:
                    break
            if replaced:
                break

    return replaced


def add_comment_to_paragraph(paragraph, source_document, page_number):
    """
    Add a comment to a paragraph containing source metadata.
    Note: python-docx doesn't directly support comments, so we'll add a hidden run with metadata.
    """
    try:
        # Add a hidden run with JSON metadata for frontend parsing
        hidden_run = paragraph.add_run()
        metadata = {
            "source": source_document,
            "page": page_number
        }
        hidden_run.text = f" [METADATA:{json.dumps(metadata)}]"
        hidden_run.font.hidden = True

        # Also add a visible source citation
        citation_run = paragraph.add_run(f" (Source: {source_document}, Page {page_number})")
        citation_run.font.size = Pt(9)
        citation_run.font.color.rgb = RGBColor(128, 128, 128)  # Gray color
        citation_run.italic = True

    except Exception as e:
        print(f"Warning: Could not add comment to paragraph: {e}")


if __name__ == '__main__':
    # For debugging: print the received arguments
    # print(f"Received arguments: {sys.argv}")
    
    if len(sys.argv) != 4:
        print("Usage: python word_editor.py <doc_path> <old_text> <new_text>")
        print(f"Error: Expected 4 arguments, but received {len(sys.argv)}.")
        sys.exit(1)

    doc_path = sys.argv[1]
    old_text = sys.argv[2]
    new_text = sys.argv[3]

    if not os.path.exists(doc_path):
        print(f"Error: Document not found at '{doc_path}'")
        sys.exit(1)

    try:
        document = docx.Document(doc_path)
        if replace_paragraph_text(document, old_text, new_text):
            document.save(doc_path)
            print("SUCCESS")
        else:
            print(f"Error: Could not find the paragraph with the text: '{old_text}'")
            sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)