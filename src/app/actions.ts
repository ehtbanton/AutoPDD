
'use server';

import { spawn } from 'child_process';
import path from 'path';

export async function runPythonBackend(): Promise<ReadableStream<Uint8Array>> {
    
    const stream = new ReadableStream({
        start(controller) {
            const pythonScriptPath = path.join(process.cwd(), 'src', 'backend', 'src', '___main.py');
            const pythonProcess = spawn('python3', [pythonScriptPath], {
                // The python script needs to know where it is to find other files
                cwd: path.join(process.cwd(), 'src', 'backend', 'src'),
            });

            pythonProcess.stdout.on('data', (data) => {
                controller.enqueue(new TextEncoder().encode(data.toString()));
            });

            pythonProcess.stderr.on('data', (data) => {
                // We send errors to the same stream to be displayed in the console
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
