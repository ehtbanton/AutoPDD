
import sys
import pypandoc

def convert_docx_to_html_stdin():
    """
    Reads DOCX binary data from stdin, converts it to HTML using pypandoc,
    and prints the HTML to stdout.
    """
    try:
        # Read binary data from stdin
        docx_content = sys.stdin.buffer.read()

        # Convert the DOCX content to HTML
        # The 'docx' format tells pandoc to interpret the input as a DOCX file.
        html_output = pypandoc.convert_text(
            source=docx_content,
            to='html5',  # 'html5' is a good modern choice
            format='docx',
            extra_args=['--standalone'] # Embeds CSS for better styling
        )

        # Print the resulting HTML to stdout
        print(html_output)

    except (OSError, ImportError) as e:
        # Pandoc not found or pypandoc not installed
        print(f"Error: Pandoc/pypandoc is required. {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        # Handle other potential errors during conversion
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    convert_docx_to_html_stdin()
