import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Search, Download, RefreshCw, CheckSquare, Square,
  ExternalLink, MessageSquare, ChevronUp, ChevronDown, Loader2, X,
  AlertTriangle, Clock, CheckCircle, XCircle, Shield, User,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Portfoy, EidsStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  EIDS_STATUS_LABELS, eidsStatusColor, daysUntilExpiry, buildWhatsAppTemplate,
} from '../lib/eids';
import { isAdminLevel } from '../types';

type TabKey = 'aktif' | 'beklemede' | 'suresi_doldu' | 'yok' | 'muaf';

const TABS: { key: TabKey; label: string; statuses: EidsStatus[] }[] = [
  { key: 'aktif',       label: 'Aktif',         statuses: ['aktif'] },
  { key: 'beklemede',   label: 'Bekleyen',       statuses: ['beklemede'] },
  { key: 'suresi_doldu',label: 'Süresi Dolan',   statuses: ['suresi_doldu', 'iptal_edildi'] },
  { key: 'yok',         label: 'Eksik',          statuses: ['yok'] },
  { key: 'muaf',        label: 'Muaf',           statuses: ['yabanci_malik', 'tapusuz'] },
];

const ALL_STATUSES: { value: EidsStatus; label: string }[] = [
  { value: 'yok',           label: 'Yetki Yok' },
  { value: 'beklemede',     label: 'Mal Sahibinden Bekleniyor' },
  { value: 'aktif',         label: 'Aktif' },
  { value: 'suresi_doldu',  label: 'Süresi Doldu' },
  { value: 'iptal_edildi',  label: 'İptal Edildi' },
  { value: 'yabanci_malik', label: 'Yabancı Malik (Muaf)' },
  { value: 'tapusuz',       label: 'Tapusuz Mülk' },
];

export default function EidsYonetim() {
  const { effectiveUser } = useAuth();
  const { toast } = useToast();
  const isAdmin = isAdminLevel(effectiveUser?.rol);

  const [portfoyler, setPortfoyler] = useState<Portfoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('aktif');
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [belgeNo, setBelgeNo] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState<Portfoy | null>(null);
  const [modalForm, setModalForm] = useState({
    eids_status: 'yok' as EidsStatus,
    eids_tasinmaz_no: '',
    eids_yetki_baslangic: '',
    eids_yetki_bitis: '',
    eids_yetkili_kisi: '',
    eids_notlar: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase
      .from('portfoyler')
      .select('id, isim, sahip_ad, sahip_soyad, sahip_tel, bolge, ilce, mahalle, danisman, eklendi_user_id, eklendi_user_ad, eids_status, eids_tasinmaz_no, eids_yetki_baslangic, eids_yetki_bitis, eids_yetkili_kisi, eids_notlar')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query.eq('eklendi_user_id', effectiveUser?.username ?? '');
    }

    const { data } = await query;
    setPortfoyler((data || []) as Portfoy[]);
    setLoading(false);
  }, [isAdmin, effectiveUser?.username]);

  useEffect(() => {
    load();
    // Load global belge no
    supabase.from('app_config').select('value').eq('key', 'derli_yetki_belge_no').maybeSingle()
      .then(({ data }) => { if (data?.value) setBelgeNo(data.value); });
  }, [load]);

  const matchesTab = (p: Portfoy, key: TabKey): boolean => {
    const s = p.eids_status;
    switch (key) {
      case 'aktif':        return s === 'aktif';
      case 'beklemede':    return s === 'beklemede';
      case 'suresi_doldu': return s === 'suresi_doldu' || s === 'iptal_edildi';
      case 'yok':          return !s || s === 'yok';
      case 'muaf':         return s === 'yabanci_malik' || s === 'tapusuz';
    }
  };

  const filtered = portfoyler
    .filter(p => matchesTab(p, tab))
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.isim?.toLowerCase().includes(q) ||
        p.sahip_ad?.toLowerCase().includes(q) ||
        p.sahip_soyad?.toLowerCase().includes(q) ||
        p.eids_tasinmaz_no?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const da = a.eids_yetki_bitis ?? '';
      const db = b.eids_yetki_bitis ?? '';
      return sortDir === 'asc' ? da.localeCompare(db) : db.localeCompare(da);
    });

  const tabCount = (key: TabKey) => portfoyler.filter(p => matchesTab(p, key)).length;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(p => p.id)));
    }
  };

  const sendWhatsApp = (p: Portfoy) => {
    const text = buildWhatsAppTemplate(p, belgeNo, effectiveUser?.ad ?? 'Danışman');
    const tel = p.sahip_tel?.replace(/[^\d+]/g, '');
    const url = tel
      ? `https://wa.me/${tel.replace('+', '')}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const sendBulkWhatsApp = () => {
    const items = filtered.filter(p => selected.has(p.id));
    if (items.length === 0) { toast('Lütfen portföy seçin.', 'error'); return; }
    for (const p of items) sendWhatsApp(p);
  };

  const openStatusModal = (p: Portfoy) => {
    if (!isAdmin) { toast('Durum değiştirme yetkisi yok.', 'error'); return; }
    setStatusModal(p);
    setModalForm({
      eids_status: (p.eids_status ?? 'yok') as EidsStatus,
      eids_tasinmaz_no: p.eids_tasinmaz_no ?? '',
      eids_yetki_baslangic: p.eids_yetki_baslangic ?? '',
      eids_yetki_bitis: p.eids_yetki_bitis ?? '',
      eids_yetkili_kisi: p.eids_yetkili_kisi ?? '',
      eids_notlar: p.eids_notlar ?? '',
    });
  };

  const saveStatus = async () => {
    if (!statusModal) return;
    setUpdating(statusModal.id);
    const { error } = await supabase
      .from('portfoyler')
      .update(modalForm)
      .eq('id', statusModal.id);
    if (error) { toast('Hata oluştu.', 'error'); setUpdating(null); return; }
    if ((statusModal.eids_status ?? 'yok') !== modalForm.eids_status) {
      await supabase.from('eids_audit_log').insert({
        property_id: statusModal.id,
        old_status: statusModal.eids_status ?? 'yok',
        new_status: modalForm.eids_status,
        changed_by: effectiveUser?.username ?? '',
        notes: modalForm.eids_notlar || null,
      });
    }
    toast('EİDS bilgileri güncellendi.');
    setStatusModal(null);
    setUpdating(null);
    load();
  };

  const sendWhatsAppFromModal = () => {
    if (!statusModal) return;
    const text = buildWhatsAppTemplate({ ...statusModal, ...modalForm } as Portfoy, belgeNo, effectiveUser?.ad ?? 'Danışman');
    const tel = statusModal.sahip_tel?.replace(/[^\d+]/g, '');
    const url = tel
      ? `https://wa.me/${tel.replace('+', '')}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const exportCsv = () => {
    const rows = [
      ['İlan Adı', 'Mal Sahibi', 'Bölge', 'EİDS Durumu', 'Taşınmaz No', 'Yetki Başlangıç', 'Yetki Bitiş', 'Danışman'],
      ...filtered.map(p => [
        p.isim ?? '',
        `${p.sahip_ad ?? ''} ${p.sahip_soyad ?? ''}`.trim(),
        p.bolge ?? '',
        EIDS_STATUS_LABELS[p.eids_status ?? 'yok'],
        p.eids_tasinmaz_no ?? '',
        p.eids_yetki_baslangic ?? '',
        p.eids_yetki_bitis ?? '',
        p.danisman ?? '',
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'eids_rapor.csv';
    a.click();
  };

  const EidsBadge = ({ p }: { p: Portfoy }) => {
    const status = p.eids_status ?? 'yok';
    const colors = eidsStatusColor(status as EidsStatus);
    const days = status === 'aktif' ? daysUntilExpiry(p.eids_yetki_bitis) : null;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
        style={{ background: colors.bg, color: colors.text }}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colors.dot }} />
        {EIDS_STATUS_LABELS[status as EidsStatus]}
        {days !== null && days <= 30 && (
          <span className="ml-1 font-bold">({days}g)</span>
        )}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#FDF3E3' }}>
      {/* Header */}
      <div className="px-4 md:px-6 py-4 shrink-0" style={{ background: '#FDF3E3', borderBottom: '0.5px solid #F6D9A8' }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ClipboardList size={20} style={{ color: '#D4AF37' }} className="shrink-0" />
            <div>
              <h1 className="text-base md:text-lg font-semibold" style={{ color: '#1A1A18' }}>EİDS Yetki Yönetimi</h1>
              <p className="text-xs" style={{ color: '#8B7355' }}>Taşınmaz ilan yetkilendirme takibi</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selected.size > 0 && (
              <button onClick={sendBulkWhatsApp} className="text-xs px-3 flex items-center gap-1 rounded" style={{ background: 'white', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}>
                <MessageSquare size={13} />
                Toplu WA ({selected.size})
              </button>
            )}
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 flex items-center gap-1 rounded" style={{ background: 'white', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}>
              <Download size={13} />
              Excel
            </button>
            <button onClick={load} className="text-xs px-3 py-1.5 flex items-center gap-1 rounded" style={{ background: 'white', border: '0.5px solid #F6D9A8', color: '#1A1A18' }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Global belge no */}
        {isAdmin && (
          <div className="mt-3 flex items-center gap-2">
            <Shield size={12} style={{ color: '#D4AF37' }} className="shrink-0" />
            <span className="text-xs" style={{ color: '#8B7355' }}>Derli Yetki Belge No:</span>
            <input
              className="input text-xs py-1 h-7 w-40"
              value={belgeNo}
              onChange={e => setBelgeNo(e.target.value)}
              placeholder="Belge numarası"
              onBlur={async () => {
                await supabase.from('app_config').upsert({ key: 'derli_yetki_belge_no', value: belgeNo }, { onConflict: 'key' });
                toast('Belge numarası kaydedildi.');
              }}
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 overflow-x-auto" style={{ background: '#FDF3E3', borderBottom: '0.5px solid #F6D9A8' }}>
        {TABS.map(t => {
          const count = tabCount(t.key);
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
              style={isActive
                ? { background: '#1A1A18', color: '#D4AF37', borderBottom: '2px solid #D4AF37' }
                : { color: '#8B7355', borderBottom: '2px solid transparent' }}
            >
              {t.label}
              {count > 0 && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: isActive ? 'rgba(212,175,55,0.2)' : 'rgba(139,115,85,0.15)', color: isActive ? '#D4AF37' : '#8B7355' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + sort */}
      <div className="px-4 py-2.5 shrink-0 flex items-center gap-3" style={{ background: '#FDF3E3', borderBottom: '0.5px solid #F6D9A8' }}>
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8B7355' }} />
          <input
            className="input pl-8 py-1.5 text-sm h-8"
            placeholder="Ara (ilan, malik, taşınmaz no...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: '#8B7355' }}>
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded"
          style={{ color: '#8B7355' }}
        >
          Bitiş Tarihi
          {sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <span className="text-xs" style={{ color: '#8B7355' }}>{filtered.length} kayıt</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto" style={{ background: '#FDF3E3' }}>
        {loading ? (
          <div className="flex items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <Loader2 className="animate-spin mr-2" size={18} />Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40" style={{ color: '#8B7355' }}>
            <ClipboardList size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Bu kategoride portföy yok.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 z-10" style={{ background: '#1A1A18' }}>
                <tr style={{ borderBottom: '0.5px solid #F6D9A8' }}>
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll}>
                      {selected.size === filtered.length && filtered.length > 0
                        ? <CheckSquare size={14} style={{ color: '#D4AF37' }} />
                        : <Square size={14} style={{ color: '#8B7355' }} />}
                    </button>
                  </th>
                  {['İlan / Malik', 'Bölge', 'EİDS Durumu', 'Taşınmaz No', 'Bitiş', 'Danışman', 'İşlemler'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#8B7355' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const days = daysUntilExpiry(p.eids_yetki_bitis);
                  const isUrgent = days !== null && days <= 7 && p.eids_status === 'aktif';
                  return (
                    <tr
                      key={p.id}
                      className="transition-colors"
                      style={{
                        borderBottom: '0.5px solid #F6D9A8',
                        background: isUrgent ? '#FFF0EE' : undefined,
                      }}
                      onMouseEnter={e => { if (!isUrgent) (e.currentTarget as HTMLElement).style.background = '#FEF3E2'; }}
                      onMouseLeave={e => { if (!isUrgent) (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelect(p.id)}>
                          {selected.has(p.id)
                            ? <CheckSquare size={14} style={{ color: '#D4AF37' }} />
                            : <Square size={14} style={{ color: '#8B7355' }} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm truncate max-w-[200px]" style={{ color: '#1A1A18' }}>{p.isim}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>
                          <User size={9} className="inline mr-0.5" />
                          {p.sahip_ad} {p.sahip_soyad?.charAt(0)}.
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#8B7355' }}>{p.bolge || p.ilce || p.mahalle || '—'}</td>
                      <td className="px-4 py-3">
                        <EidsBadge p={p} />
                        {isUrgent && (
                          <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#FF3B2F' }}>
                            <AlertTriangle size={10} />
                            <span>Acil!</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: '#8B7355' }}>{p.eids_tasinmaz_no || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#8B7355' }}>
                        {p.eids_yetki_bitis
                          ? new Date(p.eids_yetki_bitis).toLocaleDateString('tr-TR')
                          : '—'}
                        {days !== null && (
                          <div className="text-xs mt-0.5 font-medium" style={{ color: days < 0 ? '#FF3B2F' : days <= 30 ? '#D4AF37' : '#22A05A' }}>
                            {days < 0 ? `${Math.abs(days)}g geçti` : `${days}g kaldı`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#8B7355' }}>{p.danisman || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => sendWhatsApp(p)}
                            className="p-1.5 rounded transition-colors"
                            style={{ color: '#8B7355' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#22A05A'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8B7355'; }}
                            title="WhatsApp Yetki Talimatı"
                          >
                            <MessageSquare size={13} />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => openStatusModal(p)}
                              disabled={updating === p.id}
                              className="p-1.5 rounded transition-colors"
                              style={{ color: '#8B7355' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#D4AF37'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#8B7355'; }}
                              title="Durumu Güncelle"
                            >
                              {updating === p.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <ExternalLink size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status update modal */}
      {statusModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setStatusModal(null)}>
          <div className="modal-content max-w-md w-full" style={{ background: 'white', border: '0.5px solid #F6D9A8' }}>
            <div className="flex items-center justify-between p-5 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8' }}>
              <div>
                <h2 className="font-semibold" style={{ color: '#1A1A18' }}>EİDS Bilgileri</h2>
                <p className="text-xs mt-0.5 truncate max-w-[260px]" style={{ color: '#8B7355' }}>{statusModal.isim}</p>
              </div>
              <button onClick={() => setStatusModal(null)} style={{ color: '#8B7355' }}><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
              {/* EİDS Durum */}
              <div>
                <label className="label">EİDS Durum</label>
                <select className="input" value={modalForm.eids_status} onChange={e => setModalForm(f => ({ ...f, eids_status: e.target.value as EidsStatus }))}>
                  {ALL_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Taşınmaz Numarası */}
              <div>
                <label className="label">Taşınmaz Numarası</label>
                <input
                  className="input"
                  placeholder="Mal sahibinden alınan numara"
                  value={modalForm.eids_tasinmaz_no}
                  onChange={e => setModalForm(f => ({ ...f, eids_tasinmaz_no: e.target.value }))}
                />
              </div>

              {/* Tarihler */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Alınan Tarih</label>
                  <input
                    type="date"
                    className="input"
                    value={modalForm.eids_yetki_baslangic}
                    onChange={e => setModalForm(f => ({ ...f, eids_yetki_baslangic: e.target.value }))}
                  />
                  <p className="text-xs mt-1" style={{ color: '#8B7355' }}>Yetki başlangıç tarihi</p>
                </div>
                <div>
                  <label className="label">Bitiş Tarihi</label>
                  <input
                    type="date"
                    className="input"
                    value={modalForm.eids_yetki_bitis}
                    onChange={e => setModalForm(f => ({ ...f, eids_yetki_bitis: e.target.value }))}
                  />
                  {modalForm.eids_yetki_bitis && (() => {
                    const d = daysUntilExpiry(modalForm.eids_yetki_bitis);
                    if (d === null) return null;
                    return (
                      <p className="text-xs mt-1 font-medium" style={{ color: d < 0 ? '#FF3B2F' : d <= 30 ? '#D4AF37' : '#22A05A' }}>
                        {d < 0 ? `${Math.abs(d)} gün geçti` : `${d} gün kaldı`}
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Yetkili Kişi */}
              <div>
                <label className="label">Yetkili Kişi</label>
                <select className="input" value={modalForm.eids_yetkili_kisi} onChange={e => setModalForm(f => ({ ...f, eids_yetkili_kisi: e.target.value }))}>
                  <option value="">Seçin</option>
                  <option value="Malik">Malik</option>
                  <option value="Eş">Eş</option>
                  <option value="Akraba">Akraba</option>
                  <option value="Vekil">Vekil</option>
                </select>
              </div>

              {/* Notlar */}
              <div>
                <label className="label">Notlar</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={modalForm.eids_notlar}
                  onChange={e => setModalForm(f => ({ ...f, eids_notlar: e.target.value }))}
                  placeholder="Notlar..."
                />
              </div>
            </div>
            <div className="modal-footer flex-col gap-2">
              <div className="flex gap-2 w-full">
                <button onClick={() => setStatusModal(null)} className="btn-ghost flex-1 justify-center">İptal</button>
                <button onClick={saveStatus} disabled={!!updating} className="btn-gold flex-1 justify-center">
                  {updating ? <Loader2 size={14} className="animate-spin" /> : '💾 Kaydet'}
                </button>
              </div>
              <button
                onClick={sendWhatsAppFromModal}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'white', color: '#22A05A', border: '0.5px solid #F6D9A8' }}
              >
                <MessageSquare size={14} />
                WhatsApp Gönder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
