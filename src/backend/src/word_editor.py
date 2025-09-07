
import docx
import os
import shutil
import pypandoc
import json
import tempfile
import sys
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl

# --- HELPER FUNCTIONS (UNCHANGED and WORKING) ---
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
    # Go up 2 levels to reach backend folder from src/backend/src
    backend_dir = os.path.abspath(os.path.join(script_dir, '..'))

    template_folder = os.path.join(backend_dir, "pdd_template")
    output_folder = os.path.join(backend_dir, "auto_pdd_output")
    
    # Ensure template folder exists
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
    sys.stdout.flush()
    return output_path

def add_comment(paragraph, text, author="Source Reference"):
    try:
        # Only add a comment if there is actual sourced content.
        if paragraph.text.strip() and "INFO_NOT_FOUND" not in text and text.strip() != "Source: N/A":
            paragraph.add_comment(text, author=author)
    except Exception:
        pass



def _delete_element(element):
    el = element._element
    el.getparent().remove(el)

# --- NEW HELPER FUNCTION FOR HIGH-LEVEL CONTENT COPYING ---
def _insert_content_from_document(source_doc, target_doc, anchor_element):
    """
    Reads elements from the source_doc and intelligently recreates them in the
    target_doc after the anchor_element, preserving formatting.
    """
    cursor = anchor_element # This is the last known element in the target document

    # Iterate through each block (paragraph or table) in the source document
    for block in _iter_block_items(source_doc):
        if isinstance(block, docx.text.paragraph.Paragraph):
            # It's a paragraph - recreate it
            new_p = target_doc.add_paragraph(text=block.text, style=block.style)
            # This is a bit of a hack to insert after the cursor
            if cursor.getnext() is not None:
                cursor.getparent().insert(cursor.getparent().index(cursor) + 1, new_p._element)
            else:
                 cursor.addnext(new_p._element)
            cursor = new_p._element # Move the cursor
        
        elif isinstance(block, docx.table.Table):
            # It's a table - recreate it cell by cell
            num_rows = len(block.rows)
            num_cols = len(block.columns)
            new_table = target_doc.add_table(rows=num_rows, cols=num_cols)
            new_table.style = block.style
            
            # This is the crucial part: copy text from each cell
            for r in range(num_rows):
                for c in range(num_cols):
                    source_cell = block.cell(r, c)
                    target_cell = new_table.cell(r, c)
                    target_cell.text = source_cell.text
            
            if cursor.getnext() is not None:
                 cursor.getparent().insert(cursor.getparent().index(cursor) + 1, new_table._element)
            else:
                 cursor.addnext(new_table._element)
            cursor = new_table._element # Move the cursor


def replace_section_in_word_doc(doc_path, start_marker, end_marker, ai_json_data, status):
    try:
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

# Find or insert the status paragraph correctly, placing it AFTER the start marker.
        status_p_index = start_index + 1
        status_p = None

        # Check if a status paragraph ALREADY EXISTS immediately after the marker (SHOULDN'T BE HAPPENING ANYWAY BUT JUST IN CASE)
        if status_p_index < len(all_blocks) and isinstance(all_blocks[status_p_index], docx.text.paragraph.Paragraph) and "SECTION_" in all_blocks[status_p_index].text:
            # If it exists, just update its text.
            all_blocks[status_p_index].text = status
            status_p = all_blocks[status_p_index]
        else:
            # If it does NOT exist, insert a new one after the start marker.
            # We do this by targeting the NEXT element and inserting BEFORE it.
            if (start_index + 1) < len(all_blocks):
                status_p = all_blocks[start_index + 1].insert_paragraph_before(status)
            else:
                # Handle edge case where start_marker is the last item in the document.
                status_p = doc.add_paragraph(status)
        print(f"  > Status for '{start_marker}' set to: {status}")


        section_blocks = all_blocks[start_index : end_index]

        # Ensure we have data to work with
        if not ai_json_data:
            print(f"  > WARNING: No valid JSON data provided for section '{start_marker}'. Skipping content fill.")
            doc.save(doc_path)
            return

        for block in section_blocks:
            # Handle paragraphs with simple placeholder text
            if isinstance(block, docx.text.paragraph.Paragraph):
                for key, data_obj in ai_json_data.items():
                    if key in block.text and isinstance(data_obj, dict):
                        value = data_obj.get("value", "")
                        source = data_obj.get("source", "N/A")
                        block.text = block.text.replace(key, value)
                        add_comment(block, f"Source: {source}")

            # Handle tables with intelligent key matching
            elif isinstance(block, docx.table.Table):
                headers = [h.text.strip() for h in block.rows[0].cells]
                
                # Logic for simple 2-column key-value tables
                if len(headers) == 2:
                    for row in block.rows:
                        label_cell = row.cells[0]
                        value_cell = row.cells[1]
                        label_text = label_cell.text.strip()
                        if label_text in ai_json_data:
                            data = ai_json_data[label_text]
                            value = data.get("value", "")
                            source = data.get("source", "N/A")
                            value_cell.text = value
                            add_comment(value_cell.paragraphs[0], f"Source: {source}")
                
                # Logic for multi-column data tables
                else:
                    for row in block.rows[1:]: # Skip header row
                        row_context = row.cells[0].text.strip()
                        if not row_context or "..." in row_context: continue
                        clean_row_context = row_context.split('/')[0]

                        for i, cell in enumerate(row.cells):
                            if i == 0: continue
                            
                            header = headers[i]
                            
                            best_match_key = None
                            for key in ai_json_data:
                                if clean_row_context in key and header in key:
                                    best_match_key = key
                                    break
                            
                            if best_match_key:
                                data = ai_json_data[best_match_key]
                                value = data.get("value", "")
                                source = data.get("source", "N/A")
                                cell.text = value
                                if cell.paragraphs:
                                    add_comment(cell.paragraphs[0], f"Source: {source}")

        doc.save(doc_path)
        print(f"Successfully updated section '{start_marker}' in {os.path.basename(doc_path)}.")

    except Exception as e:
        print(f"FATAL ERROR during document generation for section '{start_marker}': {e}")