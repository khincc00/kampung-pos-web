"""Buat index.html (hosting/PWA, dokumen lengkap) dari src/page.html.
src/page.html sendiri = isi <body> tanpa doctype (dipakai langsung sebagai artifact)."""
from pathlib import Path
root = Path(__file__).resolve().parent.parent
page = (root / "src/page.html").read_text(encoding="utf-8")
head, _, body = page.partition("<canvas")
doc = ("<!doctype html>\n<html lang=\"id\">\n<head>\n<meta charset=\"utf-8\">\n"
       "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no\">\n"
       + head.strip() + "\n</head>\n<body>\n<canvas" + body.rstrip() + "\n</body>\n</html>\n")
(root / "index.html").write_text(doc, encoding="utf-8")
print("index.html", len(doc), "bytes")
