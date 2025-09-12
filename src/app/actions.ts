'use server';

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { Buffer } from 'buffer';

const UPLOAD_DIR_TEMPLATE = path.join(process.cwd(), 'src', 'backend', 'pdd_template');
const UPLOAD_DIR_CONTEXT = path.join(process.cwd(), 'src', 'backend', 'provided_documents');
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

export async function removeAllContexts() {
    await ensureDir(UPLOAD_DIR_CONTEXT);
    await cleanDir(UPLOAD_DIR_CONTEXT);
}

export async function resetTemplate() {
    await ensureDir(UPLOAD_DIR_TEMPLATE);
    await ensureDir(UPLOAD_DIR_OUTPUT);
    await cleanDir(UPLOAD_DIR_OUTPUT);

    const templateName = await getTemplateName();
    if (templateName) {
        const templateFilePath = path.join(UPLOAD_DIR_TEMPLATE, templateName);
        const outputFilePath = path.join(UPLOAD_DIR_OUTPUT, OUTPUT_FILE_NAME);
        await fs.copyFile(templateFilePath, outputFilePath);
    }
}


export async function runPythonBackend(): Promise<ReadableStream<Uint8Array>> {
    await ensureDir(UPLOAD_DIR_OUTPUT);

    const stream = new ReadableStream({
        start(controller) {
            const pythonScriptPath = path.join(process.cwd(), 'src', 'backend', 'src', '___main.py');
            const pythonCwd = path.join(process.cwd(), 'src', 'backend', 'src');

            const attemptSpawn = (command: string) => {
                const pythonProcess = spawn(command, [pythonScriptPath], {
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
                });

                pythonProcess.on('error', (err: NodeJS.ErrnoException) => {
                    if (command === 'python' && err.code === 'ENOENT') {
                        const fallbackMessage = "INFO: 'python' command not found. Attempting to use 'python3'.\n";
                        console.log(fallbackMessage.trim());
                        controller.enqueue(new TextEncoder().encode(fallbackMessage));
                        attemptSpawn('python3');
                    } else {
                        const errorMessage = `ERROR: Failed to start Python process with command '${command}'. Please ensure Python is installed and in your system's PATH.`;
                        console.error(errorMessage, err);
                        controller.enqueue(new TextEncoder().encode(`${errorMessage}\n${err.toString()}`));
                        controller.error(err);
                    }
                });
            };

            attemptSpawn('python');
        }
    });

    return stream;
}

export async function getOutputFileAsBase64(): Promise<string | null> {
    const outputFilePath = path.join(UPLOAD_DIR_OUTPUT, OUTPUT_FILE_NAME);
    try {
        const fileBuffer = await fs.readFile(outputFilePath);
        return fileBuffer.toString('base64');
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error("Error reading output file for base64:", error);
        }
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

export async function updateParagraph(oldText: string, newText: string) {
    await ensureDir(UPLOAD_DIR_OUTPUT);
    const outputFilePath = path.join(UPLOAD_DIR_OUTPUT, OUTPUT_FILE_NAME);

    const pythonScriptPath = path.join(process.cwd(), 'src', 'backend', 'src', 'word_editor.py');
    const pythonCwd = path.join(process.cwd(), 'src', 'backend', 'src');

    const args = [pythonScriptPath, outputFilePath, oldText, newText];

    const tryCommand = (command: string) => {
        return new Promise<string>((resolve, reject) => {
            const process = spawn(command, args, { cwd: pythonCwd});

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0 && stdout.trim() === 'SUCCESS') {
                    resolve(stdout);
                } else {
                    reject(new Error(`Exit code: ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
                }
            });

            process.on('error', (err) => {
                reject(err);
            });
        });
    };

    try {
        return await tryCommand('python');
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If 'python' is not found, try 'python3'
            return await tryCommand('python3');
        }
        throw error;
    }
}