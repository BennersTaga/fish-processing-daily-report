import { FormEvent, useEffect, useMemo, useState } from 'react';
import { recordToSheet, uploadB64 } from '../lib/api';
import { enqueue } from '../lib/offlineQueue';
import { InventoryReport, Master, SubmissionState } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { FormField } from './FormField';
import { OptionSelect } from './OptionSelect';
import { UploadInput } from './UploadInput';
import { FormActionBar } from './FormActionBar';
import { Alert } from './Alert';
import { formatDateInput, formatYmd } from '../lib/date';

const createDefaultReport = (): InventoryReport => ({
  ticketId: '',
  purchaseDate: formatDateInput(new Date()),
  date: formatDateInput(new Date()),
  person: '',
  factory: '',
  species: '',
  origin: '',
  state: '',
  kg: '',
  visual_parasite: '',
  visual_foreign: '',
});

type Props = {
  master: Master;
  onSubmitSuccess?: (payload: InventoryReport) => void;
  initialValues?: Partial<InventoryReport> | null;
};

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uploadFiles(ticketId: string, label: string, files: File[]) {
  for (const file of files) {
    try {
      await uploadB64({
        ticketId,
        fileName: `${label}_${file.name}`,
        contentB64: await fileToBase64(file),
        mimeType: file.type || 'image/png',
      });
    } catch (err) {
      console.error('upload failed', err);
    }
  }
}

export function InventoryForm({ master, onSubmitSuccess, initialValues }: Props) {
  const [report, setReport, resetReport] = usePersistentState<InventoryReport>(
    'fish-processing/inventory-form',
    createDefaultReport(),
  );
  const [state, setState] = useState<SubmissionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parasitePhotos, setParasitePhotos] = useState<File[]>([]);
  const [foreignPhotos, setForeignPhotos] = useState<File[]>([]);

  useEffect(() => {
    if (!initialValues) return;
    setReport((prev) => ({ ...prev, ...initialValues }));
  }, [initialValues, setReport]);

  const options = useMemo(
    () => ({
      factory: master.factory ?? [],
      person: master.person ?? [],
      species: master.species ?? [],
      origin: master.origin ?? [],
      state: master.state ?? ['原魚', '下処理済み', '冷凍'],
      visual_parasite: master.visual_parasite ?? ['異常なし', '要確認', '寄生虫あり'],
      visual_foreign: master.visual_foreign ?? ['異常なし', '要確認', '異物あり'],
    }),
    [master],
  );

  const requiredFilled = useMemo(
    () =>
      ['ticketId', 'purchaseDate', 'date', 'person', 'factory', 'species', 'kg'].every((key) =>
        Boolean((report as Record<string, string>)[key]?.trim()),
      ),
    [report],
  );

  const handleChange = (key: keyof InventoryReport) => (value: string) => {
    setReport((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requiredFilled) return;

    setState('submitting');
    setError(null);
    if (parasitePhotos.length === 0 && report.visual_parasite === 'あり') {
      setState('error');
      setError('寄生虫=あり の場合は写真が1枚以上必須です');
      return;
    }
    if (foreignPhotos.length === 0 && report.visual_foreign === 'あり') {
      setState('error');
      setError('異物=あり の場合は写真が1枚以上必須です');
      return;
    }

    const payload = { ...report };
    try {
      await recordToSheet(payload, 'inventory');
      const baseDate = payload.date ? new Date(payload.date) : new Date();
      const yyyymmdd = formatYmd(baseDate);
      const ticketId = payload.ticketId;
      if (parasitePhotos.length) {
        await uploadFiles(ticketId, `寄生虫_${yyyymmdd}`, parasitePhotos);
      }
      if (foreignPhotos.length) {
        await uploadFiles(ticketId, `異物_${yyyymmdd}`, foreignPhotos);
      }
      setState('success');
      onSubmitSuccess?.(payload);
      resetReport();
      setReport(createDefaultReport());
      setParasitePhotos([]);
      setForeignPhotos([]);
    } catch (err) {
      console.error(err);
      enqueue({ type: 'inventory', payload });
      setState('error');
      setError(err instanceof Error ? `${err.message}（送信失敗のため端末に保存しました）` : '送信に失敗しました');
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {state === 'error' && error ? <Alert variant="error" title="送信エラー" description={error} /> : null}
      {state === 'success' ? <Alert variant="success" title="送信が完了しました" /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="チケットID" required>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={report.ticketId}
            onChange={(e) => handleChange('ticketId')(e.target.value)}
            required
          />
        </FormField>
        <FormField label="工場" required>
          <OptionSelect value={report.factory} onChange={(e) => handleChange('factory')(e.target.value)} options={options.factory} />
        </FormField>
        <FormField label="仕入日" required>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={report.purchaseDate}
            onChange={(e) => handleChange('purchaseDate')(e.target.value)}
            required
          />
        </FormField>
        <FormField label="報告日" required>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={report.date}
            onChange={(e) => handleChange('date')(e.target.value)}
            required
          />
        </FormField>
        <FormField label="担当者" required>
          <OptionSelect value={report.person} onChange={(e) => handleChange('person')(e.target.value)} options={options.person} />
        </FormField>
        <FormField label="魚種" required>
          <OptionSelect value={report.species} onChange={(e) => handleChange('species')(e.target.value)} options={options.species} />
        </FormField>
        <FormField label="産地">
          <OptionSelect value={report.origin} onChange={(e) => handleChange('origin')(e.target.value)} options={options.origin} />
        </FormField>
        <FormField label="状態">
          <OptionSelect value={report.state} onChange={(e) => handleChange('state')(e.target.value)} options={options.state} />
        </FormField>
        <FormField label="重量(kg)" required>
          <input
            type="number"
            min="0"
            step="0.1"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={report.kg}
            onChange={(e) => handleChange('kg')(e.target.value)}
            required
          />
        </FormField>
        <FormField label="寄生虫確認">
          <OptionSelect
            value={report.visual_parasite}
            onChange={(e) => handleChange('visual_parasite')(e.target.value)}
            options={options.visual_parasite}
          />
        </FormField>
        <FormField label="異物確認">
          <OptionSelect
            value={report.visual_foreign}
            onChange={(e) => handleChange('visual_foreign')(e.target.value)}
            options={options.visual_foreign}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormField label="寄生虫/病変の写真">
          <UploadInput label="寄生虫の写真を選択" files={parasitePhotos} onFilesChange={setParasitePhotos} />
        </FormField>
        <FormField label="異物の写真">
          <UploadInput label="異物の写真を選択" files={foreignPhotos} onFilesChange={setForeignPhotos} />
        </FormField>
      </div>
      <FormActionBar
        onCancel={() => {
          resetReport();
          setReport(createDefaultReport());
          setParasitePhotos([]);
          setForeignPhotos([]);
          setState('idle');
          setError(null);
        }}
        submitting={state === 'submitting'}
        disabled={!requiredFilled}
        submitLabel="在庫報告を登録"
      />
    </form>
  );
}
