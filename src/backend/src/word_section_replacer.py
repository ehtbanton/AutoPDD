import docx
import os
import re
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph
from docx.table import Table

def _iter_block_items(parent):
    """Iterate through paragraphs and tables in document order"""
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

def parse_markdown_table(md_table_text):
    """Parse markdown table text into structured data"""
    lines = [line.strip() for line in md_table_text.strip().split('\n') if line.strip()]
    
    if len(lines) < 2:
        return None
    
    # Find header and data rows (skip separator row with ---)
    header_row = None
    separator_idx = -1
    data_rows = []
    
    for i, line in enumerate(lines):
        if line.startswith('|') and line.endswith('|'):
            cells = [cell.strip() for cell in line.split('|')[1:-1]]
            if '---' in line:
                separator_idx = i
            elif separator_idx == -1:
                header_row = cells
            else:
                data_rows.append(cells)
    
    if not header_row:
        return None
    
    return {
        'headers': header_row,
        'rows': data_rows
    }

def markdown_to_word_table(doc, md_table_text):
    """Convert markdown table to Word table"""
    table_data = parse_markdown_table(md_table_text)
    if not table_data:
        return None
    
    # Create table with appropriate dimensions
    rows_needed = len(table_data['rows']) + 1  # +1 for header
    cols_needed = len(table_data['headers'])
    
    table = doc.add_table(rows=rows_needed, cols=cols_needed)
    
    # Add header row
    for i, header in enumerate(table_data['headers']):
        table.rows[0].cells[i].text = header
    
    # Add data rows
    for row_idx, row_data in enumerate(table_data['rows']):
        for col_idx, cell_data in enumerate(row_data):
            if col_idx < len(table.rows[row_idx + 1].cells):
                table.rows[row_idx + 1].cells[col_idx].text = cell_data
    
    return table

def replace_section_content(doc_path, start_marker, end_marker, new_content, status):
    """Replace a section with new content, preserving document structure"""
    
    try:
        doc = docx.Document(doc_path)
        all_blocks = list(_iter_block_items(doc))

        # Find section boundaries
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

        # Get the heading paragraph for reference
        heading_paragraph = all_blocks[start_index]
        
        # Find and remove all existing content between start and end markers
        # We need to preserve the heading but remove everything else
        elements_to_remove = []
        for i in range(start_index + 1, end_index):
            if i < len(all_blocks):
                elements_to_remove.append(all_blocks[i])

        # Remove all existing content in the section
        for element in elements_to_remove:
            if hasattr(element, '_element'):
                element._element.getparent().remove(element._element)

        # Now insert the status paragraph right after the heading
        heading_element = heading_paragraph._element
        status_para_element = OxmlElement("w:p")
        heading_element.addnext(status_para_element)
        status_para = Paragraph(status_para_element, doc)
        status_para.text = status
        
        # Use the status paragraph as our insertion point for the rest of the content
        insert_position = status_para_element

        # Parse and insert new content
        if new_content and new_content.strip():
            content_lines = new_content.split('\n')
            current_table_lines = []
            
            for line in content_lines:
                line_stripped = line.strip()
                
                if line_stripped.startswith('|') and line_stripped.endswith('|'):
                    # This is part of a table
                    current_table_lines.append(line)
                else:
                    # Not a table line - process any pending table first
                    if current_table_lines:
                        table_text = '\n'.join(current_table_lines)
                        table = markdown_to_word_table(doc, table_text)
                        if table:
                            # Insert table after our reference position
                            insert_position.addnext(table._element)
                            insert_position = table._element
                        current_table_lines = []
                    
                    # Add paragraph if it has content
                    if line_stripped and not line_stripped.startswith('#'):
                        new_para_element = OxmlElement("w:p")
                        insert_position.addnext(new_para_element)
                        new_para = Paragraph(new_para_element, doc)
                        new_para.text = line_stripped
                        insert_position = new_para_element
                    elif not line_stripped:
                        # Empty line - add empty paragraph for spacing
                        new_para_element = OxmlElement("w:p")
                        insert_position.addnext(new_para_element)
                        insert_position = new_para_element
            
            # Handle any remaining table at the end
            if current_table_lines:
                table_text = '\n'.join(current_table_lines)
                table = markdown_to_word_table(doc, table_text)
                if table:
                    insert_position.addnext(table._element)

        doc.save(doc_path)
        print(f"Successfully replaced section '{start_marker}' content in {os.path.basename(doc_path)}.")

    except Exception as e:
        print(f"FATAL ERROR during section replacement for '{start_marker}': {e}")
        import traceback
        traceback.print_exc()

def check_for_info_not_found(content):
    """Check if the section content contains any INFO_NOT_FOUND markers"""
    return "INFO_NOT_FOUND" in content

def check_section_status(document_text, section_heading):
    """Check the status of a section in the document text"""
    try:
        # Find the section in the document
        section_start = document_text.find(section_heading)
        if section_start == -1:
            return 'PENDING'
        
        # Look for the status line (should be a few lines after the heading)
        lines = document_text[section_start:].split('\n')[:10]  # Check first 10 lines after heading
        
        for line in lines:
            line_stripped = line.strip()
            if 'SECTION_COMPLETE' in line_stripped:
                return 'SECTION_COMPLETE'
            elif 'SECTION_ATTEMPTED' in line_stripped:
                return 'SECTION_ATTEMPTED'
        
        # If we found the section but no status, check if it has meaningful content
        # If there are more than 2 lines after the heading, it's probably been attempted
        if len([l for l in lines if l.strip()]) > 2:
            return 'SECTION_ATTEMPTED'
        
        return 'PENDING'
        
    except Exception:
        return 'PENDING'