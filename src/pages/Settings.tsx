import { useState, useEffect, useRef } from 'react';
import { Save, Key, Database, Download, RefreshCw, Loader2, Eye, EyeOff, Image, X, Bell, Share2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { getClaudeApiKey, saveClaudeApiKey } from '../lib/claude';

export default function Settings() {
  const { toast } = useToast();
  const { effectiveUser } = useAuth();
  const isAdmin = effectiveUser?.rol === 'admin' || effectiveUser?.rol === 'yonetici';
  const [claudeKey, setClaudeKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getClaudeApiKey().then(k => { if (k) setClaudeKey(k); });
    supabase.from('app_config').select('value').eq('key', 'anasayfa_kapak').maybeSingle()
      .then(({ data }) => { if (data?.value) setCoverUrl(data.value); });
  }, []);

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast('Lütfen bir resim dosyası seçin.', 'error'); return; }
    setCoverUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `cover.${ext}`;
      const { error: upErr } = await supabase.storage.from('anasayfa').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('anasayfa').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('app_config').upsert({ key: 'anasayfa_kapak', value: url, updated_at: new Date().toISOString() });
      setCoverUrl(url);
      toast('Kapak fotoğrafı güncellendi.');
    } catch (err) {
      toast('Yükleme başarısız: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
    setCoverUploading(false);
  };

  const removeCover = async () => {
    await supabase.from('app_config').delete().eq('key', 'anasayfa_kapak');
    setCoverUrl(null);
    toast('Kapak fotoğrafı kaldırıldı.');
  };

  const saveKeys = async () => {
    await saveClaudeApiKey(claudeKey);
    toast('Ayarlar kaydedildi.');
  };

  const loadDemo = async () => {
    setDemoLoading(true);
    try {
      const musteriler = [
        { ad: 'Ahmet', soyad: 'Yılmaz', telefon: '0532 111 2233', email: 'ahmet@example.com', muhit: 'Kadıköy', butce: '3.500.000 TL', portfoy_tercihi: '3+1 Daire', durum: 'sicak', kaynak: 'Instagram', notlar: 'Acil arıyor, 2 ay içinde almak istiyor.' },
        { ad: 'Fatma', soyad: 'Kaya', telefon: '0541 222 3344', email: 'fatma@example.com', muhit: 'Beşiktaş', butce: '5.000.000 TL', portfoy_tercihi: 'Villa ya da Geniş Daire', durum: 'satin_alacak', kaynak: 'Referans', notlar: 'Eşiyle birlikte geliyor, ev bakmak istiyorlar.' },
        { ad: 'Mehmet', soyad: 'Demir', telefon: '0555 333 4455', email: '', muhit: 'Şişli', butce: '2.000.000 TL', portfoy_tercihi: '2+1 Daire', durum: 'dusunuyor', kaynak: 'Sahibinden.com', notlar: '' },
        { ad: 'Ayşe', soyad: 'Çelik', telefon: '0543 444 5566', email: 'ayse@example.com', muhit: 'Ataşehir', butce: '4.200.000 TL', portfoy_tercihi: '4+1 veya Villa', durum: 'kararsiz', kaynak: 'Google', notlar: 'Bütçe konusunda kararsız.' },
        { ad: 'Can', soyad: 'Arslan', telefon: '0533 555 6677', email: '', muhit: 'Ümraniye', butce: '1.800.000 TL', portfoy_tercihi: '2+1', durum: 'gelmedi', kaynak: 'Kapıdan', notlar: 'Randevuya gelmedi.' },
        { ad: 'Zeynep', soyad: 'Özkan', telefon: '0546 666 7788', email: 'zeynep@example.com', muhit: 'Maltepe', butce: '2.800.000 TL', portfoy_tercihi: '3+1 Daire', durum: 'soguk', kaynak: 'Sosyal Medya', notlar: 'Çok geç dönüyor.' },
      ];
      const portfoyler = [
        { isim: 'Kadıköy Merkez 3+1 Lüks Daire', sahip_ad: 'Hasan', sahip_soyad: 'Koç', tc: '12345678901', sahip_tel: '0532 100 2000', il: 'İstanbul', ilce: 'Kadıköy', mahalle: 'Moda', ada: '1234', parsel: '56', fiyat: '4.500.000 TL', tip: 'daire', oda: '3+1', metrekare: '145', durum_bina: '5 Yıl', kat: '4. Kat', isitma: 'Doğalgaz Kombi', portfoy_durum: 'olumlu', baska_emlakci: false, ilan_no: '', ilan_portal: '', aciklama: 'Deniz manzaralı, ebeveyn banyolu.' },
        { isim: 'Beşiktaş Çırağan Villa', sahip_ad: 'Seda', sahip_soyad: 'Yıldız', tc: '98765432101', sahip_tel: '0541 200 3000', il: 'İstanbul', ilce: 'Beşiktaş', mahalle: 'Çırağan', ada: '5678', parsel: '12', fiyat: '12.000.000 TL', tip: 'villa', oda: '5+2', metrekare: '380', durum_bina: 'Sıfır', kat: 'Müstakil', isitma: 'Yerden Isıtma', portfoy_durum: 'olumlu', baska_emlakci: true, ilan_no: 'SH123456', ilan_portal: 'Sahibinden', aciklama: 'Boğaz manzaralı, özel havuzlu.' },
        { isim: 'Şişli 2+1 Yatırımlık Daire', sahip_ad: 'Kadir', sahip_soyad: 'Uzun', tc: '', sahip_tel: '0553 300 4000', il: 'İstanbul', ilce: 'Şişli', mahalle: 'Mecidiyeköy', ada: '', parsel: '', fiyat: '2.200.000 TL', tip: 'daire', oda: '2+1', metrekare: '85', durum_bina: '10 Yıl', kat: '7. Kat', isitma: 'Doğalgaz Merkezi', portfoy_durum: 'kararsiz', baska_emlakci: false, ilan_no: '', ilan_portal: '', aciklama: '' },
        { isim: 'Ataşehir Ticari Ofis Katı', sahip_ad: 'Nilüfer', sahip_soyad: 'Şahin', tc: '', sahip_tel: '0543 400 5000', il: 'İstanbul', ilce: 'Ataşehir', mahalle: 'İçerenköy', ada: '', parsel: '', fiyat: '8.500.000 TL', tip: 'ticari', oda: 'Diğer', metrekare: '320', durum_bina: '2 Yıl', kat: '12. Kat', isitma: 'Klima', portfoy_durum: 'olumlu', baska_emlakci: false, ilan_no: '', ilan_portal: '', aciklama: 'A blok köşe dairesi, 2 ayrı ofis açık plan.' },
        { isim: 'Maltepe Arsa 500m²', sahip_ad: 'Bülent', sahip_soyad: 'Aydın', tc: '', sahip_tel: '0535 500 6000', il: 'İstanbul', ilce: 'Maltepe', mahalle: 'Bağlarbaşı', ada: '9900', parsel: '34', fiyat: '3.200.000 TL', tip: 'arsa', oda: '', metrekare: '500', durum_bina: '', kat: '', isitma: '', portfoy_durum: 'olumsuz', baska_emlakci: false, ilan_no: '', ilan_portal: '', aciklama: 'İmar durumu araştırılıyor.' },
      ];
      const randevular = [
        { tarih: new Date().toISOString().slice(0, 10), saat: '10:00', konu: 'Kadıköy daire gösterimi', durum: 'bekliyor' },
        { tarih: new Date().toISOString().slice(0, 10), saat: '14:30', konu: 'Beşiktaş villa turu', durum: 'bekliyor' },
        { tarih: new Date(Date.now() - 86400000).toISOString().slice(0, 10), saat: '11:00', konu: 'Şişli ofis görüşmesi', durum: 'tamamlandi' },
      ];

      await Promise.all([
        supabase.from('musteriler').insert(musteriler),
        supabase.from('portfoyler').insert(portfoyler),
        supabase.from('randevular').insert(randevular),
      ]);
      toast('Demo veriler yüklendi!');
    } catch {
      toast('Demo veri yüklenirken hata oluştu.', 'error');
    }
    setDemoLoading(false);
  };

  const exportAll = async () => {
    setLoading(true);
    try {
      const [m, p, r] = await Promise.all([
        supabase.from('musteriler').select('*'),
        supabase.from('portfoyler').select('*'),
        supabase.from('randevular').select('*'),
      ]);
      const data = { musteriler: m.data, portfoyler: p.data, randevular: r.data };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estateiq_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Yedek dosyası indirildi.');
    } catch {
      toast('Dışa aktarma başarısız.', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '0.5px solid #F6D9A8', background: 'white' }}>
        <h1 className="text-lg font-semibold" style={{ color: '#1A1A18' }}>Ayarlar</h1>
        <p className="text-xs mt-0.5" style={{ color: '#8B7355' }}>Uygulama yapılandırması</p>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl" style={{ background: '#FDF3E3' }}>
        <div className="space-y-6">
          {/* Supabase Config */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Database style={{ color: '#D4AF37' }} size={18} />
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Supabase Bağlantısı</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Supabase URL</label>
                <input
                  className="input font-mono text-xs"
                  value={import.meta.env.VITE_SUPABASE_URL || ''}
                  readOnly
                  placeholder="VITE_SUPABASE_URL (.env dosyasından)"
                />
              </div>
              <div>
                <label className="label">Anon Key</label>
                <input
                  className="input font-mono text-xs"
                  value={import.meta.env.VITE_SUPABASE_ANON_KEY ? '••••••••••••••••••••••••' : ''}
                  readOnly
                  placeholder="VITE_SUPABASE_ANON_KEY (.env dosyasından)"
                />
              </div>
              <p className="text-xs" style={{ color: '#8B7355' }}>Supabase yapılandırması .env dosyasından otomatik okunur.</p>
            </div>
          </div>

          {/* Anasayfa Cover Photo */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Image style={{ color: '#D4AF37' }} size={18} />
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Anasayfa Kapak Fotoğrafı</h2>
            </div>
            {coverUrl ? (
              <div className="relative mb-4 rounded-xl overflow-hidden" style={{ height: 180 }}>
                <img src={coverUrl} alt="Kapak" className="w-full h-full object-cover" />
                <button
                  onClick={removeCover}
                  className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                  style={{ background: 'rgba(26,26,24,0.85)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                className="mb-4 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                style={{ height: 120, background: 'rgba(212,175,55,0.04)', border: '2px dashed rgba(212,175,55,0.3)' }}
                onClick={() => coverInputRef.current?.click()}
              >
                <Image size={24} style={{ color: 'rgba(212,175,55,0.4)' }} />
                <p className="text-xs" style={{ color: '#8B7355' }}>Fotoğraf yüklenmedi</p>
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }}
            />
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="btn-gold"
            >
              {coverUploading ? <Loader2 className="animate-spin" size={15} /> : <Image size={15} />}
              {coverUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
            </button>
            <p className="text-xs mt-2" style={{ color: '#8B7355' }}>
              Anasayfa hero bölümünde arka plan olarak gösterilir. Önerilen: 1920×600 piksel, JPEG/PNG.
            </p>
          </div>

          {/* Claude API */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Key style={{ color: '#D4AF37' }} size={18} />
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Claude AI API Anahtarı</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">API Anahtarı (opsiyonel)</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className="input pr-10 font-mono text-xs"
                    placeholder="sk-ant-..."
                    value={claudeKey}
                    onChange={e => setClaudeKey(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#8B7355' }}>
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <p className="text-xs" style={{ color: '#8B7355' }}>Müşteri ve portföy AI analizi için Claude API anahtarı gereklidir. Anahtar tarayıcıda yerel olarak saklanır.</p>
              <button onClick={saveKeys} className="btn-gold">
                <Save size={15} />
                Kaydet
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell style={{ color: '#D4AF37' }} size={18} />
              <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Bildirimler</h2>
            </div>
            <div className="space-y-3">
              {'Notification' in window ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#1A1A18' }}>Bildirim Durumu</p>
                      <p className="text-xs mt-0.5" style={{
                        color: Notification.permission === 'granted' ? '#22A05A'
                          : Notification.permission === 'denied' ? '#ef4444'
                          : '#8B7355'
                      }}>
                        {Notification.permission === 'granted' ? 'Aktif'
                          : Notification.permission === 'denied' ? 'Engellendi — tarayici ayarlarindan acin'
                          : 'Henuz izin verilmedi'}
                      </p>
                    </div>
                    {Notification.permission === 'default' && (
                      <button
                        onClick={() => Notification.requestPermission().then(() => toast('Bildirim izni guncellendi.'))}
                        className="btn-ghost shrink-0"
                      >
                        <Bell size={14} />
                        Izin Ver
                      </button>
                    )}
                  </div>
                  {Notification.permission === 'granted' && (
                    <button
                      onClick={() => {
                        new Notification('Test Bildirimi', {
                          body: 'DerliEstate Pro bildirimleri calisiyor!',
                          icon: '/icon-192.png',
                        });
                        toast('Test bildirimi gonderildi.');
                      }}
                      className="btn-gold"
                    >
                      <Bell size={14} />
                      Test Bildirimi Gonder
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs" style={{ color: '#8B7355' }}>
                  Bu tarayici bildirimleri desteklemiyor.
                </p>
              )}
            </div>
          </div>

          {/* Data Actions */}
          <div className="card p-5">
            <h2 className="font-semibold mb-4" style={{ color: '#1A1A18' }}>Veri İşlemleri</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl rounded-lg">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A1A18' }}>Demo Veri Yükle</p>
                  <p className="text-xs" style={{ color: '#8B7355' }}>Örnek müşteri, portföy ve randevu verilerini ekler</p>
                </div>
                <button onClick={loadDemo} disabled={demoLoading} className="btn-ghost shrink-0">
                  {demoLoading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                  Yükle
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl rounded-lg">
                <div>
                  <p className="text-sm font-medium" style={{ color: '#1A1A18' }}>Tüm Verileri Dışa Aktar</p>
                  <p className="text-xs" style={{ color: '#8B7355' }}>JSON formatında tam yedek indir</p>
                </div>
                <button onClick={exportAll} disabled={loading} className="btn-gold shrink-0">
                  {loading ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
                  İndir
                </button>
              </div>
            </div>
          </div>

          {/* Facebook Lead Ads (admin only) */}
          {isAdmin && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Share2 style={{ color: '#1877F2' }} size={18} />
                <h2 className="font-semibold" style={{ color: '#1A1A18' }}>Facebook & Instagram Lead Ads</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(24,119,242,0.1)', color: '#1877F2' }}>Admin</span>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl p-4 space-y-3" style={{ background: '#F5F0E8', border: '1px solid #F6D9A8' }}>
                  <div>
                    <label className="label">Webhook URL</label>
                    <div className="flex items-center gap-2">
                      <input
                        className="input flex-1 font-mono text-xs"
                        readOnly
                        value={`${window.location.origin.includes('localhost') ? 'https://derliestate.com' : window.location.origin}/.netlify/functions/facebook-lead`}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin.includes('localhost') ? 'https://derliestate.com' : window.location.origin}/.netlify/functions/facebook-lead`);
                          toast('URL kopyalandı!');
                        }}
                        className="btn-ghost shrink-0 text-xs"
                      >
                        Kopyala
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label">Verify Token</label>
                    <input className="input font-mono text-xs" readOnly value="derli2026facebook" />
                  </div>
                </div>

                <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: 'rgba(24,119,242,0.04)', border: '1px solid rgba(24,119,242,0.15)' }}>
                  <p className="font-semibold" style={{ color: '#1877F2' }}>Kurulum Adımları</p>
                  <ol className="space-y-1.5 list-decimal list-inside text-xs" style={{ color: '#5C4A32' }}>
                    <li>Facebook Business Manager → Sayfanız → Lead Ads Form oluşturun</li>
                    <li>Webhooks bölümünden yukarıdaki URL'yi girin</li>
                    <li>Verify Token olarak <span className="font-mono font-bold">derli2026facebook</span> girin</li>
                    <li>leadgen aboneliği ekleyin</li>
                    <li>Gelen müşteriler otomatik olarak sisteme eklenir</li>
                  </ol>
                </div>

                <div className="flex gap-2 text-xs">
                  <div className="flex-1 rounded-lg p-2.5 text-center" style={{ background: 'rgba(24,119,242,0.08)', border: '1px solid rgba(24,119,242,0.2)' }}>
                    <span className="text-lg">📘</span>
                    <p style={{ color: '#1877F2' }}>Facebook Lead</p>
                  </div>
                  <div className="flex-1 rounded-lg p-2.5 text-center" style={{ background: 'rgba(131,58,180,0.08)', border: '1px solid rgba(131,58,180,0.2)' }}>
                    <span className="text-lg">📸</span>
                    <p style={{ color: '#833AB4' }}>Instagram Lead</p>
                  </div>
                  <div className="flex-1 rounded-lg p-2.5 text-center" style={{ background: 'rgba(34,160,90,0.08)', border: '1px solid rgba(34,160,90,0.2)' }}>
                    <span className="text-lg">✋</span>
                    <p style={{ color: '#22A05A' }}>Manuel Giriş</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="text-center text-xs" style={{ color: '#8B7355' }}>
            DerliEstate Pro — Profesyonel Gayrimenkul Portföy Yönetimi
          </div>
        </div>
      </div>
    </div>
  );
}
