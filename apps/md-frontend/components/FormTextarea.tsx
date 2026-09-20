"use client";

import { useEffect, useRef } from "react";

interface FormTextareaProps {
  name: string;
  label: string;
  sublabel?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function FormTextarea({
  name,
  label,
  sublabel,
  value,
  onChange,
  required = false,
  placeholder = "",
  disabled = false,
  maxLength = 5000,
}: FormTextareaProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.style.height = "auto";
      textArea.style.height = `${textArea.scrollHeight}px`;
    }
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-[#80848E] uppercase tracking-wide">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {sublabel && (
        <p className="text-[#80848E] text-[11px] mb-2 italic leading-tight">{sublabel}</p>
      )}
      <textarea
        required={required}
        name={name}
        value={value}
        ref={textAreaRef}
        disabled={disabled}
        onChange={handleInput}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={2}
        className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-3 py-2 outline-none focus:border-[#5865F2] transition-all duration-200 overflow-hidden min-h-20"
        style={{ resize: "none" }}
      />
      <p className="text-[10px] text-right text-[#4E5058]">
        {value?.length || 0} / {maxLength}
      </p>
    </div>
  );
}
