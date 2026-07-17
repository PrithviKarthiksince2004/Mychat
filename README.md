# WhatsApp Clone (Spring Boot + Plain JS)

A secure, fully real-time messaging application featuring 1-to-1 chats, group conversations, online presence tracking, media sharing, and rich interactive features. The frontend is built with vanilla HTML/CSS/JS (no build steps), and the backend runs on Spring Boot 3.3.4 (Java 17) connected to MySQL.

**Live Deployment URL:** [https://mychat-production-0c9e.up.railway.app](https://mychat-production-0c9e.up.railway.app)

---

## 🚀 Implemented Features

### Phase 1: Secure Authentication
- **BCrypt Password Hashing:** Replaced legacy plaintext credentials with secure BCrypt encryption.
- **JWT (JSON Web Tokens):** Implemented stateless session management. All REST API requests authenticate via `Authorization: Bearer <token>` headers.
- **Forgot & Reset Password Flow:** Created safe recovery endpoints returning tokens to update credentials.

### Phase 2: Profile & Real-Time Presence
- **User Profiles:** Users can set a custom biography and upload profile pictures.
- **WebSocket Presence Listeners:** Tracks online status via STOMP connection session listeners (`SessionConnectedEvent`/`SessionDisconnectEvent`), toggling active indicators instantly across the interface.

### Phase 3: Real-Time Chat Core
- **WebSocket Stream (SockJS & STOMP):** Removed all legacy polling loops, switching to bidirectional real-time channels over WebSocket broker routes `/ws`.

### Phase 4: Media Attachments
- **Multipart API Uploads:** Added rest controllers for uploading/downloading files.
- **Inline Previews:** Renders image files inline in message bubbles and PDF files as download links.

### Phase 5: Interactive Message Actions
- **Hover Action Toolbar:** Users can copy, quote-reply, forward, edit, and delete messages.
- **Soft Deletion & Edits:** Soft-deleted messages clear content in the database and display *"This message was deleted"*. Edits display an *"edited"* label.

### Phase 6: Unified Sidebar Chat List
- **Collated Chat List:** Combined 1-to-1 and group chats in one list sorted by last message timestamp.
- **Pinning & Search:** Pin favorite chats to the top and filter contacts/chats via search input.
- **Unread Badge Counts:** Displays real-time counts for unread messages.

### Phase 7: Real-Time Typing & Delivered Statuses
- **Typing Indicators:** Broadcasts start/stop typing events to user queues or group topics, showing *"Username is typing..."* updates.
- **Status Ticks:**
  - `✓` (Sent): Message persisted in the DB.
  - `✓✓` (Delivered): Marked immediately if the recipient is online, or updated when they connect.
  - `✓✓` (Read - Blue): Turns blue when the recipient opens the conversation.

### Phase 8 & 9: Notifications & Group Administration
- **Web Audio Alert:** Synthesizes a notification chime using the HTML5 Web Audio API (no assets needed).
- **Web Notifications API:** Triggers browser popup alerts when the browser window is out of focus.
- **Group Admin Controls:** Group creators are assigned the `admin` role, letting them add/remove members and rename groups.

### Phase 10: Premium Polish
- **Emoji Picker:** Integrated `emoji-picker-element` CDN to append emojis directly.
- **Dark/Light Theme Toggle:** Supports a smooth transition between theme layouts.
- **In-Chat Message Search:** Allows instant client-side filtering of messages in the active chat.
- **Wallpaper Color Picker:** Customize message board background colors.
- **Responsive Layout:** Adjusts dynamically for mobile viewport sizes.

---

## 🛠️ Technology Stack
- **Backend:** Java 17, Spring Boot 3.3.4, Spring Security, Spring WebSocket STOMP
- **Database:** MySQL, Spring Data JPA, Hibernate DDL Auto-update
- **Frontend:** Vanilla HTML5, Vanilla CSS3 (Variables & Flexbox), Vanilla ES6 JavaScript
- **Libraries:** SockJS Client, StompJS, JJWT

---

## 📦 Deployment Steps (Railway)

We deployed the application live on Railway. The steps taken:

1. **Procfile Configuration:** Created `Procfile` mapping the web entry point:
   ```text
   web: java -jar target/clone-1.0.0.jar
   ```

2. **Database Provisioning:** Added a managed MySQL database container inside the Railway project.

3. **Application Properties Bindings:** Configured JDBC database connection properties to resolve dynamically from Railway environment variables on boot:
   ```properties
   spring.datasource.url=jdbc:mysql://${MYSQLHOST:localhost}:${MYSQLPORT:3306}/${MYSQLDATABASE:whatsapp_clone}?createDatabaseIfNotExist=true
   spring.datasource.username=${MYSQLUSER:root}
   spring.datasource.password=${MYSQLPASSWORD:}
   ```

4. **Service Setup & Upload:**
   - Linked the project using `railway link`.
   - Setup a dedicated service `Mychat`.
   - Deployed the code via `railway up`.
   - Exposed the public domain `https://mychat-production-0c9e.up.railway.app`.

5. **Persistent Storage (Optional for uploads):**
   To make uploads persistent across container restarts, mount a **Persistent Volume** on Railway to `/app/uploads` (or set the `UPLOAD_DIR` variable to a mounted directory path).

---

## Deploy on Render (Blueprint)

This repo includes a `render.yaml` Blueprint that provisions:

- **mychat** — Docker web service (Spring Boot)
- **mychat-mysql** — private MySQL service with persistent disk
- **uploads disk** — persistent storage for media files

### One-click deploy

1. Push `Dockerfile`, `render.yaml`, and `.dockerignore` to the `main` branch on GitHub.
2. Go to [Render Dashboard → New Blueprint](https://dashboard.render.com/blueprint/new).
3. Connect GitHub and select `PrithviKarthiksince2004/Mychat`.
4. Review the services and click **Apply**.
5. Wait for both services to deploy (first build takes ~5–10 minutes).
6. Open the **mychat** web service URL (e.g. `https://mychat.onrender.com`).

### Manual deploy (without Blueprint)

1. **MySQL:** New → Private Service → Docker → use [render-examples/mysql](https://github.com/render-examples/mysql). Add a 10 GB disk at `/var/lib/mysql` and set `MYSQL_DATABASE=whatsapp_clone`.
2. **Web app:** New → Web Service → connect this repo → Runtime: **Docker**.
3. **Environment variables** on the web service:

   | Key | Value |
   |-----|-------|
   | `MYSQLHOST` | Internal hostname of MySQL service |
   | `MYSQLPORT` | `3306` |
   | `MYSQLDATABASE` | `whatsapp_clone` |
   | `MYSQLUSER` | Same as MySQL service |
   | `MYSQLPASSWORD` | Same as MySQL service |
   | `JWT_SECRET` | Random 32+ character string |
   | `UPLOAD_DIR` | `/app/uploads` |

4. Add a **1 GB disk** mounted at `/app/uploads` on the web service.
5. Deploy and open the generated URL.
