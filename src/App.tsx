import React, { useEffect, useMemo, useState } from "react";
import { HashRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";

/**
 * 魚日報デモ（加工する魚原材料 / 魚原料在庫報告書）
 * - CSV分割を `text.split(/\r?\n/)` に統一
 * - ホーム: 月切替＋表。行ごとの「在庫報告をする」
 * - Intake: 有毒魚の確認UIを統合
 * - Inventory: 加工状態=単一選択、産地（業者）=選択式
 * - 在庫報告: 「使い切った / 次の日に残した」＋残量kg
 * - 仕入れモーダルの「年月日」→「仕入れの年月日」
 * - 二重送信/多重遷移の防止（押下後は完了までdisabled）
 */

const MASTER_CSV_URL = import.meta.env.VITE_MASTER_CSV_URL || "";
const API_URL = import.meta.env.VITE_GAS_URL || "";
const DRIVE_FOLDER_ID_PHOTOS = "1h3RCYDQrsNuBObQwKXsYM-HYtk8kE5R5";

type MasterKey =
  | "factory"
  | "person"
  | "species"
  | "supplier"
  | "admin"
  | "ozone_person"
  | "origin";

const fallbackMaster: Record<MasterKey, string[]> = {
  factory: [],
  person: [],
  species: [],
  supplier: [],
  admin: [],
  ozone_person: [],
  origin: [],
};

/** CSV文字列→ {id: 選択肢[]} へ変換（1行目=名称, 2行目=ID, 3行目以降=選択肢） */
function parseMasterCsv(text: string): Partial<Record<MasterKey, string[]>> {
  if (!text) return {};
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.split(",").map((c) => c.trim()))
    .filter((r) => r.length > 0 && r.some((c) => c !== ""));
  const colCount = rows[0]?.length ?? 0;
  const result: Partial<Record<MasterKey, string[]>> = {};
  for (let c = 0; c < colCount; c++) {
    const id = (rows[1]?.[c] || "") as MasterKey;
    if (!id) continue;
    const choices: string[] = [];
    for (let r = 2; r < rows.length; r++) {
      const val = rows[r]?.[c];
      if (val && val.length > 0) choices.push(val);
    }
    if (choices.length) result[id] = choices;
  }
  return result;
}

async function fetchMasterFromCsv(url: string): Promise<Record<MasterKey, string[]>> {
  if (!url) throw new Error("MASTER_CSV_URL is empty");
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch CSV");
  const text = await res.text();
  const parsed = parseMasterCsv(text);
  return { ...fallbackMaster, ...(parsed as Record<MasterKey, string[]>) };
}

// ---- Dev用の超軽量テスト（任意）----
function arraysEqual(a: any[], b: any[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function runParserTests() {
  try {
    const sample = [
      "工場,担当者,魚種,産地（業者）",
      "factory,person,species,origin",
      "A工場,佐藤,サバ,北海道（〇〇水産）",
      "B工場,鈴木,アジ,宮城県（△△商店）",
    ].join("\n");
    const out = parseMasterCsv(sample);
    const t1 = arraysEqual(out.factory || [], ["A工場", "B工場"]);
    const t2 = arraysEqual(out.person || [], ["佐藤", "鈴木"]);
    const t3 = arraysEqual(out.species || [], ["サバ", "アジ"]);
    const t4 = arraysEqual(out.origin || [], ["北海道（〇〇水産）", "宮城県（△△商店）"]);

    const sampleAll = [
      "工場,担当者,魚種,仕入れ先,管理者チェック,オゾン水 担当者,産地（業者）",
      "factory,person,species,supplier,admin,ozone_person,origin",
      "第一工場,佐藤,サバ,〇〇水産,管理者A,佐藤,北海道（〇〇水産）",
      "第二工場,鈴木,アジ,△△商店,管理者B,鈴木,宮城県（△△商店）",
    ].join("\n");
    const outAll = parseMasterCsv(sampleAll);
    const tAll1 = arraysEqual(outAll.factory || [], ["第一工場", "第二工場"]);
    const tAll2 = arraysEqual(outAll.person || [], ["佐藤", "鈴木"]);
    const tAll3 = arraysEqual(outAll.species || [], ["サバ", "アジ"]);
    const tAll4 = arraysEqual(outAll.supplier || [], ["〇〇水産", "△△商店"]);
    const tAll5 = arraysEqual(outAll.admin || [], ["管理者A", "管理者B"]);
    const tAll6 = arraysEqual(outAll.ozone_person || [], ["佐藤", "鈴木"]);
    const tAll7 = arraysEqual(outAll.origin || [], ["北海道（〇〇水産）", "宮城県（△△商店）"]);

    const all =
      t1 && t2 && t3 && t4 &&
      tAll1 && tAll2 && tAll3 && tAll4 && tAll5 && tAll6 && tAll7;
    console.log("[TEST] parseMasterCsv all:", all);
  } catch (e) {
    console.error("[TEST] parseMasterCsv failed:", e);
  }
}
if (typeof window !== "undefined") runParserTests();
// ----------------------------------------------------------------------

const LS_KEYS = {
  MASTER: "fish-demo.master",
  SPECIES_SET: "fish-demo.speciesSet",
  INTAKE_SUBMISSIONS: "fish-demo.intakeSubmissions", // チケット
  INVENTORY_REPORTS: "fish-demo.inventoryReports",   // 消込
};

type Ticket = {
  ticketId: string;
  factory: string;
  date: string; // 起票日 or チケット作成日
  purchaseDate?: string; // 仕入れの年月日（ホーム1列目で使用）
  person: string;
  species: string;
  supplier: string;
  ozone: "あり" | "なし";
  ozone_person: string;
  visual_toxic: "あり" | "なし";
  visual_toxic_note?: string;
  visual_parasite: "あり" | "なし";
  visual_foreign: "あり" | "なし";
  admin: string;
};

type Report = {
  ticketId: string;
  purchaseDate: string; // 仕入れ日
  date: string; // 記入日（加工日）
  person: string;
  factory: string;
  species: string;
  origin: string;
  state: string; // 単一選択
  kg: number | null;
  depletion: "使い切った" | "次の日に残した";
  leftoverKg: number | null;
};

// ---- GAS integration helpers ----
async function recordToSheet(type: "intake" | "inventory", payload: any) {
  if (!API_URL) return;
  const fd = new FormData();
  fd.append("action", "record");
  fd.append("type", type);
  fd.append("payload", JSON.stringify(payload));
  await fetch(API_URL, { method: "POST", mode: "no-cors", body: fd }).catch(() => {});
}

/** 画像アップロード（multipart / no-cors 応答は読まない） */
async function uploadPhotos(files: File[], prefix: string, folderId?: string): Promise<string[]> {
  if (!API_URL || files.length === 0) return [];
  const fd = new FormData();
  fd.append("action", "upload");
  fd.append("prefix", prefix);
  if (folderId) fd.append("folderId", folderId);
  files.forEach((file, i) => {
    fd.append(`file${i}`, file);
  });
  await fetch(API_URL, { method: "POST", mode: "no-cors", body: fd }).catch(() => {});
  return [];
}

function useMasterOptions() {
  const [master, setMaster] = useState<Record<MasterKey, string[]>>(() => {
    try {
      const cached = localStorage.getItem(LS_KEYS.MASTER);
      return cached ? JSON.parse(cached) : fallbackMaster;
    } catch {
      return fallbackMaster;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMasterFromCsv(MASTER_CSV_URL);
      setMaster(data);
      localStorage.setItem(LS_KEYS.MASTER, JSON.stringify(data));
    } catch (e: any) {
      setError(e?.message || "マスター取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (MASTER_CSV_URL) reload();
  }, []);

  return { master, reload, loading, error };
}

function useSpeciesSet() {
  const [setData, setSetData] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.SPECIES_SET);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const add = (species: string) => {
    setSetData((prev) => {
      if (prev.includes(species)) return prev;
      const next = [...prev, species];
      localStorage.setItem(LS_KEYS.SPECIES_SET, JSON.stringify(next));
      return next;
    });
  };
  const clear = () => {
    setSetData([]);
    localStorage.removeItem(LS_KEYS.SPECIES_SET);
  };
  return { speciesSet: setData, add, clear };
}

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function monthStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}
function yyyymmdd(dateISO: string) {
  const [y, m, d] = dateISO.split("-");
  return `${y}${m}${d}`;
}
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
function getQuery() {
  const q = new URLSearchParams(window.location.hash.split("?")[1] || "");
  return Object.fromEntries(q.entries());
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-medium">{children}</span>;
}
function PrimaryButton({ to, icon, title, desc }: { to: string; icon: string; title: string; desc: string; }) {
  return (
    <Link
      to={to}
      className="group block rounded-3xl bg-white/90 ring-1 ring-sky-100 hover:ring-sky-300 hover:bg-white shadow-sm hover:shadow-lg transition p-6"
    >
      <div className="text-sky-600 text-2xl mb-2">{icon}</div>
      <div className="flex items-baseline justify-between">
        <h3 className="text-xl font-bold text-sky-900">{title}</h3>
        <svg className="w-5 h-5 text-sky-400 group-hover:text-sky-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L12 6.414V17a1 1 0 11-2 0V6.414L5.707 10.707A1 1 0 114.293 9.293l6-6z"/></svg>
      </div>
      <p className="mt-1 text-slate-600 text-sm">{desc}</p>
    </Link>
  );
}

function Header() {
  return (
    <div className="w-full bg-gradient-to-r from-sky-500 to-sky-600 text-white sticky top-0 z-10 shadow">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="font-bold text-lg flex items-center gap-2">🐟 魚日報デモ</div>
        <div className="hidden md:flex gap-2 text-xs">
          <Link className="px-3 py-1.5 rounded-full bg-white/10 hover:bg白/20" to="/">ホーム</Link>
          <Link className="px-3 py-1.5 rounded-full bg白/10 hover:bg白/20" to="/intake">チケット作成</Link>
          <Link className="px-3 py-1.5 rounded-full bg白/10 hover:bg白/20" to="/inventory">在庫報告</Link>
        </div>
      </div>
    </div>
  );
}

// ------------------------ ホーム（表＋モーダル） ------------------------
function Home({ onReloadMaster, masterLoading, masterError }: { onReloadMaster: () => void; masterLoading: boolean; masterError: string | null; }) {
  const [m, setM] = useState<string>(monthStr());
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [navigatingTid, setNavigatingTid] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem(LS_KEYS.INTAKE_SUBMISSIONS) || "[]");
      const r = JSON.parse(localStorage.getItem(LS_KEYS.INVENTORY_REPORTS) || "[]");
      setTickets(t);
      setReports(r);
    } catch {}
  }, [showModal]);

  const reportByTid = useMemo(() => {
    const map = new Map<string, Report>();
    reports.forEach((r) => map.set(r.ticketId, r));
    return map;
  }, [reports]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => (t.purchaseDate || t.date).startsWith(m));
  }, [tickets, m]);

  const goInventory = (t: Ticket) => {
    if (navigatingTid) return;
    setNavigatingTid(t.ticketId);
    nav(`/inventory?tid=${encodeURIComponent(t.ticketId)}&species=${encodeURIComponent(t.species)}`);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-sky-50 to-white">
      <div className="max-w-5xl mx-auto p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-sky-900">月別一覧</h1>
            <input type="month" className="border rounded-xl px-3 py-1.5 text-sm" value={m} onChange={(e) => setM(e.target.value)} />
          </div>
          <button onClick={() => setShowModal(true)} className="px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm shadow">仕入れを報告する</button>
        </div>

        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-sky-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sky-50 text-sky-900">
              <tr>
                <th className="text-left px-4 py-3">仕入れの年月日</th>
                <th className="text-left px-4 py-3">魚種</th>
                <th className="text-left px-4 py-3">在庫報告 / 消込</th>
                <th className="text-left px-4 py-3">加工した年月日</th>
                <th className="text-left px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">この月のデータはありません</td></tr>
              )}
              {filtered.map((t) => {
                const rep = reportByTid.get(t.ticketId);
                const done = !!rep;
                return (
                  <tr key={t.ticketId} className={`${done ? "text-slate-400" : ""}`}>
                    <td className="px-4 py-3">{t.purchaseDate || rep?.purchaseDate || "—"}</td>
                    <td className="px-4 py-3">{t.species}</td>
                    <td className="px-4 py-3">{done ? "報告完了" : "未報告"}</td>
                    <td className="px-4 py-3">{rep?.date || "—"}</td>
                    <td className="px-4 py-3">
                      {done ? (
                        <span className="text-slate-400">報告完了</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goInventory(t)}
                          disabled={navigatingTid === t.ticketId || done}
                          className={`px-3 py-1.5 rounded-full text-white shadow transition ${
                            (navigatingTid === t.ticketId || done)
                              ? "bg-slate-300 cursor-not-allowed opacity-50 pointer-events-none"
                              : "bg-sky-600 hover:bg-sky-700"
                          }`}
                        >
                          在庫報告をする
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
          <h2 className="font-semibold text-sky-900 mb-2">マスター再読込</h2>
          <button onClick={onReloadMaster} className="px-4 py-2 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm disabled:opacity-50" disabled={masterLoading}>
            {masterLoading ? "読込中..." : "マスターを再読込"}
          </button>
          {masterError && <p className="text-red-600 text-sm mt-2">{masterError}</p>}
        </div>
      </div>

      {showModal && <IntakeModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

const INTAKE_MODAL_OVERLAY_CLASS =
  "fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50";
const INTAKE_MODAL_CARD_CLASS =
  "w-[min(960px,95vw)] max-h-[90vh] overflow-auto rounded-3xl bg-white p-6 ring-1 ring-sky-100 shadow-xl";
const INTAKE_MODAL_SUBMIT_CLASS =
  "px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm shadow";
const INTAKE_MODAL_CANCEL_CLASS =
  "px-5 py-2.5 rounded-full bg-white ring-1 ring-sky-200 text-sky-700 text-sm shadow-sm";

function IntakeModal({ onClose }: { onClose: () => void; }) {
  const { master } = useMasterOptions();
  const { add } = useSpeciesSet();
  const [date, setDate] = useState(todayStr()); // 仕入れの年月日
  const [factory, setFactory] = useState(master.factory[0] || "");
  const [person, setPerson] = useState(master.person[0] || "");
  const [species, setSpecies] = useState(master.species[0] || "");
  const [supplier, setSupplier] = useState(master.supplier[0] || "");
  const [ozone, setOzone] = useState<"あり" | "なし">("なし");
  const [ozonePerson, setOzonePerson] = useState("なし");
  const ozoneOptions = useMemo(() => ["なし", ...master.ozone_person.filter((o) => o !== "なし")], [master.ozone_person]);
  const [toxFish, setToxFish] = useState<"あり" | "なし">("なし");
  const [toxNote, setToxNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ozone === "なし") setOzonePerson("なし");
    else if (!ozonePerson || ozonePerson === "なし") {
      const first = ozoneOptions.find((o) => o !== "なし") || "";
      setOzonePerson(first);
    }
  }, [ozone, ozonePerson, ozoneOptions]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErr(null);
    setIsSubmitting(true);

    const ticket: Ticket = {
      ticketId: uid(), factory, date: todayStr(), purchaseDate: date, person, species, supplier,
      ozone, ozone_person: ozonePerson,
      visual_toxic: toxFish, visual_toxic_note: toxNote,
      visual_parasite: "なし", visual_foreign: "なし",
      admin: master.admin[0] || "管理者A",
    };
    try {
      const raw = localStorage.getItem(LS_KEYS.INTAKE_SUBMISSIONS);
      const arr: Ticket[] = raw ? JSON.parse(raw) : [];
      arr.push(ticket);
      localStorage.setItem(LS_KEYS.INTAKE_SUBMISSIONS, JSON.stringify(arr));
      await recordToSheet("intake", ticket);
      add(species);
      onClose();
    } catch {
      setErr("保存に失敗しました");
      setIsSubmitting(false);
    }
  };

  return (
    <div className={INTAKE_MODAL_OVERLAY_CLASS}>
      <div className={INTAKE_MODAL_CARD_CLASS}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-sky-900">仕入れを報告する</h3>
          <button onClick={onClose} disabled={isSubmitting} className="text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none">閉じる</button>
        </div>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Select label="工場" value={factory} onChange={setFactory} options={master.factory} />
            <DateInput label="仕入れの年月日" value={date} onChange={setDate} />
            <Select label="担当者" value={person} onChange={setPerson} options={master.person} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Select label="魚種（チケット対象）" value={species} onChange={setSpecies} options={master.species} />
            <Select label="仕入れ先" value={supplier} onChange={setSupplier} options={master.supplier} />
            <RadioYN label="オゾン水 実施の有無" value={ozone} onChange={setOzone} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Select label="オゾン水 担当者" value={ozonePerson} onChange={setOzonePerson} options={ozoneOptions} disabled={ozone === "なし"} />
            <ToxicBox valueYN={toxFish} setYN={setToxFish} note={toxNote} setNote={setToxNote} />
            <div />
          </div>
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="flex gap-2">
            <button disabled={isSubmitting} className="px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none">登録</button>
            <button type="button" onClick={onClose} disabled={isSubmitting} className="px-5 py-2.5 rounded-full bg-white ring-1 ring-sky-200 text-sky-700 text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none">キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ------------------------ Intake（ページ） ------------------------
function IntakePage({ master, onSubmitted, addSpecies }: { master: Record<MasterKey, string[]>; onSubmitted: (payload: any) => void; addSpecies: (s: string) => void; }) {
  const [date, setDate] = useState(todayStr());
  const [factory, setFactory] = useState(master.factory[0] || "");
  const [person, setPerson] = useState(master.person[0] || "");
  const [species, setSpecies] = useState(master.species[0] || "");
  const [supplier, setSupplier] = useState(master.supplier[0] || "");
  const [ozone, setOzone] = useState<"あり" | "なし">("なし");
  const [ozonePerson, setOzonePerson] = useState("なし");
  const ozoneOptions = useMemo(() => ["なし", ...master.ozone_person.filter((o) => o !== "なし")], [master.ozone_person]);
  const [toxFish, setToxFish] = useState<"あり" | "なし">("なし");
  const [toxNote, setToxNote] = useState("");
  const [admin, setAdmin] = useState(master.admin[0] || "");
  const [err, setErr] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (master.factory.length) setFactory(master.factory[0]);
    if (master.person.length) setPerson(master.person[0]);
    if (master.species.length) setSpecies(master.species[0]);
    if (master.supplier.length) setSupplier(master.supplier[0]);
    if (master.ozone_person.length) setOzonePerson(master.ozone_person[0]);
    if (master.admin.length) setAdmin(master.admin[0]);
  }, [master]);

  useEffect(() => {
    if (ozone === "なし") setOzonePerson("なし");
    else if (!ozonePerson || ozonePerson === "なし") {
      const first = ozoneOptions.find((o) => o !== "なし") || "";
      setOzonePerson(first);
    }
  }, [ozone, ozonePerson, ozoneOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErr(null);
    setIsSubmitting(true);

    const payload: Ticket = {
      ticketId: uid(),
      factory, date, purchaseDate: undefined, person, species, supplier,
      ozone, ozone_person: ozonePerson,
      visual_toxic: toxFish, visual_toxic_note: toxNote,
      visual_parasite: "なし", visual_foreign: "なし",
      admin,
    };

    addSpecies(species);
    try {
      const raw = localStorage.getItem(LS_KEYS.INTAKE_SUBMISSIONS);
      const arr: Ticket[] = raw ? JSON.parse(raw) : [];
      arr.push(payload);
      localStorage.setItem(LS_KEYS.INTAKE_SUBMISSIONS, JSON.stringify(arr));
      await recordToSheet("intake", payload);
      setPreviewOpen(true);
      onSubmitted(payload);
    } catch {
      setErr("保存に失敗しました");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-sky-50 to-white">
      <div className="max-w-5xl mx-auto p-4">
        <div className="mb-4 p-4 rounded-3xl bg-white ring-1 ring-sky-100 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-sky-900">チケット作成（加工する魚原材料）</h1>
            <p className="text-slate-600 text-sm">魚種ごとの作業をチケットとして起票します。</p>
          </div>
          <Badge>🎫 Ticket</Badge>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Select label="工場" value={factory} onChange={setFactory} options={master.factory} />
            <DateInput label="年月日" value={date} onChange={setDate} />
            <Select label="担当者" value={person} onChange={setPerson} options={master.person} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Select label="魚種（チケット対象）" value={species} onChange={setSpecies} options={master.species} />
            <Select label="仕入れ先" value={supplier} onChange={setSupplier} options={master.supplier} />
            <RadioYN label="オゾン水 実施の有無" value={ozone} onChange={setOzone} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Select label="オゾン水 担当者" value={ozonePerson} onChange={setOzonePerson} options={ozoneOptions} disabled={ozone === "なし"} />
            <ToxicBox valueYN={toxFish} setYN={setToxFish} note={toxNote} setNote={setToxNote} />
            <div />
          </div>
          <Select label="管理者チェック" value={admin} onChange={setAdmin} options={master.admin} />
          {err && <p className="text-red-600 text-sm">{err}</p>}

          <div className="flex gap-3">
            <button
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              登録
            </button>
            <Link to="/" className="px-5 py-2.5 rounded-full bg-white ring-1 ring-sky-200 text-sky-700 text-sm shadow-sm">ホームへ</Link>
          </div>
        </form>

        <TicketListPreview />

        {previewOpen && (
          <PhotosPreviewModal
            title="プレビュー"
            parasite={[]}
            foreign={[]}
            onClose={() => {
              setPreviewOpen(false);
              setIsSubmitting(false);
              nav("/");
            }}
          />
        )}
      </div>
    </div>
  );
}

function ToxicBox({ valueYN, setYN, note, setNote }: { valueYN: "あり" | "なし"; setYN: (v: "あり" | "なし") => void; note: string; setNote: (v: string) => void; }) {
  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <label className="block text-sm font-medium mb-1 text-slate-700">目視確認 有毒魚</label>
      <div className="flex items-center gap-6 text-sm mb-2">
        <label className="flex items-center gap-2"><input type="radio" checked={valueYN === "あり"} onChange={() => setYN("あり")} />あり</label>
        <label className="flex items-center gap-2"><input type="radio" checked={valueYN === "なし"} onChange={() => setYN("なし")} />なし</label>
      </div>
      <input type="text" className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="気づいたこと（有毒魚）" value={note} onChange={(e) => setNote(e.target.value)} />
    </div>
  );
}

function TicketListPreview() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.INTAKE_SUBMISSIONS);
      const arr = raw ? JSON.parse(raw) : [];
      setItems(arr.slice(-5).reverse());
    } catch {}
  }, []);
  if (!items.length) return null;
  return (
    <div className="mt-6 p-4 rounded-3xl bg-white ring-1 ring-sky-100 shadow-sm">
      <h2 className="font-semibold text-sky-900 mb-3">最近作成したチケット</h2>
      <ul className="space-y-2 text-sm">
        {items.map((x: Ticket, i: number) => (
          <li key={i} className="flex items-center justify-between bg-sky-50 rounded-xl px-3 py-2">
            <div className="flex items-center gap-3">
              <Badge>{x.purchaseDate || x.date}</Badge>
              <span className="font-medium">{x.species}</span>
              <span className="text-slate-500">{x.person}</span>
            </div>
            <span className="text-sky-600">OPEN</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------ Inventory（ページ） ------------------------
function InventoryPage({ master, speciesSet }: { master: Record<MasterKey, string[]>; speciesSet: string[]; }) {
  const q = getQuery();
  const ticketId = (q["tid"] as string) || "";
  const qsSpecies = (q["species"] as string) || "";
  const nav = useNavigate();

  const [factory, setFactory] = useState(master.factory[0] || "");
  const [date, setDate] = useState(todayStr());
  const [person, setPerson] = useState(master.person[0] || "");
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [species, setSpecies] = useState("" as string);
  const [fixedSpecies, setFixedSpecies] = useState<string | null>(null);
  const [origin, setOrigin] = useState(master.origin[0] || "");
  const [state, setState] = useState<string>("ラウンド"); // 単一選択
  const [depletion, setDepletion] = useState<"使い切った" | "次の日に残した">("使い切った");
  const [leftoverKg, setLeftoverKg] = useState<string>("");

  const [parasiteYN, setParasiteYN] = useState<"あり" | "なし">("なし");
  const [parasitePhotos, setParasitePhotos] = useState<File[]>([]);
  const [foreignYN, setForeignYN] = useState<"あり" | "なし">("なし");
  const [foreignPhotos, setForeignPhotos] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const speciesOptions = useMemo(() => {
    const base = speciesSet.length ? speciesSet : master.species;
    return qsSpecies && base.includes(qsSpecies) ? [qsSpecies, ...base.filter((b) => b !== qsSpecies)] : base;
  }, [speciesSet, master.species, qsSpecies]);

  useEffect(() => {
    let resolved = "";
    if (ticketId) {
      try {
        const raw = localStorage.getItem(LS_KEYS.INTAKE_SUBMISSIONS);
        if (raw) {
          const arr: Ticket[] = JSON.parse(raw);
          const matched = arr.find((t) => t.ticketId === ticketId);
          if (matched?.species) resolved = matched.species;
        }
      } catch {}
    }
    if (!resolved && qsSpecies) {
      resolved = qsSpecies;
    }
    if (resolved) {
      if (resolved !== fixedSpecies) {
        setFixedSpecies(resolved);
        setSpecies(resolved);
      }
    } else if (fixedSpecies) {
      setFixedSpecies(null);
      setSpecies("");
    }
  }, [ticketId, qsSpecies, fixedSpecies]);

  useEffect(() => {
    if (!fixedSpecies && !species && speciesOptions.length) {
      setSpecies(speciesOptions[0]);
    }
  }, [speciesOptions, fixedSpecies, species]);

  useEffect(() => {
    if (master.factory.length) setFactory((prev) => prev || master.factory[0]);
    if (master.person.length) setPerson((prev) => prev || master.person[0]);
  }, [master]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErr(null);
    setIsSubmitting(true);

    if (parasiteYN === "あり" && parasitePhotos.length === 0) {
      setErr("寄生虫=あり の場合は写真が1枚以上必須です");
      setIsSubmitting(false);
      return;
    }
    if (foreignYN === "あり" && foreignPhotos.length === 0) {
      setErr("異物=あり の場合は写真が1枚以上必須です");
      setIsSubmitting(false);
      return;
    }
    if (depletion === "次の日に残した" && !leftoverKg) {
      setErr("翌日に残したkgを入力してください");
      setIsSubmitting(false);
      return;
    }

    const speciesForSubmit = fixedSpecies ?? species;
    const speciesSeg = (speciesForSubmit || "").replace(/\s+/g, "");

    // kg は「翌日に残したkg」を流用。使い切った場合は 0
    const kgValue =
      depletion === "次の日に残した"
        ? (leftoverKg ? Number(leftoverKg) : 0)
        : 0;

    const payload: Report = {
      ticketId,
      factory,
      date,
      person,
      purchaseDate,
      species: speciesForSubmit,
      origin,
      state,
      kg: kgValue,
      depletion,
      leftoverKg: kgValue,
    };
    try {
      const raw = localStorage.getItem(LS_KEYS.INVENTORY_REPORTS);
      const arr: Report[] = raw ? JSON.parse(raw) : [];
      const idx = ticketId ? arr.findIndex((r) => r.ticketId === ticketId) : -1;
      if (idx >= 0) arr[idx] = payload; else arr.push(payload);
      localStorage.setItem(LS_KEYS.INVENTORY_REPORTS, JSON.stringify(arr));

      const prefixPara = `寄生虫_${speciesSeg}_${yyyymmdd(date)}_${person}`;
      const prefixForeign = `異物_${speciesSeg}_${yyyymmdd(date)}_${person}`;
      const parasiteUrls = await uploadPhotos(parasitePhotos, prefixPara, DRIVE_FOLDER_ID_PHOTOS);
      const foreignUrls  = await uploadPhotos(foreignPhotos,  prefixForeign, DRIVE_FOLDER_ID_PHOTOS);

      await recordToSheet("inventory", {
        ...payload,
        parasiteYN,  parasiteFiles: parasiteUrls,
        foreignYN,   foreignFiles:  foreignUrls,
      });

      setPreviewOpen(true);
    } catch {
      setErr("保存に失敗しました");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-sky-50 to-white">
      <div className="max-w-5xl mx-auto p-4">
        <div className="mb-4 p-4 rounded-3xl bg-white ring-1 ring-sky-100 shadow-sm flex items中心 justify-between">
          <div>
            <h1 className="text-xl font-semibold text-sky-900">魚原料在庫報告書</h1>
            <p className="text-slate-600 text-sm">作成済みのチケットから対象魚種を選び、在庫実績を記録します。</p>
          </div>
          <Badge>✅ Reconcile</Badge>
        </div>

        {!fixedSpecies && (
          <div className="p-4 rounded-3xl bg-white ring-1 ring-sky-100 shadow-sm mb-4">
            <label className="block font-medium mb-2">未消込のチケット（魚種）</label>
            <div className="flex flex-wrap gap-2">
              {(speciesOptions.length ? speciesOptions : ["（チケット未作成）"]).map((s) => (
                <button key={s} onClick={() => setSpecies(s)} type="button" className={`px-3 py-1.5 rounded-full text-sm ring-1 transition ${species === s ? "bg-sky-600 text-white ring-sky-600" : "bg-sky-50 text-sky-700 ring-sky-200 hover:ring-sky-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Select label="工場" value={factory} onChange={setFactory} options={master.factory} />
            <DateInput label="記入日（加工日）" value={date} onChange={setDate} />
            <Select label="担当者" value={person} onChange={setPerson} options={master.person} />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <DateInput label="仕入れ日" value={purchaseDate} onChange={setPurchaseDate} />
            {fixedSpecies ? (
              <ReadOnlyField label="魚種（チケット選択）" value={fixedSpecies} />
            ) : (
              <Select label="魚種（チケット選択）" value={species} onChange={setSpecies} options={speciesOptions} />
            )}
            <Select label="産地（業者）" value={origin} onChange={setOrigin} options={master.origin} />
          </div>
          <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
            <label className="block font-medium mb-2">加工状態（該当するものを選択）</label>
            <div className="grid md:grid-cols-3 gap-2 text-sm">
              {["ラウンド", "頭落とし（腹出）", "三枚卸し", "切り身", "柵", "刺身"].map((label) => (
                <label key={label} className="flex items-center gap-2">
                  <input type="radio" name="state" checked={state === label} onChange={() => setState(label)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ▼ 目視確認（寄生虫・異物） */}
          <div className="grid md:grid-cols-2 gap-4">
            <FileGroupYNMulti labelYN="目視確認 寄生虫" yn={parasiteYN} setYN={setParasiteYN} labelFile="寄生虫の写真（ありの場合1枚以上必須）" files={parasitePhotos} setFiles={setParasitePhotos} requiredWhenYes />
            <FileGroupYNMulti labelYN="目視確認 異物" yn={foreignYN} setYN={setForeignYN} labelFile="異物の写真（ありの場合1枚以上必須）" files={foreignPhotos} setFiles={setForeignPhotos} requiredWhenYes />
          </div>

          {err && <p className="text-red-600 text-sm">{err}</p>}
          <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
            <label className="block font-medium mb-2">在庫の結果</label>
            <div className="flex items-center gap-6 text-sm mb-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={depletion === "使い切った"}
                  onChange={() => { setDepletion("使い切った"); setLeftoverKg(""); }}
                />
                使い切った
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={depletion === "次の日に残した"}
                  onChange={() => setDepletion("次の日に残した")}
                />
                次の日に残した
              </label>
            </div>

            {depletion === "次の日に残した" && (
              <div className="mt-2">
                <NumberInput
                  label="翌日に残したkg（小数1位まで）"
                  value={leftoverKg}
                  onChange={setLeftoverKg}
                  step={0.1}
                  min={0}
                />
              </div>
            )}
          </div>
          {/* kg入力欄は廃止（翌日残量をkgとして送信） */}
          <div className="flex gap-3">
            <button
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              在庫報告を登録
            </button>
            <Link to="/" className="px-5 py-2.5 rounded-full bg-white ring-1 ring-sky-200 text-sky-700 text-sm shadow-sm">ホームへ</Link>
          </div>
        </form>
      </div>

      {previewOpen && (
        <PhotosPreviewModal
          title="添付写真のプレビュー"
          parasite={parasitePhotos}
          foreign={foreignPhotos}
          onClose={() => {
            setPreviewOpen(false);
            setIsSubmitting(false);
            nav("/");
          }}
        />
      )}
    </div>
  );
}

// ------------------------ 汎用UI ------------------------
function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (v: string) => void; options: string[]; disabled?: boolean; }) {
  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <label className="block text-sm font-medium mb-1 text-slate-700">{label}</label>
      <select
        className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-50 disabled:bg-slate-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string; }) {
  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <label className="block text-sm font-medium mb-1 text-slate-700">{label}</label>
      <div className="w-full border rounded-xl px-3 py-2 text-sm bg-slate-50 text-slate-700">
        {value || ""}
      </div>
    </div>
  );
}
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void; }) {
  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <label className="block text-sm font-medium mb-1 text-slate-700">{label}</label>
      <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; }) {
  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <label className="block text-sm font-medium mb-1 text-slate-700">{label}</label>
      <input type="text" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function NumberInput({ label, value, onChange, step, min }: { label: string; value: string; onChange: (v: string) => void; step?: number; min?: number; }) {
  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <label className="block text-sm font-medium mb-1 text-slate-700">{label}</label>
      <input type="number" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" value={value} onChange={(e) => onChange(e.target.value)} step={step} min={min} />
    </div>
  );
}
function RadioYN({ label, value, onChange }: { label: string; value: "あり" | "なし"; onChange: (v: "あり" | "なし") => void; }) {
  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <label className="block text-sm font-medium mb-1 text-slate-700">{label}</label>
      <div className="flex items-center gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name={label} checked={value === "あり"} onChange={() => onChange("あり")} />あり
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={label} checked={value === "なし"} onChange={() => onChange("なし")} />なし
        </label>
      </div>
    </div>
  );
}
const FILE_GROUP_MAX = 10;

function FileGroupYNMulti({ labelYN, yn, setYN, labelFile, files, setFiles, requiredWhenYes }: { labelYN: string; yn: "あり" | "なし"; setYN: (v: "あり" | "なし") => void; labelFile: string; files: File[]; setFiles: (f: File[]) => void; requiredWhenYes?: boolean; }) {
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    const combined = [...files, ...selected];
    const next = combined.slice(0, FILE_GROUP_MAX);
    setFiles(next);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
  };

  return (
    <div className="p-4 rounded-3xl bg-white shadow-sm ring-1 ring-sky-100 grid gap-3">
      <RadioYN label={labelYN} value={yn} onChange={setYN} />
      {yn === "あり" && (
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium mb-1 text-slate-700">{labelFile}</label>
            <span className="text-xs text-slate-500">{files.length}/{FILE_GROUP_MAX}</span>
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="w-full border rounded-xl px-3 py-2 text-sm"
            onChange={handleFilesChange}
            disabled={files.length >= FILE_GROUP_MAX}
          />
          {requiredWhenYes && files.length === 0 && (
            <p className="text-xs text-red-600 mt-1">ありの場合は写真が1枚以上必須です</p>
          )}
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="relative h-16 w-16">
                  <img src={URL.createObjectURL(f)} alt="preview" className="h-16 w-16 object-cover rounded-md ring-1 ring-sky-200" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center shadow"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PhotosPreviewModal({ title, parasite, foreign, onClose }: { title: string; parasite: File[]; foreign: File[]; onClose: () => void; }) {
  const [closing, setClosing] = useState(false);
  const handle = () => {
    if (closing) return;
    setClosing(true);
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl p-6 w-[min(720px,95vw)] max-h-[90vh] overflow-auto ring-1 ring-sky-100 shadow-xl">
        <h3 className="text-lg font-semibold text-sky-900 mb-3">{title}</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">寄生虫</h4>
            {parasite.length === 0 ? (
              <p className="text-sm text-slate-500">添付なし</p>
            ) : (
              <div className="flex flex-wrap gap-2">{parasite.map((f, i) => (<img key={i} src={URL.createObjectURL(f)} alt="parasite" className="h-24 w-24 object-cover rounded-md ring-1 ring-sky-200" />))}</div>
            )}
          </div>
          <div>
            <h4 className="font-medium mb-2">異物</h4>
            {foreign.length === 0 ? (
              <p className="text-sm text-slate-500">添付なし</p>
            ) : (
              <div className="flex flex-wrap gap-2">{foreign.map((f, i) => (<img key={i} src={URL.createObjectURL(f)} alt="foreign" className="h-24 w-24 object-cover rounded-md ring-1 ring-sky-200" />))}</div>
            )}
          </div>
        </div>
        <div className="mt-4 text-right">
          <button
            onClick={handle}
            disabled={closing}
            className="px-5 py-2.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { master, reload, loading, error } = useMasterOptions();
  const { speciesSet, add, clear } = useSpeciesSet();
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home onReloadMaster={reload} masterLoading={loading} masterError={error} />} />
        <Route path="/intake" element={<IntakePage master={master} onSubmitted={() => {}} addSpecies={add} />} />
        <Route path="/inventory" element={<InventoryPage master={master} speciesSet={speciesSet} />} />
      </Routes>
      <footer className="max-w-5xl mx-auto px-4 py-6 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span>© 魚日報デモ</span>
          <button className="underline" onClick={clear}>ローカルの魚種履歴をクリア</button>
        </div>
      </footer>
    </Router>
  );
}
