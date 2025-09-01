
'use server';

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { Buffer } from 'buffer';
import mammoth from "mammoth";


const UPLOAD_DIR_TEMPLATE = path.join(process.cwd(), 'src', 'backend', 'pdd_template');
const UPLOAD_DIR_CONTEXT = path.join(process.cwd(), 'src', 'backend', 'provided_documents', 'prime_road');
const UPLOAD_DIR_OUTPUT = path.join(process.cwd(), 'src', 'backend', 'auto_pdd_output');
const OUTPUT_FILE_NAME = 'AutoPDD_prime_road.docx';

async function ensureDir(dir: string) {
    try {
        await fs.access(dir);
    } catch (error) {
        await fs.mkdir(dir, { recursive: true });
    }
}

async function cleanDir(dir: string) {
    try {
        const files = await fs.readdir(dir);
        for (const file of files) {
            await fs.unlink(path.join(dir, file));
        }
    } catch (error) {
        // Directory might not exist, which is fine
    }
}

export async function uploadTemplateFile(fileName: string, fileContentBase64: string) {
    await ensureDir(UPLOAD_DIR_TEMPLATE);
    await cleanDir(UPLOAD_DIR_TEMPLATE);
    await ensureDir(UPLOAD_DIR_OUTPUT);
    await cleanDir(UPLOAD_DIR_OUTPUT);

    const templateFilePath = path.join(UPLOAD_DIR_TEMPLATE, fileName);
    const buffer = Buffer.from(fileContentBase64, 'base64');
    await fs.writeFile(templateFilePath, buffer);

    // Also create the initial output file by copying the template
    const outputFilePath = path.join(UPLOAD_DIR_OUTPUT, OUTPUT_FILE_NAME);
    await fs.copyFile(templateFilePath, outputFilePath);
}

export async function uploadContextFile(fileName: string, fileContentBase64: string) {
    await ensureDir(UPLOAD_DIR_CONTEXT);
    const filePath = path.join(UPLOAD_DIR_CONTEXT, fileName);
    await fs.writeFile(filePath, Buffer.from(fileContentBase64, 'base64'));
}


export async function runPythonBackend(): Promise<ReadableStream<Uint8Array>> {
    
    await ensureDir(UPLOAD_DIR_OUTPUT);
    let pythonProcess: import('child_process').ChildProcess | null = null;

    const stream = new ReadableStream({
        start(controller) {
            const pythonScriptPath = path.join(process.cwd(), 'src', 'backend', 'src', '___main.py');
            
            pythonProcess = spawn('python', [pythonScriptPath], {
                cwd: path.join(process.cwd(), 'src', 'backend', 'src'),
                shell: true 
            });

            pythonProcess.stdout.on('data', (data) => {
                controller.enqueue(new TextEncoder().encode(data.toString()));
            });

            pythonProcess.stderr.on('data', (data) => {
                controller.enqueue(new TextEncoder().encode(`ERROR: ${data.toString()}`));
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    controller.enqueue(new TextEncoder().encode(`\nPython script exited with code ${code}`));
                }
                controller.close();
            });

            pythonProcess.on('error', (err) => {
                controller.error(err);
            });
        },
        cancel() {
            if (pythonProcess) {
                pythonProcess.kill();
            }
        }
    });

    return stream;
}

export async function getOutputFileAsHtml(): Promise<string | null> {
    const outputFilePath = path.join(UPLOAD_DIR_OUTPUT, OUTPUT_FILE_NAME);
    try {
        await fs.access(outputFilePath); // Check if file exists
    } catch (error) {
        // Output file doesn't exist, let's see if we can create it from a template
        try {
            const templateName = await getTemplateName();
            if (templateName) {
                const templateFilePath = path.join(UPLOAD_DIR_TEMPLATE, templateName);
                await ensureDir(UPLOAD_DIR_OUTPUT);
                await fs.copyFile(templateFilePath, outputFilePath);
                console.log("Created output file from existing template.");
            } else {
                 // No template, so no output file can exist yet.
                return null;
            }
        } catch (creationError) {
             console.error("Error creating output file from template:", creationError);
             return null;
        }
    }

    // Now, try to read the file (it should exist at this point if a template was found)
    try {
        const docxBuffer = await fs.readFile(outputFilePath);
        
        // Use a Python script with pypandoc for better conversion
        const pythonScriptPath = path.join(process.cwd(), 'src', 'backend', 'src', 'convert_to_html.py');
        
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python', [pythonScriptPath]);

            let htmlOutput = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                htmlOutput += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(htmlOutput);
                } else {
                    console.error("Pandoc conversion error:", errorOutput);
                    reject(new Error(`Python script for HTML conversion exited with code ${code}: ${errorOutput}`));
                }
            });

            pythonProcess.on('error', (err) => {
                reject(err);
            });

            // Write the docx buffer to the Python script's stdin
            pythonProcess.stdin.write(docxBuffer);
            pythonProcess.stdin.end();
        });

    } catch (readError) {
        console.error("Error reading or converting output file:", readError);
        return null;
    }
}

export async function getExistingContextFiles(): Promise<{ name: string; content: string }[]> {
    try {
        await ensureDir(UPLOAD_DIR_CONTEXT);
        const files = await fs.readdir(UPLOAD_DIR_CONTEXT);
        const contextFiles = [];
        for (const file of files) {
            if (path.extname(file).toLowerCase() === '.pdf') {
                const filePath = path.join(UPLOAD_DIR_CONTEXT, file);
                const fileContent = await fs.readFile(filePath);
                contextFiles.push({
                    name: file,
                    content: fileContent.toString('base64'),
                });
            }
        }
        return contextFiles;
    } catch (error) {
        console.error("Error reading context files:", error);
        return [];
    }
}

export async function getTemplateName(): Promise<string | null> {
    try {
        await ensureDir(UPLOAD_DIR_TEMPLATE);
        const files = await fs.readdir(UPLOAD_DIR_TEMPLATE);
        const templateFile = files.find(file => path.extname(file).toLowerCase() === '.docx');
        return templateFile || null;
    } catch (error) {
        console.error("Error reading template directory:", error);
        return null;
    }
}

