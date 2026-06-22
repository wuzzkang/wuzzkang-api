# WuzzKang API - cURL Examples

Dokumen ini berisi kumpulan contoh perintah `cURL` untuk menguji berbagai *endpoint* di WuzzKang API. Anda bisa menyalin perintah di bawah ini ke terminal Anda.

> **Catatan:**  
> - Ganti `<USER_ID>` dengan UUID user yang valid dari tabel `profiles` Anda (misal: `7bcf3271-0d70-4429-88d5-10b9e9e33b61`).  
> - Ganti `<PROJECT_ID>` dengan UUID proyek yang didapat setelah proses *Generate*.
> - Pastikan server berjalan di `http://localhost:3026` (atau sesuaikan *port* Anda).

---

### 1. Cek Saldo User (GET /api/profile)
Mengecek informasi profil user termasuk saldo saat ini.

```bash
curl -s -X GET "http://localhost:3026/api/profile?userId=<USER_ID>" | jq
```

---

### 2. Generate Landing Page (POST /api/generate)
Menghasilkan konten *landing page* menggunakan AI dan langsung menyimpannya ke *database* sebagai `draft`.  
**Biaya:** Gratis

```bash
curl -s -X POST "http://localhost:3026/api/generate" \
-H "Content-Type: application/json" \
-d '{
  "userId": "<USER_ID>",
  "name": "Kopi Organik Jakarta",
  "prompt": "Landing page untuk toko kopi organik modern di Jakarta dengan desain minimalis"
}' | jq
```
*Catatan: Ambil `projectId` dari respons ini untuk tahap selanjutnya.*

---

### 3. Deploy Proyek (POST /api/projects/:id/deploy)
Mendeploy proyek *draft* ke GitHub. Akan melakukan validasi saldo dan nama repo secara sinkron.  
**Biaya:** 10.000 saldo (Dipotong otomatis)

```bash
curl -s -X POST "http://localhost:3026/api/projects/<PROJECT_ID>/deploy" \
-H "Content-Type: application/json" \
-d '{
  "userId": "<USER_ID>",
  "repoName": "kopi-organik-web"
}' | jq
```

---

### 4. Cek Status Satu Proyek (GET /api/projects/:id)
Melihat status *deployment* (`draft`, `deploying`, `deployed`, `failed`) dan seluruh detail JSON (`page_data`). Biasanya di-hit oleh Frontend secara berkala (*polling*) saat *loading* deploy.

```bash
curl -s -X GET "http://localhost:3026/api/projects/<PROJECT_ID>" | jq
```

---

### 5. List Semua Proyek User (GET /api/projects)
Menampilkan daftar semua proyek milik user. Respons endpoint ini sudah dioptimasi dengan mengecualikan `page_data` yang berat, sehingga sangat cepat dan cocok untuk halaman *Dashboard*.

```bash
curl -s -X GET "http://localhost:3026/api/projects?userId=<USER_ID>" | jq
```

---

### 6. Retry GitHub Pages (POST /api/projects/:id/retry-pages)
Jika status proyek sudah `deployed` tapi GitHub Pages tidak merespons atau *error*, endpoint ini memaksa *backend* untuk menembak ulang API GitHub Pages tanpa mengulang proses *deploy* dari awal.  
**Biaya:** Gratis

```bash
curl -s -X POST "http://localhost:3026/api/projects/<PROJECT_ID>/retry-pages" \
-H "Content-Type: application/json" \
-d '{
  "userId": "<USER_ID>"
}' | jq
```

---

### Tips Pengujian
1. Gunakan opsi `| jq` di akhir perintah cURL (seperti contoh di atas) agar JSON yang dikembalikan oleh server diformat dengan rapi dan mudah dibaca di terminal.
2. Uji skenario **Saldo Kosong**: Kosongkan saldo di Supabase, lalu jalankan endpoint Deploy. Anda harus mendapatkan status HTTP 402.
3. Uji skenario **Repo Sudah Ada**: Gunakan nama repo yang memang sudah ada di GitHub organisasi Anda. Anda harus mendapatkan pesan error tanpa pemotongan saldo.
