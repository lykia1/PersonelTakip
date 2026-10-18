# Atölye Ekip — PersonelTakip

Döner Atölyesi için iOS/Android personel uygulaması ve kasa/yönetici web ekranı.

- Mobil: React Native, TypeScript, Expo SDK 57 (Expo Go client 57.0.9 ile uyumlu).
- Sunucu: Node.js 24+, Express, SQLite; kullanıcılar, mesai, fotoğraflar ve oturumlar.
- Kasa: 30 saniyede yenilenen QR. Personel: QR → 100 metre konum kontrolü → selfie → sunucuda kayıt.
- Yönetici: personel/kasa hesabı oluşturma, kayıt listesi ve yetkili fotoğraf görüntüleme.

**[Windows kurulum ve telefon bağlantısı](docs/local-setup.md)**

İlk açılışta uygulama örnek verilerle önizleme olarak çalışır. Gerçek kayıt için üstteki giriş alanından kurulmuş sunucuya bağlanın. Kurulmuş veya internette yayınlanmış bir sunucu bu depoyla otomatik oluşmaz.

## Sadece tasarımı deneme

```powershell
git clone -b codex/mobile-foundation https://github.com/lykia1/PersonelTakip.git
cd PersonelTakip/mobile
npm.cmd ci
npx.cmd expo start
```

## Kontroller

```powershell
cd server
npm.cmd ci
npm.cmd test
cd ../mobile
npm.cmd ci
npx.cmd tsc --noEmit
npm.cmd run lint
npx.cmd expo install --check
```

Kamera/GPS ve yerel ağ erişimi gerçek cihazda test edilmelidir. Vardiya, izin ve performans modülleri henüz tamamlanmadı. Fotoğraf kaydı otomatik yüz doğrulaması değildir. Gizli anahtar, şifre ve personel verilerini bu herkese açık depoya eklemeyin.
