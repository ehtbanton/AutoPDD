import docx
import os
import shutil
import json
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.oxml import OxmlElement # <--- ADD THIS IMPORT
from docx.text.paragraph import Paragraph # <--- ADD THIS IMPORT

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

def add_comment(paragraph, text, author="Source Reference"):
    try:
        if paragraph.text.strip() and "INFO_NOT_FOUND" not in text and "N/A" not in text:
            paragraph.add_comment(text, author=author)
    except Exception:
        pass

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

        # ---- THIS IS THE NEW, CORRECTED CODE ----
        status_p_index = start_index + 1
        # Check if the paragraph immediately after the heading is already a status line
        if status_p_index < len(all_blocks) and \
           isinstance(all_blocks[status_p_index], docx.text.paragraph.Paragraph) and \
           "SECTION_" in all_blocks[status_p_index].text:
            # If it is, just update its text
            all_blocks[status_p_index].text = status
        else:
            # If not, we need to insert a new status paragraph AFTER the heading
            heading_paragraph = all_blocks[start_index]
            p_element = heading_paragraph._p  # The underlying XML element of the heading
            # Add a new paragraph element (<w:p>) immediately after the heading's element
            p_element.addnext(OxmlElement("w:p"))
            # Create a new Paragraph object from this new element and set its text
            new_para = Paragraph(p_element.getnext(), heading_paragraph._parent)
            new_para.text = status

        if not ai_json_data:
            doc.save(doc_path)
            return

        section_blocks = all_blocks[start_index:end_index]

        for block in section_blocks:
            if isinstance(block, docx.text.paragraph.Paragraph):
                for key, data_obj in ai_json_data.items():
                    if key in block.text and isinstance(data_obj, dict):
                        value = data_obj.get("value", "")
                        source = data_obj.get("source", "N/A")
                        block.text = block.text.replace(key, str(value))
                        add_comment(block.paragraphs[0] if hasattr(block, 'paragraphs') else block, f"Source: {source}")


            elif isinstance(block, docx.table.Table):
                headers = [h.text.strip() for h in block.rows[0].cells]
                
                if len(headers) == 2:
                    for row in block.rows:
                        label_cell = row.cells[0]
                        value_cell = row.cells[1]
                        label_text = label_cell.text.strip()
                        if label_text in ai_json_data:
                            data = ai_json_data[label_text]
                            value = data.get("value", "")
                            source = data.get("source", "N/A")
                            value_cell.text = str(value)
                            add_comment(value_cell.paragraphs[0], f"Source: {source}")
                
                else:
                    for row in block.rows[1:]:
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
                                cell.text = str(value)
                                if cell.paragraphs:
                                    add_comment(cell.paragraphs[0], f"Source: {source}")

        doc.save(doc_path)
        print(f"Successfully updated section '{start_marker}' in {os.path.basename(doc_path)}.")

    except Exception as e:
        print(f"FATAL ERROR during document generation for section '{start_marker}': {e}")