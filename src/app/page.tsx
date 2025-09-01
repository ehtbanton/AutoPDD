
'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TemplateEditor } from '@/components/template-editor';
import { ContextViewer } from '@/components/context-viewer';
import { ControlsPanel } from '@/components/controls-panel';
import { useToast } from "@/hooks/use-toast";
import mammoth from "mammoth";
import { runPythonBackend } from '@/app/actions';

export type ContextFile = {
  name: string;
  content: ArrayBuffer;
};

const initialTemplateContent = ``;

const initialContextFiles: ContextFile[] = [];

const initialLogs = [
  'Welcome to AutoPDD!',
  'Upload a Word document as a template and PDF files for context.',
];

const Page: FC = () => {
  const [templateContent, setTemplateContent] = useState<string>(initialTemplateContent);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>(initialContextFiles);
  const [selectedContextFile, setSelectedContextFile] = useState<ContextFile | undefined>(undefined);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef<boolean>(false);
  const [templatePath, setTemplatePath] = useState<string>('');


  const log = useCallback((message: string) => {
    const timedMessage = `[${new Date().toLocaleTimeString()}] ${message}`;
    setLogs((prevLogs) => [...prevLogs, timedMessage]);
    console.log(timedMessage);
  }, []);
  
  useEffect(() => {
    setLogs(initialLogs.map(l => `[${new Date().toLocaleTimeString()}] ${l}`));
  }, []);

  const handleTemplateUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
        .then(result => {
          setTemplateContent(result.value);
          log(`Template "${file.name}" uploaded successfully.`);
          
          setTemplatePath(file.name);

          toast({
              title: "Upload Successful",
              description: `Template "${file.name}" has been loaded.`,
              variant: "default",
              className: "bg-accent text-accent-foreground",
          });
        })
        .catch(error => {
            console.error(error);
            log(`Error processing Word document: ${file.name}`);
            toast({
                title: "Processing Failed",
                description: "Could not process the Word document.",
                variant: "destructive",
            });
        });
    };
    reader.onerror = () => {
        log(`Error reading file: ${file.name}`);
        toast({
            title: "Upload Failed",
            description: `There was an error reading "${file.name}".`,
            variant: "destructive",
        });
    }
    reader.readAsArrayBuffer(file);
  };

  const handleContextUpload = (files: FileList) => {
    log(`Attempting to upload ${files.length} context file(s)...`);
    const newFiles: ContextFile[] = [];
    let processedCount = 0;
  
    const fileArray = Array.from(files);
  
    if (fileArray.length === 0) {
      log("No files selected for context upload.");
      return;
    }
  
    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as ArrayBuffer;
        // IMPORTANT: Create a copy of the ArrayBuffer
        const contentCopy = content.slice(0);
        const newFile = { name: file.name, content: contentCopy };
        newFiles.push(newFile);
        
        log(`Successfully processed "${file.name}".`);
        
        processedCount++;
        if (processedCount === fileArray.length) {
            setContextFiles(prevFiles => {
                const updatedFiles = [...prevFiles];
                newFiles.forEach(newFile => {
                    const existingIndex = updatedFiles.findIndex(f => f.name === newFile.name);
                    if (existingIndex !== -1) {
                        log(`Replacing existing file: "${newFile.name}"`);
                        updatedFiles[existingIndex] = newFile;
                    } else {
                        updatedFiles.push(newFile);
                    }
                });
                return updatedFiles;
            });

          if (!selectedContextFile || contextFiles.length === 0) {
            setSelectedContextFile(newFiles[0]);
          }
          log(`${newFiles.length} context file(s) uploaded successfully.`);
          toast({
              title: "Upload Successful",
              description: `${newFiles.length} context file(s) have been loaded.`,
              variant: "default",
              className: "bg-accent text-accent-foreground",
          });
        }
      };
      reader.onerror = (error) => {
        log(`Error reading file "${file.name}": ${error}`);
        toast({
            title: "Upload Failed",
            description: `There was an error reading "${file.name}".`,
            variant: "destructive",
        });
        processedCount++;
        if (processedCount === fileArray.length && newFiles.length > 0) {
            setContextFiles(prevFiles => {
                const updatedFiles = [...prevFiles];
                newFiles.forEach(newFile => {
                    const existingIndex = updatedFiles.findIndex(f => f.name === newFile.name);
                    if (existingIndex !== -1) {
                        log(`Replacing existing file: "${newFile.name}"`);
                        updatedFiles[existingIndex] = newFile;
                    } else {
                        updatedFiles.push(newFile);
                    }
                });
                return updatedFiles;
            });
            if (!selectedContextFile || contextFiles.length === 0) {
              setSelectedContextFile(newFiles[0]);
            }
          }
      }
      reader.readAsArrayBuffer(file);
    });
  };
  
  const handleContextSelect = (fileName: string) => {
    const file = contextFiles.find(f => f.name === fileName);
    setSelectedContextFile(file);
    if(file) {
        log(`Context file "${fileName}" selected.`);
    }
  }

  const handleFillDocument = async () => {
    if (!templatePath) {
        log("Error: Please upload a template document first.");
        toast({
            title: "Template Missing",
            description: "You must upload a template .docx file before filling the document.",
            variant: "destructive",
        });
        return;
    }

    log("Starting document processing with Python backend...");
    setIsProcessing(true);
    processingRef.current = true;

    try {
        const stream = await runPythonBackend();
        const reader = stream.getReader();
        const decoder = new TextDecoder();

        while (processingRef.current) {
            const { value, done } = await reader.read();
            if (done) {
                log("Python script finished.");
                break;
            }
            const decodedChunk = decoder.decode(value, { stream: true });
            // The script outputs can be messy, let's clean it up a bit.
            const lines = decodedChunk.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                log(line);
            }
        }
        if(!processingRef.current) {
            log("Processing stopped by user.");
        }

    } catch (error) {
        console.error("Error running python backend: ", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error: ${errorMessage}`);
        toast({
            title: "Backend Error",
            description: "The Python script failed to run. Check the console for details.",
            variant: "destructive",
        });
    } finally {
        setIsProcessing(false);
        processingRef.current = false;
    }
};

  const handleStop = () => {
    log("Stop button pressed. Attempting to stop processing...");
    processingRef.current = false; // This will signal the loop to stop
    // Note: The python process itself is not killed here, just the client-side listening.
    // For true process killing, a more complex setup would be needed.
  };

  return (
    <main className="h-full flex flex-col p-4 gap-4">
      <header className="text-center lg:text-left">
        <h1 className="font-headline text-5xl font-bold text-primary">
          AutoPDD
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Fill in your PDD automatically using a bundle of provided PDF files
        </p>
      </header>

      <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-1 flex flex-col gap-2 min-h-0">
          <ControlsPanel
            logs={logs}
            onTemplateUpload={handleTemplateUpload}
            onContextUpload={handleContextUpload}
            contextFiles={contextFiles}
            selectedContextFile={selectedContextFile}
            onContextSelect={handleContextSelect}
            onFillDocument={handleFillDocument}
            isProcessing={isProcessing}
            onStop={handleStop}
          />
          <ContextViewer contextFile={selectedContextFile} />
        </div>
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <TemplateEditor
            content={templateContent}
          />
        </div>
      </div>
    </main>
  );
};

export default Page;
