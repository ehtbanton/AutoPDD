# AutoPDD

Project Overview
AutoPDD, also referred to as "Context Editor," is a web-based document filling service. It enables users to edit a main template document (in Word format) while referencing context from other documents (in PDF format) within a two-column interface.

Tech Stack
Frontend: The user interface is built with Next.js, React, and TypeScript.

Backend: The server-side logic is written in Python.

Setup Instructions
Prerequisites
Before you begin, ensure you have the following installed on your system:

Node.js and npm: Required for running the frontend.

Python 3 and pip: Required for running the backend.

Pandoc: A universal document converter required by the pypandoc Python library. You must install this separately by following the instructions on the official Pandoc website.

1. Frontend Setup
Navigate to Project Root: Open your terminal or command prompt and navigate to the root directory of the AutoPDD project.

Install Dependencies: Run the following command to install all the necessary frontend packages listed in the package.json file, such as React, Next.js, and others:

Bash

npm install
2. Backend Setup
Navigate to Backend Directory: In your terminal, change to the backend directory:

Bash

cd src/backend
Create and Activate a Virtual Environment (Recommended): It's best practice to use a virtual environment to manage Python dependencies.

Create the environment:

Bash

python -m venv venv
Activate the environment:

Windows: .\venv\Scripts\activate

macOS/Linux: source venv/bin/activate

Install Python Packages: Install the required Python libraries using the requirements.txt file. This will install packages such as google-generativeai, python-dotenv, pdfplumber, python-docx, and pypandoc.

Bash

pip install -r requirements.txt
3. Running the Application
Return to Project Root: Navigate back to the main project directory from the src/backend folder.

Bash

cd ../..
Start the Development Servers: Run the following command to start both the frontend and backend servers concurrently:

Bash

npm run dev
This command executes two scripts simultaneously: npm:dev:next (which starts the Next.js frontend) and npm:dev:python (which starts the Python backend).

Access the Application: Once the servers are running, you can access the AutoPDD application in your web browser at the following address: http://localhost:9002.
