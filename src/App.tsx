import { useMemo, useState } from 'react';
import { IntakeForm } from './components/IntakeForm';
import { InventoryForm } from './components/InventoryForm';
import { SectionCard } from './components/SectionCard';
import { SubmissionHistory, SubmissionLog } from './components/SubmissionHistory';
import { Button } from './components/Button';
import { Alert } from './components/Alert';
import { useMasterOptions } from './hooks/useMasterOptions';
import { usePersistentState } from './store/usePersistentState';
import { IntakeTicket, InventoryReport } from './types';

const TABS = [
  { key: 'intake', label: '仕入れ報告' },
  { key: 'inventory', label: '在庫報告' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function App() {
  const { master, status, error, reload } = useMasterOptions();
  const [tab, setTab] = useState<TabKey>('intake');
  const [intakeHistory, setIntakeHistory] = usePersistentState<SubmissionLog[]>(
    'fish-processing/history/intake',
    [],
  );
  const [inventoryHistory, setInventoryHistory] = usePersistentState<SubmissionLog[]>(
    'fish-processing/history/inventory',
    [],
  );

  const masterAlert = useMemo(() => {
    if (status === 'loading') {
      return <Alert variant="info" title="マスターを読み込み中" />;
    }
    if (status === 'error' && error) {
      return (
        <Alert
          variant="error"
          title="マスターの取得に失敗しました"
          description={error}
          action={<Button onClick={() => void reload()}>再読み込み</Button>}
        />
      );
    }
    return null;
  }, [status, error, reload]);

  const handleIntakeSuccess = (ticket: IntakeTicket) => {
    const timestamp = new Date().toLocaleString('ja-JP');
    setIntakeHistory((prev) => {
      const next: SubmissionLog = {
        id: ticket.ticketId || `${timestamp}-intake`,
        title: `${ticket.species || '魚種未設定'} / ${ticket.factory || '工場未設定'}`,
        subtitle: `${ticket.person || '担当未設定'} が ${ticket.date || '日付未設定'} に報告`,
        state: 'success',
        timestamp,
      };
      const filtered = prev.filter((item) => item.id !== next.id);
      return [next, ...filtered].slice(0, 20);
    });
  };

  const handleInventorySuccess = (report: InventoryReport) => {
    const timestamp = new Date().toLocaleString('ja-JP');
    setInventoryHistory((prev) => {
      const next: SubmissionLog = {
        id: report.ticketId || `${timestamp}-inventory`,
        title: `${report.species || '魚種未設定'} / ${report.factory || '工場未設定'}`,
        subtitle: `${report.person || '担当未設定'} が ${report.date || '日付未設定'} に報告 (${report.kg || '-'}kg)`,
        state: 'success',
        timestamp,
      };
      const filtered = prev.filter((item) => item.id !== next.id);
      return [next, ...filtered].slice(0, 20);
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">魚加工日報</h1>
            <p className="mt-1 text-sm text-slate-600">Google Sheets / Google Drive と連携し、仕入れ・在庫報告を簡単に登録できます。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => void reload()} disabled={status === 'loading'}>
              マスター再読込
            </Button>
            <div className="flex overflow-hidden rounded-md border">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`px-4 py-2 text-sm font-semibold transition ${
                    tab === key ? 'bg-primary text-white' : 'bg-white text-slate-500 hover:text-primary'
                  }`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto mt-8 grid max-w-5xl gap-6 px-6 md:grid-cols-[2fr,1fr]">
        <div className="space-y-6">
          {masterAlert}
          {tab === 'intake' ? (
            <SectionCard title="仕入れを報告する" description="受け入れ時の状況を記録し、スプレッドシートの action シートへ送信します。">
              <IntakeForm master={master} onSubmitSuccess={handleIntakeSuccess} />
            </SectionCard>
          ) : null}
          {tab === 'inventory' ? (
            <SectionCard title="在庫報告を登録" description="在庫の状況と写真をアップロードし、Sheets / Drive へ共有します。">
              <InventoryForm master={master} onSubmitSuccess={handleInventorySuccess} />
            </SectionCard>
          ) : null}
        </div>
        <aside className="space-y-6">
          <SectionCard title="最近の仕入れ報告" description="送信済みの報告は自動的にステータスが更新されます。">
            <SubmissionHistory items={intakeHistory} emptyLabel="まだ仕入れ報告はありません。" />
          </SectionCard>
          <SectionCard title="最近の在庫報告" description="寄生虫/異物の写真は Google Drive に保存されます。">
            <SubmissionHistory items={inventoryHistory} emptyLabel="まだ在庫報告はありません。" />
          </SectionCard>
        </aside>
      </main>
    </div>
  );
}
