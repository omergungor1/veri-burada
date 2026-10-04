# VeriBurada — Google Maps Scraper Yönetim Sistemi

Supabase kuyruk + Next.js admin panel + Chrome extension worker.

## Parçalar

1. **Admin Panel** (`npm run dev`) — proje oluşturma, kuyruk, worker yönetimi, işletmeler, CSV
2. **Extension Worker** (`map-scrapper-extension/`) — Auto Mode ile LIST/DETAIL iş çeken otonom scraper
3. **Supabase** — tablolar, atomic claim RPC, RLS (`supabase/migrations/`)

## Kurulum

### 1. Ortam

`.env.local.example` dosyasını `.env.local` olarak kopyalayın (veya mevcut `.env.local` kullanın):

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`service_role` anahtarını client veya extension içine koymayın.

### 2. Admin kullanıcısı

Supabase Dashboard → Authentication → Users üzerinden e-posta/şifre ile admin kullanıcı oluşturun. Signup UI yoktur.

### 3. Admin paneli

```bash
npm install
npm run dev
```

`http://localhost:3000/login`

### 4. Extension

1. `chrome://extensions` → Developer mode
2. Load unpacked → `map-scrapper-extension`
3. `https://www.google.com/maps` açın
4. Panelde **START** ile Auto Mode başlatın

## Mimari özet

- LIST: her search term bir `scan_task`
- DETAIL: `businesses.detail_status = pending` işleri batch (≤100)
- Claim: `claim_next_work` + `FOR UPDATE SKIP LOCKED`
- Worker: anon key + SECURITY DEFINER RPC
- `place_id` UNIQUE; ilişkiler `scan_results` üzerinden

## Notlar

- MAX_DETAIL şimdilik implemente edilmedi; şema uyumlu.
- Lease varsayılan 900 sn; heartbeat çalışan işlerde lease uzatır.
