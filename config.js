/*
 * BMO Portfolyo — ayarlar
 * Sadece bu dosyayı düzenlemen yeterli.
 */
window.BMO_CONFIG = {
  // Ziyaretçiler sağ üstteki kutuya kendi GitHub kullanıcı adını yazar, kasetler onun projelerine dönüşür.
  // Link olarak paylaşmak için: siteadresi/?user=kullaniciadi
  // Buraya bir ad yazarsan, ziyaretçi henüz kimseyi bağlamadıysa o hesap açılır. Boşsa boş kasetler (KASET 1, 2...) görünür.
  githubUsername: "",

  // Sol üstte görünen isim ve unvan. Boş bırakırsan bağlanan GitHub profilinden (isim ve bio) gelir.
  name: "",
  title: "",

  // BMO'nun ilk cümlesi
  greeting: "Kim oyun oynamak ister? Bir kaset seç, BMO'ya tak!",

  // BMO'nun etrafında kaç kaset olsun (en fazla 12 önerilir)
  maxProjects: 8,

  // Sadece bu repoları bu sırayla göster. Boşsa: yıldız + son güncellemeye göre otomatik seçilir.
  include: [],

  // Bu repoları hiç gösterme
  exclude: [],

  // Forkladığın repolar da görünsün mü?
  showForks: false,

  // Repo bazlı özelleştirme (anahtar = GitHub'daki repo adı)
  overrides: {
    // "repo-adi": {
    //   title: "Güzel Proje Adı",
    //   description: "Kendi açıklaman",
    //   image: "assets/repo-adi.gif",        // ekrandaki ön izleme (png/jpg/gif/webp)
    //   cover: "assets/repo-adi-kapak.png",  // kasetin etiketindeki görsel
    //   demo: "https://canli-demo-linki.com"
    // }
  }
};
