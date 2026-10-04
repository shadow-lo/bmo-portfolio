# BMO Portfolyo

Adventure Time'daki BMO temalı, herkesin kullanabileceği interaktif GitHub portfolyosu.
Ziyaretçi sağ üstteki kutuya GitHub kullanıcı adını yazar; BMO'nun etrafındaki boş kasetler (KASET 1, 2...)
o kişinin projelerine dönüşür. Bir kasete tıklayınca kaset BMO'nun yuvasına takılır, kamera ekrana yaklaşır ve
projenin ön izlemesi, açıklaması, **GitHub'a Git** ve **Geri** butonları açılır.

Kurulum veya build adımı yok: HTML + CSS + JS. 3D sahne (ağaç ev, kütük masa, BMO, kasetler)
three.js ile tamamen kodla üretilir; three.js CDN'den yüklenir, ayrı model ya da görsel dosyası yoktur.

## Nasıl kullanılır

- Sağ üstteki kutuya bir GitHub kullanıcı adı yaz → **BAĞLAN**. ✕ ile bağlantıyı kaldırıp boş kasetlere dönebilirsin.
- Paylaşılabilir link: `siteadresi/?user=kullaniciadi` (açılınca direkt o kişinin kasetleri gelir).
- Son bağlanan hesap tarayıcıda hatırlanır.
- Projeler yıldız sayısı ve son güncellemeye göre sıralanır, ilk 8 tanesi kaset olur. Forklar gösterilmez.

## Ayarlar (`config.js`, isteğe bağlı)

- `githubUsername` → kimse bağlanmadıysa varsayılan olarak açılacak hesap (boşsa boş kasetler görünür)
- `name`, `title` → sol üstteki isim/unvanı sabitlemek için (boşsa GitHub profilinden gelir)
- `maxProjects`, `showForks`, `include`, `exclude` → hangi repoların kaset olacağı
- `overrides` → sadece `githubUsername` hesabının repoları için özel başlık, açıklama, ön izleme görseli (`image`), kaset etiketi (`cover`) ve canlı demo linki (`demo`)

Ön izleme görseli verilmezse GitHub'ın otomatik oluşturduğu proje kartı kullanılır.

GitHub, giriş yapmadan saatte 60 istekle sınırlıdır; her bağlanma 2 istek harcar ve sonuçlar 30 dakika önbellekte tutulur.

## Yerelde çalıştırma

```bash
python -m http.server 5175 --directory bmo-portfolio
```

Sonra tarayıcıda `http://localhost:5175` adresini aç.

## Kontroller

- Fare / dokunma: kasete tıkla
- Klavye: `← →` kaset seç, `Enter` tak, `Esc` / `B` geri
- Açık projenin kendi linki var (`?user=kullaniciadi#repo-adi`), paylaşılabilir

## Yayınlama

Klasörü olduğu gibi GitHub Pages, Netlify veya Vercel'e yükleyebilirsin.
