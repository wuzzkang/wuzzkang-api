Tentu, ini adalah gambaran alur (workflow) Frontend yang ideal berdasarkan endpoint yang sudah kita bangun. Alur ini dirancang agar user merasa aman (bisa melihat hasil dulu) sebelum akhirnya memutuskan untuk membayar/deploy.

Berikut adalah tahapan-tahapannya:

Tahap 1: Eksplorasi & Preview (Gratis)
Input Prompt: User memasukkan deskripsi landing page di UI.
Generate Preview: Frontend memanggil POST /api/generate.
Endpoint ini hanya mengembalikan JSON data landing page (tanpa memotong saldo).
Live Preview: Frontend merender JSON tersebut ke dalam komponen preview sehingga user bisa melihat desainnya secara langsung.
Tahap 2: Keputusan & Cek Saldo
Klik "Deploy": Jika user suka, mereka klik tombol "Deploy ke GitHub".
Cek Saldo: Frontend mengecek saldo user GET /api/profile untuk ini.
Jika Saldo Kurang: Tampilkan modal "Saldo Tidak Cukup" dan arahkan ke menu Top Up.
Jika Saldo Cukup: Lanjut ke pengisian nama repository.
Tahap 3: Top Up (Jika Saldo Kurang)
Pilih Nominal: User memilih nominal top up.
Create Payment: Frontend memanggil POST /api/payments/create.
Sistem memberikan nomor VA (Virtual Account).
Pembayaran: User membayar. Setelah sukses, saldo user otomatis bertambah via Webhook yang sudah kita buat.
Tahap 4: Deployment (Proses Berbayar)
Finalize Project: User memasukkan name proyek dan repoName tujuan.
Create Project: Frontend memanggil POST /api/projects.
Di sinilah saldo dipotong (10.000).
Proyek disimpan ke database dengan status draft (kemudian otomatis berubah ke deployed oleh worker).
Deployment ke GitHub dimulai di background.
Tahap 5: Monitoring Status
Polling Status: Frontend menampilkan indikator "Sedang Mendeploy...".
Cek Status: Frontend melakukan polling ke GET /api/projects/:id setiap beberapa detik.
Selesai: Begitu status berubah menjadi deployed, tampilkan link repository dan link live website-nya.


curl -X POST http://localhost:3026/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "7bcf3271-0d70-4429-88d5-10b9e9e33b61",
    "name": "Project Baru",
    "prompt": "Landing page modern untuk startup teknologi.",
    "repoName": "startup-test-repo"
  }'
  
  
  curl -X POST http://localhost:3026/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 50006,
    "userId": "7bcf3271-0d70-4429-88d5-10b9e9e33b61",
    "channel": "CIMB"
  }'


  curl -X GET "http://localhost:3000/api/profile?userId=7bcf3271-0d70-4429-88d5-10b9e9e33b61"


eyJhbGciOiJFUzI1NiIsImtpZCI6ImMwZDdmMTk1LWFjODgtNDk3NC1hYTI3LTM3NmJiMmQyZWNiMyIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3BnZ2FrbnljYnBqdnNtbW9mbmxuLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI5MjYwY2UxZS05OGMxLTRiZTUtOGYwMS1kMThlMzEwNmMwYjQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgyMTQwNTM0LCJpYXQiOjE3ODIxMzY5MzQsImVtYWlsIjoidGVzdHVzZXJAd3V6emthbmcuY29tIiwicGhvbmUiOiIiLCJhcHBfbWV0YWRhdGEiOnsicHJvdmlkZXIiOiJlbWFpbCIsInByb3ZpZGVycyI6WyJlbWFpbCJdfSwidXNlcl9tZXRhZGF0YSI6eyJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODIxMzY5MzR9XSwic2Vzc2lvbl9pZCI6IjFiNDZlYzQxLTg2YzctNDgwYS1iMDcwLTg5Zjc1ZmUxNDc3NSIsImlzX2Fub255bW91cyI6ZmFsc2V9.WWCpIO7M4SmE_iCfoOKmDN4-CS7RQEnuEE9vxlG9YfC0rXNIm1gx5-sOXYGZVhh0Sdq9ckv59KoI_bQKQprs6w