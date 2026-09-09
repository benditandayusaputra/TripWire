# TripWire: Formula Red Flag Detector

## 1. Sinyal Input
Tiga sinyal mentah dari data Sectors, masing masing punya sub-skor sendiri sebelum digabung:
- Histori suspend saham beserta alasan resmi
- Transaksi insider dan pemegang saham mayor (Company Filings)
- Perubahan komposisi kepemilikan (Shareholders Composition)

## 2. Sub-skor per Sinyal

### 2.1 Skor Suspend (S_susp), rentang 0 sampai 100
```
frekuensi_score = min(100, jumlah_suspend_3_tahun_terakhir × 25)
recency_score:
    100  jika suspend terakhir kurang dari 90 hari lalu
    70   jika kurang dari 180 hari lalu
    40   jika kurang dari 365 hari lalu
    15   jika kurang dari 3 tahun lalu
    0    jika tidak pernah, atau lebih lama dari itu
severity_score = rata rata tier keparahan dari semua suspend 3 tahun terakhir
    (tier 1, rutin, semisal UMA: 20 / tier 2, operasional, semisal penundaan laporan: 60
     / tier 3, serius, semisal dugaan pelanggaran: 100), 0 kalau tidak ada suspend

S_susp = (frekuensi_score × 0.3) + (recency_score × 0.3) + (severity_score × 0.4)
```

### 2.2 Skor Klaster Insider (S_insider), rentang 0 sampai 100
```
window = 30 hari rolling
insider_count = jumlah insider/pemegang saham mayor berbeda yang bertransaksi dalam window
net_direction = (total nilai jual − total nilai beli) / (total nilai jual + total nilai beli)
    rentang -1 (semua beli) sampai +1 (semua jual)

cluster_intensity = min(100, insider_count × 20)
direction_factor = max(0, net_direction)

S_insider = cluster_intensity × (0.4 + 0.6 × direction_factor)
```
Insider buying gak dianggap sinyal negatif (direction_factor dasarnya 0, bukan minus), karena fokus Red Flag Detector itu risiko, bukan penilaian dua arah. Faktor dasar 0.4 tetap dikasih meski net_direction netral, karena klaster transaksi itu sendiri (apa pun arahnya) tetap layak diperhatikan.

### 2.3 Skor Perubahan Kepemilikan (S_owner), rentang 0 sampai 100
```
window = 90 hari rolling
delta_concentration = |persentase top holder sekarang − persentase 90 hari lalu|, dalam poin persentase

magnitude_score = min(100, delta_concentration × 10)
S_owner = magnitude_score × faktor_free_float
    faktor_free_float = 0.7 kalau saham termasuk free float kecil, 1.0 kalau normal
```
Saham free float kecil secara alami punya persentase kepemilikan yang lebih volatile, faktor pengurang ini nyegah saham semacam itu selalu nangkring di skor tinggi padahal pergerakannya wajar buat ukuran floatnya.

## 3. Deteksi Pola Silang
Ini mekanisme inti yang bikin Red Flag Detector beda dari sekadar menampilkan tiga skor berdampingan.
```
correlation_window = 30 hari

signals_active = hitung berapa dari tiga sinyal yang punya KEJADIAN DISKRET
    (bukan cuma skor di atas nol, tapi event nyata) dalam correlation_window yang sama:
    - ada suspend dalam window
    - ada klaster insider dalam window (insider_count >= 2)
    - ada perubahan kepemilikan signifikan dalam window (delta_concentration > 3 poin persentase)

cross_multiplier:
    1.0  jika signals_active <= 1
    1.3  jika signals_active == 2
    1.6  jika signals_active == 3
```

## 4. Formula Gabungan
```
base_score = (S_susp × 0.3) + (S_insider × 0.4) + (S_owner × 0.3)
Red_Flag_Score = min(100, base_score × cross_multiplier)
```
Insider dikasih bobot sedikit lebih tinggi (0.4) dibanding dua sinyal lain (0.3 masing masing), karena secara umum dianggap sinyal paling langsung terkait pihak dalam perusahaan dibanding suspend (keputusan bursa) atau kepemilikan (bisa institusional/pasif).

## 5. Kategori & Ambang Batas
```
0 sampai 30   : Rendah
31 sampai 60  : Sedang
61 sampai 85  : Tinggi
86 sampai 100 : Kritis
```

## 6. Pemetaan ke insight_events
Satu insight per siklus deteksi per saham, bukan satu insight per sinyal:
```json
{
  "governance_risk_score": 72.5,
  "category": "Tinggi",
  "sub_scores": {
    "suspension": 65,
    "insider_clustering": 80,
    "ownership_change": 55
  },
  "cross_pattern": {
    "signals_active_in_window": 2,
    "multiplier_applied": 1.3,
    "window_days": 30
  },
  "supporting_data": {
    "suspensions": [],
    "insider_transactions": [],
    "ownership_snapshots": []
  },
  "computed_at": ""
}
```
`insight_events.score` diisi `governance_risk_score`, `insight_events.subtype` diisi `governance_risk_composite`, seluruh objek di atas masuk ke `insight_events.payload`.

## 7. Kondisi Trigger
Dijalankan sebagai `condition_type = daily`, cek ulang tiap saham di watchlist sekali sehari. Ini baseline yang aman karena perubahan kepemilikan gak selalu punya momen filing diskret yang jelas buat dijadiin trigger event. Kalau data filing dari Sectors ternyata bisa dipantau real-time, `recent_event` bisa ditambah sebagai lapisan kedua supaya klaster insider yang baru muncul gak nunggu sampai jadwal harian berikutnya.

## 8. Keterbatasan & Kalibrasi
- Bobot (0.3/0.4/0.3) dan ambang batas kategori di atas itu starting point berdasar penalaran, bukan hasil backtest ke data historis riil. Perlu dikalibrasi ulang begitu API key aktif dan ada cukup data buat lihat distribusi skor yang wajar di seluruh saham IDX.
- Taksonomi severity suspend (rutin/operasional/serius) perlu dipetakan manual ke isi field reason asli dari Sectors, belum dicek persis apa saja nilai yang muncul di sana.
- Model belum bisa membedakan insider selling yang genuinely mencurigakan dari yang rutin atau terjadwal. Skor ini menunjukkan pola, bukan vonis, konsisten sama aturan lomba yang melarang rekomendasi beli/jual, jadi presentasinya di UI wajib tetap faktual (apa yang terjadi), bukan menyimpulkan niat.
- Saham dengan histori data tipis (baru listing, jarang ada filing) defaultnya dianggap skor rendah, bukan error, karena minim kejadian bukan berarti berisiko.
