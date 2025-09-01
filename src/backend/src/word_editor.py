
import docx
import os
import shutil
import pypandoc
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
    try:
        if os.path.isdir(folder_path):
            for f in os.listdir(folder_path):
                if f.lower().endswith('.docx') and not f.startswith('~$'):
                    filename = os.path.join(folder_path, f)
                    break
        elif os.path.isfile(folder_path) and folder_path.lower().endswith('.docx'):
            filename = folder_path
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
    template_folder, output_folder = "../../pdd_template", "../../auto_pdd_output"
    template_path = next((os.path.join(template_folder, f) for f in os.listdir(template_folder) if f.lower().endswith('.docx') and not f.startswith('~$')), None)
    
    if not template_path:
        # Before raising an error, let's create the directories if they don't exist.
        if not os.path.exists(template_folder):
            os.makedirs(template_folder)
            print(f"Created template directory at: {template_folder}")
            print("Please add your template .docx file to this folder.")
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
            
            cursor.addnext(new_table._element)
            cursor = new_table._element # Move the cursor


# --- FINAL MAIN FUNCTION ---
def replace_section_in_word_doc(doc_path, start_marker, end_marker, new_content_str):
    """
    Uses Pandoc to create a temporary, perfectly-formatted doc, then performs a
    high-level copy of its contents into the main document.
    """
    temp_file_handle, temp_docx_path = tempfile.mkstemp(suffix=".docx")
    os.close(temp_file_handle)

    try:
        # STEP 1: Parse the incoming AI response
        lines = new_content_str.strip().split('\n')
        status_line = lines[0] if lines else "SECTION_ATTEMPTED"
        markdown_content = "\n".join(lines[2:])

        # STEP 2: Use Pandoc to create a physical temporary DOCX file
        pypandoc.convert_text(markdown_content, 'docx', format='md', outputfile=temp_docx_path)
        
        # STEP 3: Open both the main doc and the perfect temporary doc
        temp_doc = docx.Document(temp_docx_path)
        main_doc = docx.Document(doc_path)
        
        blocks = list(_iter_block_items(main_doc))

        start_index, end_index = -1, -1
        for i, block in enumerate(blocks):
            if isinstance(block, docx.text.paragraph.Paragraph) and block.text.strip() == start_marker:
                start_index = i
            elif start_index != -1 and isinstance(block, docx.text.paragraph.Paragraph) and block.text.strip() == end_marker:
                end_index = i
                break
        
        if start_index == -1:
            print(f"Warning: Start marker '{start_marker}' not found. Cannot update.")
            sys.stdout.flush()
            return

        if end_index == -1:
            end_index = len(blocks)
        
        # STEP 4: Delete all old content to create a clean slate
        if end_index > start_index + 1:
            for i in range(end_index - 1, start_index, -1):
                _delete_element(blocks[i])

        # STEP 5: Perform the new, robust, high-level copy
        anchor = blocks[start_index]._element
        
        status_p = main_doc.add_paragraph(status_line)
        anchor.addnext(status_p._element)
        anchor_for_copy = status_p._element

        _insert_content_from_document(temp_doc, main_doc, anchor_for_copy)

        main_doc.save(doc_path)
        print(f"Successfully updated section '{start_marker}' in {os.path.basename(doc_path)}.")
        sys.stdout.flush()

    except ImportError:
        # Error handling remains the same
        print("\nFATAL ERROR: pypandoc is not installed...")
        sys.stdout.flush()
        exit()
    except OSError as e:
        print(f"\nFATAL ERROR: Pandoc application not found or failed. Error: {e}")
        sys.stdout.flush()
        exit()
    except Exception as e:
        print(f"FATAL ERROR during document generation for '{start_marker}': {e}")
        sys.stdout.flush()

    finally:
        # STEP 6: Always clean up the temporary file
        if os.path.exists(temp_docx_path):
            os.remove(temp_docx_path)
