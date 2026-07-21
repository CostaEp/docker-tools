# 🐳 DockerForge v1.1.0 — מדריך הרצה בסביבת Air-Gap (RHEL 9 / Podman / Docker)

מדריך זה מפרט את הצעדים להרצת **DockerForge v1.1.0** בסביבה סגורה ללא חיבור לאינטרנט (Air-Gapped Environment) כגון Red Hat Enterprise Linux 9 (RHEL 9) או שרת מנותק רשת.

---

## 📦 תוכן חבילת ה-Air-Gap (`dockerforge-release-v1.1.0.tar.gz`)

בתוך ארכיב ה-`tar.gz` שתחלץ נמצאים הקבצים הבאים:
* `dockerforge-1.1.0-image.tar` — אימג' Docker/Podman מיוצא ומוכן מראש (~95MB).
* `start-airgap.sh` — סקריפט הפעלה אוטומטי המזהה מנוע (Docker/Podman), טוען את האימג' ומריץ את המערכת.
* `docker-compose.yml` — קובץ Docker Compose מוכן לפריסה.
* `AIRGAP_GUIDE.md` — מדריך ההרצה הנוכחי.
* `WIKI.md`, `FEATURES.md`, `CHANGELOG.md`, `SBOM.json` — תיעוד מלא ומידע אבטחה.

---

## 🚀 שיטת הרצה 1: הרצה אוטומטית (מומלצת - פקודה אחת)

1. **חילוף הארכיב בשרת היעד:**
   ```bash
   tar -xzf dockerforge-1.1.0.tar.gz
   cd dockerforge-release-v1.1.0
   ```

2. **הרצת סקריפט ההפעלה האוטומטי:**
   ```bash
   ./start-airgap.sh
   ```
   *(הסקריפט יטען אוטומטית את `dockerforge-1.1.0-image.tar` ל-Docker או ל-Podman ויעלה את הקונטיינר).*

3. **גישה למערכת:**
   פתח דפדפן בכתובת: **`http://localhost:9090`** (או `http://<IP-OF-RHEL-SERVER>:9090`).

---

## 🛠️ שיטת הרצה 2: הרצה ידנית ב-Docker

1. **טעינת האימג' המוכנה מראש:**
   ```bash
   docker load -i dockerforge-1.1.0-image.tar
   ```

2. **הרצת הקונטיינר:**
   ```bash
   docker run -d \
     --name dockerforge \
     -p 9090:3000 \
     -v /var/run/docker.sock:/var/run/docker.sock \
     --restart unless-stopped \
     docker-tools-dockerforge:latest
   ```

---

## 🛡️ שיטת הרצה 3: הרצה ב-RHEL 9 עם Podman

1. **הפעלת שירות ה-Socket של Podman ב-RHEL 9 (מידע חד פעמי):**
   ```bash
   systemctl enable --now podman.socket
   ```

2. **טעינת האימג' ב-Podman:**
   ```bash
   podman load -i dockerforge-1.1.0-image.tar
   ```

3. **הרצת הקונטיינר ב-Podman:**
   ```bash
   podman run -d \
     --name dockerforge \
     -p 9090:3000 \
     -v /run/podman/podman.sock:/var/run/docker.sock \
     --restart unless-stopped \
     docker-tools-dockerforge:latest
   ```

---

## ✨ פיצ'רים מרכזיים בגרסה v1.1.0

1. **ניהול קונטיינרים מלא**: צפייה, הרצה, עצירה, פילטור לוגים בזמן אמת וניטור משאבים (CPU/Memory/IO).
2. **טרמינל משולב (`xterm.js`)**: חיבור TTY ישיר אל תוך קונטיינרים.
3. **Build Specification Exporter**: מחולל אוטומטי של `docker-compose.yml`, `Dockerfile`, ו-`pod.yaml` מתוך כל קונטיינר.
4. **Helm Chart Generator**: מחולל אוטומטי של חבילות Helm מלאות ופרמטריות (`Chart.yaml`, `values.yaml`, `templates/deployment.yaml`, `templates/service.yaml`, `templates/_helpers.tpl`) כולל העתקה והורדה.
