import { useState, useEffect } from 'react';
import { Plus, Search, X, Edit2, Trash2, Calendar, Clock, MapPin, User, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isAdminLevel } from '../types';
import type { Randevu } from '../types';

const DURUM_OPTIONS = ['bekliyor', 'tamamlandi', 'iptal', 'ertelendi'];
const TUR_OPTIONS = ['portfoy_gosterimi', 'musteri_gorusmesi', 'sozlesme', 'teslim', 'diger'];

const EMPTY_FORM = {
  musteri_adi: '', musteri_telefon: '', konu: '', tarih: '', saat: '',
  konum: '', notlar: '', durum: 'bekliyor', tur: 'portfoy_gosterimi',
  portfoy_id: '', musteri_id: '',
};

const DURUM_COLORS: Record<string, string> = {
  bekliyor: '#D97706',
  tamamlandi: '#059669',
  iptal: '#DC2626',
  ertelendi: '#6B7280',
};

export default function Appointments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Randevu[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [durumFilter, setDurumFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Randevu | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('randevular').select('*').order('tarih', { ascending: true }).order('saat', { ascending: true });
    setAppointments(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = appointments.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.konu?.toLowerCase().includes(q) || a.musteri_adi?.toLowerCase().includes(q) || a.konum?.toLowerCase().includes(q);
    const matchDurum = !durumFilter || a.durum === durumFilter;
    return matchSearch && matchDurum;
  });

  const openAdd = (date?: string) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, tarih: date || new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };
  const openEdit = (a: Randevu) => {
    setEditing(a);
    setForm({ musteri_adi: a.musteri_adi || '', musteri_telefon: a.musteri_telefon || '', konu: a.konu || '', tarih: a.tarih || '', saat: a.saat || '', konum: a.konum || '', notlar: a.notlar || '', durum: a.durum || 'bekliyor', tur: a.tur || 'portfoy_gosterimi', portfoy_id: a.portfoy_id || '', musteri_id: a.musteri_id || '' });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.konu.trim() || !form.tarih || !form.saat) { toast('Konu, tarih ve saat zorunludur.', 'error'); return; }
    setSaving(true);
    const payload = { ...form, danismanid: user?.id };
    if (editing) {
      const { error } = await supabase.from('randevular').update(payload).eq('id', editing.id);
      if (error) toast(error.message, 'error');
      else { toast('Randevu güncellendi.', 'success'); setShowModal(false); load(); }
    } else {
      const { error } = await supabase.from('randevular').insert(payload);
      if (error) toast(error.message, 'error');
      else { toast('Randevu eklendi.', 'success'); setShowModal(false); load(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('randevular').delete().eq('id', deleteId);
    if (error) toast(error.message, 'error');
    else { toast('Randevu silindi.', 'success'); load(); }
    setDeleteId(null);
  };

  const updateStatus = async (id: string, durum: string) => {
    const { error } = await supabase.from('randevular').update({ durum }).eq('id', id);
    if (error) toast(error.message, 'error');
    else load();
  };

  // Calendar helpers
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const appointmentsByDate: Record<string, Randevu[]> = {};
  appointments.forEach(a => {
    if (!appointmentsByDate[a.tarih]) appointmentsByDate[a.tarih] = [];
    appointmentsByDate[a.tarih].push(a);
  });

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A18' }}>Randevular</h1>
          <p style={{ color: '#8B7355', fontSize: 13 }}>{appointments.length} randevu</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', background: '#F5F0E8', borderRadius: 8, overflow: 'hidden' }}>
            <button onClick={() => setView('list')} style={{ padding: '7px 14px', border: 'none', background: view === 'list' ? '#1A1A18' : 'transparent', color: view === 'list' ? '#fff' : '#8B7355', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Liste</button>
            <button onClick={() => setView('calendar')} style={{ padding: '7px 14px', border: 'none', background: view === 'calendar' ? '#1A1A18' : 'transparent', color: view === 'calendar' ? '#fff' : '#8B7355', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Takvim</button>
          </div>
          <button onClick={() => openAdd()} className="btn-gold"><Plus size={15} /> Yeni Randevu</button>
        </div>
      </div>

      {view === 'list' ? (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <div className="search-box" style={{ flex: 1, minWidth: 200 }}>
              <Search size={14} color="#8B7355" />
              <input placeholder="Randevu ara..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
              {search && <button onClick={() => setSearch('')}><X size={12} color="#8B7355" /></button>}
            </div>
            <select value={durumFilter} onChange={e => setDurumFilter(e.target.value)} className="input" style={{ width: 150 }}>
              <option value="">Tüm Durumlar</option>
              {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" color="#D4AF37" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#8B7355' }}>
              <Calendar size={40} color="#D4C9B8" style={{ margin: '0 auto 12px' }} />
              <p>Randevu bulunamadı</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(a => (
                <div key={a.id} style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  {/* Date block */}
                  <div style={{ width: 52, height: 52, background: a.tarih === today ? '#1A1A18' : '#FAF6EF', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: a.tarih === today ? 'none' : '1px solid #F0E8D8' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: a.tarih === today ? '#D4AF37' : '#1A1A18', lineHeight: 1 }}>{new Date(a.tarih + 'T00:00:00').getDate()}</span>
                    <span style={{ fontSize: 9, color: a.tarih === today ? 'rgba(255,255,255,0.7)' : '#8B7355', textTransform: 'uppercase' }}>{new Date(a.tarih + 'T00:00:00').toLocaleDateString('tr-TR', { month: 'short' })}</span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1A1A18', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.konu}</h3>
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: DURUM_COLORS[a.durum] + '20', color: DURUM_COLORS[a.durum], flexShrink: 0 }}>{a.durum}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#8B7355', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{a.saat}</span>
                      {a.musteri_adi && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={11} />{a.musteri_adi}</span>}
                      {a.konum && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{a.konum}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {a.durum === 'bekliyor' && (
                      <button onClick={() => updateStatus(a.id, 'tamamlandi')} style={{ padding: '5px 10px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✓</button>
                    )}
                    <button onClick={() => openEdit(a)} className="btn-ghost" style={{ padding: '6px 8px' }}><Edit2 size={13} /></button>
                    {isAdminLevel(user?.rol) && <button onClick={() => setDeleteId(a.id)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #FFD0CC', background: 'transparent', color: '#FF3B2F', cursor: 'pointer' }}><Trash2 size={13} /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Calendar view */
        <div style={{ background: '#fff', border: '1px solid #F0E8D8', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0E8D8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setCalendarDate(new Date(calYear, calMonth - 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ChevronLeft size={18} color="#1A1A18" /></button>
            <h3 style={{ fontWeight: 700, color: '#1A1A18' }}>{calendarDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</h3>
            <button onClick={() => setCalendarDate(new Date(calYear, calMonth + 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><ChevronRight size={18} color="#1A1A18" /></button>
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#8B7355', padding: 4 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {Array.from({ length: (firstDay === 0 ? 6 : firstDay - 1) }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayAppts = appointmentsByDate[dateStr] || [];
                const isToday = dateStr === today;
                return (
                  <div
                    key={dayNum}
                    onClick={() => dayAppts.length > 0 ? null : openAdd(dateStr)}
                    style={{ minHeight: 60, padding: 4, borderRadius: 6, border: isToday ? '2px solid #D4AF37' : '1px solid #F0E8D8', background: isToday ? '#FFF8E1' : '#fff', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!isToday) (e.currentTarget.style.background = '#FAF6EF'); }}
                    onMouseLeave={e => { if (!isToday) (e.currentTarget.style.background = '#fff'); }}
                  >
                    <div style={{ fontSize: 12, fontWeight: isToday ? 900 : 600, color: isToday ? '#D4AF37' : '#1A1A18', marginBottom: 2 }}>{dayNum}</div>
                    {dayAppts.slice(0, 2).map(a => (
                      <div key={a.id} onClick={e => { e.stopPropagation(); openEdit(a); }} style={{ fontSize: 9, background: DURUM_COLORS[a.durum] + '20', color: DURUM_COLORS[a.durum], borderRadius: 3, padding: '1px 3px', marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}>
                        {a.saat} {a.konu}
                      </div>
                    ))}
                    {dayAppts.length > 2 && <div style={{ fontSize: 9, color: '#8B7355' }}>+{dayAppts.length - 2} daha</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #F6D9A8' }}>
              <h2 className="font-bold" style={{ color: '#1A1A18' }}>{editing ? 'Randevu Düzenle' : 'Yeni Randevu'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body p-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="label">Konu *</label>
                  <input value={form.konu} onChange={e => setForm(f => ({ ...f, konu: e.target.value }))} className="input" required placeholder="ör. Villa Gösterimi" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Tarih *</label>
                    <input type="date" value={form.tarih} onChange={e => setForm(f => ({ ...f, tarih: e.target.value }))} className="input" required />
                  </div>
                  <div>
                    <label className="label">Saat *</label>
                    <input type="time" value={form.saat} onChange={e => setForm(f => ({ ...f, saat: e.target.value }))} className="input" required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Müşteri Adı</label>
                    <input value={form.musteri_adi} onChange={e => setForm(f => ({ ...f, musteri_adi: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="label">Müşteri Telefon</label>
                    <input value={form.musteri_telefon} onChange={e => setForm(f => ({ ...f, musteri_telefon: e.target.value }))} className="input" placeholder="+90 532 xxx xxxx" />
                  </div>
                </div>
                <div>
                  <label className="label">Konum</label>
                  <input value={form.konum} onChange={e => setForm(f => ({ ...f, konum: e.target.value }))} className="input" placeholder="ör. Çeşme Marina" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="label">Tür</label>
                    <select value={form.tur} onChange={e => setForm(f => ({ ...f, tur: e.target.value }))} className="input">
                      {TUR_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Durum</label>
                    <select value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))} className="input">
                      {DURUM_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Notlar</label>
                  <textarea value={form.notlar} onChange={e => setForm(f => ({ ...f, notlar: e.target.value }))} className="input" rows={2} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="submit" className="btn-gold flex-1 justify-center" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : (editing ? 'Güncelle' : 'Kaydet')}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 360 }}>
            <div className="p-6 text-center">
              <Trash2 size={32} color="#FF3B2F" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontWeight: 700, fontSize: 16, color: '#1A1A18', marginBottom: 8 }}>Randevuyu Sil</h3>
              <p style={{ color: '#8B7355', fontSize: 13, marginBottom: 20 }}>Bu randevu kalıcı olarak silinecek.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleDelete} style={{ flex: 1, padding: '9px', background: '#FF3B2F', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Sil</button>
                <button onClick={() => setDeleteId(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
