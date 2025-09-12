#!/usr/bin/env python3

import json
import sys
import os
from text_processing import retrieve_contents_list, get_pdd_targets
from word_editor import load_word_doc_to_string
from word_section_replacer import check_section_status

def extract_sections_from_template():
    """Extract PDD sections from the template and determine their current status"""
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.abspath(os.path.join(script_dir, '..'))
    
    template_doc_folder = os.path.join(backend_dir, "pdd_template")
    output_doc_folder = os.path.join(backend_dir, "auto_pdd_output")
    
    try:
        # Load template text to extract section structure
        template_text = load_word_doc_to_string(template_doc_folder)
        if not template_text:
            return []
        
        # Get sections from table of contents
        contents_list = retrieve_contents_list(template_text)
        pdd_targets = get_pdd_targets(contents_list)
        
        # Load output document to check section status
        output_text = None
        try:
            output_text = load_word_doc_to_string(output_doc_folder)
        except:
            # Output document may not exist yet
            pass
        
        sections = []
        for section_heading, subheading, subheading_idx, page_num in pdd_targets:
            # Determine section status by checking output document
            status = 'PENDING'  # Default status
            
            if output_text:
                status = check_section_status(output_text, subheading)
            
            section_data = {
                'sectionHeading': section_heading,
                'subheading': subheading, 
                'subheadingIdx': subheading_idx,
                'pageNum': page_num,
                'status': status
            }
            sections.append(section_data)
        
        return sections
        
    except Exception as e:
        print(f"Error extracting sections: {str(e)}", file=sys.stderr)
        return []

def main():
    """Main function to extract sections and output as JSON"""
    try:
        sections = extract_sections_from_template()
        print(json.dumps(sections, indent=2))
    except Exception as e:
        print(f"Error in main: {str(e)}", file=sys.stderr)
        print("[]")  # Return empty array on error

if __name__ == "__main__":
    main()