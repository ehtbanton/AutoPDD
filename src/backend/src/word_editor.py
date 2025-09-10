import docx
import os
import shutil
import json
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.oxml import OxmlElement # <--- ADD THIS IMPORT
from docx.text.paragraph import Paragraph # <--- ADD THIS IMPORT
import sys

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