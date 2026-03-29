## Build Hardening

Project ini sudah memakai hardening dasar di build production:

- source map dimatikan
- `console` dan `debugger` dibuang dari bundle production
- nama file hasil build dibuat hash-only agar tidak mudah ditebak
- output production tetap dimampatkan saat build

## Batasan Penting

Aplikasi web front-end tidak bisa dibuat benar-benar tidak bisa diambil, karena browser tetap harus mengunduh HTML, CSS, dan JavaScript untuk menjalankan aplikasi.

Proteksi di atas hanya membuat kode hasil build lebih sulit dibaca, bukan membuatnya rahasia.

## Yang Wajib Dilakukan Untuk Proteksi Nyata

- Jangan pernah menaruh `service_role` key atau secret lain di client-side code.
- Simpan logic yang sensitif di server, Supabase Edge Functions, atau RPC/database function.
- Pastikan Row Level Security tetap aktif dan policy hanya membuka akses yang memang diperlukan.
- Jika source mentah disimpan di repository, gunakan repository private.
- Untuk lingkungan internal, pertimbangkan proteksi tambahan di level akses seperti login wajib, allowlist user, atau reverse proxy yang dibatasi.
