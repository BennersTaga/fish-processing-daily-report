import { FormEvent, useMemo, useState } from 'react';
import { recordToSheet } from '../lib/api';
import { enqueue } from '../lib/offlineQueue';
import { IntakeTicket, Master, SubmissionState } from '../types';
import { usePersistentState } from '../store/usePersistentState';
import { FormField } from './FormField';
import { OptionSelect } from './OptionSelect';
import { FormActionBar } from './FormActionBar';
import { Alert } from './Alert';
import { formatDateInput } from '../lib/date';

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

  const options = useMemo(
    () => ({
      factory: master.factory ?? [],
      person: master.person ?? [],
      species: master.species ?? [],
      supplier: master.supplier ?? [],
      ozone: master.ozone ?? ['実施', '未実施'],
      visual_toxic: master.visual_toxic ?? ['問題なし', '要確認', '廃棄'],
      admin: master.admin ?? [],
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
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requiredFilled) return;
    setState('submitting');
    setError(null);
    const payload = { ...ticket };
    try {
      await recordToSheet(payload, 'intake');
      setState('success');
      onSubmitSuccess?.(payload);
      resetTicket();
      setTicket(createDefaultTicket());
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
          <OptionSelect value={ticket.person} onChange={(e) => handleChange('person')(e.target.value)} options={options.person} />
        </FormField>
        <FormField label="魚種" required>
          <OptionSelect value={ticket.species} onChange={(e) => handleChange('species')(e.target.value)} options={options.species} />
        </FormField>
        <FormField label="仕入先" required>
          <OptionSelect
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
      <FormActionBar
        onCancel={() => {
          resetTicket();
          setTicket(createDefaultTicket());
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
