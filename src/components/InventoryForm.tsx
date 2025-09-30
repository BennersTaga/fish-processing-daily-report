import { FormEvent, useMemo, useState } from 'react';
import { Master, postInventory, uploadPhotos } from '../lib/api';
import { InventoryReport, SubmissionState } from '../types';
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
};

export function InventoryForm({ master, onSubmitSuccess }: Props) {
  const [report, setReport, resetReport] = usePersistentState<InventoryReport>(
    'fish-processing/inventory-form',
    createDefaultReport(),
  );
  const [state, setState] = useState<SubmissionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [parasitePhotos, setParasitePhotos] = useState<File[]>([]);
  const [foreignPhotos, setForeignPhotos] = useState<File[]>([]);

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
    try {
      await postInventory(report);
      const baseDate = report.date ? new Date(report.date) : new Date();
      const yyyymmdd = formatYmd(baseDate);
      const person = report.person || '未設定';

      if (parasitePhotos.length) {
        await uploadPhotos(`寄生虫_${yyyymmdd}_${person}`, parasitePhotos);
      }
      if (foreignPhotos.length) {
        await uploadPhotos(`異物_${yyyymmdd}_${person}`, foreignPhotos);
      }

      setState('success');
      onSubmitSuccess?.(report);
      setParasitePhotos([]);
      setForeignPhotos([]);
    } catch (err) {
      console.error(err);
      setState('error');
      setError(err instanceof Error ? err.message : '送信に失敗しました');
      return;
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
