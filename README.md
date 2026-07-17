# WhatsApp Clone (Spring Boot + Plain JS)

A REST-based chat app: 1-to-1 messaging, group chat, online/offline presence,
and read receipts. Frontend is plain HTML/CSS/JS served directly by Spring
Boot, so there's nothing to `npm install` — just run the backend.

> Real-time push (WebSocket/STOMP) was intentionally left out of this build.
> Right now the frontend **polls** the REST API every few seconds for new
> messages and presence updates, which is why chats aren't instant. That's
> the natural next upgrade if you want to add it back in later.

## Features
- Register / login (`users` table)
- 1-to-1 chat with persisted history (`messages` table)
- Group chat — create a group, add members, shared history
- Online/offline presence (heartbeat every 15s while the tab is open)
- Read receipts — single grey tick (sent) → double blue tick (read)

## Project structure
```
whatsapp-clone/
  pom.xml
  src/main/java/com/whatsapp/clone/
    WhatsappCloneApplication.java
    config/CorsConfig.java
    model/          User.java, Group.java, Message.java
    repository/      UserRepository, GroupRepository, MessageRepository
    service/         UserService, GroupService, MessageService
    controller/      AuthController, UserController, GroupController, MessageController
    dto/             AuthRequest, MessageRequest, GroupRequest
  src/main/resources/
    application.properties
    static/index.html, style.css, app.js   <- frontend
```

## Setup in Eclipse

1. **Import the project**
   `File → Import → Maven → Existing Maven Projects`, point it at the
   `whatsapp-clone` folder.

2. **Create the database**
   In MySQL Workbench / CLI:
   ```sql
   CREATE DATABASE whatsapp_clone;
   ```
   (`application.properties` also has `createDatabaseIfNotExist=true`, so
   this step is a backup — Spring will try to create it for you.)

3. **Set your MySQL password**
   Open `src/main/resources/application.properties` and replace
   `YOUR_MYSQL_PASSWORD` with your actual root password.

4. **Run it**
   Right-click `WhatsappCloneApplication.java` → `Run As → Java Application`.
   Hibernate will auto-create the `users`, `messages`, `chat_groups`, and
   `group_members` tables on first run (`ddl-auto=update`).

5. **Open it**
   Go to `http://localhost:8080` in your browser. Register two different
   users in two separate browser windows (or one normal + one incognito) to
   test chat between them.

## Trying it out
- Register `alice` and `bob` in two windows.
- Log in as both, click on each other in the contact list, send messages.
- Watch the tick change from grey (✓) to blue (✓✓) once the other person
  opens the chat — that's the read receipt.
- Click **+ New Group**, name it, check a couple of members, and chat there too.

## Known limitations (worth mentioning if asked in an interview)
- Passwords are stored in plain text — fine for a learning project, but a
  real app needs BCrypt hashing (Spring Security has this built in).
- No JWT/session auth — anyone can call the API as any user if they know
  the username. Add Spring Security + JWT as a next step.
- Updates are polling-based, not real-time push (see note above).
- No image/file sharing yet.

## Natural next steps
- Add WebSocket/STOMP back in for real push updates and typing indicators
  (this is the part you're planning to build out separately).
- Add Spring Security with JWT.
- Add file/image message support.
- Dockerize it for deployment.
