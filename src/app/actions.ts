
'use server';

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { Buffer } from 'buffer';
import mammoth from "mammoth";


const UPLOAD_DIR_TEMPLATE = path.join(process.cwd(), 'src', 'pdd_template');
const UPLOAD_DIR_CONTEXT = path.join(process.cwd(), 'src', 'provided_documents', 'prime_road');
const UPLOAD_DIR_OUTPUT = path.join(process.cwd(), 'src', 'auto_pdd_output');
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

    const stream = new ReadableStream({
        start(controller) {
            const pythonScriptPath = path.join(process.cwd(), 'src', 'backend', 'src', '___main.py');
            
            const pythonProcess = spawn('python', [pythonScriptPath], {
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
        }
    });

    return stream;
}

export async function getOutputFileAsHtml(): Promise<string | null> {
    const outputFilePath = path.join(UPLOAD_DIR_OUTPUT, OUTPUT_FILE_NAME);
    try {
        await fs.access(outputFilePath); // Check if file exists
        const arrayBuffer = await fs.readFile(outputFilePath);
        const result = await mammoth.convertToHtml({ buffer: arrayBuffer });
        return result.value;
    } catch (error) {
        console.error("Error reading or converting output file:", error);
        return null; // Return null if file doesn't exist or there's an error
    }
}
