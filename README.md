# TemuYuk — Static

Versi statis (HTML + CSS + Bootstrap Icons + jQuery) tanpa backend dan tanpa build step. Buka langsung di browser.

## Cara menjalankan

Buka `index.html` langsung di browser, atau jalankan server statis apa pun:

```bash
npx serve .
# atau
python3 -m http.server 8080
```

## Alur halaman

| File | Halaman |
| --- | --- |
| `index.html` | Masuk / Daftar |
| `hubungkan-kalender.html` | Hubungkan kalender (opsional) |
| `dasbor.html` | Dasbor event |
| `buat-event.html` | Wizard buat event (Info → Tanggal → Jam → Rekap → Tinjau) |
| `detail-event.html` | Detail event untuk pembuat (rekap + tetapkan jadwal) |
| `detail-event-peserta.html` | Isi ketersediaan untuk peserta |
| `jadwal-saya.html` | Jadwal rutin mingguan 7×48 slot |
| `jadwal-final.html` | Jadwal final yang sudah ditetapkan |

Aset bersama: `style.css` (token desain + grid slot) dan folder `js/`:

| File | Isi |
| --- | --- |
| `js/core.js` | Namespace `TY`, toast, theme toggle (muat pertama) |
| `js/time.js` | Helper tanggal/jam Asia/Jakarta |
| `js/slot-drag.js` | Drag-paint slot + mode pengisian |
| `js/auth.js` | Tab masuk/daftar + validasi (khusus `index.html`) |
| `js/calendar-onboard.js` | Tombol hubungkan kalender (khusus onboarding) |
| `js/buat-event.js` | Wizard 5 langkah: peserta, tanggal, jam, rekap, ringkasan |
| `js/jadwal-saya.js` | Grid mingguan 7×48 (khusus `jadwal-saya.html`) |
| `js/respons.js` | Kirim respons peserta (khusus `detail-event-peserta.html`) |
| `js/dialogs.js` | Dialog detail slot + konfirmasi final/batal |
| `js/jadwal-final.js` | Tombol kalender + bagikan (khusus `jadwal-final.html`) |

## Catatan

- Semua data contoh tersimpan di memori halaman (tidak ada backend).
- Responsif: sidebar di desktop, bottom nav di mobile.
- Tema terang/gelap tersimpan di `localStorage`.
