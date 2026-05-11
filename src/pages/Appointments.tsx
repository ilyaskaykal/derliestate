import { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, Clock, User, X, Loader2, List, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Randevu, Musteri, RandevuDurum } from '../types';
import { RandevuStatusBadge } from '../components/StatusBadge';
import { useToast } from '../contexts/ToastContext';

type ViewMode = 'liste' | 'haftalik' | 'aylik';

const DURUM_COLORS: Record<RandevuDurum, string> = {
  bekliyor:   '#7F77DD',
  tamamlandi: '#22A05A',
  iptal:      '#FF3B2F',
};

const emptyForm = { musteri_id: '', tarih: '', saat: '', konu: '', durum: 'bekliyor' as RandevuDurum };

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const TR_WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const TR_MONTHS   = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

export default function Appointments() {
  const { toast } = useToast();
  const [randevular, setRandevular] = useState<Randevu[]>([]);
  const [musteriler, setMusteriler] = useState<Musteri[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState<Randevu | null>(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [saving, setSaving]         = useState(false);
  const [viewMode, setViewMode]     = useState<ViewMode>('liste');
  const [navDate, setNavDate]       = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, m] = await Promise.all([
      supabase.from('randevular').select('*').order('tarih', { ascending: false }).order('saat', { ascending: true }),
      supabase.from('musteriler').select('id, ad, soyad, telefon').order('ad'),
    ]);
    const randevuData = (r.data || []) as Randevu[];
    const musteriData = (m.data || []) as Musteri[];
    const enriched = randevuData.map(rv => ({
      ...rv,
      musteri: musteriData.find(mu => mu.id === rv.musteri_id),
    }));
    setRandevular(enriched);
    setMusteriler(musteriData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Appointment reminders (1-hour check)
  useEffect(() => {
    if (!randevular.length) return;
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    randevular.forEach(r => {
      if (r.durum !== 'bekliyor' || !r.tarih || !r.saat) return;
      const dt = new Date(`${r.tarih}T${r.saat}`);
      if (dt > now && dt <= oneHourLater) {
        toast(`1 saat sonra randevu: ${r.konu}`, 'success');
      }
    });
  // Run once on load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Grouped list
  const grouped = randevular.reduce<Record<string, Randevu[]>>((acc, r) => {
    const key = r.tarih || 'Tarih Belirtilmemiş';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return d; }
  };
  const isToday = (d: string) => {
    try { return new Date(d).toDateString() === new Date().toDateString(); } catch { return false; }
  };

  const openAdd  = (prefillDate?: string) => {
    setForm({ ...emptyForm, tarih: prefillDate || '' });
    setEditItem(null);
    setShowForm(true);
  };
  const openEdit = (r: Randevu) => {
    setForm({ musteri_id: r.musteri_id || '', tarih: r.tarih, saat: r.saat, konu: r.konu, durum: r.durum });
    setEditItem(r);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, musteri_id: form.musteri_id || null };
    if (editItem) {
      const { error } = await supabase.from('randevular').update(payload).eq('id', editItem.id);
      if (error) toast('Hata oluştu.', 'error'); else toast('Randevu güncellendi.');
    } else {
      const { error } = await supabase.from('randevular').insert(payload);
      if (error) toast('Hata oluştu.', 'error'); else toast('Randevu eklendi.');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Bu randevuyu silmek istediğinizden emin misiniz?')) return;
    await supabase.from('randevular').delete().eq('id', id);
    toast('Randevu silindi.');
    load();
  };

  const updateDurum = async (id: string, durum: RandevuDurum) => {
    await supabase.from('randevular').update({ durum }).eq('id', id);
    toast('Durum güncellendi.');
    load();
  };

  // ── Tomorrow reminder count
  const tomorrow = isoDate(addDays(new Date(), 1));
  const tomorrowCount = randevular.filter(r => r.tarih === tomorrow && r.durum === 'bekliyor').length;

  // ── Weekly calendar helpers
  const weekStart = startOfWeek(navDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const randevularByDate = (d: string) => randevular.filter(r => r.tarih === d);

  // ── Monthly calendar helpers
  const monthStart = startOfMonth(navDate);
  const monthFirstWeekday = ((monthStart.getDay() + 6) % 7); // 0=Mon
  const daysInMonth = new Date(navDate.getFullYear(), navDate.getMonth() + 1, 0).getDate();
  const calDays: (Date | null)[] = [
    ...Array(monthFirstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(navDate.getFullYear(), navDate.getMonth(), i + 1)),
  ];
  // pad to complete weeks
  while (calDays.length % 7 !== 0) calDays.push(null);

  const navigate = (dir: 1 | -1) => {
    setNavDate(d => {
      const n = new Date(d);
      if (viewMode === 'haftalik') n.setDate(n.getDate() + dir * 7);
      else n.setMonth(n.getMonth() + dir);
      return n;
    });
  };

  const buildCalendarLink = (r: Randevu) => {
    if (!r.tarih || !r.saat) return null;
    const startDt = new Date(`${r.tarih}T${r.saat}:00`);
    const endDt = new Date(startDt.getTime() + 60 * 60 * 1000); // 1 hour
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const title = encodeURIComponent(r.konu);
    const details = r.musteri ? encodeURIComponent(`Müşteri: ${r.musteri.ad} ${r.musteri.soyad}`) : '';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(startDt)}/${fmt(endDt)}&details=${details}`;
  };

  const RandevuDot = ({ r, compact = false }: { r: Randevu; compact?: boolean }) => (
    <div
      key={r.id}
      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate ${compact ? 'max-w-full' : ''}`}
      style={{ background: `${DURUM_COLORS[r.durum]}18`, color: DURUM_COLORS[r.durum], border: `1px solid ${DURUM_COLORS[r.durum]}30` }}
      title={r.konu}
    >
      {r.saat && <span className="font-mono shrink-0">{r.saat.slice(0, 5)}</span>}
      <span className="truncate">{r.konu}</span>
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ background: '#FDF3E3' }}>
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: 'white', borderBottom: '0.5px solid #F6D9A8' }}
      >
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#1A1A18', fontFamily: '"Times New Roman", Times, serif' }}>
            <Calendar size={18} style={{ color: '#D4AF37' }} />
            Randevular
          </h1>
          {tomorrowCount > 0 && (
            <span className="text-xs mt-0.5 px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(127,119,221,0.12)', color: '#7F77DD' }}>
              <Clock size={10} />Yarın {tomorrowCount} randevu
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View mode switcher */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '0.5px solid #F6D9A8' }}>
            {([
              { v: 'liste',    icon: List,     label: 'Liste' },
              { v: 'haftalik', icon: Calendar, label: 'Haftalık' },
              { v: 'aylik',    icon: Calendar, label: 'Aylık' },
            ] as { v: ViewMode; icon: React.ElementType; label: string }[]).map(({ v, icon: Icon, label }) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="flex items-center gap-1 px-3 py-2 text-xs font-medium transition-all"
                style={viewMode === v
                  ? { background: '#1A1A18', color: '#D4AF37' }
                  : { background: 'transparent', color: '#8B7355' }
                }
              >
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
          <button onClick={() => openAdd()} className="btn-gold"><Plus size={16} />Randevu Ekle</button>
        </div>
      </div>

      {/* Calendar nav (weekly/monthly) */}
      {viewMode !== 'liste' && (
        <div
          className="px-6 py-2.5 shrink-0 flex items-center justify-between"
          style={{ background: 'white', borderBottom: '0.5px solid #F6D9A8' }}
        >
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#D4AF37' }}>
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-sm" style={{ color: '#1A1A18' }}>
            {viewMode === 'haftalik'
              ? `${weekDays[0].getDate()} ${TR_MONTHS[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${TR_MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
              : `${TR_MONTHS[navDate.getMonth()]} ${navDate.getFullYear()}`
            }
          </span>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#D4AF37' }}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={20} />Yükleniyor...
          </div>
        ) : viewMode === 'liste' ? (
          /* ── Liste view ── */
          randevular.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3" style={{ color: '#8B7355' }}>
              <Calendar size={32} />
              Henüz randevu eklenmemiş.
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="px-3 py-1 rounded-lg text-sm font-medium"
                      style={isToday(date)
                        ? { background: '#1A1A18', color: '#D4AF37', border: '1px solid #D4AF37' }
                        : { background: 'white', color: '#1A1A18', border: '0.5px solid #F6D9A8' }
                      }
                    >
                      {isToday(date) ? 'Bugün' : formatDate(date)}
                    </div>
                    <div className="flex-1 h-px" style={{ background: '#D4C9B8' }} />
                    <span className="text-xs" style={{ color: '#8B7355' }}>{grouped[date].length} randevu</span>
                  </div>
                  <div className="space-y-2">
                    {grouped[date].map(r => (
                      <div
                        key={r.id}
                        className="rounded-xl p-4 flex items-center gap-4"
                        style={{ background: 'white', border: '0.5px solid #F6D9A8' }}
                      >
                        <div className="text-center w-16 shrink-0">
                          <div className="flex items-center justify-center gap-1 font-mono text-lg font-semibold" style={{ color: '#D4AF37' }}>
                            <Clock size={14} />{r.saat || '--:--'}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium" style={{ color: '#1A1A18' }}>{r.konu}</p>
                          {r.musteri && (
                            <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: '#8B7355' }}>
                              <User size={12} />{r.musteri.ad} {r.musteri.soyad}
                              {r.musteri.telefon && <span style={{ color: '#8B7355' }}>• {r.musteri.telefon}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={r.durum}
                            onChange={e => updateDurum(r.id, e.target.value as RandevuDurum)}
                            className="text-xs rounded-lg px-2 py-1 focus:outline-none"
                            style={{ background: 'white', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}
                          >
                            <option value="bekliyor">Bekliyor</option>
                            <option value="tamamlandi">Tamamlandı</option>
                            <option value="iptal">İptal</option>
                          </select>
                          <RandevuStatusBadge durum={r.durum} />
                          {buildCalendarLink(r) && (
                            <a
                              href={buildCalendarLink(r)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-all"
                              title="Google Calendar'a ekle"
                              style={{ color: '#22A05A', background: 'rgba(34,160,90,0.08)', border: '1px solid rgba(34,160,90,0.2)' }}
                            >
                              <ExternalLink size={11} />
                            </a>
                          )}
                          <button onClick={() => openEdit(r)} className="text-xs px-2 py-1 rounded-lg" style={{ color: '#1A1A18', background: 'white', border: '0.5px solid #F6D9A8' }}>Düzenle</button>
                          <button onClick={() => remove(r.id)} className="text-xs px-2 py-1 rounded-lg" style={{ color: 'white', background: '#FF3B2F' }}>Sil</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : viewMode === 'haftalik' ? (
          /* ── Haftalık view ── */
          <div className="grid grid-cols-7 gap-2 h-full">
            {weekDays.map((day, i) => {
              const d = isoDate(day);
              const dayRandevular = randevularByDate(d);
              const today = d === isoDate(new Date());
              return (
                <div
                  key={d}
                  className="flex flex-col rounded-xl overflow-hidden"
                  style={{ border: today ? '1px solid #D4AF37' : '0.5px solid #F6D9A8', minHeight: 120 }}
                >
                  <div
                    className="px-2 py-2 text-center text-xs font-semibold shrink-0"
                    style={today
                      ? { background: '#1A1A18', color: '#D4AF37' }
                      : { background: '#F5F0E8', color: '#8B7355' }
                    }
                  >
                    <div>{TR_WEEKDAYS[i]}</div>
                    <div className="text-base font-bold" style={{ color: today ? '#D4AF37' : '#1A1A18' }}>{day.getDate()}</div>
                  </div>
                  <div
                    className="flex-1 p-1.5 space-y-1 overflow-y-auto cursor-pointer"
                    style={{ background: 'white' }}
                    onClick={() => openAdd(d)}
                  >
                    {dayRandevular.map(r => (
                      <div key={r.id} onClick={e => { e.stopPropagation(); openEdit(r); }}>
                        <RandevuDot r={r} compact />
                      </div>
                    ))}
                    {dayRandevular.length === 0 && (
                      <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Plus size={14} style={{ color: '#D4AF37' }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Aylık view ── */
          <div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {TR_WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-semibold py-2" style={{ color: '#8B7355' }}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calDays.map((day, idx) => {
                if (!day) return <div key={idx} />;
                const d = isoDate(day);
                const dayRandevular = randevularByDate(d);
                const today = d === isoDate(new Date());
                const isSelected = d === selectedDay;
                return (
                  <div
                    key={d}
                    className="rounded-xl p-1.5 cursor-pointer transition-all min-h-[60px]"
                    style={{
                      background: isSelected ? '#F5F0E8' : today ? '#F5F0E8' : 'white',
                      border: today ? '1px solid #D4AF37' : isSelected ? '1px solid #F6D9A8' : '0.5px solid #F6D9A8',
                    }}
                    onClick={() => { setSelectedDay(isSelected ? null : d); }}
                  >
                    <div className="text-right mb-1">
                      <span
                        className="text-xs font-bold inline-flex items-center justify-center w-5 h-5 rounded-full"
                        style={today
                          ? { background: '#1A1A18', color: '#D4AF37' }
                          : { color: day.getMonth() === navDate.getMonth() ? '#1A1A18' : '#8B7355' }
                        }
                      >
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      {dayRandevular.slice(0, 2).map(r => (
                        <div
                          key={r.id}
                          className="rounded px-1 py-0.5 text-[9px] truncate font-medium"
                          style={{ background: `${DURUM_COLORS[r.durum]}20`, color: DURUM_COLORS[r.durum] }}
                          onClick={e => { e.stopPropagation(); openEdit(r); }}
                        >
                          {r.saat?.slice(0, 5)} {r.konu}
                        </div>
                      ))}
                      {dayRandevular.length > 2 && (
                        <div className="text-[9px] text-center" style={{ color: '#8B7355' }}>+{dayRandevular.length - 2} daha</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected day detail */}
            {selectedDay && randevularByDate(selectedDay).length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: '#D4AF37' }} />
                  <span className="text-sm font-semibold" style={{ color: '#1A1A18' }}>
                    {new Date(selectedDay).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                  <button onClick={() => openAdd(selectedDay)} className="ml-auto btn-gold text-xs py-1 px-2.5"><Plus size={12} />Ekle</button>
                </div>
                {randevularByDate(selectedDay).map(r => (
                  <div
                    key={r.id}
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'white', border: '0.5px solid #F6D9A8' }}
                  >
                    <span className="font-mono text-sm font-semibold" style={{ color: '#D4AF37' }}>{r.saat || '--:--'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: '#1A1A18' }}>{r.konu}</p>
                      {r.musteri && <p className="text-xs" style={{ color: '#8B7355' }}>{r.musteri.ad} {r.musteri.soyad}</p>}
                    </div>
                    <RandevuStatusBadge durum={r.durum} />
                    <button onClick={() => openEdit(r)} className="text-xs" style={{ color: '#8B7355' }}>Düzenle</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal-content max-w-lg" style={{ background: 'white', border: '1px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: '#F6D9A8' }}>
              <h2 className="font-semibold text-lg" style={{ color: '#1A1A18' }}>{editItem ? 'Randevu Düzenle' : 'Yeni Randevu'}</h2>
              <button onClick={() => setShowForm(false)} style={{ color: '#8B7355' }}><X size={20} /></button>
            </div>
            <form onSubmit={save} className="flex flex-col flex-1 min-h-0">
              <div className="modal-body p-5 space-y-4">
                <div>
                  <label className="label">Müşteri</label>
                  <select className="input" value={form.musteri_id} onChange={e => setForm(f => ({ ...f, musteri_id: e.target.value }))}>
                    <option value="">Müşteri seçin (opsiyonel)</option>
                    {musteriler.map(m => (
                      <option key={m.id} value={m.id}>{m.ad} {m.soyad} {m.telefon ? `— ${m.telefon}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Tarih</label>
                    <input type="date" className="input" value={form.tarih} onChange={e => setForm(f => ({ ...f, tarih: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="label">Saat</label>
                    <input type="time" className="input" value={form.saat} onChange={e => setForm(f => ({ ...f, saat: e.target.value }))} required />
                  </div>
                </div>
                <div>
                  <label className="label">Konu</label>
                  <input className="input" placeholder="Randevu konusu" value={form.konu} onChange={e => setForm(f => ({ ...f, konu: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Durum</label>
                  <select className="input" value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value as RandevuDurum }))}>
                    <option value="bekliyor">Bekliyor</option>
                    <option value="tamamlandi">Tamamlandı</option>
                    <option value="iptal">İptal</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ background: '#F5F0E8', borderTop: '1px solid #F6D9A8' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button type="submit" disabled={saving} className="btn-gold flex-1 justify-center">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : (editItem ? 'Güncelle' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
