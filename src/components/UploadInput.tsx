import { useEffect, useMemo } from 'react';
import { Button } from './Button';

export type UploadInputProps = {
  label: string;
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  capture?: string;
  disabled?: boolean;
  maxFiles?: number; // default 5
};

export function UploadInput({
  label,
  files,
  onFilesChange,
  accept = 'image/*',
  capture = 'environment',
  disabled = false,
  maxFiles = 5,
}: UploadInputProps) {
  const previews = useMemo(
    () => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [files]
  );

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  const pick = () => {
    if (disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;               // allow picking multiple at once
    input.accept = accept;
    if (capture) input.setAttribute('capture', capture);

    input.onchange = () => {
      if (!input.files) return;

      const selected = Array.from(input.files);
      // Append to current files, then cap by maxFiles and de-duplicate
      const merged = [...files, ...selected];

      // de-dup by name+size+lastModified to keep order of first occurrence
      const seen = new Set<string>();
      const unique: File[] = [];
      for (const f of merged) {
        const k = `${f.name}__${f.size}__${(f as any).lastModified ?? 0}`;
        if (!seen.has(k)) {
          seen.add(k);
          unique.push(f);
        }
      }

      const limited = unique.slice(0, maxFiles);
      onFilesChange(limited);
    };

    input.click();
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" disabled={disabled} onClick={pick}>
        {label}
      </Button>

      {disabled ? (
        <p className="text-xs text-slate-400">※「あり」を選択すると写真を選べます</p>
      ) : (
        <p className="text-xs text-slate-500">
          {files.length ? `選択中: ${files.length}枚（最大${maxFiles}枚）` : '選択されたファイルはありません。'}
        </p>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
          {previews.map((p) => (
            <div key={p.url} className="overflow-hidden rounded border border-slate-200">
              <img src={p.url} alt={p.name} className="h-24 w-full object-cover" />
              <div className="truncate px-2 py-1 text-[10px] text-slate-600">{p.name}</div>
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-slate-600">
          {files.map((f) => (
            <li key={f.name}>{f.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
