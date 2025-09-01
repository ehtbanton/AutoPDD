
import os
import time
import google.generativeai as genai
from dotenv import load_dotenv
from typing import List, Optional
import sys

# Note: The 'UploadedFile' type can be imported for more specific type hinting
# from google.generativeai.types import UploadedFile

def setup_gemini():
    """
    Configures the Gemini API with an API key from environment variables
    and initializes the generative model.
    """
    try:
        # Load from .env file in the root of the project
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.abspath(os.path.join(script_dir, '..', '..', '..'))
        dotenv_path = os.path.join(project_root, '.env')
        load_dotenv(dotenv_path=dotenv_path)

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            # Check for GOOGLE_API_KEY as a fallback
            api_key = os.getenv("GOOGLE_API_KEY")

        if not api_key:
            raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY not found in environment variables.")

        genai.configure(api_key=api_key)
        
        # Note: Corrected the model name to a valid one, 'gemini-1.5-flash'.
        agent = genai.GenerativeModel('gemini-1.5-flash')
        return agent
    except Exception as e:
        print(f"An error occurred during setup: {e}")
        sys.stdout.flush()
        return None

def upload_files_to_gemini(file_paths: List[str], max_upload_retries: int = 3) -> Optional[List]:
    """
    Uploads a list of files to the Gemini API and returns their references.

    This function handles the file upload process, including retries for failures.
    The returned list can be cached and reused for multiple prompts.

    Args:
        file_paths: A list of local file paths to upload.
        max_upload_retries: The maximum number of times to retry uploading a file.

    Returns:
        A list of 'UploadedFile' objects if successful, otherwise None.
    """
    print(f"Uploading {len(file_paths)} file(s) to create a cache...")
    sys.stdout.flush()
    uploaded_files = []
    
    for file_path in file_paths:
        if not os.path.exists(file_path):
            print(f"  File not found: '{file_path}'. Skipping upload.")
            sys.stdout.flush()
            continue

        success = False
        for attempt in range(max_upload_retries):
            try:
                # The API performs a check for the file's MIME type.
                uploaded_file = genai.upload_file(path=file_path)
                uploaded_files.append(uploaded_file)
                print(f"  Successfully uploaded '{file_path}'")
                sys.stdout.flush()
                success = True
                break
            except Exception as e:
                print(f"  Upload attempt {attempt + 1} failed for {file_path}: {e}")
                sys.stdout.flush()
                if attempt < max_upload_retries - 1:
                    time.sleep(2)  # Wait before retry
        
        if not success:
            print(f"FAILED to upload '{file_path}' after {max_upload_retries} attempts.")
            sys.stdout.flush()
            # It's better to return None and let the caller handle it.
            return None
            
    print("File cache created successfully.")
    sys.stdout.flush()
    return uploaded_files

def ask_gemini(agent: genai.GenerativeModel, prompt: str, system_prompt: Optional[str] = None, cached_files: Optional[List] = None) -> str:
    """
    Sends a prompt and an optional list of pre-uploaded file references to Gemini.

    Args:
        agent: The initialized Gemini model agent.
        prompt: The user's text prompt.
        system_prompt: Optional system-level instructions for the model.

        cached_files: A list of 'UploadedFile' objects returned by upload_files_to_gemini(). 23
    Returns:
        The generated text response from the model.
    """
    if not agent:
        return "Error: Gemini agent is not initialized."

    # Construct the full prompt with system instructions if provided
    complete_prompt = f"SYSTEM INSTRUCTIONS:\n{system_prompt}\n\nUSER QUERY:\n{prompt}" if system_prompt else prompt
    
    # The content list starts with the text prompt
    content = [complete_prompt]
    
    # If a file cache is provided, add the file references to the content
    if cached_files:
        content.extend(cached_files)
        #print(f"Asking Gemini with prompt and {len(cached_files)} cached file(s)...")
    else:
        #print("Asking Gemini with prompt (no files)...")
        pass

    try:
        response = agent.generate_content(content)
        return response.text
    except Exception as e:
        return f"An error occurred while asking Gemini: {e}"
