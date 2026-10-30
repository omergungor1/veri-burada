# VERİ BURADA – MÜŞTERİ PANELİ VE ONBOARDING GELİŞTİRME PROMPTU

Sen deneyimli bir Senior Full-Stack Developer, SaaS Product Designer ve Next.js mimarısın.

Supabase mcp bağlı. Bağlı Organizasyon içinde Veri-Burada projesini kullanacaksın bu proje için. Tablo ekleyip güncelleyebilirsin vs. Var olan admin  ve eklenti akışını bozmamaya çalış. Müşteri panelini yapıyoruz. Modern bir admin panel tasarlayalım müşteri için. Tam responsive ve telden kullanılabilen bir panel yapacaksın. 

Mevcut **Veri Burada** projesine eksiksiz, modern, kullanıcı dostu ve production-ready bir müşteri paneli geliştireceksin.

## 1. PROJE HAKKINDA

Marka: Veri Burada

Ürün tipi: DaaS (Data as a Service)

Veri Burada, internetten işletme bilgileri toplayan ve müşterilerine toplu işletme listeleri sunan bir SaaS/DaaS platformudur.

Örnek kullanım:

Bir müşteri Antalya'daki kuaförlerin listesini almak istiyor.

1. Veri Burada'ya kayıt olur.
2. Antalya ilini seçer.
3. Arama terimi olarak "Kuaför" yazar.
4. Liste talebi oluşturur.
5. Sistem arka planda işletmeleri toplar.
6. Liste yaklaşık 1 iş günü içerisinde hazırlanır.
7. Kullanıcı e-posta ile bilgilendirilir.
8. Müşteri paneline giriş yapar.
9. Liste istatistiklerini ve 10 örnek işletmeyi ücretsiz görür.
10. Tam listeyi açmak istediğinde kredi satın alır.
11. Kredisi yeterliyse listeyi açar ve indirir.

İş modelimiz kredi bazlıdır.

**1 işletme = 1 kredi.**

### Önemli teknik talimatlar

- Proje halihazırda Next.js ile geliştirilmiştir.
- Supabase kullanılmaktadır.
- Supabase Auth ile giriş sistemi bulunmaktadır.
- Şu anda kayıt/onboarding ekranı bulunmamaktadır.
- Giriş yapan kullanıcı boş müşteri paneline yönlendirilmektedir.
- Mevcut admin paneli ve arka plan liste toplama altyapısı olabilir.

İLK ÖNCE MEVCUT PROJEYİ ANALİZ ET.

Mevcut mimariyi, route yapısını, authentication sistemini, veritabanını, tasarım bileşenlerini ve admin altyapısını incele.

Mevcut çalışan sistemleri bozma. Gereksiz yere yeni mimari oluşturma.

Mevcut tablo veya fonksiyonlar kullanılabiliyorsa onları genişlet.

Veritabanı değişikliklerini migration olarak hazırla. Gerekli SQL migration'larını oluştur.

Placeholder, sahte API veya kalıcı mock veri kullanma.

Gerçek Supabase entegrasyonları yap.

---

# 2. TASARIM FELSEFESİ

Modern, premium ve sade bir B2B SaaS dashboard tasarla.

Hedef tasarım özellikleri:

- Minimalist
- Profesyonel
- Güven veren
- Kolay anlaşılır
- Modern
- Responsive
- Ferah ve temiz
- Kullanıcıyı satın almaya yönlendiren
- Gereksiz karmaşıklıktan uzak

Tasarım dili olarak Linear, Stripe Dashboard, Vercel ve modern SaaS yönetim panellerinden ilham alabilirsin.

Renk yaklaşımı:

- Koyu lacivert
- Beyaz
- Açık gri
- Turkuaz veya mavi vurgu renkleri

Mevcut projede bir tasarım sistemi bulunuyorsa onu koru.

Mümkünse mevcut UI bileşenlerini kullan.

Yeni bileşen gerektiğinde mevcut teknolojiye uygun bileşenler oluştur.

Tüm arayüz Türkçe olacak.

Mobil ve masaüstünde sorunsuz çalışacak.

Loading, empty state, error state, success state ve skeleton ekranlarını unutma.

---

# 3. KAYIT VE ONBOARDING

Yeni kullanıcıların kayıt olabilmesi için çok adımlı, modern bir onboarding geliştir.

Amaç yalnızca kayıt almak değil, müşteriyi tanımak ve hedef müşteri kitlemizi analiz edebilmektir.

Onboarding kısa, akıcı ve kolay tamamlanabilir olmalı.

Üstte adım göstergesi bulunmalı.

Örneğin:

Adım 1/4

## ADIM 1 – HESAP OLUŞTUR

Başlık:

"İhtiyacınız olan işletme verilerine ulaşın."

Alt açıklama:

"Binlerce işletmeye ulaşmak artık çok daha kolay. Hemen ücretsiz hesabınızı oluşturun."

Alanlar:

- Ad Soyad (zorunlu)
- E-posta (zorunlu)
- Telefon (opsiyonel)
- Şifre (zorunlu)

Telefon için Türkiye ülke kodu +90 varsayılan olabilir, ancak uluslararası telefon numaraları da desteklenmeli.

Telefon boş bırakılırsa kayıt işlemini engellemeyen küçük bir uyarı göster:

"Listeniz hazır olduğunda bunu kaçırmayın! Telefon numaranızı eklerseniz size SMS veya WhatsApp üzerinden de haber verebiliriz."

Telefon opsiyonel kalmalı.

SMS ve WhatsApp gönderim altyapısı şu anda yoksa gönderim yapılmış gibi gösterme.

Ayrıca bildirim izinlerini ayrı şekilde al ve sakla. Telefon verilmesi otomatik pazarlama izni anlamına gelmez.

Şifre Supabase Auth üzerinden yönetilmeli.

Şifreyi kendi veritabanımızda düz metin olarak saklama.

E-posta doğrulaması şu aşamada zorunlu olmayacak.

Supabase Auth ayarları bu akışa uygun yapılandırılmalı. Dashboard üzerinde manuel yapılması gereken ayar varsa açıkça belirt.

Kullanıcı kayıt olduğunda auth.users kaydı oluşmalı.

Kayıt işlemi başarısız olursa onboarding ilerlememeli.

## ADIM 2 – SİZİ TANIYALIM

Başlık:

"Veri Burada'yı nasıl kullanacaksınız?"

Alt açıklama:

"İhtiyaçlarınızı anlayarak size daha iyi bir deneyim sunmak istiyoruz."

Soru 1:

"Veri Burada'yı hangi amaçla kullanacaksınız?"

Seçenekler:

- Potansiyel müşteri bulmak
- Satış ve pazarlama
- Soğuk arama / müşteri kazanımı
- E-posta pazarlaması
- Pazar araştırması
- Rakip analizi
- Yazılım veya otomasyon projeleri
- Diğer

Birden fazla seçim yapılabilsin.

Soru 2:

"Hangisi sizi daha iyi tanımlıyor?"

Seçenekler:

- Freelancer
- Ajans
- Yazılım şirketi
- Satış ekibi
- Pazarlama ekibi
- İşletme sahibi
- Kurumsal şirket çalışanı
- Diğer

Soru 3:

"Aylık yaklaşık kaç işletme verisine ihtiyacınız oluyor?"

Seçenekler:

- 100'den az
- 100–1.000
- 1.000–5.000
- 5.000–10.000
- 10.000+

Soru 4:

"En çok hangi işletmelere ulaşmak istiyorsunuz?"

Opsiyonel serbest metin.

Örnek:

"Türkiye genelindeki kuaförler ve güzellik salonları."

Bu cevapları veritabanında yapılandırılmış biçimde sakla.

Admin paneli tarafından sonradan analiz edilebilir olmalı.

## ADIM 3 – İLK LİSTENİ OLUŞTUR

Başlık:

"İlk işletme listeni oluşturalım!"

Alt açıklama:

"Hangi işletmeleri aradığını söyle, gerisini bize bırak."

Bu adımda liste talep formunun basitleştirilmiş versiyonu gösterilsin.

Alanlar:

- Arama terimleri
- İl seçimi

Butonlar:

"İlk Listemi Oluştur"

"Şimdilik Atla"

Liste oluşturmak zorunlu değil.

Kullanıcı oluşturursa gerçek liste talebi kaydedilecek.

Atla seçerse normal şekilde devam edecek.

## ADIM 4 – HOŞ GELDİN

Başlık:

"Veri Burada'ya hoş geldin, [Ad]!"

Açıklama:

"İşletme verilerine ulaşmak için her şey hazır."

Eğer liste talebi oluşturduysa:

"İlk liste talebini aldık! Listen hazır olduğunda sana haber vereceğiz."

Eğer oluşturmadıysa:

"İlk işletme listeni oluşturarak hemen başlayabilirsin."

Buton:

"Panele Git"

Onboarding tamamlandı bilgisi kaydedilmeli.

Kullanıcı tekrar giriş yaptığında onboarding tamamlanmışsa doğrudan dashboard açılmalı.

Onboarding yarım kaldıysa kaldığı adımdan devam edebilmeli.

Gerekli durumlarda onboarding soruları daha sonra hesap ayarlarından güncellenebilmeli.

---

# 4. MÜŞTERİ PANELİ GENEL YAPISI

Müşteri paneli sade bir sidebar içermeli.

Menüler:

1. Genel Bakış
2. Listelerim
3. Yeni Liste Talebi
4. Kredilerim
5. Hesabım

Sidebar alt bölümünde:

- Kullanıcı adı
- E-posta
- Mevcut kredi
- Çıkış yap

Kredi bakiyesi sidebar veya üst navbar içerisinde kolayca görülebilmeli.

Örneğin:

"2.450 Kredi"

Yanında küçük bir "+" butonu bulunabilir.

Bu buton kredi satın alma sayfasını açmalı.

---

# 5. GENEL BAKIŞ (DASHBOARD)

Dashboard kullanıcının en önemli bilgileri tek ekranda görmesini sağlamalı.

Üst kısım:

"Hoş geldin, Ahmet 👋"

Alt metin:

"İşletme verilerine ulaşmak için yeni bir liste oluşturabilirsin."

Ana CTA:

"Yeni Liste Oluştur"

Özet kartları:

1. Toplam Liste Talebim
2. Hazır Listelerim
3. Hazırlanan Listeler
4. Mevcut Kredim

Alt bölüm:

"Son Listelerim"

Son 5 liste talebi gösterilsin.

Kolonlar:

- Liste adı
- Oluşturulma tarihi
- Durum
- İşletme sayısı
- İşlem

Durumlar:

- Sırada
- Hazırlanıyor
- Hazır
- Başarısız

Hazır listelerde:

"Listeyi Görüntüle"

Hazırlanan listelerde:

"Hazırlanıyor"

Hiç liste oluşturulmadıysa güzel bir empty state göster:

"Henüz bir işletme listen yok."

"İlk listeni oluşturarak binlerce potansiyel işletmeye ulaşabilirsin."

Buton:

"İlk Listemi Oluştur"

Ek olarak hazır ancak henüz satın alınmamış listeler varsa dashboard üzerinde dikkat çekici bir bölüm gösterilebilir:

"2 listen hazır! İşletme verilerini keşfetmeye başlayabilirsin."

Bu bölüm kullanıcıyı liste detay sayfasına yönlendirmeli.

---

# 6. YENİ LİSTE TALEBİ

Bu ekran ürünün en önemli ekranlarından biridir.

Mümkün olduğunca anlaşılır ve hızlı kullanılabilir olmalı.

Başlık:

"Yeni İşletme Listesi Oluştur"

Açıklama:

"Aradığın işletmeleri ve şehirleri belirle. Senin için listeyi hazırlayalım."

## Alan 1 – Arama terimleri

Kullanıcı birden fazla anahtar kelime girebilmeli.

Örnekler:

- Kuaför
- Güzellik salonu
- Berber
- Nalbur
- Oto servis

Maksimum 10 keyword.

Tag input kullan.

Kullanıcı kelime yazıp Enter ile ekleyebilmeli.

Her kelimenin yanında silme butonu olmalı.

Aynı kelime iki kez eklenmemeli.

Boş kelimeler kabul edilmemeli.

Büyük/küçük harf farkından kaynaklanan tekrarlar engellenmeli.

Sayaç göster:

"3/10 arama terimi"

En az bir arama terimi zorunlu.

## Alan 2 – İl seçimi

Türkiye'nin 81 ili listelensin.

Çoklu seçim yapılabilsin.

Arama yapılabilen combobox/multiselect kullan.

Kullanıcı istediği kadar il seçebilsin.

Ayrıca:

"Tüm Türkiye'yi Seç"

seçeneği bulunmalı.

Tüm Türkiye seçilirse 81 il seçilmiş sayılmalı.

Seçim kaldırılabilmeli.

En az bir il zorunlu.

## Liste adı

Sistem seçilen terimlerden ve şehirlerden otomatik liste adı oluştursun.

Örneğin:

"Antalya Kuaför Listesi"

"İstanbul ve Ankara Güzellik Salonları"

Liste adı isteğe bağlı değiştirilebilir olsun.

## Talep özeti

Formun altında özet göster:

Arama Terimleri:
Kuaför, Berber

Bölgeler:
Antalya, Muğla

Tahmini Hazırlanma Süresi:
Yaklaşık 1 iş günü

Bilgi mesajı:

"Liste oluşturmak ücretsizdir. Yalnızca listenin tamamını açmak istediğinde kredi kullanırsın."

CTA:

"Liste Talebi Oluştur"

## Liste talebi limiti

Bir kullanıcının aynı anda maksimum 3 tamamlanmamış liste talebi bulunabilir.

Tamamlanmamış durumlar:

- queued
- processing

Ready veya failed durumları bu limite dahil edilmez.

Kullanıcı 3 aktif talebe ulaştığında yeni talep oluşturamaz.

Uyarı:

"Aynı anda en fazla 3 liste talebi oluşturabilirsin. Yeni bir talep için mevcut listelerinden birinin tamamlanmasını beklemelisin."

Bu kural yalnızca frontend'de uygulanmamalı.

Backend tarafında atomik ve güvenli şekilde uygulanmalı.

Eş zamanlı isteklerle limit aşılmamalı.

Kullanıcının hiç kredisi olmasa bile liste talebi oluşturabilmeli.

## Başarılı talep ekranı

Talep başarıyla kaydedildikten sonra güzel bir başarı ekranı veya modal göster.

Başlık:

"Tebrikler! Liste talebini aldık 🎉"

Açıklama:

"İşletme listeni hazırlamaya başladığımızda süreç panelinden takip edebilirsin. Listen genellikle 1 iş günü içinde hazır olur."

"Listen hazır olduğunda sana e-posta ile haber vereceğiz."

Butonlar:

"Listelerime Git"

"Yeni Liste Oluştur"

Gerçekte henüz başlamamış işlemi başlamış gibi göstermemeye dikkat et.

Talebin sistem tarafından başarıyla kaydedildiğini doğrula.

---

# 7. LİSTELERİM

Müşterinin oluşturduğu bütün liste talepleri burada gösterilmeli.

Üst kısım:

Başlık:
"Listelerim"

Açıklama:
"İşletme listelerini buradan yönetebilir ve hazır olanları indirebilirsin."

Sağ tarafta:

"Yeni Liste Oluştur"

Filtreler:

- Tümü
- Hazırlanıyor
- Hazır
- Başarısız

Tablo kolonları:

- Liste Adı
- Bölgeler
- Arama Terimleri
- Talep Tarihi
- Durum
- İşletme Sayısı
- İşlem

Hazır olmayan listelerde henüz bilinmeyen işletme sayısı yerine "-" göster.

Durum rozetleri:

Sırada: Gri
Hazırlanıyor: Mavi
Hazır: Yeşil
Başarısız: Kırmızı

Hazır listelerde buton:

"Listeyi Görüntüle"

Hazırlanan listelerde:

"Detayları Gör"

Başarısız listelerde uygun bilgilendirme göster.

Liste kartı veya tablosu üzerinden detay sayfasına gidilebilmeli.

Sayfalama veya uygun veri miktarında pagination uygulanmalı.

---

# 8. LİSTE DETAY SAYFASI

Bu ekran satış dönüşümü açısından en kritik ekrandır.

Amaç kullanıcıya hazırlanan verinin değerini göstermek.

Örnek:

Kullanıcı Antalya Kuaför Listesi talep etti.

Sistem listeyi hazırladı.

Kullanıcı liste detayına geldi.

Başlık:

"Antalya Kuaför Listesi"

Durum:

"Listen Hazır!"

Alt açıklama:

"Antalya bölgesindeki işletmeleri senin için topladık."

## İstatistik kartları

Liste tamamlandığında gerçek verilerden hesaplanan istatistikleri göster.

Örnek:

Toplam Eşsiz İşletme:
2.450

Web Sitesi Olmayan:
1.320

4 Yıldız Altındaki:
380

Telefon Bilgisi Bulunan:
1.980

Web Sitesi Bulunan:
1.130

Kullanılabilir E-posta Bulunan:
420

İstatistikler yalnızca veritabanında gerçekten bulunan alanlar üzerinden hesaplanmalı.

Veri yoksa tahmini sayı üretme.

İstatistikler mümkünse liste tamamlandığında hesaplanıp saklansın.

Performans için her sayfa açılışında tüm kayıtları tekrar tekrar tarama.

Boş veya eksik puan değerlerini 4 yıldız altı olarak sayma.

Aynı işletmenin tekrarlarını eşsiz işletme sayısına dahil etme.

## Satış odaklı bilgilendirme

İstatistiklerin altında bir değer önerisi kartı göster.

Örnek:

"Bu listede 1.320 web sitesi olmayan işletme bulunuyor!"

Alt açıklama:

"Bu işletmeler web tasarım, dijital pazarlama ve müşteri kazanımı hizmetleri için potansiyel hedef kitlen olabilir."

Diğer örnek:

"380 işletmenin puanı 4 yıldızın altında."

"Bu işletmeler müşteri deneyimi ve dijital itibar hizmetleri açısından araştırılabilecek potansiyel fırsatlar sunabilir."

Bu metinler yalnızca gerçek istatistiklere göre dinamik oluşturulmalı.

Kesin satış veya müşteri kazanımı vadetme.

## Ücretsiz 10 işletme önizlemesi

Kullanıcı satın alma yapmadan 10 işletmenin gerçek verilerini görebilmeli.

Tablo:

- İşletme Adı
- Şehir
- Telefon
- Web Sitesi
- Puan
- Adres (varsa)

Bu 10 kayıt tamamen ücretsiz görüntülenebilmeli.

"10 Örnek İşletmeyi İndir" butonu bulunmalı.

Ücretsiz örnek CSV veya XLSX indirilebilmeli.

Bu işlem kredi düşürmemeli.

Her görüntülemede farklı 10 kayıt gösterme. Listeye özgü sabit örnek kayıtlar kullan.

Ücretsiz örnek ve istatistikler backend üzerinden kontrollü sunulmalı.

İndirilmeyen diğer işletmelerin ham verilerini tarayıcıya gönderme.

## Tam listeyi açma

Örnek:

Toplam eşsiz işletme:
2.450

Gerekli kredi:
2.450

Kullanıcının kredisi:
1.000

Eksik kredi:
1.450

Buton:

"Tam Listeyi Aç – 2.450 Kredi"

Kredi yeterli değilse buton kredi satın alma modalını açmalı.

Modal:

"Yeterli Krediniz Bulunmuyor"

"Bu listeyi açabilmek için 2.450 krediye ihtiyacınız var. Mevcut bakiyeniz 1.000 kredi."

"En az 1.450 kredi daha yüklemeniz gerekiyor."

Buton:

"Kredi Satın Al"

Kredi yeterliyse kullanıcıya onay ekranı göster:

"Bu listeyi açmak için 2.450 krediniz kullanılacak. Listeyi daha sonra sınırsız kez tekrar indirebilirsiniz."

Buton:

"2.450 Kredi Kullan ve Listeyi Aç"

ÖNEMLİ KURAL:

Kredi liste her indirildiğinde düşmeyecek.

Kredi tam listeye ilk erişim hakkı açıldığında düşecek.

Kullanıcı bir kez ödeme yaptıktan sonra aynı listeyi tekrar tekrar ücretsiz indirebilecek.

Ödeme sonrası:

- Liste kullanıcının hesabına açılır.
- Kredi bakiyesi azalır.
- Kredi hareketi oluşturulur.
- Tam liste tablo halinde görüntülenebilir.
- CSV ve XLSX indirilebilir.
- Sonraki indirmeler kredi tüketmez.

Listeyi açma ve kredi düşme işlemleri tek bir güvenli veritabanı transaction'ı içinde gerçekleştirilmelidir.

İstek iki kez gönderilse bile iki kez kredi düşmemeli.

İlk açma işlemi başarısız olursa bakiye yanlışlıkla düşmemeli.

Yeterli kredisi olmayan kullanıcıya tam veri hiçbir API veya doğrudan dosya URL'si üzerinden erişilebilir olmamalı.

---

# 9. KREDİ SİSTEMİ

Platform kredi bazlı çalışır.

1 eşsiz işletme = 1 kredi.

Örnek:

500 işletmelik liste:
500 kredi

2.450 işletmelik liste:
2.450 kredi

10.000 işletmelik liste:
10.000 kredi

Aynı liste tekrar indirilirse:
0 kredi

Ücretsiz 10 işletmelik örnek:
0 kredi

Kullanıcı liste talebi oluştururken:
0 kredi

## Kredi paketleri

Aşağıdaki paketleri tanımla:

| Paket | Kredi | Fiyat |
|---|---:|---:|
| Başlangıç | 100 | 200 TL |
| Popüler | 1.000 | 1.200 TL |
| Profesyonel | 5.000 | 5.000 TL |
| Kurumsal | 10.000 | 8.000 TL |

Paketleri veritabanında yönetilebilir hale getir.

Frontend'de sabit fiyatlara bağımlı olma.

İleride admin panelinden yeni paket eklenebilmeli, mevcut paketler değiştirilebilmeli veya pasifleştirilebilmeli.

"Popüler" paketini görsel olarak vurgulayabilirsin.

## Kredi satın alma sayfası

Başlık:

"İhtiyacın Kadar Kredi Al"

Alt açıklama:

"Kredilerinle işletme listelerinin tamamına erişebilirsin. Kullanmadığın kredilerin hesabında kalır."

Üst bölüm:

"Mevcut Bakiyen: 750 Kredi"

Altında paket kartları.

Her pakette:

- Paket adı
- Kredi miktarı
- Fiyat
- Kredi başı maliyet
- Satın al butonu

Shopier ödeme altyapısını kullanacağız.

Şu anda Shopier otomatik entegrasyonu bulunmuyor.

Satın al butonu ilgili paketin admin tarafından tanımlanan Shopier bağlantısına yönlendirmeli.

Shopier linklerini veritabanı veya güvenli konfigürasyondan yönetilebilir yap.

Örnek link uydurma.

Gerçek linkler henüz tanımlanmamışsa admin tarafından yapılandırılması gerektiğini göster.

## Manuel kredi yükleme süreci

Şu an ödeme sonrası kredi yüklemesi manuel yapılacak.

Akış:

1. Kullanıcı Shopier sayfasına gider.
2. Satın alma gerçekleştirir.
3. Admin ödemeyi Shopier üzerinden doğrular.
4. Admin panelinden kullanıcıyı bulur.
5. Kredi paketini seçer.
6. Kullanıcıya kredi yükler.
7. Kullanıcının bakiyesi güncellenir.
8. İşlem kredi hareketlerine kaydedilir.

Kullanıcıya ödeme sonrası şu mesaj gösterilebilir:

"Ödemeniz tamamlandıktan ve doğrulandıktan sonra kredileriniz hesabınıza tanımlanacaktır."

Shopier dönüşünü tek başına ödeme kanıtı kabul etme.

Otomatik kredi yüklemesi yapma.

İleride ödeme webhook entegrasyonu eklenebilecek şekilde mimari oluştur.

---

# 10. KREDİLERİM EKRANI

Bu ekranda kullanıcının kredi bilgileri gösterilecek.

Üstte büyük bakiye kartı:

"Mevcut Krediniz"

"2.450 Kredi"

Buton:

"Kredi Yükle"

Altında küçük özet kartları:

- Toplam Yüklenen Kredi
- Toplam Kullanılan Kredi
- Güncel Bakiye

## Kredi hareketleri

Tablo kolonları:

- Tarih
- İşlem Türü
- Açıklama
- Kredi Değişimi
- İşlem Sonrası Bakiye

Örnek:

28.10.2026 – Kredi Yükleme – 1.000 Kredi Paketi – +1.000

29.10.2026 – Liste Açma – Antalya Kuaför Listesi – -650

30.10.2026 – Kredi Yükleme – 5.000 Kredi Paketi – +5.000

Pozitif işlemler yeşil, negatif işlemler kırmızı gösterilebilir.

Kullanıcının kredi bakiyesi elle frontend'de hesaplanmamalı.

Backend'deki güvenilir bakiyeyi kullan.

Tüm kredi hareketleri denetlenebilir şekilde saklanmalı.

Eski hareketler düzenlenmemeli veya silinmemeli.

Gerekirse düzeltme için yeni bir ters kayıt oluşturulmalı.

---

# 11. ADMİN KREDİ YÜKLEME

Mevcut admin paneline uygun bir kredi yönetim bölümü ekle.

Admin bir kullanıcı seçebilmeli.

Kullanıcı arama:

- Ad
- E-posta
- Telefon

Seçilen kullanıcı detaylarında:

- Ad Soyad
- E-posta
- Mevcut Kredi
- Toplam Yüklenen Kredi
- Toplam Harcanan Kredi

Kredi yükleme alanı:

"Paket Seç"

Paket seçimi dropdown şeklinde olsun.

Seçilen paketin kredi miktarı gösterilsin.

Örnek:

1.000 Kredi Paketi

Yüklenecek:
1.000 Kredi

Not alanı:

"Shopier sipariş numarası / açıklama"

Buton:

"Kredi Yükle"

Butona basıldığında onay modalı aç:

"Ahmet Yılmaz adlı kullanıcıya 1.000 kredi yüklemek istediğinize emin misiniz?"

Onay sonrası:

- Kredi bakiyesini artır.
- Credit transaction oluştur.
- İşlemi yapan admin ID'sini kaydet.
- İşlem tarihini kaydet.
- Paket bilgisini kaydet.
- Shopier sipariş referansını sakla.

Aynı Shopier siparişi yanlışlıkla iki kez kredi yüklememeli.

Sipariş referansı girilmişse ilgili işlem için mükerrer yüklemeyi engelle.

Kritik kredi işlemleri yalnızca sunucu tarafında ve admin yetki kontrolünden sonra çalışmalı.

Normal kullanıcı bu fonksiyonu çağıramamalı.

---

# 12. HESABIM

Müşteri hesap bilgilerini buradan düzenleyebilmeli.

Alanlar:

- Ad Soyad
- E-posta
- Telefon
- Hesap Oluşturulma Tarihi

Ayrıca:

- Şifre değiştirme
- Bildirim tercihleri
- Onboarding cevaplarını güncelleme
- Çıkış yap

E-posta güncelleme ve şifre değiştirme Supabase Auth üzerinden güvenli yapılmalı.

Bildirim tercihleri:

- E-posta ile liste hazır bildirimi
- SMS ile bilgilendirme (altyapı hazır değilse devre dışı)
- WhatsApp ile bilgilendirme (altyapı hazır değilse devre dışı)

Güvenlik bildirimleri ve pazarlama izinleri ayrı ele alınmalı.

---

# 13. VERİTABANI TASARIMI

Önce mevcut Supabase şemasını incele.

Gerekli tablolar yoksa oluştur.

Önerilen veri modeli:

## profiles

- id
- full_name
- email
- phone
- role
- onboarding_completed
- onboarding_step
- created_at
- updated_at

id, Supabase Auth kullanıcı ID'siyle bağlantılı olsun.

## onboarding_responses

- id
- user_id
- usage_purposes
- user_type
- monthly_data_need
- target_business_description
- created_at
- updated_at

## list_requests

- id
- user_id
- title
- keywords
- cities
- status
- business_count
- created_at
- started_at
- completed_at
- updated_at
- error_message

Status değerleri:

queued
processing
ready
failed

Mevcut scraping sistemi farklı durumlar kullanıyorsa uyarlama katmanı oluştur.

## list_businesses

Mevcut işletme/veri tablosu varsa tekrar oluşturma.

Gerekli ilişkiyi mevcut modele ekle.

İşletme bilgileri mevcut scraping altyapısındaki alanlarla uyumlu olmalı.

Örnek:

- id
- list_id
- business_name
- phone
- website
- address
- city
- rating
- review_count
- email
- created_at

Gerçek şemaya göre uyarlama yap.

## list_statistics

- id
- list_id
- unique_business_count
- without_website_count
- below_four_stars_count
- with_phone_count
- with_website_count
- with_email_count
- calculated_at

## credit_packages

- id
- name
- credits
- price_try
- shopier_url
- is_active
- is_popular
- sort_order
- created_at

## credit_wallets

- user_id
- balance
- updated_at

## credit_transactions

- id
- user_id
- amount
- balance_after
- transaction_type
- description
- list_id
- package_id
- admin_id
- payment_reference
- idempotency_key
- created_at

İşlem türleri:

- purchase
- list_unlock
- admin_adjustment
- refund

## list_unlocks

- id
- list_id
- user_id
- credits_spent
- unlocked_at

Aynı kullanıcı ve liste için yalnızca bir unlock kaydı bulunmalı.

Kredi düşme ve unlock oluşturma atomik olmalı.

## notification_preferences

- user_id
- email_enabled
- sms_enabled
- whatsapp_enabled
- updated_at

Mevcut tablolarla örtüşen alanları gereksiz yere çoğaltma.

---

# 14. GÜVENLİK VE RLS

Supabase Row Level Security doğru yapılandırılmalı.

Kurallar:

- Kullanıcı yalnızca kendi profilini okuyabilmeli.
- Kullanıcı yalnızca kendi listelerini görebilmeli.
- Kullanıcı yalnızca kendi kredilerini görebilmeli.
- Kullanıcı yalnızca kendi kredi hareketlerini görebilmeli.
- Kullanıcı başka müşterinin işletme verilerine ulaşamamalı.
- Tam listeye yalnızca unlock hakkı olan kullanıcı erişebilmeli.
- Unlock olmayan kullanıcı yalnızca izin verilen 10 örnek işletmeyi ve istatistikleri alabilmeli.
- Kullanıcı kredi bakiyesini doğrudan değiştirememeli.
- Kullanıcı list_request status, business_count veya completed_at alanlarını değiştirememeli.
- Kullanıcı unlock kaydını kendisi oluşturamamalı.
- Kullanıcı admin rolünü kendisine verememeli.
- Service role key hiçbir zaman tarayıcıya gönderilmemeli.

Admin rolünü istemciden gelen bir alan üzerinden kabul etme.

Güvenilir backend yetkilendirmesi kullan.

Önemli:

Kredi yükleme, kredi düşme ve liste açma işlemleri database transaction veya güvenli PostgreSQL fonksiyonu ile yapılmalı.

Bunlar için gerekli RPC / server-side işlemleri uygula.

Eş zamanlı isteklerde kredi bakiyesi eksiye düşmemeli.

Kritik işlemlerde idempotency kullan.

SQL migration ve RLS politikalarını oluştur.

---

# 15. LİSTE HAZIRLANMA SÜRECİ

Müşteri bir talep oluşturduğunda:

status = queued

İşleme başlanınca:

status = processing

Başarıyla tamamlanınca:

status = ready

Hata olursa:

status = failed

Liste tamamlanırken:

1. İşletme verileri kaydedilir.
2. Tekrar eden işletmelerin nasıl ayıklandığı belirlenir.
3. Eşsiz işletme sayısı hesaplanır.
4. İstatistikler hesaplanır.
5. Ücretsiz örnek 10 işletme belirlenir.
6. Liste ready durumuna geçer.
7. Müşteriye liste hazır e-postası gönderilmesi tetiklenir.

Mevcut arka plan tarama sistemi varsa onunla entegre ol.

Bu müşteri paneli geliştirmesi için yeni scraping motoru yazma.

Mevcut sistem yoksa liste talebini gerçek veritabanına kaydet ve ileride backend tarafından tüketilecek açık bir iş akışı oluştur.

Sahte şekilde 1 gün bekleyen timer veya otomatik başarı simülasyonu yapma.

Hazır e-postasını mümkünse mevcut e-posta servisinden gönder.

E-posta servisi henüz yoksa açık entegrasyon noktası ve bildirim kaydı oluştur; gönderildi olarak işaretleme.

Tekrarlanan durum güncellemelerinde müşteriye aynı hazır e-postası birden fazla kez gönderilmesin.

---

# 16. KULLANICI DENEYİMİ DETAYLARI

Bütün süreçte kullanıcıya net durum bilgisi ver.

Örnek durum metinleri:

Sırada:

"Talebin alındı. Hazırlık sırasına eklendi."

Hazırlanıyor:

"İşletme verilerini senin için topluyoruz."

Hazır:

"Listen hazır! İşletme verilerini keşfedebilirsin."

Başarısız:

"Listen hazırlanırken bir sorun oluştu."

Hazırlanıyor durumundaki listeler için progress bar kullanılacaksa gerçek ilerleme bilgisi bulunmalı.

Gerçek bilgi yoksa sahte yüzde gösterme.

Bunun yerine animasyonlu durum göstergesi kullan.

Ayrıca:

- Toast bildirimleri
- Modal'lar
- Skeleton loading
- Responsive tablolar
- Form validation
- Hata mesajları
- Empty state'ler
- Başarılı işlem bildirimleri
- Kaydetme sırasında disabled butonlar
- Çift tıklamayı engelleme

Bütün butonlar gerçekten çalışmalı.

İşlevsiz buton veya dekoratif sahte özellik bırakma.

---

# 17. DOSYA İNDİRME

Kullanıcı listeyi unlock ettikten sonra CSV ve XLSX formatında indirebilmeli.

Türkçe karakterler doğru aktarılmalı.

CSV UTF-8 BOM destekleyebilir.

Dosya adı anlaşılır olmalı.

Örnek:

antalya-kuafor-listesi-2026-10-28.xlsx

İndirilen dosyanın kolonları mevcut veri alanlarına göre oluşturulmalı.

İlgili kolonda hiç veri yoksa uygun şekilde boş bırak.

Sadece ilk 10 örnek veriye erişimi olan kullanıcı tam listeyi indirememeli.

CSV veya XLSX indirme endpoint'leri sunucu tarafında yetki kontrolü yapmalı.

Yalnızca frontend'de butonu gizlemek güvenlik için yeterli değildir.

---

# 18. İŞ KURALLARI VE SINIR DURUMLARI

Aşağıdaki kuralları eksiksiz uygula:

1. Kullanıcı sıfır krediyle hesap açabilir.
2. Sıfır krediyle liste talep edebilir.
3. Aynı anda en fazla 3 tamamlanmamış talebi olabilir.
4. En fazla 10 keyword girebilir.
5. Türkiye'nin 81 ilinden istediğini seçebilir.
6. Tüm Türkiye seçeneği bulunur.
7. Hazırlanan listeyi satın almadan istatistiklerini görebilir.
8. İlk 10 örnek işletmeyi ücretsiz görebilir ve indirebilir.
9. Tam liste yalnızca yeterli krediyle açılır.
10. Tam liste ilk açıldığında işletme sayısı kadar kredi düşer.
11. Aynı listeye erişim hakkı satın alındıktan sonra tekrar kredi düşmez.
12. Aynı anda gönderilen unlock istekleri çift kredi tüketmez.
13. Kullanıcı başka müşterinin listesine erişemez.
14. Liste henüz hazır değilken kredi düşmez.
15. Hazır liste sıfır işletme içeriyorsa kullanıcıdan kredi alınmaz.
16. İşletme sayısı hesaplanırken tekrar eden kayıtlar iki kez fiyatlandırılmaz.
17. Admin kredi yüklemesi denetlenebilir hareket kaydı oluşturur.
18. Kredi yükleme ancak gerçek ödeme admin tarafından doğrulandıktan sonra yapılır.
19. Kredi paketleri sonradan değiştirilebilir.
20. Eski kredi işlemleri paket fiyatı değiştiğinde etkilenmez.

Ücretsiz 10 işletme, ücretli listenin içerisindeki örneklerdir.

Dolayısıyla 2.450 işletmelik bir listenin tamamını açmanın bedeli 2.450 kredidir. Önceden ücretsiz gösterilen 10 işletme için ikinci bir indirim yapılmaz.

Bu kural kullanıcı arayüzünde açıkça belirtilmeli.

---

# 19. TESTLER

Özellikle aşağıdaki akışları test et:

- Yeni kullanıcı kaydı
- E-posta doğrulaması olmadan giriş
- Onboarding tamamlama
- Onboarding yarıda bırakıp geri dönme
- İlk liste talebi
- Onboarding sırasında liste oluşturmadan geçme
- Üç aktif talep sınırı
- Dördüncü talebin backend'de reddedilmesi
- Sıfır krediyle talep oluşturma
- Liste hazır olduğunda detayları görüntüleme
- Ücretsiz 10 örnek veriye erişim
- Ücretsiz örnek CSV indirme
- Yetersiz kredi durumunda uyarı
- Yeterli krediyle liste açma
- Kredi düşme ve hareket oluşturma
- Aynı listeyi tekrar indirme
- Eş zamanlı unlock istekleri
- Admin kredi yükleme
- Mükerrer Shopier sipariş referansı
- Başka kullanıcının listesine yetkisiz erişim
- Tam liste indirme endpoint'i yetkilendirmesi
- Mobil görünüm
- Refresh sonrası oturum ve onboarding durumunun korunması

Mevcut test altyapısını kullan.

Gerekli birim ve entegrasyon testlerini ekle.

---

# 20. UYGULAMA SIRASI

İşi şu sırayla gerçekleştir:

FAZ 1:
Mevcut projeyi analiz et. Auth, dashboard, admin, scraping ve veritabanı sistemlerini incele.

FAZ 2:
Gerekli veritabanı migration'larını ve RLS politikalarını oluştur.

FAZ 3:
Supabase Auth ile kayıt ve onboarding akışını geliştir.

FAZ 4:
Müşteri paneli layout ve dashboard ekranını oluştur.

FAZ 5:
Liste talep ekranını ve listelerim sayfasını geliştir.

FAZ 6:
Liste detay sayfasını, istatistikleri ve ücretsiz 10 veri önizlemesini geliştir.

FAZ 7:
Kredi sistemi, liste unlock mantığı ve kredi geçmişini geliştir.

FAZ 8:
Shopier paket yönlendirmelerini ve admin manuel kredi yükleme alanını entegre et.

FAZ 9:
Hesap ayarları, bildirim tercihleri ve indirme fonksiyonlarını tamamla.

FAZ 10:
Güvenlik testleri, hata kontrolleri, responsive iyileştirmeler ve genel kalite kontrolünü yap.

---

# 21. ÇALIŞMA KURALLARI

ÖNEMLİ:

Bu bir tasarım mockup projesi değildir.

Gerçek, çalışan müşteri paneli geliştiriyoruz.

Sadece component üretip bırakma.

Frontend, backend ve database katmanlarını birlikte tamamla.

Her sayfanın gerçek veriyle çalışmasını sağla.

Mevcut proje mimarisine uy.

Var olan çalışan fonksiyonları bozma.

Mevcut admin panelinin yetkilerini koru.

Mevcut authentication sistemini gereksiz yere baştan yazma.

Kod kalitesine önem ver.

Tekrarlanan kodlardan kaçın.

TypeScript tiplerini doğru tanımla.

Hata yönetimini düzgün yap.

Gizli anahtarları istemciye çıkarma.

SQL migration'larını güvenli şekilde hazırla.

Veritabanındaki mevcut kullanıcı veya işletme verilerini silme.

Gerekli ortam değişkenlerini `.env.example` içerisinde belgele; gerçek gizli anahtarları değiştirme.

Harici panelde yapılması gereken manuel kurulum varsa net şekilde listele.

## BEKLENEN SONUÇ

Çalışma tamamlandığında:

- Kullanıcı kayıt olabilmeli.
- Onboarding tamamlayabilmeli.
- İlk listesini oluşturabilmeli.
- Dashboard'a erişebilmeli.
- Yeni liste talepleri oluşturabilmeli.
- Listelerinin durumunu takip edebilmeli.
- Hazır listelerin istatistiklerini görebilmeli.
- 10 örnek işletmeyi ücretsiz indirebilmeli.
- Kredi paketlerini görüntüleyebilmeli.
- Shopier üzerinden ödeme bağlantısına gidebilmeli.
- Admin kullanıcıya manuel kredi yükleyebilmeli.
- Kullanıcı kredisiyle tam listeyi açabilmeli.
- Listeyi Excel/CSV olarak indirebilmeli.
- Kredi geçmişini görebilmeli.
- Hesap bilgilerini düzenleyebilmeli.

Tüm bu işlemler gerçek Supabase veritabanına bağlı çalışmalı.

**Başlamadan önce mevcut projeyi incele, mimariyi kısaca özetle ve belirlediğin uyarlama kararlarını açıkla. Daha sonra implementasyona geç.**

Gerçekleştirilemeyen dış servis entegrasyonlarını çalışıyormuş gibi gösterme. Bunları açıkça raporla.

İş bitiminde:

1. Tamamlanan özellikleri listele.
2. Oluşturulan migration'ları belirt.
3. Eklenen veya güncellenen route'ları belirt.
4. Çalıştırılan testleri ve sonuçlarını açıkla.
5. Manuel yapılandırma gerektiren noktaları yaz.
6. Eksik kalan bir özellik varsa dürüstçe belirt.

Hedefimiz gerçek müşterilerin kullanabileceği, güvenli, hızlı ve satış dönüşümüne odaklı bir Veri Burada müşteri paneli geliştirmek.