# 🛡️ MobyDock v2.4.5 — RHEL 9 Air-Gap Deployment Guide

> **100% Offline Installation Package for Red Hat Enterprise Linux 9 (RHEL 9) & Podman / Docker**  
> **GateScanner / AV Sanitized (0 non-Linux binaries, 0 .bare, 0 .exe)**

---

## 📋 מדריך פריסה בסביבה סגורה (Air-Gap) — Red Hat Enterprise Linux 9

חבילה זו מיועדת לפריסה מלאה בסביבה רשתית סגורה ללא חיבור לאינטרנט. החבילה עברה בדיקת הלבנה מלאה (GateScanner Clean Audit) ונבדקה עבור **RHEL 9**, **Podman**, ו-**Docker Engine**.

---

### 🚀 שלבי ההתקנה במכונת RHEL 9 (ב-3 צעדים פשוטים):

1. **העבר את הארכיון למכונת ה-RHEL 9** (באמצעות דיסק-און-קי מולבן או תקשורת סגורה):
   ```bash
   tar -zxvf mobydock-v2.4.5-airgap-rhel9.tar.gz
   cd airgap-dist
   ```

2. **הרצ את סקריפט ההתקנה בלחיצת כפתור אחת**:
   ```bash
   ./install.sh
   ```

3. **התחבר לממשק האפליקציה**:
   - 📱 **ממשק המשתמש (MobyDock Web UI)**:  
     👉 **`http://localhost:9090`** (או `http://SERVER_IP:9090`)

   - 🚦 **לוח הבקרה הוויזואלי Traefik API Gateway**:  
     👉 **`http://localhost:8080/dashboard/`**

---

### 📦 תכולת החבילה:

- **`images/mobydock-stack-images.tar`**: ארכיון התמונות המוכנות לייבוא מראש (`docker-tools-gateway`, `core`, `qa`, `files`, `terminal`).
- **`install.sh`**: סקריפט התקנה אוטומטי המזהה Podman/Docker.
- **`docker-compose.yml`**: קובץ הפריסה של 5 ה-Microservices.
- **`services/`**: קבצי הגדרה פנימיים ו-Traefik Dynamic Routing (`traefik_dynamic.yml`).

---

### 🛡️ תוצאות בדיקת הלבנה (GateScanner AV Compliance):
- **קבצי `.bare`**: 0
- **קבצי `.exe` / `.dll` / `.dylib`**: 0
- **תיקיות `win32` / `darwin`**: 0 (נמחקו לחלוטין לקבלת 100% תאימות ל-RHEL 9)

---

### 📄 רישיון ויוצרים:
נבנה ומתוחזק ע"י **Costa Epshtein** & **Antigravity AI (Google DeepMind)**.
