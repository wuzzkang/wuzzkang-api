# WuzzKang API - cURL Examples (WITH JWT AUTH)

Dokumen ini berisi kumpulan contoh perintah `cURL` untuk menguji berbagai *endpoint* di WuzzKang API setelah penerapan sistem autentikasi.

> **PENTING: PERUBAHAN AUTHENTICATION**  
> Semua request sekarang WAJIB menggunakan JWT Token (*Access Token*) dari Supabase Auth yang dikirimkan melalui *header* `Authorization`.  
> Tidak ada lagi pengiriman `userId` lewat URL atau Request Body. Backend akan secara otomatis mengetahui identitas Anda dari Token.
>
> **Ganti `<JWT_TOKEN>` dengan token asli yang Anda dapat dari Supabase Login.**
> **Ganti `<PROJECT_ID>` dengan UUID proyek Anda.**

---

### 1. Cek Saldo User (GET /api/profile)
Mengecek informasi profil dan saldo user yang sedang *login*.

```bash
curl -s -X GET "http://localhost:3026/api/profile" \
-H "Authorization: Bearer <JWT_TOKEN>" | jq
```

---

### 2. Generate Landing Page (POST /api/generate)
Menghasilkan konten *landing page* menggunakan AI.

```bash
curl -s -X POST "http://localhost:3026/api/generate" \
-H "Authorization: Bearer <JWT_TOKEN>" \
-H "Content-Type: application/json" \
-d '{
  "name": "Kopi Organik Jakarta",
  "prompt": "Landing page untuk toko kopi organik modern di Jakarta dengan desain minimalis"
}' | jq
```

---

### 3. Deploy Proyek (POST /api/projects/:id/deploy)
Mendeploy proyek *draft* ke GitHub. Akan melakukan potong saldo 10.000.

```bash
curl -s -X POST "http://localhost:3026/api/projects/<PROJECT_ID>/deploy" \
-H "Authorization: Bearer <JWT_TOKEN>" \
-H "Content-Type: application/json" \
-d '{
  "repoName": "kopi-organik-web"
}' | jq
```

---

### 4. Cek Status Satu Proyek (GET /api/projects/:id)
Melihat status *deployment* dan isi JSON lengkap.

```bash
curl -s -X GET "http://localhost:3026/api/projects/<PROJECT_ID>" \
-H "Authorization: Bearer <JWT_TOKEN>" | jq
```

---

### 5. List Semua Proyek User (GET /api/projects)
Menampilkan daftar proyek user saat ini.

```bash
curl -s -X GET "http://localhost:3026/api/projects" \
-H "Authorization: Bearer <JWT_TOKEN>" | jq
```

---

### 6. Retry GitHub Pages (POST /api/projects/:id/retry-pages)
Memaksa ulang koneksi ke GitHub Pages (Gratis).

```bash
curl -s -X POST "http://localhost:3026/api/projects/<PROJECT_ID>/retry-pages" \
-H "Authorization: Bearer <JWT_TOKEN>" \
-H "Content-Type: application/json" \
-d '{}' | jq
```
