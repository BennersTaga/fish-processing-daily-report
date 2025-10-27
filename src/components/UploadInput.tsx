import { useMemo } from 'react';
import { Button } from './Button';

export type UploadInputProps = {
  label: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  capture?: string;
  disabled?: boolean;
};

export function UploadInput({
  label,
  files,
  onFilesChange,
  accept = 'image/*',
  capture = 'environment',
  disabled = false,
}: UploadInputProps) {
  const names = useMemo(() => files.map((file) => file.name).join(', '), [files]);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = accept;
          if (capture) {
            input.setAttribute('capture', capture);
          }
          input.onchange = () => {
            if (!input.files) return;
            onFilesChange(Array.from(input.files));
          };
          input.click();
        }}
      >
        {label}
      </Button>
      <p className="text-xs text-slate-500">{names || '選択されたファイルはありません。'}</p>
    </div>
  );
}
