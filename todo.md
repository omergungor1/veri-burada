# PROJE: GOOGLE MAPS SCRAPER YÖNETİM SİSTEMİ

Mevcut bir Next.js projesi ve aynı proje dizini içerisinde çalışan bir browser extension bulunuyor.

Bu projeyi baştan yazma. Öncelikle mevcut kod tabanını detaylı şekilde incele. Özellikle browser extension içerisindeki mevcut Google Maps scraping mekanizmasını, `Keyword_planner` componentini, mevcut list/detail scraping akışlarını ve kullanılan veri yapılarını tespit et.

Mevcut çalışan scraper mantığını mümkün olduğunca koru. Gereksiz refactor yapma. Bunun üzerine aşağıda tarif edilen Supabase tabanlı merkezi kuyruk, worker yönetimi ve admin panel sistemini kur.

Supabase MCP bağlıdır. Gerekli SQL migrationlarını / tabloları oluştur, indexleri ekle, gerekli RPC fonksiyonlarını oluştur ve RLS politikalarını yapılandır.

Teknolojiler:

* Next.js
* JavaScript
* TailwindCSS
* Supabase PostgreSQL
* Supabase Auth
* Browser Extension
* TypeScript KULLANMA.
* Tam responsive tasarım yap.
* Özellikle admin panel mobil kullanımını çok iyi optimize et.

---

# 1. TEMEL MİMARİ

Sistem iki ana parçadan oluşacak:

## A. Admin Panel

Next.js uygulaması.

Buradan:

* login
* scraping project oluşturma
* project görüntüleme
* queue görüntüleme
* worker görüntüleme/yönetme
* scraping ilerlemesini takip etme
* business kayıtlarını görüntüleme
* CSV export

yapılacak.

## B. Browser Extension / Scraper Worker

Extension tamamen otonom bir worker olarak çalışacak.

Extension kullanıcıdan:

* keyword
* şehir
* place_id
* scraping türü

gibi herhangi bir input ALMAYACAK.

Bunların tamamını merkezi Supabase queue sisteminden alacak.

Extension'ın temel arayüzü yalnızca:

* START AUTO MODE
* STOP AUTO MODE
* worker durumu
* çok kısa mevcut işlem bilgisi

gibi bilgiler içersin.

Mevcut karmaşık manuel scraper arayüzünü sadeleştir.

Auto Mode açıldığında worker kendi kendine sürekli iş alıp çalışabilmeli.

---

# 2. SCRAPING MODLARI

Sistemin gelecekte 3 modu olacak:

1. LIST
2. DETAIL
3. MAX_DETAIL

Ancak ŞİMDİ sadece:

* LIST
* DETAIL

modlarını implemente et.

Database tasarımını gelecekte MAX_DETAIL eklenebilecek şekilde oluştur.

---

# 3. LIST SCRAPING

Örnek kullanıcı admin panelden:

Keyword:

`oto tamir`

Location:

`Bursa`

seçti.

Mevcut extension içerisindeki `Keyword_planner` componentinde bulunan mantığı admin paneldeki New Project ekranına taşı.

Örneğin sistem şunları oluşturabilir:

* oto tamir Bursa Osmangazi
* oto tamir Bursa Nilüfer
* oto tamir Bursa Yıldırım
* oto tamir Bursa Gemlik
* ...

Her üretilen search term bir `scan_task` olmalıdır.

LIST scraping:

Google Maps üzerinde search term araması yapar.

Örneğin:

`oto tamir Bursa Gemlik`

Sonuçlardan mümkün olduğunca sadece:

* place_id
* cid

toplanır.

Bu aşamada business detayları toplanmayacaktır.

LIST taraması her yeni project/job oluşturulduğunda yeniden yapılmalıdır.

Daha önce aynı keyword/location taranmış olsa bile yeni project için LIST scan tekrar yapılır.

---

# 4. BUSINESS UNIQUE MANTIĞI

Bir işletmenin temel external identifier'ı:

`place_id`

olacaktır.

CID de saklanmalıdır.

Bir business farklı:

* project
* scan job
* keyword
* search term

içerisinde bulunabilir.

Ancak `businesses` tablosunda aynı `place_id` yalnızca BİR DEFA bulunmalıdır.

Örneğin aynı işletme:

`oto tamir Bursa`

ve

`oto servis Bursa Osmangazi`

aramalarında çıkabilir.

Business tekrar oluşturulmayacaktır.

Bunun yerine business ile scan/project arasındaki ilişki ayrı bir junction/result tablosunda tutulmalıdır.

Database seviyesinde UNIQUE constraint kullan.

Duplicate kontrolünü sadece frontend/extension koduna bırakma.

Extension LIST sonuçlarını gönderirken aynı batch içerisinde duplicate place_id kayıtlarını client tarafında da temizlesin.

Örneğin:

```js
Map(place_id => result)
```

mantığı kullanılabilir.

Böylece gereksiz network trafiği azaltılsın.

Ancak nihai duplicate güvenliği database constraint ile sağlanmalıdır.

---

# 5. BUSINESS TABLOSU

`businesses` tablosu oluştur.

Önerilen alanlar:

```text
id
place_id
cid

name
city
district
full_address
plus_code

phone
website

lat
lng

rating
review_count

business_type

image_url
working_hours

google_maps_url

created_at
detailed_at
max_detailed_at

detail_status
next_detail_scan_at
updated_at
```

Alan isimleri tamamen İngilizce olsun.

`place_id` UNIQUE ve NOT NULL.

`cid` nullable olabilir fakat index ekle.

`created_at` business'ın bizim sistemimize ilk giriş tarihidir.

`detailed_at` en son başarılı DETAIL scraping tarihidir.

`max_detailed_at` gelecekte MAX_DETAIL scraping yapıldığı tarihi tutacaktır.

UI'da sadece tarih gösterilebilir.

Database tarafında gerekiyorsa timestamp kullanabilirsin.

---

# 6. SEARCH TERM BUSINESS İLİŞKİSİ

Business tablosunun içine `search_term` koyma.

Çünkü aynı business birden fazla search term ile bulunabilir.

Bunun için ayrı ilişki tablosu oluştur.

Örneğin:

```text
scan_results

id
scan_job_id
scan_task_id
business_id
place_id
search_term
discovered_at
```

Uygun UNIQUE constraint oluştur.

Aynı business'ın aynı task altında tekrar eklenmesini engelle.

Örneğin:

```text
UNIQUE(scan_task_id, business_id)
```

veya mimari açısından daha uygun görüyorsan eşdeğer güvenli constraint kullan.

---

# 7. PROJECT / JOB / TASK YAPISI

Temel yapı:

```text
projects
   ↓
scan_jobs
   ↓
scan_tasks
   ↓
scan_results
   ↓
businesses
```

Worker yönetimi ayrıca:

```text
workers
```

üzerinden yapılacaktır.

Gerekirse ayrı bir queue/lease tablosu ekleyebilirsin.

Ancak gereksiz tablo üretme.

---

# 8. PROJECTS

`projects`

alanları yaklaşık:

```text
id
name
keyword
location
status
created_at
updated_at
```

Bir project oluşturulduğunda LIST scan job oluştur.

Project içerisinde oluşturulan tüm search termleri `scan_tasks` tablosuna ekle.

---

# 9. SCAN_JOBS

Bir project altında farklı scan operasyonlarını temsil etsin.

Örneğin:

```text
id
project_id
scan_type

status

total_tasks
completed_tasks
failed_tasks

started_at
completed_at
created_at
```

`scan_type` geleceğe uyumlu olarak:

```text
list
detail
max_detail
```

değerlerini destekleyebilecek şekilde tasarlanabilir.

Şimdilik LIST ve DETAIL kullanılacak.

---

# 10. SCAN_TASKS

LIST scraping için her search term ayrı task olmalıdır.

Örnek:

```text
id
scan_job_id

task_type
search_term

status

worker_id

claimed_at
started_at
completed_at

attempt_count
last_error

lease_expires_at

created_at
updated_at
```

Status örnekleri:

```text
pending
claimed
running
completed
failed
cancelled
```

Gerekirse `retry` durumunu ayrıca ekleyebilirsin veya pending'e geri döndür.

---

# 11. ATOMIC TASK CLAIM

BU PROJENİN EN ÖNEMLİ KISIMLARINDAN BİRİDİR.

Aynı task'ı iki worker kesinlikle alamamalıdır.

Şöyle bir yöntem KULLANMA:

1. SELECT pending task
2. client task gördü
3. UPDATE task worker_id

Çünkü iki worker aynı anda aynı kaydı görebilir.

Task sahiplenme işlemini PostgreSQL tarafında ATOMIC yap.

Supabase RPC/PostgreSQL function oluştur.

Örneğin mantıksal olarak:

```text
claim_next_list_task(worker_id)
```

Tek transaction içerisinde:

* uygun pending task bul
* row lock uygula
* mümkünse `FOR UPDATE SKIP LOCKED`
* worker_id ata
* claimed_at yaz
* lease_expires_at yaz
* status = claimed/running yap
* sadece sahiplenilen task'ı döndür

Aynı task başka worker'a verilmemelidir.

---

# 12. LEASE / WORKER CRASH MEKANİZMASI

Browser extension kapanabilir.

Chrome crash olabilir.

İnternet gidebilir.

Bilgisayar kapanabilir.

Bu nedenle yalnızca:

`worker_id`

atamak yeterli değildir.

Task claim edildiğinde:

```text
lease_expires_at
```

oluştur.

Worker düzenli heartbeat göndermelidir.

Worker veya task uzun süre heartbeat göndermezse task sonsuza kadar running kalmamalıdır.

Expired task tekrar `pending` yapılabilmelidir.

Örneğin admin veya RPC mekanizması:

```text
requeue_expired_tasks()
```

oluşturabilir.

Aynı zamanda `attempt_count` artır.

Belirli sayıda başarısız denemeden sonra task:

```text
failed
```

olabilir.

Retry limitini merkezi config/constant olarak tanımla.

---

# 13. LIST WORKER AKIŞI

Extension Auto Mode çalıştığında:

1. Worker kendisini register eder.
2. Heartbeat gönderir.
3. Merkezi sistemden iş ister.
4. LIST task aldıysa Google Maps search açar.
5. Search term'i arar.
6. Sonuçları toplar.
7. Aynı batch içindeki duplicate `place_id` kayıtlarını temizler.
8. Sonuçları mümkün olduğunca batch halinde backend/Supabase'e gönderir.
9. Businesses UPSERT edilir.
10. Scan_results ilişkileri oluşturulur.
11. Task completed yapılır.
12. Worker yeni task ister.

Her business için ayrı ayrı network request yapma.

Batch gönderim kullan.

---

# 14. DETAIL SCRAPING QUEUE

LIST ile DETAIL birbirinden farklıdır.

DETAIL scraping search term bazlı değil, business/place_id bazlı çalışacaktır.

Yeni bulunan bir business:

```text
detailed_at IS NULL
```

ise DETAIL scraping için adaydır.

Aynı business 5 farklı search term içerisinde bulunmuş olsa bile sadece BİR KEZ detail scraping yapılmalıdır.

DETAIL worker bir defada:

**maksimum 100 business**

alabilmelidir.

Örneğin PostgreSQL RPC:

```text
claim_detail_batch(worker_id, batch_size)
```

Batch size maksimum 100 olsun.

Yine atomic claim/locking kullanılmalıdır.

İki worker aynı business'ı DETAIL için sahiplenmemelidir.

Gerekirse business üzerinde:

```text
detail_status
detail_worker_id
detail_claimed_at
detail_lease_expires_at
```

alanları oluştur.

Alternatif olarak ayrı `detail_tasks` tablosu mimari olarak daha temiz olacaksa kullanabilirsin.

Kararı mevcut kodu inceleyerek ver.

Öncelik:

* basitlik
* veri bütünlüğü
* düşük Supabase yükü
* worker concurrency güvenliği

olsun.

---

# 15. DETAIL BATCH

Worker DETAIL moduna geçtiğinde:

```text
100 place_id
```

alır.

Her business için Google Maps detail scraping çalıştırılır.

Toplanan bilgiler:

```text
Business Name
City
District
Full Address
Plus Code
Phone
Website
Latitude
Longitude
Rating
Review Count
Business Type
Image URL
Working Hours
Google Maps URL
Place ID
CID
```

Database alanları İngilizce olacaktır.

İşlem sonunda sonuçları mümkün olduğunca tek batch request ile server'a gönder.

Businesses tablosunu UPSERT et.

Başarılı business için:

```text
detailed_at = now()
detail_status = completed
```

yap.

Başarısız business'ları tüm batch yüzünden kaybetme.

Partial success destekle.

Örneğin 100 işletmeden:

```text
96 success
4 failed
```

olabilir.

96 başarılı kayıt kaydedilmeli.

4 başarısız kayıt retry için uygun durumda bırakılmalı.

---

# 16. LIST VE DETAIL ÖNCELİK MEKANİZMASI

Auto worker'ın iş seçim algoritması şu mantıkta olsun:

Normalde LIST task çalıştır.

Ancak bekleyen DETAIL business sayısı belirli eşiğe ulaştığında DETAIL batch çalıştır.

Başlangıç için threshold:

```text
100
```

olsun.

Örneğin:

```text
if pending_detail_count >= 100:
    claim up to 100 detail businesses
    run DETAIL
else:
    claim one LIST task
```

Ancak önemli bir edge case var:

LIST queue bittiyse ve DETAIL queue içerisinde 100'den az kayıt kaldıysa bunları bekletme.

Mantık:

```text
if pending_detail >= 100:
    DETAIL

else if pending_list > 0:
    LIST

else if pending_detail > 0:
    DETAIL remaining batch

else:
    IDLE
```

Bu mantığı mümkün olduğunca tek merkezi `claim_next_work` RPC üzerinden çözmeyi değerlendir.

Ama implementasyon gereksiz karmaşıklaşacaksa LIST ve DETAIL claim RPC'lerini ayrı tut.

---

# 17. DETAY TARAMAYI GELECEKTE TEKRARLAMA

İlk bulunan business bir kere DETAIL scraping yapılmalıdır.

Daha sonra gelecekte belirli periyotlarda yeniden taranabilecek.

Bunun için şimdiden:

```text
detailed_at
next_detail_scan_at
```

alanlarını destekle.

Şimdilik periyodik scheduler yapmak zorunda değilsin.

Ancak mimari daha sonra:

```text
detailed_at < X days ago
```

veya:

```text
next_detail_scan_at <= now()
```

ile tekrar DETAIL queue oluşturabilecek şekilde tasarlansın.

Ara DETAIL taramalarda geçmiş snapshotları saklamak zorunda değiliz.

Business'ın son güncel bilgisi yeterlidir.

---

# 18. WORKERS TABLOSU

Worker extension instance'larını takip etmek için `workers` tablosu oluştur.

Önerilen alanlar:

```text
id
worker_key
name

status
auto_mode

current_task_type
current_task_id
current_job_id

last_heartbeat_at
started_at

extension_version

processed_list_tasks
processed_detail_businesses
failed_tasks

created_at
updated_at
```

Status örnekleri:

```text
offline
idle
working
paused
stopping
error
```

Worker'ın ONLINE/OFFLINE durumunu her saniye database'e yazma.

Örneğin heartbeat yaklaşık 20-30 saniyede bir gönderilebilir.

Admin panelde:

```text
last_heartbeat_at
```

değerine göre online/offline hesaplanabilir.

Supabase Free Plan nedeniyle gereksiz write yapma.

---

# 19. WORKER IDENTITY

Her extension kurulumu ilk çalışmada unique bir:

```text
worker_key
```

oluştursun.

Bunu extension local storage'da sakla.

Örneğin UUID kullanılabilir.

Extension tekrar açıldığında aynı worker identity ile devam etsin.

Admin panel worker'ı bu ID üzerinden tanısın.

---

# 20. ADMIN WORKER CONTROL

Admin panelde Workers sayfası oluştur.

Göster:

* worker ID/name
* online/offline
* auto mode
* status
* current operation
* current project/job
* current search term
* current batch
* last heartbeat
* uptime
* processed count
* error count

Üst tarafta özet kartları:

```text
Online Workers
Working Workers
Idle Workers
Paused Workers
Offline Workers
```

göster.

Admin şu komutları verebilsin:

* Pause
* Resume
* Stop Auto Mode
* Start/Resume Auto Mode
* Release Current Task
* Reset Worker

Browser extension bu komutları heartbeat/poll sırasında okuyup uygulamalıdır.

Admin browser'a doğrudan bağlanmaya çalışmasın.

Worker tablosunda örneğin:

```text
requested_action
```

ve gerekirse:

```text
requested_action_at
```

kullan.

Worker komutu uyguladıktan sonra temizlesin/acknowledge etsin.

---

# 21. RELEASE CURRENT TASK

Admin:

`Release Current Task`

dediğinde worker mümkün olduğunca güvenli şekilde mevcut scraping'i durdursun.

Task tamamlanmadıysa:

```text
pending
```

durumuna geri dönsün.

Worker ownership/lease temizlensin.

Başka worker daha sonra alabilsin.

---

# 22. QUEUE SAYFASI

Admin panelde Queue ekranı oluştur.

Sekmeler olabilir:

```text
All
List
Detail
Running
Pending
Failed
Completed
```

Gösterilecek temel bilgiler:

* type
* project
* job
* search term / business count
* worker
* status
* claimed time
* started time
* elapsed time
* attempts
* error

Queue realtime hissi vermeli.

Ancak Supabase Free Plan nedeniyle gereksiz realtime subscription/polling oluşturma.

Mümkünse:

* yalnızca açık Queue ekranında realtime subscription

veya

* düşük frekanslı polling

kullan.

Dashboard kapalıyken gereksiz sorgu çalıştırma.

---

# 23. PROJECT LIST

Projects sayfasında tüm scraping projectleri göster.

Her project için:

* Project Name
* Keyword
* Location
* Status
* Search Terms
* List Progress
* Businesses Found
* Unique Businesses
* Detail Progress
* Created Date

göster.

Progress bar kullan.

Örneğin:

```text
LIST
32 / 48 tasks
██████████████░░ 67%

DETAIL
1,840 / 2,310
████████████░░░░ 80%
```

Progress değerlerini mümkün olduğunca her render sırasında pahalı COUNT sorguları ile hesaplama.

Gerekirse scan_jobs üzerinde aggregate counter alanları tut.

Counter güncellemelerinde concurrency güvenli SQL/RPC kullan.

---

# 24. PROJECT DETAIL

Project'e tıklayınca:

* Overview
* Search Terms
* Businesses
* Queue / Tasks
* Errors

gibi bölümler göster.

Search Terms tablosunda:

```text
Search Term
Status
Worker
Businesses Found
Started
Completed
Duration
Attempts
```

göster.

---

# 25. BUSINESS LIST

Businesses sayfası oluştur.

Tablo kolonları:

* Business Name
* City
* District
* Phone
* Website
* Rating
* Review Count
* Business Type
* Place ID
* CID
* Created Date
* Detailed Date

Arama ve temel filtreleme ekle.

Place ID ile arama destekle.

Business detayına tıklanınca tüm mevcut bilgiler gösterilebilir.

---

# 26. CSV EXPORT

Project tamamlandıktan sonra veya project detail içerisinden:

`Export CSV`

butonu olsun.

Butona basıldığında modal aç.

Kullanıcı export etmek istediği kolonları seçsin.

Örneğin:

```text
Business Name
City
District
Full Address
Plus Code
Phone
Website
Latitude
Longitude
Rating
Review Count
Business Type
Image URL
Working Hours
Google Maps URL
Place ID
CID
Search Term
Created Date
Detailed Date
```

CSV header isimleri tamamen İngilizce olsun.

Aynı business birden fazla search term ile bulunduysa export davranışını açık şekilde tasarla.

Tercihen project export'ta:

`Search Term`

bilgisini scan_results üzerinden getir.

Aynı işletmenin birden fazla search term'i varsa mümkünse tek business satırı üret ve search termleri bir separator ile birleştir.

Örneğin:

```text
"oto tamir Bursa Osmangazi | oto servis Bursa Osmangazi"
```

Böylece CSV'de aynı işletmenin gereksiz duplicate satırları oluşmasın.

---

# 27. AUTH

Supabase Auth kullan.

Admin panel ilk açıldığında login ekranı göster.

Sadece:

* Email / Username gerekiyorsa mevcut sisteme göre
* Password
* Login

olsun.

Şunları EKLEME:

* Signup
* Forgot Password
* Reset Password
* Social Login

Admin kullanıcılarını Supabase üzerinden manuel oluşturacağım.

Login olmayan kullanıcı admin sayfalarına erişemesin.

---

# 28. RLS / SECURITY

Supabase MCP kullanarak gerekli RLS politikalarını oluştur.

Browser extension'ın database'e sınırsız admin erişimi olmasın.

Özellikle extension içine:

`service_role`

key KOYMA.

Service role key browser extension veya client-side Next.js bundle içerisine kesinlikle gömülmemelidir.

Admin authenticated kullanıcılar gerekli admin tablolarını okuyabilsin/yönetebilsin.

Worker'ın yapabileceği işlemleri mümkün olduğunca kontrollü RPC/API endpointleri üzerinden sınırla.

Worker:

* register
* heartbeat
* claim work
* submit list result
* submit detail result
* complete/fail work
* requested action kontrolü

gibi ihtiyaç duyduğu operasyonları yapabilsin.

Doğrudan kritik tablolar üzerinde sınırsız UPDATE/DELETE yetkisi verme.

---

# 29. BATCH DATABASE OPERATIONS

Supabase Free Plan kullanıyoruz.

Bu nedenle database/network kullanımını optimize et.

ŞUNU YAPMA:

```text
100 business
=
100 ayrı HTTP request
=
100 ayrı INSERT
```

Bunun yerine:

```text
100 business
=
1 batch request
=
batch UPSERT
```

mantığını kullan.

LIST sonuçlarında da aynı şekilde batch insert/upsert kullan.

---

# 30. INDEXLER

Query patternlerini analiz ederek gerekli PostgreSQL indexlerini oluştur.

Özellikle düşün:

```text
businesses(place_id)
businesses(cid)
businesses(detail_status)
businesses(next_detail_scan_at)

scan_tasks(status)
scan_tasks(scan_job_id, status)
scan_tasks(worker_id)
scan_tasks(lease_expires_at)

scan_results(scan_job_id)
scan_results(scan_task_id)
scan_results(business_id)

workers(last_heartbeat_at)
```

Ancak gereksiz index oluşturma.

UNIQUE constraint'in zaten index oluşturduğu durumlarda duplicate index ekleme.

---

# 31. EXTENSION AUTO MODE STATE MACHINE

Extension tarafında açık bir state machine kullan.

Örneğin:

```text
STOPPED
    ↓
REGISTERING
    ↓
IDLE
    ↓
CLAIMING
    ↓
LIST_SCRAPING
    ↓
SUBMITTING
    ↓
IDLE

veya

IDLE
    ↓
CLAIMING
    ↓
DETAIL_SCRAPING
    ↓
SUBMITTING
    ↓
IDLE
```

Hata durumunda:

```text
ERROR
↓
RETRY WAIT
↓
IDLE
```

Browser reload/navigation durumlarını hesaba kat.

Google Maps sayfası yeniden yüklense bile mümkün olduğunca worker state kaybolmasın.

Extension local storage'da yalnızca gerekli state tut.

Database merkezi source of truth olsun.

---

# 32. SCRAPER DAYANIKLILIĞI

Extension'ın uzun süre bakım görmeden çalışmasını istiyoruz.

Mevcut DOM selectorları incele.

Scraper kodunu:

* tek bir dev component içerisine doldurma
* scraping engine
* queue client
* worker state
* Supabase/API communication
* UI

olarak mantıksal modüllere ayır.

Google Maps DOM selectorlarını mümkün olduğunca merkezi bir dosyada tut.

Bir selector değişirse tüm scraper'ı değiştirmek zorunda kalmayalım.

Selector fallback mekanizması kullan.

Örneğin mümkün olduğunda:

```text
primary selector
fallback selector
semantic/attribute selector
```

mantığı uygula.

Rastgele `setTimeout` zincirleri yerine reusable wait helper'ları kullan.

Örneğin:

```js
waitForElement()
waitForCondition()
retry()
sleep()
```

gibi utility fonksiyonları oluştur.

Infinite loop oluşmasını engelle.

Her scraping operasyonunda timeout bulunmalı.

---

# 33. IDEMPOTENCY

Tüm kritik submit işlemleri idempotent tasarlanmalıdır.

Worker aynı LIST sonucu internet problemi nedeniyle iki kez gönderirse duplicate business veya duplicate scan_result oluşmamalıdır.

Worker DETAIL sonucunu iki kez gönderirse ikinci request sistemi bozmamalıdır.

Database constraint + UPSERT kullan.

---

# 34. NETWORK FAILURE

Extension sonuç topladıktan sonra network giderse sonuçları hemen kaybetme.

Küçük bir local pending submission mekanizması oluştur.

Örneğin extension storage içerisinde:

```text
pendingSubmissions
```

tutulabilir.

Submit başarılı olduğunda temizle.

Ancak burada devasa scraping datası biriktirme.

Sadece henüz server tarafından acknowledge edilmemiş son batch/batchler tutulmalıdır.

---

# 35. TASK COMPLETION ATOMICITY

Özellikle LIST scraping'de şu hata oluşmamalı:

1. worker task completed yaptı
2. results insert başarısız oldu

Bu nedenle mümkünse:

`submit_list_results`

RPC/server operation içerisinde tek transaction mantığı kullan:

1. businesses UPSERT
2. scan_results INSERT/UPSERT
3. task COMPLETED
4. counters UPDATE

Hepsi başarılıysa commit.

Hata varsa task completed olmamalı.

DETAIL submission için de benzer güvenli mekanizma kur.

---

# 36. WORKER HEARTBEAT

Worker yaklaşık 20-30 saniyede bir heartbeat gönderebilir.

Heartbeat içerisinde minimum:

```text
worker_id
status
auto_mode
current_task_type
current_task_id
```

bilgileri olsun.

Her saniye heartbeat gönderme.

Admin UI online durumunu:

```text
now - last_heartbeat_at
```

üzerinden hesaplasın.

Örneğin makul timeout sonrası offline göster.

---

# 37. ADMIN DASHBOARD

Ana dashboard sade ve operasyon odaklı olsun.

Üst kartlar:

```text
Active Projects
Pending List Tasks
Pending Detail Businesses
Active Workers
Working Workers
Total Businesses
```

Alt tarafta:

* Running Workers
* Current Queue
* Recent Projects
* Recent Errors

gösterilebilir.

Dashboard'ı gereksiz grafiklerle doldurma.

Asıl amaç scraper operasyonunu hızlı takip etmek.

---

# 38. RESPONSIVE UI

Admin panel desktop + tablet + mobile tam responsive olmalı.

Desktop'ta sidebar olabilir.

Mobilde sidebar drawer/bottom navigation gibi uygun responsive çözüm kullan.

Büyük tablolar mobilde kırılmamalı.

Gerekirse:

* horizontal scroll
* mobile card representation
* önemli kolonları önceliklendirme

kullan.

---

# 39. ERROR LOGGING

Scraping hatalarını takip edebilmek için gerekiyorsa küçük bir:

```text
scrape_errors
```

tablosu oluştur.

Örneğin:

```text
id
worker_id
scan_job_id
scan_task_id
business_id
error_type
message
context
created_at
```

Ancak devasa log üretme.

Normal başarılı işlemleri log tablosuna yazma.

Sadece operasyonel hata/debug için gerekli kayıtları tut.

---

# 40. MAX DETAIL GELECEK UYUMLULUĞU

Şu anda MAX_DETAIL scraping IMPLEMENTE ETME.

Ancak database tasarımında:

```text
max_detailed_at
```

alanı olsun.

Task/job type yapısı gelecekte:

```text
max_detail
```

eklenmesini engellemesin.

UI'da şu anda MAX_DETAIL göstermene gerek yok.

---

# 41. DOSYA YAPISI

Mevcut projeyi inceleyerek uygun yapıyı kendin belirle.

Ancak mantıksal olarak kodları şu sorumluluklara ayır:

```text
admin UI
auth
supabase client
project services
queue services
worker services
export services

extension
    worker
    queue client
    scraper
        list scraper
        detail scraper
        selectors
        helpers
    storage
    ui
```

Mevcut çalışan extension mimarisini gereksiz yere bozma.

---

# 42. SUPABASE MCP

Supabase MCP bağlı.

Sadece SQL dosyası üretip bana "bunu çalıştır" deme.

MCP üzerinden mümkün olan gerekli işlemleri gerçekleştir:

* tabloları oluştur
* constraintleri oluştur
* foreign keyleri oluştur
* indexleri oluştur
* RPC/functionları oluştur
* RLS'yi aktifleştir
* policies oluştur

Migration/SQL dosyalarını da repository içerisinde tut ki database yapısı version control altında olsun.

---

# 43. DATABASE TASARIMINI ÖNCE NETLEŞTİR

Kodlamaya başlamadan önce mevcut repository'yi incele.

Ardından kısa şekilde nihai database modelini belirle.

Minimum olarak şu kavramlar bulunmalı:

```text
projects
scan_jobs
scan_tasks
businesses
scan_results
workers
```

Gerçekten gerekiyorsa:

```text
detail_tasks
scrape_errors
```

gibi ek tablolar ekleyebilirsin.

Ancak tablo sayısını gereksiz artırma.

---

# 44. ÖNEMLİ MİMARİ KURALLAR

Şunlara kesinlikle dikkat et:

1. Aynı `place_id` businesses içerisinde duplicate olamaz.

2. Aynı task iki worker tarafından claim edilemez.

3. Worker crash olduğunda task sonsuza kadar running kalamaz.

4. LIST scraping her yeni project için yeniden yapılır.

5. DETAIL scraping aynı business için başlangıçta yalnızca bir kere yapılır.

6. Aynı business farklı project/search termlerde bulunabilir.

7. Search term bilgisini business tablosuna bağlama.

8. DETAIL scraping 100 business batch olarak alınabilmelidir.

9. LIST scraping worker'a tek search term/task olarak verilmelidir.

10. Batch database operations kullan.

11. Extension içerisine Supabase service role key koyma.

12. Network retry nedeniyle duplicate kayıt oluşmamalıdır.

13. Extension mümkün olduğunca kendi kendine çalışmalıdır.

14. Database merkezi source of truth olmalıdır.

15. Supabase Free Plan kaynaklarını gereksiz tüketme.

---

# 45. UYGULAMA SIRASI

Projeyi yarım bırakmadan aşağıdaki sırayla ilerle:

### Faz 1

Mevcut repository ve extension scraper yapısını incele.

### Faz 2

Database schema + migrationları oluştur.

### Faz 3

Supabase RLS + RPC/atomic queue fonksiyonlarını oluştur.

### Faz 4

Admin authentication oluştur.

### Faz 5

Admin layout/dashboard oluştur.

### Faz 6

New Project + mevcut Keyword_planner entegrasyonunu yap.

### Faz 7

Projects / Project Detail / Queue ekranlarını oluştur.

### Faz 8

Workers dashboard ve worker command sistemini oluştur.

### Faz 9

Extension UI'ı sadeleştir ve persistent worker identity oluştur.

### Faz 10

Extension Auto Mode state machine oluştur.

### Faz 11

LIST queue claim → scrape → batch submit akışını bağla.

### Faz 12

DETAIL batch claim → scrape → batch submit akışını bağla.

### Faz 13

Heartbeat + lease expiration + retry/recovery mekanizmalarını tamamla.

### Faz 14

Business list + Project Business list oluştur.

### Faz 15

CSV column selector + export sistemini oluştur.

### Faz 16

Concurrency, duplicate ve crash recovery testlerini yap.

---

# 46. TEST EDİLMESİ GEREKEN KRİTİK SENARYOLAR

Kod bittikten sonra özellikle test et:

### Test 1

Tek worker + tek LIST task.

### Test 2

10 worker aynı anda pending task istediğinde aynı task iki worker'a verilmemeli.

### Test 3

Aynı place_id aynı search term içerisinde 5 kere bulunursa business bir kere oluşmalı.

### Test 4

Aynı place_id 5 farklı search term'de bulunursa business bir kere, scan_results ilişkileri ayrı oluşmalı.

### Test 5

Worker LIST scraping ortasında kapanırsa lease bittikten sonra task tekrar alınabilmeli.

### Test 6

Worker sonuçları submit ettikten sonra aynı request tekrar gönderilirse duplicate oluşmamalı.

### Test 7

100 pending DETAIL business olduğunda DETAIL batch alınmalı.

### Test 8

99 DETAIL beklerken LIST task varsa LIST devam etmeli.

### Test 9

LIST tamamen bittiğinde 37 DETAIL business kaldıysa 37'si de DETAIL taramaya alınmalı.

### Test 10

İki worker aynı anda DETAIL batch isterse aynı business iki batch içerisinde bulunmamalı.

### Test 11

100 DETAIL kaydından 4 tanesi hata verirse diğer 96 kayıt kaybolmamalı.

### Test 12

Admin worker'a Pause gönderdiğinde worker güvenli şekilde pause olmalı.

### Test 13

Offline worker'ın sahiplendiği iş lease sonrasında kurtarılmalı.

### Test 14

CSV export'ta aynı business gereksiz duplicate satırlar oluşturmamalı.

---

# 47. SON KONTROL

İşlem sonunda:

* build çalıştır
* syntax hatalarını düzelt
* console errorları kontrol et
* Supabase query/RPC hatalarını kontrol et
* responsive ekranları kontrol et
* extension manifest/build hatalarını kontrol et
* RLS nedeniyle worker operasyonlarının kırılmadığını test et
* admin olmayan erişimin kritik verilere ulaşamadığını kontrol et
* service role key'in client bundle veya extension içerisinde bulunmadığını doğrula
* duplicate/concurrency senaryolarını test et

Eksik TODO bırakma.

Mevcut çalışan scraper fonksiyonlarını gereksiz yere değiştirme.

Önceliğimiz gösterişli bir uygulama değil:

**uzun süre otonom çalışabilen, aynı işi iki worker'a vermeyen, duplicate üretmeyen, düşük Supabase kaynak tüketen sağlam bir scraping queue sistemi oluşturmaktır.**
