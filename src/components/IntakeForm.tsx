import { FormEvent, useMemo, useState } from 'react';
import { recordToSheet, uploadB64 } from '../lib/api';
import { enqueue } from '../lib/offlineQueue';
import { IntakeTicket, Master, SubmissionState } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { FormField } from './FormField';
import { OptionSelect } from './OptionSelect';
import { FormActionBar } from './FormActionBar';
import { Alert } from './Alert';
import { formatDateInput, formatYmd } from '../lib/date';
import { useNavigate } from '../react-router-dom';
import { UploadInput } from './UploadInput';

const DRIVE_FOLDER_ID = '1h3RCYDQrsNuBObQwKXsYM-HYtk8kE5R5';

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
  ticket: IntakeTicket,
  files: File[],
): Promise<string[]> {
  const ymd = formatYmd(ticket.purchaseDate ? new Date(ticket.purchaseDate) : new Date());
  const base = `${kind}_${ticket.species}_${ymd}_${ticket.person}`;
  const uploaded: string[] = [];
  for (const file of files) {
    const fileName = `${base}_${file.name}`;
    try {
      const res = await uploadB64({
        ticketId: ticket.ticketId,
        fileName,
        contentB64: await fileToBase64(file),
        mimeType: file.type || 'image/png',
        folderId: DRIVE_FOLDER_ID,
      });
      const name = (res as { result?: { name?: string } }).result?.name ?? fileName;
      uploaded.push(name);
    } catch (err) {
      console.error('upload failed', err);
      uploaded.push(fileName);
    }
  }
  return uploaded;
}

const createDefaultTicket = (): IntakeTicket => ({
  ticketId: '',
  factory: '',
  date: formatDateInput(new Date()),
  purchaseDate: formatDateInput(new Date()),
  person: '',
  species: '',
  supplier: '',
  ozone: '',
  ozone_person: '',
  visual_toxic: '',
  visual_toxic_note: '',
  admin: '',
  parasiteYN: '',
  parasiteFiles: '',
  foreignYN: '',
  foreignFiles: '',
});

type Props = {
  master: Master;
  onSubmitSuccess?: (ticket: IntakeTicket) => void;
};

export function IntakeForm({ master, onSubmitSuccess }: Props) {
  const [ticket, setTicket, resetTicket] = usePersistentState<IntakeTicket>(
    'fish-processing/intake-form',
    createDefaultTicket(),
  );
  const [state, setState] = useState<SubmissionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [parasitePhotos, setParasitePhotos] = useState<File[]>([]);
  const [foreignPhotos, setForeignPhotos] = useState<File[]>([]);

  const parasiteRequired = ticket.parasiteYN === '寄生虫あり';
  const foreignRequired = ticket.foreignYN === '異物あり';

  const selectVisualState = (value: string, required?: boolean) =>
    required && !value ? 'bg-gray-100 text-gray-500' : 'bg-white text-gray-900';

  const options = useMemo(
    () => ({
      factory: master.factory ?? [],
      person: master.person ?? [],
      species: master.species ?? [],
      supplier: master.supplier ?? [],
      ozone: master.ozone ?? ['実施', '未実施'],
      visual_toxic: master.visual_toxic ?? ['問題なし', '要確認', '廃棄'],
      admin: master.admin ?? [],
      parasiteYN: master.visual_parasite ?? ['なし', '寄生虫あり'],
      foreignYN: master.visual_foreign ?? ['なし', '異物あり'],
    }),
    [master],
  );

  const requiredFilled = useMemo(
    () =>
      ['factory', 'date', 'purchaseDate', 'person', 'species', 'supplier'].every((key) =>
        Boolean((ticket as Record<string, string>)[key]?.trim()),
      ),
    [ticket],
  );

  const handleChange = (key: keyof IntakeTicket) => (value: string) => {
    setTicket((prev) => ({ ...prev, [key]: value }));
    if (key === 'parasiteYN' && value !== '寄生虫あり') {
      setParasitePhotos([]);
    }
    if (key === 'foreignYN' && value !== '異物あり') {
      setForeignPhotos([]);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requiredFilled) return;
    setState('submitting');
    setError(null);
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

    const payload: IntakeTicket = { ...ticket, parasiteFiles: '', foreignFiles: '' };
    try {
      if (parasitePhotos.length) {
        const names = await uploadFiles('寄生虫', payload, parasitePhotos);
        payload.parasiteFiles = names.join('\n');
      }
      if (foreignPhotos.length) {
        const names = await uploadFiles('異物', payload, foreignPhotos);
        payload.foreignFiles = names.join('\n');
      }

      const res = await recordToSheet(payload, 'intake');
      if (res?.result && typeof res.result === 'object' && 'ticketId' in res.result) {
        payload.ticketId = (res.result as { ticketId?: string }).ticketId || payload.ticketId;
      }
      setState('success');
      onSubmitSuccess?.(payload);
      resetTicket();
      setTicket(createDefaultTicket());
      setParasitePhotos([]);
      setForeignPhotos([]);
      navigate('/', { replace: true });
    } catch (err) {
      console.error(err);
      enqueue({ type: 'intake', payload });
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
            className={selectVisualState(ticket.factory, true)}
            value={ticket.factory}
            onChange={(e) => handleChange('factory')(e.target.value)}
            options={options.factory}
          />
        </FormField>
        <FormField label="仕入日" required>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={ticket.purchaseDate}
            onChange={(e) => handleChange('purchaseDate')(e.target.value)}
            required
          />
        </FormField>
        <FormField label="報告日" required>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={ticket.date}
            onChange={(e) => handleChange('date')(e.target.value)}
            required
          />
        </FormField>
        <FormField label="担当者" required>
          <OptionSelect
            className={selectVisualState(ticket.person, true)}
            value={ticket.person}
            onChange={(e) => handleChange('person')(e.target.value)}
            options={options.person}
          />
        </FormField>
        <FormField label="魚種" required>
          <OptionSelect
            className={selectVisualState(ticket.species, true)}
            value={ticket.species}
            onChange={(e) => handleChange('species')(e.target.value)}
            options={options.species}
          />
        </FormField>
        <FormField label="仕入先" required>
          <OptionSelect
            className={selectVisualState(ticket.supplier, true)}
            value={ticket.supplier}
            onChange={(e) => handleChange('supplier')(e.target.value)}
            options={options.supplier}
          />
        </FormField>
        <FormField label="オゾン処理">
          <OptionSelect value={ticket.ozone} onChange={(e) => handleChange('ozone')(e.target.value)} options={options.ozone} />
        </FormField>
        <FormField label="オゾン担当">
          <OptionSelect
            value={ticket.ozone_person}
            onChange={(e) => handleChange('ozone_person')(e.target.value)}
            options={options.person}
          />
        </FormField>
        <FormField label="有毒魚類チェック">
          <OptionSelect
            value={ticket.visual_toxic}
            onChange={(e) => handleChange('visual_toxic')(e.target.value)}
            options={options.visual_toxic}
          />
        </FormField>
        <FormField label="有毒魚類備考">
          <textarea
            className="min-h-[88px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={ticket.visual_toxic_note}
            onChange={(e) => handleChange('visual_toxic_note')(e.target.value)}
          />
        </FormField>
        <FormField label="管理担当">
          <OptionSelect value={ticket.admin} onChange={(e) => handleChange('admin')(e.target.value)} options={options.admin} />
        </FormField>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <FormField label="寄生虫確認">
            <OptionSelect
              value={ticket.parasiteYN}
              onChange={(e) => handleChange('parasiteYN')(e.target.value)}
              options={options.parasiteYN}
            />
          </FormField>
          <FormField label="寄生虫/病変の写真">
            <UploadInput
              label="寄生虫の写真を選択"
              files={parasitePhotos}
              onFilesChange={setParasitePhotos}
              disabled={!parasiteRequired}
              maxFiles={5}
            />
          </FormField>
        </div>

        <div className="space-y-4">
          <FormField label="異物確認">
            <OptionSelect
              value={ticket.foreignYN}
              onChange={(e) => handleChange('foreignYN')(e.target.value)}
              options={options.foreignYN}
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
      </div>
      <FormActionBar
        onCancel={() => {
          resetTicket();
          setTicket(createDefaultTicket());
          setParasitePhotos([]);
          setForeignPhotos([]);
          setState('idle');
          setError(null);
        }}
        submitting={state === 'submitting'}
        disabled={!requiredFilled}
        submitLabel="仕入れを報告する"
      />
    </form>
  );
}
