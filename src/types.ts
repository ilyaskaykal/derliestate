export interface Kullanici {
  id: string;
  username: string;
  sifre?: string;
  sifre_hashed?: boolean;
  ad: string;
  soyad: string;
  rol: 'admin' | 'yonetici' | 'kıdemli_danisan' | 'danisan' | 'musteri' | 'misafir';
  ilk_giris: boolean;
  telefon?: string;
  foto_url?: string | null;
  created_at: string;
}

export interface Musteri {
  id: string;
  ad: string;
  soyad: string;
  telefon: string;
  email: string;
  muhit: string;
  butce: string;
  butce_min: string;
  butce_max: string;
  para_birimi?: string;
  bolge_esnek: boolean;
  olmaz_olmaz: string;
  kesin_istekler: string;
  aciklama: string;
  danisman: string;
  portfoy_tercihi: string;
  durum: MusteriDurum;
  kaynak: string;
  notlar: string;
  eklendi_user_id?: string;
  eklendi_user_ad?: string;
  denize_yakin?: boolean;
  deniz_manzarasi?: boolean;
  tags?: string[];
  last_contact?: string | null;
  created_at: string;
  // Foreign customer fields
  yabanci_musteri?: boolean;
  uyruk?: string;
  pasaport_no?: string;
  dil_tercihi?: string;
  turkiye_kalis_suresi?: string;
  vatandaslik_durumu?: string;
  // Feature fields
  kisilik_analizi?: Record<string, unknown> | null;
  microsite_token?: string | null;
  microsite_aktif?: boolean;
}

export type MusteriDurum = 'sicak' | 'satin_alacak' | 'dusunuyor' | 'kararsiz' | 'gelmedi' | 'soguk';

export type EidsStatus = 'yok' | 'beklemede' | 'aktif' | 'suresi_doldu' | 'iptal_edildi' | 'yabanci_malik' | 'tapusuz';

export interface Portfoy {
  id: string;
  isim: string;
  sahip_ad: string;
  sahip_soyad: string;
  tc: string;
  sahip_tel: string;
  il: string;
  ilce: string;
  mahalle: string;
  bolge: string;
  ada: string;
  parsel: string;
  fiyat: string;
  para_birimi?: string;
  tip: PortfoyTip;
  oda: string;
  metrekare: string;
  durum_bina: string;
  kat: string;
  isitma: string;
  portfoy_durum: PortfoyDurum;
  baska_emlakci: boolean;
  ilan_no: string;
  ilan_portal: string;
  aciklama: string;
  kapak_foto: string;
  anahtar_nerede: string;
  danisman: string;
  eklendi_user_id?: string;
  eklendi_user_ad?: string;
  ilan_url?: string;
  denize_yakin?: boolean;
  deniz_manzarasi?: boolean;
  fotograflar?: { url: string; sira: number }[];
  created_at: string;
  // EİDS fields
  eids_status?: EidsStatus;
  eids_tasinmaz_no?: string;
  eids_yetki_baslangic?: string;
  eids_yetki_bitis?: string;
  eids_yetki_belge_no?: string;
  eids_notlar?: string;
  eids_son_hatirlatma?: string;
  eids_yetkili_kisi?: string;
}

export type PortfoyTip = 'daire' | 'villa' | 'ticari' | 'arsa';
export type PortfoyDurum = 'olumlu' | 'kararsiz' | 'olumsuz';

export interface Randevu {
  id: string;
  musteri_id: string | null;
  tarih: string;
  saat: string;
  konu: string;
  durum: RandevuDurum;
  created_at: string;
  musteri?: Musteri;
}

export type RandevuDurum = 'bekliyor' | 'tamamlandi' | 'iptal';

export interface Mesaj {
  id: string;
  kullanici_id: string;
  kullanici_adi: string;
  mesaj: string;
  mentionler: MentionItem[] | null;
  tip: 'text' | 'voice';
  ses_url: string | null;
  sure: number | null;
  created_at: string;
}

export interface MentionItem {
  type: 'musteri' | 'portfoy' | 'instagram';
  id: string;
  label: string;          // display text (ada/parsel for portfoy/instagram, name for musteri)
  adaParsel?: string;     // "4234/5" for portfoy/instagram mentions
  portfoyIsim?: string;   // property title shown in bubble
  portfoyFiyat?: string;
  portfoyBolge?: string;
  instagramUrl?: string;  // original instagram post URL
  instagramFoto?: string; // thumbnail
}

export interface DegisiklikGecmisi {
  id: string;
  kayit_id: string;
  kayit_turu: string;
  alan: string;
  eski_deger: string;
  yeni_deger: string;
  degistiren: string;
  created_at: string;
}

export type KullaniciRol = Kullanici['rol'];

export const ROL_LABELS: Record<KullaniciRol, string> = {
  admin: 'Admin',
  yonetici: 'Yönetici',
  kıdemli_danisan: 'Kıdemli Danışman',
  danisan: 'Danışman',
  musteri: 'Müşteri',
  misafir: 'Misafir',
};

export function isAdminLevel(rol: KullaniciRol | undefined | null): boolean {
  return rol === 'admin' || rol === 'yonetici';
}

export function isStaff(rol: KullaniciRol | undefined | null): boolean {
  return rol === 'admin' || rol === 'yonetici' || rol === 'kıdemli_danisan' || rol === 'danisan';
}

/** True for read-only limited-access roles (misafir, musteri) */
export function isGuest(rol: KullaniciRol | undefined | null): boolean {
  return rol === 'misafir' || rol === 'musteri';
}

export const CESME_BOLGELERI = [
  'Çeşme Merkez',
  'Alaçatı',
  'Ilıca',
  'Çiftlikköy',
  'Ovacık',
  'Dalyan',
  'Boyalık',
  'Reisdere',
  'Zeytineli',
  'Altınkum',
  'Şifne',
  'Çark',
  'Paşalimanı',
] as const;

export type CesmeBolgesi = typeof CESME_BOLGELERI[number];

export interface TapuSorgulama {
  id: string;
  ada: string | null;
  parsel: string | null;
  il: string | null;
  ilce: string | null;
  mahalle: string | null;
  tapu_alani: string | null;
  sahibinden_url: string | null;
  isim1: string | null;
  isim2: string | null;
  isim3: string | null;
  isim4: string | null;
  telefon1: string | null;
  telefon2: string | null;
  telefon3: string | null;
  telefon4: string | null;
  istenen_tarih: string | null;
  bilgi_geldi: boolean;
  arandi: boolean;
  aranma_tarihi: string | null;
  durum: string;
  notlar: string | null;
  danisman: string | null;
  eklendi_user_id: string | null;
  created_at: string;
}

export interface InstagramIlan {
  id: string;
  url: string;
  baslik: string | null;
  fiyat: string | null;
  bolge: string | null;
  aciklama: string | null;
  foto_url: string | null;
  ada: string | null;
  parsel: string | null;
  eklendi_user_id: string | null;
  eklendi_user_ad: string | null;
  created_at: string;
}

export type GorevOncelik = 'dusuk' | 'orta' | 'yuksek' | 'acil';
export type GorevDurum = 'bekliyor' | 'devam' | 'tamamlandi';

export interface Gorev {
  id: string;
  baslik: string;
  aciklama: string | null;
  son_tarih: string | null;
  saat: string | null;
  oncelik: GorevOncelik;
  durum: GorevDurum;
  musteri_id: string | null;
  portfoy_id: string | null;
  atanan_user: string | null;
  olusturan_user: string | null;
  created_at: string;
}

export interface EslestirmeGecmisi {
  id: string;
  musteri_id: string | null;
  portfoy_id: string | null;
  musteri_ad: string | null;
  portfoy_baslik: string | null;
  gosterildi_tarihi: string;
  sonuc: 'olumlu' | 'olumsuz' | 'dusunuyor' | 'bekliyor';
  notlar: string | null;
  takip_tarihi: string | null;
  danisman: string | null;
  created_at: string;
}

export interface Belge {
  id: string;
  baslik: string | null;
  tur: string | null;
  musteri_id: string | null;
  portfoy_id: string | null;
  dosya_url: string | null;
  imza_tarihi: string | null;
  gecerlilik_tarihi: string | null;
  notlar: string | null;
  yuklendi_user: string | null;
  created_at: string;
}
