import { useCallback, useEffect, useMemo, useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { IntakeForm } from './components/IntakeForm';
import { InventoryForm } from './components/InventoryForm';
import { SectionCard } from './components/SectionCard';
import { Button } from './components/Button';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Alert } from './components/Alert';
import { useMasterOptions } from './hooks/useMasterOptions';
import { closeTicket, fetchList, fetchTicket, formatMonth } from './lib/api';
import type { ListItem } from './lib/api';
import { syncPending } from './lib/offlineQueue';
import { InventoryReport, Master } from './types';

const LEGACY_KEYS = ['fish-demo.intakeSubmissions', 'fish-demo.inventoryReports', 'fish-demo.master'];

function formatYmdOnly(v: string | Date | undefined): string {
  if (!v) return '—';
  const d = v instanceof Date ? v : (/^\d{4}-\d{2}-\d{2}T/.test(String(v)) ? new Date(String(v)) : null);
  if (d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

function getHashQueryString() {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash || '';
  const index = hash.indexOf('?');
  return index >= 0 ? hash.slice(index + 1) : '';
}

function useHashQuery() {
  const [query, setQuery] = useState(() => getHashQueryString());
  useEffect(() => {
    const update = () => setQuery(getHashQueryString());
    update();
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return useMemo(() => new URLSearchParams(query), [query]);
}

function Header() {
  return (
    <header className="bg-primary text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link to="/" className="text-lg font-semibold">
          🐟 魚日報ダッシュボード
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/" className="hover:underline">ホーム</Link>
          <Link to="/intake" className="hover:underline">仕入れ</Link>
          <Link to="/inventory" className="hover:underline">在庫報告</Link>
        </nav>
      </div>
    </header>
  );
}

function HomePage() {
  const [month, setMonth] = useState(() => formatMonth(new Date()));
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetMonth = month || formatMonth(new Date());
      const { items: response } = await fetchList(targetMonth);
      setItems(Array.isArray(response) ? (response as ListItem[]) : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : '一覧の取得に失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  const reload = useCallback(async () => {
    await load();
  }, [load]);

  const handleClose = useCallback(
    async (id: string) => {
      if (!id) return;
      if (
        !window.confirm(
          'このチケットを「報告済」にしますか？\n（在庫報告は不要としてクローズします）'
        )
      )
        return;
      try {
        await closeTicket(id);
        await reload();
      } catch (e) {
        alert('クローズに失敗しました。通信状態をご確認ください。');
      }
    },
    [reload]
  );

  useEffect(() => {
    // 旧キーの掃除（幽霊データ対策）
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="月別の報告一覧"
        description="Googleシートに保存された仕入れと在庫報告を読み込みます。"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              className="rounded-md border border-slate-300 px-3 py-1 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => void reload()} disabled={loading}>
              {loading ? '読込中…' : '再読込'}
            </Button>
            <Button type="button" onClick={() => navigate('/intake')}>仕入れを報告する</Button>
          </div>
        }
      >
        {error ? <Alert variant="error" description={`取得エラー：${error}`} /> : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoadingSpinner />
            読み込み中です…
          </div>
        ) : null}
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">仕入日</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">報告時刻</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">魚種</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">工場</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">ステータス</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    この月のデータはありません
                  </td>
                </tr>
              ) : null}
              {items.map((item) => {
                const done = item.status !== '仕入';
                const canOpenInventory = item.status === '仕入';
                return (
                  <tr key={item.ticketId} className={done ? 'opacity-60' : undefined}>
                    <td className="px-4 py-2">{formatYmdOnly(item.date)}</td>
                    <td className="px-4 py-2">{item.reportTime || '—'}</td>
                    <td className="px-4 py-2">{item.species || '—'}</td>
                    <td className="px-4 py-2">{item.factory || '—'}</td>
                    <td className="px-4 py-2">
                      {item.status === '仕入' ? (
                        <button
                          type="button"
                          className="text-primary underline decoration-dotted hover:opacity-80"
                          onClick={() => void handleClose(item.ticketId)}
                          title="在庫報告不要としてクローズ（報告済）"
                        >
                          仕入
                        </button>
                      ) : (
                        item.status || '—'
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {done ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-3 py-1 text-xs text-slate-400">
                          在庫報告済み
                        </span>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={!canOpenInventory}
                          onClick={() => navigate(`/inventory?ticketId=${encodeURIComponent(item.ticketId)}`)}
                        >
                          在庫報告を開く
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function IntakePage({ master }: { master: Master }) {
  return (
    <SectionCard title="仕入れを報告" description="入力後すぐにGoogleシートへ記録します。">
      <IntakeForm master={master} />
    </SectionCard>
  );
}

function InventoryPage({ master }: { master: Master }) {
  const query = useHashQuery();
  const ticketId = query.get('ticketId') || query.get('id') || query.get('tid') || '';
  const [ticket, setTicket] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setTicket(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { item } = await fetchTicket(ticketId);
        if (!cancelled) {
          setTicket(item || null);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'チケット取得に失敗しました');
          setTicket(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const initialValues = useMemo<Partial<InventoryReport> | null>(() => {
    if (ticket) {
      return {
        ticketId: ticket.ticketId || ticketId,
        species: ticket.species || '',
        factory: ticket.factory || '',
        purchaseDate: ticket.purchaseDate || ticket.date || '',
      };
    }
    if (ticketId) {
      return { ticketId };
    }
    return null;
  }, [ticket, ticketId]);

  return (
    <div className="space-y-6">
      <SectionCard
        title="在庫報告を登録"
        description="仕入れチケットに紐づく在庫報告を送信します。"
      >
        {error ? <Alert variant="error" title="取得エラー" description={error} /> : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoadingSpinner />
            チケット情報を取得中です…
          </div>
        ) : null}
        {ticket ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p>魚種: {ticket.species || '—'}</p>
            <p>工場: {ticket.factory || '—'}</p>
            <p>仕入日: {ticket.purchaseDate || ticket.date || '—'}</p>
          </div>
        ) : null}
        <InventoryForm master={master} initialValues={initialValues} />
      </SectionCard>
    </div>
  );
}

export default function App() {
  const { master, status, error, reload } = useMasterOptions();

  useEffect(() => {
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    void syncPending();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-slate-100 text-slate-900">
        <Header />
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
          {status === 'loading' ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <LoadingSpinner />
              マスター情報を取得しています…
            </div>
          ) : null}
          {status === 'error' && error ? (
            <Alert
              variant="error"
              title="マスター取得エラー"
              description={
                <div className="space-y-2">
                  <p>{error}</p>
                  <Button type="button" variant="secondary" onClick={() => void reload()}>
                    再取得する
                  </Button>
                </div>
              }
            />
          ) : null}
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/intake" element={<IntakePage master={master} />} />
            <Route path="/inventory" element={<InventoryPage master={master} />} />
          </Routes>
        </main>
        <footer className="border-t border-slate-200 bg-white py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-xs text-slate-500">
            <span>© 魚日報</span>
            <Button type="button" variant="ghost" onClick={() => void syncPending()}>
              未送信データを同期
            </Button>
          </div>
        </footer>
      </div>
    </Router>
  );
}
