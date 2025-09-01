'use client';

import type { FC } from 'react';
import React, { useState, useEffect, useCallback } from 'react';
import { TemplateEditor } from '@/components/template-editor';
import { ContextViewer } from '@/components/context-viewer';
import { ControlsPanel } from '@/components/controls-panel';
import { useToast } from "@/hooks/use-toast";

export type ContextFile = {
  name: string;
  content: string;
};

const initialTemplateContent = `
<h1 class="font-headline text-2xl font-bold mb-4">Project Proposal</h1>
<p class="mb-2"><strong>Project Name:</strong> New Mobile Application</p>
<p class="mb-2"><strong>Client:</strong> Global Tech Inc.</p>
<p class="mb-4"><strong>Date:</strong> {{current_date}}</p>

<h2 class="font-headline text-xl font-bold mb-2">1. Introduction</h2>
<p class="mb-4">This document outlines the proposal for a new mobile application designed to enhance customer engagement and streamline service delivery for Global Tech Inc. The primary contact for this project will be {{contact_person}}.</p>

<h2 class="font-headline text-xl font-bold mb-2">2. Project Scope</h2>
<p class="mb-4">The project will involve the development of native iOS and Android applications. Key features will include user authentication, a product catalog, and an integrated support chat. The project is expected to be completed by {{end_date}}.</p>

<h2 class="font-headline text-xl font-bold mb-2">3. Budget</h2>
<p class="mb-4">The estimated total cost for the project is {{project_cost}}. A detailed breakdown is available in the attached financial statement.</p>
`;

const initialContextFiles: ContextFile[] = [
  {
    name: 'project_data.txt',
    content: `contact_person: Jane Doe\nend_date: Q4 2024\nproject_cost: $250,000`,
  },
  {
    name: 'client_details.txt',
    content: `client_name: Global Tech Inc.\naddress: 123 Innovation Drive, Tech City\ncontact_email: contact@globaltech.com`,
  },
];

const initialLogs = [
  'Welcome to Context Editor!',
  'Upload a new template or context files using the controls.',
  'Select a context file from the dropdown to view its contents.'
];

const Page: FC = () => {
  const [templateContent, setTemplateContent] = useState<string>(initialTemplateContent);
  const [contextFiles, setContextFiles] = useState<ContextFile[]>(initialContextFiles);
  const [selectedContextFile, setSelectedContextFile] = useState<string>(initialContextFiles[0]?.name || '');
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const log = useCallback((message: string) => {
    console.log(message);
    setLogs((prevLogs) => [...prevLogs, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);
  
  useEffect(() => {
    setLogs(initialLogs.map(l => `[${new Date().toLocaleTimeString()}] ${l}`));
  }, []);

  const handleTemplateUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setTemplateContent(content);
      log(`Template "${file.name}" uploaded successfully.`);
      toast({
          title: "Upload Successful",
          description: `Template "${file.name}" has been loaded.`,
          variant: "default",
          className: "bg-accent text-accent-foreground",
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
    reader.readAsText(file);
  };

  const handleContextUpload = (files: FileList) => {
    let uploadedCount = 0;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setContextFiles((prev) => {
            const existingFileIndex = prev.findIndex(f => f.name === file.name);
            if (existingFileIndex !== -1) {
                const updatedFiles = [...prev];
                updatedFiles[existingFileIndex] = { name: file.name, content };
                return updatedFiles;
            }
            return [...prev, { name: file.name, content }];
        });
        
        if(!selectedContextFile) {
            setSelectedContextFile(file.name);
        }
        uploadedCount++;
        if (uploadedCount === files.length) {
            log(`${files.length} context file(s) uploaded successfully.`);
            toast({
                title: "Upload Successful",
                description: `${files.length} context file(s) have been loaded.`,
                variant: "default",
                className: "bg-accent text-accent-foreground",
            });
        }
      };
      reader.onerror = () => {
        log(`Error reading file: ${file.name}`);
        toast({
            title: "Upload Failed",
            description: `There was an error reading "${file.name}".`,
            variant: "destructive",
        });
      }
      reader.readAsText(file);
    });
  };
  
  const handleContextSelect = (fileName: string) => {
    setSelectedContextFile(fileName);
    log(`Selected context file: ${fileName}`);
  }

  const currentContext = contextFiles.find(f => f.name === selectedContextFile);

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <header className="mb-8 text-center lg:text-left">
        <h1 className="font-headline text-5xl font-bold text-primary">
          Context Editor
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          A simple interface to edit templates alongside their context.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-8">
        <div className="lg:col-span-1 flex flex-col gap-8">
          <ControlsPanel
            contextFiles={contextFiles}
            selectedContextFile={selectedContextFile}
            logs={logs}
            onTemplateUpload={handleTemplateUpload}
            onContextUpload={handleContextUpload}
            onContextSelect={handleContextSelect}
          />
          <ContextViewer contextFile={currentContext} />
        </div>
        <div className="lg:col-span-2 mt-8 lg:mt-0">
          <TemplateEditor
            content={templateContent}
            onContentChange={setTemplateContent}
          />
        </div>
      </div>
    </main>
  );
};

export default Page;
