'use server';

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { Buffer } from 'buffer';
import mammoth from "mammoth";


const UPLOAD_DIR_TEMPLATE = path.join(process.cwd(), 'src', 'backend', 'pdd_template');
const UPLOAD_DIR_CONTEXT = path.join(process.cwd(), 'src', 'backend', 'provided_documents', 'prime_road');
const UPLOAD_DIR_OUTPUT = path.join(process.cwd(), 'src', 'backend', 'auto_pdd_output');
const OUTPUT_FILE_NAME = 'AutoPDD_prime_road.docx';

let pythonProcess: ChildProcess | null = null;

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
            const pythonCwd = path.join(process.cwd(), 'src', 'backend', 'src');

            const attemptSpawn = (command: string) => {
                pythonProcess = spawn(command, [pythonScriptPath], {
                    cwd: pythonCwd,
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
                    pythonProcess = null;
                });

                // The 'error' event is emitted when the process can't be spawned.
                pythonProcess.on('error', (err: NodeJS.ErrnoException) => {
                    // ENOENT means the command was not found.
                    if (command === 'python' && err.code === 'ENOENT') {
                        const fallbackMessage = "INFO: 'python' command not found. Attempting to use 'python3'.\n";
                        console.log(fallbackMessage.trim());
                        controller.enqueue(new TextEncoder().encode(fallbackMessage));
                        // If 'python' fails, try 'python3'.
                        attemptSpawn('python3');
                    } else {
                        // If 'python3' also fails or another error occurs, report it.
                        const errorMessage = `ERROR: Failed to start Python process with command '${command}'. Please ensure Python is installed and in your system's PATH.`;
                        console.error(errorMessage, err);
                        controller.enqueue(new TextEncoder().encode(`${errorMessage}\n${err.toString()}`));
                        controller.error(err);
                    }
                });
            };

            // Start by attempting to use the 'python' command.
            attemptSpawn('python');
        }
    });

    return stream;
}

export async function stopPythonBackend() {
    if (pythonProcess) {
        pythonProcess.kill();
        pythonProcess = null;
    }
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