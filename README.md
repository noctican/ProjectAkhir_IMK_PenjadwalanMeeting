# TemuYuk — Cari Waktu yang Pas

Proyek Akhir IMK — Kelompok Kebal When Yah.

TemuYuk membantu pengurus organisasi menemukan waktu rapat yang cocok untuk
semua peserta. Ketersediaan diambil dari jadwal rutin mingguan dan (secara
simulasi) jam sibuk Google Calendar, lalu ditampilkan sebagai kandidat waktu
dengan rekap jumlah peserta yang bisa, tidak bisa, dan belum merespons.

## Struktur

```
be/   Bun + Hono + bun:sqlite, REST API di :8080
fe/   TanStack Start (React 19, Vite, Tailwind v4), UI di :3000
```

Frontend memakai BFF proxy (`fe/src/routes/api/$.tsx`): browser hanya bicara
dengan satu origin, cookie sesi HttpOnly diteruskan ke backend.

## Menjalankan

Butuh [Bun](https://bun.sh) 1.x. Dua terminal:

```sh
# terminal 1 — backend
cd be
bun install
bun run seed     # sekali saja: 6 pengguna, 5 event demo, jadwal sibuk
bun run dev      # http://127.0.0.1:8080
```

```sh
# terminal 2 — frontend
cd fe
bun install
bun run dev      # http://localhost:3000
```

Buka `http://localhost:3000`, masuk dengan akun demo:

| Email                       | Kata sandi   |
| --------------------------- | ------------ |
| `candra@filkom.ub.ac.id`    | `temuyuk123` |
| `naufal@filkom.ub.ac.id`    | `temuyuk123` |
| `bagas@filkom.ub.ac.id`     | `temuyuk123` |

Semua akun seed memakai kata sandi yang sama. Tiga akun lain (Salsabila, Raka,
Dinda) juga tersedia sebagai peserta.

## Mode backend dan mode demo

- **Backend aktif** — frontend memakai API (`/api/*`) sebagai sumber data dan
  menampilkan chip “Terhubung ke server”.
- **Backend tidak aktif** — aplikasi tetap dapat dibuka memakai `localStorage`
  (`temuyuk:demo:v1`), dengan banner “Mode Demo — perubahan disimpan di
  perangkat ini”. Data bertahan setelah refresh. Login, jadwal, event, respons,
  dan finalisasi semuanya berjalan lokal.
- Perpindahan mode tidak otomatis menimpa data. Jika koneksi putus, pengguna
  dapat mencoba lagi atau memilih mode lokal secara eksplisit.

## Alur layar

1. **Masuk & hubungkan kalender** — `/masuk`
2. **Dasbor** — `/` (peringatan respons, jadwal final, daftar event)
3. **Jadwal Saya** — `/jadwal` (matriks 7 × 48 slot, aksi massal, undo)
4. **Buat event** — `/event/baru` (5 tahap: info, tanggal, jam, rekap, tinjau)
5. **Detail event** — `/event/:id` (respons peserta, rekap organizer, finalisasi)

## Yang disimulasikan

Integrasi Google Calendar belum memakai OAuth. Endpoint `/api/calendar/*`
membaca jam sibuk contoh dan selalu menandai status `demo: true`. UI menyebut
“simulasi” pada kartu kalender, tombol sinkronisasi, dan penambahan ke kalender,
sehingga tidak ada klaim bahwa event benar-benar dibuat di Google Calendar.

## Perintah lain

```sh
cd be && bun run seed         # reset dan isi ulang data demo
cd be && bun run typecheck    # cek tipe backend (perlu TypeScript terpasang)
cd fe && npx tsc --noEmit     # cek tipe frontend
cd fe && bun run build        # build produksi
```

Reset data demo backend: `cd be && bun run seed`. Reset data mode lokal: buka
DevTools lalu hapus key `temuyuk:demo:v1` dan `temuyuk:session:v1`.
