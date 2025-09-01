
"use client";

import { useRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

interface FileUploadButtonProps extends ButtonProps {
  onFileSelect: (file: File | FileList) => void;
  multiple?: boolean;
  accept?: string;
}

export function FileUploadButton({
  onFileSelect,
  multiple = false,
  accept,
  children,
  ...props
}: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      if (multiple) {
        onFileSelect(files);
      } else if (files.length > 0) {
        onFileSelect(files[0]);
      }
    }
    // Reset the input value to allow re-uploading the same file
    event.target.value = '';
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <Button onClick={handleButtonClick} {...props}>
        {children}
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple={multiple}
        accept={accept}
      />
    </>
  );
}

    