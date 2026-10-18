# Atölye Ekip — PersonelTakip

Döner Atölyesi için iOS ve Android personel uygulaması. React Native + Expo + TypeScript.

## İlk çalıştırma (Windows)

Node.js LTS ve Git kurun. Terminalde:

```powershell
git clone https://github.com/lykia1/PersonelTakip.git
cd PersonelTakip/mobile
npm ci
npx expo start
```

Telefona bu projenin Expo SDK sürümüyle uyumlu Expo Go yükleyin. Bilgisayar ve telefon aynı ağda olsun. iPhone Kamera uygulamasıyla terminaldeki Expo QR kodunu okutun. Bu **geliştirme QR kodudur**; kasanın mesai QR koduyla aynı değildir. Expo Go sürüm uyuşmazlığı bildirirse uygulamayı çalıştırmak için uyumlu geliştirme derlemesi gerekir.

## Hazır olanlar

- Antrasit/turuncu personel arayüzü; bugün, vardiya, geçmiş, profil sekmeleri.
- Kamera izni ve QR tarama; ön planda konum izni ve GPS okuma.
- Ön kamerayla anlık fotoğraf ve fotoğraf önizleme.
- Hata/izin reddi ekranları, çift QR tarama kilidi.

## Önemli: ilk sürüm önizlemedir

Gösterilen vardiyalar ve istatistikler örnektir. Giriş, veritabanı, yönetici paneli ve kasa QR ekranı henüz yoktur. Gerçek mesai kaydı oluşturulmaz. Test için `personeltakip:test` metnini içeren QR kullanılabilir; bu biçim kontrolü güvenlik doğrulaması değildir. Konum okunur ancak dükkân koordinatları ve sunucu olmadığı için mesafe doğrulanmaz. Fotoğraf sunucuya gönderilmez; bu sürüm otomatik yüz doğrulaması yapmaz.

## Sonraki aşama

[Sunucu ve doğrulama tasarımı](docs/architecture.md). İşletmenin koordinatları, izin verilen yarıçap, vardiya kuralları ve performans ölçütleri yapılandırılmalıdır. Gizli anahtarları veya personel bilgilerini bu herkese açık depoya eklemeyin.

## Kontrol

```powershell
cd mobile
npx tsc --noEmit
npx expo install --check
```

Kamera ve GPS gerçek cihazda test edilmelidir.
