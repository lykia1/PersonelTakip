# Mesai doğrulama tasarımı

## Bileşenler

1. Expo personel uygulaması: kimlik doğrulama, vardiya, QR, konum, anlık fotoğraf.
2. API + PostgreSQL: yetki, sunucu saati, QR geçerliliği, mesafe ve mesai kuralları.
3. Kasada tarayıcı ekranı: yetkili cihaz oturumu; API tarafından üretilen kısa ömürlü QR.
4. Yönetim: şube/personel/vardiya/izin, fotoğraflı kayıt inceleme ve denetim geçmişi.

## Planlanan kayıt akışı

Kasaya özel yetkiyle API'den 30 saniye geçerli rastgele QR alınır. QR içinde personel bilgisi veya imzalama anahtarı bulunmaz. Mobil uygulama QR, güncel konum/doğruluk ve anlık fotoğrafı kimliği doğrulanmış oturumla gönderir. API şube, QR süresi, personel yetkisi, konumun güncelliği ve doğruluğu, mesafe ve mevcut açık mesaiyi kontrol eder. Aynı QR farklı personellerce kullanılabilir; aynı personelin aynı QR'ı tekrar kullanması reddedilir. Kayıt ve tekrar kullanım işareti tek veritabanı işlemi içinde tutulur. Tekrarlanan ağ istekleri için idempotency anahtarı kullanılır. Fotoğraf yükleme ve kayıt işlemlerinin başarısızlıkları yetim dosya temizliğiyle ele alınır.

Koordinatlar henüz verilmedi. Geofence, API'de şube koordinatlarına göre hesaplanmalı; istemciden gelen şube yarıçapı kabul edilmemelidir. GPS sahteciliği tamamen engellenemez. Fotoğraf kaydı otomatik kimlik veya canlılık doğrulaması değildir.

## Veri modeli (plan)

branches, employees, users, shifts, shift_assignments, kiosk_sessions, qr_challenges, attendance_events, attendance_sessions, leave_requests, performance_reviews, audit_logs.

Fotoğraflar özel dosya deposunda tutulmalı; rol ve şube bazlı erişim, kısa süreli görüntüleme URL'leri ve saklama süresi uygulanmalıdır. Yönetici düzeltmeleri eski kaydı silmeden denetim kaydı oluşturmalıdır. Performans ölçütleri henüz tanımlanmadığından otomatik puan üretilemez.

## Gerçek cihaz kabul kontrolleri

- Kamera/konum reddi mesai oluşturmamalı.
- Süresi geçmiş/yanlış şube QR'ı, şube dışındaki ve doğruluğu yetersiz konum API'de reddedilmeli.
- Aynı isteğin tekrarı iki mesai oluşturmamalı.
- Fotoğraf hatası, ağ kesintisi ve uygulamanın kapanması güvenli şekilde ele alınmalı.
- Personel başka personelin kaydını veya fotoğrafını görememeli.
