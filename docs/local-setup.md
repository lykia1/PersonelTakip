# Windows: gerçek mesai sistemi kurulumu

Node.js **24 veya üstü** gerekir (`node --version`). Sistem bu aşamada tek şube için yerel pilot sürümdür. Veriler kasa bilgisayarındaki SQLite veritabanında kalır. Bilgisayar kapalıysa uygulama kayıt oluşturamaz.

## 1. Güncelleme

Expo terminalinde Ctrl+C:

```powershell
cd "$env:USERPROFILE\PersonelTakip"
git pull --ff-only origin codex/mobile-foundation
```

## 2. Sunucuyu hazırlama (ayrı PowerShell)

```powershell
cd "$env:USERPROFILE\PersonelTakip\server"
npm.cmd ci
Copy-Item .env.example .env
notepad .env
```

`.env` içindeki `ADMIN_PASSWORD=` alanına kendi en az 12 karakterlik şifrenizi yazın. Şifreyi paylaşmayın ve GitHub'a göndermeyin. Kaydedin.

```powershell
npm.cmd run setup
npm.cmd start
```

`setup` yalnızca ilk kurulumda gerekir; var olan yöneticinin şifresini değiştirmez. Sonraki açılışlarda sadece `npm.cmd start`.

## 3. Kasa ve yönetim ekranı

Bilgisayarda `http://localhost:3001` açın. Kullanıcı adı `yonetici`, şifre belirlediğiniz şifredir. Yönetim bölümünde personel hesapları ve ayrı bir **kasa hesabı** oluşturun. Sonra yöneticiden çıkış yapıp kasa hesabıyla giriş yapın. Kasada QR ekranını açık tutun. Kasa hesabı personel listesi veya fotoğraflara erişemez. Yönetici paneli son 200 kaydı gösterir, fotoğrafları yalnızca yönetici açabilir.

## 4. Telefona bağlama

Expo için ayrı PowerShell:

```powershell
cd "$env:USERPROFILE\PersonelTakip\mobile"
npm.cmd ci
npx.cmd expo start --clear
```

Telefonda uygulamanın üstündeki **Gerçek hesabınla giriş yap** alanına dokunun. Sunucu adresi, bilgisayarın yerel IP adresidir; örneğin `http://192.168.1.123:3001`. `localhost` telefonda bilgisayarı göstermez. Personel hesabıyla giriş yapın. Mevcut IP adresini `ipconfig` komutundaki IPv4 alanından doğrulayın. Telefon ve bilgisayar aynı güvenilir ağda olmalı. Windows Güvenlik Duvarı izni gerekirse yalnızca Özel ağ için uygulamaya izin verin.

QR okut → güncel konum sunucuda doğrulanır → 90 saniye içinde selfie çek ve onayla → güncel konum yeniden kontrol edilir → kayıt alınır. QR 30 saniye geçerlidir; QR zamanında doğrulanmışsa fotoğraf için verilen 90 saniyelik işlem süresi kullanılır. Giriş ve çıkış aynı akışla yapılır. İki işlem arasında 30 saniye beklenir.

Konum: `40.209634, 28.978217`, yarıçap 100 m. Konumun hata payı da bu sınırın içinde kalmalı; doğruluk 50 metreden kötü veya konum 60 saniyeden eskiyse işlem reddedilir. Evden test ederken konum dışı uyarısı beklenir; sınır test için kaldırılmadı.

## Kapsam ve sonraki işler

- Sunucu saati, kimlik doğrulama, yetki, tekrar kullanım ve çift kayıt kontrolleri var.
- Fotoğraflar SQLite içinde saklanır, herkese açık URL bulunmaz; sunucu yeniden başlasa da kalır. Bütün görüntü yeniden JPEG'e çevrilir; EXIF konum verisi korunmaz.
- Bu sistem fotoğraflı kayıt sağlar; yüz tanıma/canlılık tespiti yapmaz. Değiştirilmiş istemcinin sahte konum veya fotoğraf göndermesini kesin engellemez.
- Yerel pilot HTTP yalnızca güvenilir ağda deneme içindir. İnternete açmadan HTTPS, erişim denetimi, otomatik yedekleme ve fotoğraf saklama/silme süresi tamamlanmalı. Veritabanı yedeği SQLite backup API ile veya servis durdurulup `server/data` klasörü bütünüyle kopyalanarak alınmalı; çalışan WAL veritabanının yalnız `.sqlite` dosyasını kopyalamayın.
- Mobil oturum bellekte tutulur; uygulama yeniden başlatıldığında giriş gerekir. İstek hatasında başarı gösterilmez; aynı işlem anahtarıyla tekrar gönderim çift kayıt üretmez.
- Vardiya planlama, izinler, performans puanlama, hesap kapatma/şifre sıfırlama ve mesai düzeltme bu sürümde henüz yoktur.
