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

Aset bersama: `style.css` (token desain + grid slot), `script.js` (tab auth, drag slot, wizard, dialog native, theme).

## Catatan

- Semua data contoh tersimpan di memori halaman (tidak ada backend).
- Responsif: sidebar di desktop, bottom nav di mobile.
- Tema terang/gelap tersimpan di `localStorage`.
