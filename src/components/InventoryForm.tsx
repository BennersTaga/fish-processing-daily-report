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
import { useNavigate } from '../react-router-dom';

const DRIVE_FOLDER_ID = '1h3RCYDQrsNuBObQwKXsYM-HYtk8kE5R5';

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

async function uploadFiles(
  kind: '寄生虫' | '異物',
  report: InventoryReport,
  files: File[],
) {
  const ymd = formatYmd(report.purchaseDate ? new Date(report.purchaseDate) : new Date());
  const base = `${kind}_${report.species}_${ymd}_${report.person}`;
  for (const file of files) {
    try {
      await uploadB64({
        ticketId: report.ticketId,
        fileName: `${base}_${file.name}`,
        contentB64: await fileToBase64(file),
        mimeType: file.type || 'image/png',
        folderId: DRIVE_FOLDER_ID,
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
  const navigate = useNavigate();

  const [parasitePhotos, setParasitePhotos] = useState<File[]>([]);
  const [foreignPhotos, setForeignPhotos] = useState<File[]>([]);

  const lockedFromTicket = Boolean(initialValues?.ticketId);
  const parasiteRequired = report.visual_parasite === '寄生虫あり';
  const foreignRequired = report.visual_foreign === '異物あり';

  useEffect(() => {
    if (!initialValues) return;
    // Normalize dates to "YYYY-MM-DD" so <input type="date"> can display them
    const normalized: Partial<InventoryReport> = { ...initialValues };
    const src = initialValues.purchaseDate || (initialValues as any).date;
    if (src) {
      normalized.purchaseDate = formatDateInput(src);
    }
    setReport((prev) => ({ ...prev, ...normalized }));
  }, [initialValues, setReport]);

  const options = useMemo(
    () => ({
      factory: master.factory ?? [],
      person: master.person ?? [],
      species: master.species ?? [],
      origin: master.origin ?? [],
      state: master.state ?? ['原魚', '下処理済み', '冷凍'],
      visual_parasite: master.visual_parasite ?? ['なし', '寄生虫あり'],
      visual_foreign: master.visual_foreign ?? ['なし', '異物あり'],
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
    // 選択が「あり」以外になったらファイルをクリア
    if (key === 'visual_parasite' && value !== '寄生虫あり') {
      setParasitePhotos([]);
    }
    if (key === 'visual_foreign' && value !== '異物あり') {
      setForeignPhotos([]);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requiredFilled) return;

    setState('submitting');
    setError(null);

    // 「あり」のときは写真必須
    if (parasiteRequired && parasitePhotos.length === 0) {
      setState('error');
      setError('寄生虫あり の場合は写真が1枚以上必須です');
      return;
    }
    if (foreignRequired && foreignPhotos.length === 0) {
      setState('error');
      setError('異物あり の場合は写真が1枚以上必須です');
      return;
    }

    // intake の P → inventory の S に変換
    const toInventoryId = (id: string) => {
      if (!id) return '';
      return id.endsWith('P') ? id.slice(0, -1) + 'S' : id.endsWith('S') ? id : id + 'S';
    };
    const payload = { ...report, ticketId: toInventoryId(report.ticketId) };

    try {
      await recordToSheet(payload, 'inventory');

      if (parasitePhotos.length) {
        await uploadFiles('寄生虫', payload, parasitePhotos);
      }
      if (foreignPhotos.length) {
        await uploadFiles('異物', payload, foreignPhotos);
      }

      setState('success');
      onSubmitSuccess?.(payload);
      resetReport();
      setReport(createDefaultReport());
      setParasitePhotos([]);
      setForeignPhotos([]);
      navigate('/', { replace: true });
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
        <FormField label="工場" required>
          <OptionSelect
            required
            value={report.factory}
            onChange={(e) => handleChange('factory')(e.target.value)}
            options={options.factory}
            disabled={lockedFromTicket}
            className={lockedFromTicket ? 'bg-slate-100' : undefined}
          />
        </FormField>

        <FormField label="仕入日" required>
          <input
            type="date"
            className={`w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 ${lockedFromTicket ? 'bg-slate-100' : ''}`}
            value={report.purchaseDate}
            onChange={(e) => handleChange('purchaseDate')(e.target.value)}
            required
            disabled={lockedFromTicket}
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
          <OptionSelect
            required
            value={report.person}
            onChange={(e) => handleChange('person')(e.target.value)}
            options={options.person}
          />
        </FormField>

        <FormField label="魚種" required>
          <OptionSelect
            required
            value={report.species}
            onChange={(e) => handleChange('species')(e.target.value)}
            options={options.species}
            disabled={lockedFromTicket}
            className={lockedFromTicket ? 'bg-slate-100' : undefined}
          />
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
          <UploadInput
            label="寄生虫の写真を選択"
            files={parasitePhotos}
            onFilesChange={setParasitePhotos}
            disabled={!parasiteRequired}
            maxFiles={5}
          />
        </FormField>

        <FormField label="異物の写真">
          <UploadInput
            label="異物の写真を選択"
            files={foreignPhotos}
            onFilesChange={setForeignPhotos}
            disabled={!foreignRequired}
            maxFiles={5}
          />
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
