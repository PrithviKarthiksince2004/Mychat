const API = "/api";

let currentUser = null;
let activeChat = null;       // { type: 'user', username } or { type: 'group', groupId, groupName }
let allUsers = [];
let allGroups = [];
let pollTimers = {};

let stompClient = null;
let groupSubscription = null;
let groupTypingSubscription = null;
let selectedProfileFile = null;

// Reply / Forward states
let replyingToMessageId = null;
let messageToForward = null;

// Sidebar states
let recentChats = [];
let unreadCounts = {};
let searchQuery = "";

// Typing indicator state
let isTyping = false;
let typingTimeout = null;

// Theme, Sound and Notification states
let soundEnabled = true;
let notificationsGranted = false;

// Helper to get auth headers
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { "Authorization": "Bearer " + token } : {};
}

// Wrapper for fetch to automatically add JWT token
async function authFetch(url, options = {}) {
  options.headers = {
    ...getAuthHeaders(),
    ...options.headers
  };
  if (options.body instanceof FormData) {
    delete options.headers["Content-Type"];
  }
  const res = await fetch(url, options);
  if (res.status === 401) {
    handleLogout();
  }
  return res;
}

// Check if user is already logged in on load
window.addEventListener("DOMContentLoaded", () => {
  // Theme check
  const theme = localStorage.getItem("theme");
  if (theme === "light") {
    document.body.classList.add("light-theme");
  }

  // Sound check
  const soundPref = localStorage.getItem("sound");
  if (soundPref === "false") {
    soundEnabled = false;
    document.getElementById("sound-toggle").textContent = "🔇";
  }

  // Request browser notification permission
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      notificationsGranted = true;
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        notificationsGranted = (permission === "granted");
      });
    }
  }

  // Emoji picker listener
  const picker = document.querySelector('emoji-picker');
  if (picker) {
    picker.addEventListener('emoji-click', event => {
      const input = document.getElementById('message-input');
      input.value += event.detail.unicode;
      input.focus();
    });
  }

  // Check login
  const token = localStorage.getItem("token");
  const storedUser = localStorage.getItem("currentUser");
  if (token && storedUser) {
    currentUser = storedUser;
    document.getElementById("current-user").textContent = currentUser;
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    
    const myPic = localStorage.getItem("profilePicture") || "";
    updateMyAvatar(myPic);

    // Apply saved wallpaper
    const wall = localStorage.getItem("wallpaper");
    if (wall) setWallpaper(wall);

    initWebSocket();
    refreshAllUsers();
    refreshChatsList();
    pollTimers.chats = setInterval(refreshChatsList, 5000);
  }
});

// Update sidebar avatar thumbnail
function updateMyAvatar(filename) {
  const avatarEl = document.getElementById("my-avatar");
  if (filename) {
    avatarEl.src = `/api/media/download/${filename}`;
    avatarEl.style.display = "block";
  } else {
    avatarEl.style.display = "none";
  }
}

// ---------------- WEBSOCKETS ----------------

function initWebSocket() {
  if (stompClient && stompClient.connected) return;

  const socket = new SockJS('/ws');
  stompClient = Stomp.over(socket);
  stompClient.debug = null;

  stompClient.connect(
    { Authorization: "Bearer " + localStorage.getItem("token") },
    (frame) => {
      console.log("WebSocket connected!");
      
      // Personal queue for messages
      stompClient.subscribe('/user/queue/messages', (message) => {
        const msg = JSON.parse(message.body);
        handleIncomingMessage(msg);
      });

      // Global presence
      stompClient.subscribe('/topic/presence', (message) => {
        const pres = JSON.parse(message.body);
        handlePresenceUpdate(pres);
      });

      // Typing indicators (1-to-1)
      stompClient.subscribe('/user/queue/typing', (message) => {
        const payload = JSON.parse(message.body);
        handleTypingIndicatorMessage(payload);
      });
    },
    (error) => {
      console.error("WebSocket error, reconnecting...", error);
      setTimeout(initWebSocket, 5000);
    }
  );
}

function handleIncomingMessage(msg) {
  const existingMsgEl = document.getElementById(`msg-${msg.id}`);
  if (existingMsgEl) {
    const isCurrentGroup = activeChat?.type === "group" && msg.groupId === activeChat.groupId;
    const isCurrent1to1 = activeChat?.type === "user" && 
      ((msg.sender === currentUser && msg.receiver === activeChat.username) || 
       (msg.sender === activeChat.username && msg.receiver === currentUser));

    if (isCurrent1to1 || isCurrentGroup) {
      updateSingleMessageDom(msg, isCurrentGroup);
    }
    return;
  }

  const isCurrent1to1 = activeChat?.type === "user" && 
    ((msg.sender === currentUser && msg.receiver === activeChat.username) || 
     (msg.sender === activeChat.username && msg.receiver === currentUser));
     
  const isCurrentGroup = activeChat?.type === "group" && 
    msg.groupId === activeChat.groupId;

  if (isCurrent1to1 || isCurrentGroup) {
    appendSingleMessage(msg, activeChat?.type === "group");
    if (msg.sender !== currentUser) {
      authFetch(`${API}/messages/read?userViewing=${currentUser}&otherUser=${msg.sender}`, { method: "POST" });
    }
  } else {
    // Message in inactive chat - notify & update badge
    const key = msg.groupId ? `group_${msg.groupId}` : `user_${msg.sender}`;
    unreadCounts[key] = (unreadCounts[key] || 0) + 1;
    
    // Alert Sound
    playBeep();
    
    // Browser Notification
    if (document.hidden && notificationsGranted) {
      new Notification(`New message from ${msg.sender}`, {
        body: msg.content || "Media Attachment"
      });
    }
  }

  refreshChatsList();
}

function handlePresenceUpdate(pres) {
  const user = allUsers.find(u => u.username === pres.username);
  if (user) {
    user.online = pres.online;
    user.lastSeen = pres.lastSeen;
  }
  refreshChatsList();
}

// ---------------- TYPING STATUS ----------------

function handleMessageInput() {
  if (!stompClient || !stompClient.connected || !activeChat) return;

  if (!isTyping) {
    isTyping = true;
    sendTypingStatus(true);
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    sendTypingStatus(false);
  }, 1500);
}

function sendTypingStatus(typing) {
  if (!stompClient || !stompClient.connected || !activeChat) return;
  const payload = {
    chatType: activeChat.type,
    target: activeChat.type === "user" ? activeChat.username : String(activeChat.groupId),
    typing: typing
  };
  stompClient.send("/app/typing", {}, JSON.stringify(payload));
}

function handleTypingIndicatorMessage(payload) {
  if (!activeChat) return;
  const isCurrent1to1 = activeChat.type === "user" && 
    payload.chatType === "user" && 
    payload.sender === activeChat.username;
    
  const isCurrentGroup = activeChat.type === "group" && 
    payload.chatType === "group" && 
    parseInt(payload.target) === activeChat.groupId && 
    payload.sender !== currentUser;

  const indicator = document.getElementById("typing-indicator");
  if (isCurrent1to1 || isCurrentGroup) {
    if (payload.typing) {
      indicator.textContent = isCurrentGroup ? `${payload.sender} is typing...` : "typing...";
    } else {
      indicator.textContent = "";
    }
  }
}

// ---------------- SOUND ALERT SYNTHESIZER ----------------

function playBeep() {
  if (!soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch(e) {
    console.error("Audio synthesiser issue:", e);
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("sound", soundEnabled);
  document.getElementById("sound-toggle").textContent = soundEnabled ? "🔊" : "🔇";
}

// ---------------- THEME TOGGLE ----------------

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-theme");
  localStorage.setItem("theme", isLight ? "light" : "dark");
}

// ---------------- CHAT WALLPAPER PICKER ----------------

function toggleWallpaperMenu() {
  document.getElementById("wallpaper-menu").classList.toggle("hidden");
}

function setWallpaper(color) {
  const container = document.getElementById("messages");
  if (color === "default") {
    container.style.background = "";
    localStorage.removeItem("wallpaper");
  } else {
    container.style.background = color;
    localStorage.setItem("wallpaper", color);
  }
  document.getElementById("wallpaper-menu").classList.add("hidden");
}

// ---------------- ACTIVE CONVERSATION SEARCH ----------------

function handleMessageSearch() {
  const query = document.getElementById("message-search").value.toLowerCase().trim();
  const msgs = document.querySelectorAll("#messages .msg");
  msgs.forEach(el => {
    const textDiv = el.querySelector(".msg-content");
    if (!textDiv) return;
    const txt = textDiv.textContent.toLowerCase();
    if (txt.includes(query)) {
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  });
}

// ---------------- MOBILE RESPONSIVE NAVIGATION ----------------

function closeActiveChat() {
  document.body.classList.remove("chat-open");
  activeChat = null;
  document.getElementById("message-search").classList.add("hidden");
  document.getElementById("wallpaper-picker-btn").classList.add("hidden");
  document.getElementById("group-admin-actions").classList.add("hidden");
  
  if (groupSubscription) {
    groupSubscription.unsubscribe();
    groupSubscription = null;
  }
  if (groupTypingSubscription) {
    groupTypingSubscription.unsubscribe();
    groupTypingSubscription = null;
  }
  
  refreshChatsList();
}

// ---------------- EMOJI PICKER POPUP ----------------

function toggleEmojiPicker() {
  document.getElementById("emoji-picker-container").classList.toggle("hidden");
}

// Hide picker when clicking outside
window.addEventListener("click", (e) => {
  const pickerContainer = document.getElementById("emoji-picker-container");
  const triggerBtn = document.querySelector('[title="Emojis"]');
  if (pickerContainer && !pickerContainer.classList.contains("hidden") && !pickerContainer.contains(e.target) && e.target !== triggerBtn) {
    pickerContainer.classList.add("hidden");
  }
  
  const wallpaperMenu = document.getElementById("wallpaper-menu");
  const wallpaperBtn = document.getElementById("wallpaper-picker-btn");
  if (wallpaperMenu && !wallpaperMenu.classList.contains("hidden") && !wallpaperMenu.contains(e.target) && e.target !== wallpaperBtn) {
    wallpaperMenu.classList.add("hidden");
  }
});

// ---------------- AUTH ----------------

async function handleRegister() {
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!username || !password) return showAuthError("Enter a username and password");

  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) return showAuthError(await res.text());
  showAuthError("Registered! Now click Login.", false);
}

async function handleLogin() {
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!username || !password) return showAuthError("Enter a username and password");

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) return showAuthError(await res.text());

  const data = await res.json();
  currentUser = data.username;
  localStorage.setItem("token", data.token);
  localStorage.setItem("currentUser", currentUser);
  localStorage.setItem("bio", data.bio || "");
  localStorage.setItem("profilePicture", data.profilePicture || "");

  document.getElementById("current-user").textContent = currentUser;
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");

  updateMyAvatar(data.profilePicture);
  initWebSocket();
  refreshAllUsers();
  refreshChatsList();
  pollTimers.chats = setInterval(refreshChatsList, 5000);
}

async function handleLogout() {
  if (currentUser) {
    await authFetch(`${API}/auth/logout/${currentUser}`, { method: "POST" });
  }
  Object.values(pollTimers).forEach(clearInterval);
  if (groupSubscription) {
    groupSubscription.unsubscribe();
    groupSubscription = null;
  }
  if (groupTypingSubscription) {
    groupTypingSubscription.unsubscribe();
    groupTypingSubscription = null;
  }
  if (stompClient) {
    try { stompClient.disconnect(); } catch(e) {}
    stompClient = null;
  }
  currentUser = null;
  activeChat = null;
  localStorage.removeItem("token");
  localStorage.removeItem("currentUser");
  localStorage.removeItem("bio");
  localStorage.removeItem("profilePicture");
  
  document.getElementById("my-avatar").style.display = "none";
  document.body.classList.remove("chat-open");
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("auth-screen").classList.remove("hidden");
  showLoginSection();
}

function showAuthError(msg, isError = true) {
  const el = document.getElementById("auth-error");
  el.textContent = msg;
  el.style.color = isError ? "#f15c6d" : "#00e676";
}

// Navigation helpers
function showForgotSection() {
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("forgot-section").classList.remove("hidden");
  document.getElementById("reset-section").classList.add("hidden");
  showAuthError("", false);
}

function showResetSection() {
  document.getElementById("login-section").classList.add("hidden");
  document.getElementById("forgot-section").classList.add("hidden");
  document.getElementById("reset-section").classList.remove("hidden");
  showAuthError("", false);
}

function showLoginSection() {
  document.getElementById("login-section").classList.remove("hidden");
  document.getElementById("forgot-section").classList.add("hidden");
  document.getElementById("reset-section").classList.add("hidden");
  showAuthError("", false);
}

// Forgot/Reset Handlers
async function handleForgotPassword() {
  const username = document.getElementById("forgot-username").value.trim();
  if (!username) return showAuthError("Enter your username");

  const res = await fetch(`${API}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });
  if (!res.ok) return showAuthError(await res.text());

  const data = await res.json();
  document.getElementById("reset-token-display").textContent = data.token;
  document.getElementById("token-box").classList.remove("hidden");
  showAuthError("Token generated successfully!", false);
}

async function handleResetPassword() {
  const token = document.getElementById("reset-token").value.trim();
  const newPassword = document.getElementById("reset-new-password").value;
  if (!token || !newPassword) return showAuthError("Enter the token and new password");

  const res = await fetch(`${API}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword })
  });
  if (!res.ok) return showAuthError(await res.text());

  showAuthError("Password reset successfully! Switch to login to proceed.", false);
  setTimeout(showLoginSection, 2000);
}

// ---------------- PROFILE MODAL ----------------

function openProfileModal() {
  const bio = localStorage.getItem("bio") || "";
  const pic = localStorage.getItem("profilePicture") || "";
  document.getElementById("profile-bio-input").value = bio;
  
  const preview = document.getElementById("profile-preview-avatar");
  if (pic) {
    preview.src = `/api/media/download/${pic}`;
  } else {
    preview.src = `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser}`;
  }
  selectedProfileFile = null;
  document.getElementById("profile-modal").classList.remove("hidden");
}

function closeProfileModal() {
  document.getElementById("profile-modal").classList.add("hidden");
}

function handleProfilePictureSelected(input) {
  if (input.files && input.files[0]) {
    selectedProfileFile = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("profile-preview-avatar").src = e.target.result;
    };
    reader.readAsDataURL(selectedProfileFile);
  }
}

async function saveProfile() {
  const bio = document.getElementById("profile-bio-input").value.trim();
  const formData = new FormData();
  formData.append("bio", bio);
  if (selectedProfileFile) {
    formData.append("file", selectedProfileFile);
  }

  const res = await authFetch(`${API}/users/${currentUser}/profile`, {
    method: "PUT",
    body: formData
  });

  if (!res.ok) {
    alert("Failed to save profile: " + await res.text());
    return;
  }

  const data = await res.json();
  localStorage.setItem("bio", data.bio || "");
  if (data.profilePicture) {
    localStorage.setItem("profilePicture", data.profilePicture);
    updateMyAvatar(data.profilePicture);
  }
  closeProfileModal();
  refreshAllUsers();
  refreshChatsList();
}

// ---------------- CHAT LIST SIDEBAR ----------------

async function refreshAllUsers() {
  const res = await authFetch(`${API}/users`);
  if (!res.ok) return;
  allUsers = (await res.json()).filter(u => u.username !== currentUser);
}

async function refreshChatsList() {
  const res = await authFetch(`${API}/chats/recent`);
  if (!res.ok) return;
  recentChats = await res.json();
  
  const groupsRes = await authFetch(`${API}/groups/${currentUser}`);
  if (groupsRes.ok) {
    allGroups = await groupsRes.json();
  }

  renderRecentChatsList();
}

function handleSearch() {
  searchQuery = document.getElementById("search-input").value.toLowerCase().trim();
  renderRecentChatsList();
}

function togglePinChat(id, type) {
  const key = `pinned_${type}_${id}`;
  const isPinned = localStorage.getItem(key) === "true";
  localStorage.setItem(key, isPinned ? "false" : "true");
  renderRecentChatsList();
}

function renderRecentChatsList() {
  const container = document.getElementById("chat-list");
  container.innerHTML = "";

  const processedChats = recentChats.map(c => {
    const isPinned = localStorage.getItem(`pinned_${c.type}_${c.id}`) === "true";
    return { ...c, pinned: isPinned };
  });

  processedChats.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const timeA = a.lastMessageTimestamp ? new Date(a.lastMessageTimestamp).getTime() : 0;
    const timeB = b.lastMessageTimestamp ? new Date(b.lastMessageTimestamp).getTime() : 0;
    return timeB - timeA;
  });

  const filteredRecent = processedChats.filter(c => c.name.toLowerCase().includes(searchQuery));

  filteredRecent.forEach(c => {
    const isActive = activeChat && activeChat.type === c.type && 
      (c.type === "user" ? activeChat.username === c.id : activeChat.groupId === parseInt(c.id));
      
    const div = document.createElement("div");
    div.className = "contact-item" + (isActive ? " active" : "");
    
    const key = `${c.type}_${c.id}`;
    const unread = unreadCounts[key] !== undefined ? unreadCounts[key] : c.unreadCount;
    const badge = unread > 0 ? `<span class="unread-badge" style="background:#00e676; color:#111b21; border-radius:10px; padding:2px 6px; font-size:10px; font-weight:bold; margin-left:auto; display:inline-block;">${unread}</span>` : "";
    
    const avatarContent = c.type === "user" && c.avatar
      ? `<img src="/api/media/download/${c.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`
      : (c.type === "user" ? c.name[0].toUpperCase() : "#");
      
    const onlineIndicator = c.type === "user" ? `<div class="status-dot ${c.online ? "online" : ""}" style="margin-left:5px;"></div>` : "";
    const pinBtn = `<span class="pin-btn" onclick="event.stopPropagation(); togglePinChat('${c.id}', '${c.type}')" style="cursor:pointer; margin-left:8px; font-size:12px; opacity:${c.pinned ? 1 : 0.3};">${c.pinned ? "📌" : "📌"}</span>`;

    div.onclick = () => {
      if (c.type === "user") openUserChat(c.id);
      else openGroupChat(parseInt(c.id), c.name);
    };

    const lastMsgTime = c.lastMessageTimestamp 
      ? new Date(c.lastMessageTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) 
      : "";
      
    div.innerHTML = `
      <div class="avatar">${avatarContent}</div>
      <div style="flex:1; min-width:0; margin-left:10px; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-primary);">${c.name}</div>
          <div style="font-size:11px; color:var(--text-secondary);">${lastMsgTime}</div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:3px;">
          <div style="font-size:12px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; margin-right:5px;">${c.lastMessage || ""}</div>
          <div style="display:flex; align-items:center; gap:5px; flex-shrink:0;">
            ${badge}
            ${onlineIndicator}
            ${pinBtn}
          </div>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  if (searchQuery !== "") {
    const matchingUsers = allUsers.filter(u => 
      u.username.toLowerCase().includes(searchQuery) && 
      !processedChats.some(c => c.type === "user" && c.id === u.username)
    );

    if (matchingUsers.length > 0) {
      const header = document.createElement("h3");
      header.className = "section-title";
      header.style.marginTop = "15px";
      header.textContent = "Other Contacts";
      container.appendChild(header);

      matchingUsers.forEach(u => {
        const div = document.createElement("div");
        div.className = "contact-item";
        div.onclick = () => openUserChat(u.username);
        
        const avatarContent = u.profilePicture 
          ? `<img src="/api/media/download/${u.profilePicture}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />` 
          : u.username[0].toUpperCase();

        div.innerHTML = `
          <div class="avatar">${avatarContent}</div>
          <div class="contact-name" style="margin-left:10px; text-align:left; flex:1; color:var(--text-primary);">${u.username}</div>
          <div class="status-dot ${u.online ? "online" : ""}"></div>
        `;
        container.appendChild(div);
      });
    }
  }
}

// ---------------- CHAT: 1-to-1 ----------------

function openUserChat(username) {
  activeChat = { type: "user", username };
  document.body.classList.add("chat-open");
  
  // Set headers
  document.getElementById("chat-header-name").textContent = username;
  document.getElementById("chat-input-bar").classList.remove("hidden");
  document.getElementById("message-search").classList.remove("hidden");
  document.getElementById("wallpaper-picker-btn").classList.remove("hidden");
  document.getElementById("group-admin-actions").classList.add("hidden");
  
  if (groupSubscription) {
    groupSubscription.unsubscribe();
    groupSubscription = null;
  }
  if (groupTypingSubscription) {
    groupTypingSubscription.unsubscribe();
    groupTypingSubscription = null;
  }
  
  unreadCounts[`user_${username}`] = 0;
  document.getElementById("typing-indicator").textContent = "";
  
  cancelReply();
  refreshChatsList();
  loadConversation();
}

async function loadConversation() {
  if (!activeChat || activeChat.type !== "user") return;
  const res = await authFetch(`${API}/messages/conversation?userA=${currentUser}&userB=${activeChat.username}`);
  if (!res.ok) return;
  const messages = await res.json();
  renderMessages(messages, false);

  await authFetch(`${API}/messages/read?userViewing=${currentUser}&otherUser=${activeChat.username}`, { method: "POST" });
}

// ---------------- CHAT: group ----------------

function openGroupChat(groupId, groupName) {
  activeChat = { type: "group", groupId, groupName };
  document.body.classList.add("chat-open");
  
  document.getElementById("chat-header-name").textContent = `# ${groupName}`;
  document.getElementById("chat-input-bar").classList.remove("hidden");
  document.getElementById("message-search").classList.remove("hidden");
  document.getElementById("wallpaper-picker-btn").classList.remove("hidden");
  
  if (groupSubscription) {
    groupSubscription.unsubscribe();
    groupSubscription = null;
  }
  if (groupTypingSubscription) {
    groupTypingSubscription.unsubscribe();
    groupTypingSubscription = null;
  }
  
  if (stompClient && stompClient.connected) {
    groupSubscription = stompClient.subscribe(`/topic/group/${groupId}`, (message) => {
      const msg = JSON.parse(message.body);
      handleIncomingMessage(msg);
    });

    groupTypingSubscription = stompClient.subscribe(`/topic/group/${groupId}/typing`, (message) => {
      const payload = JSON.parse(message.body);
      handleTypingIndicatorMessage(payload);
    });
  }

  // Setup admin actions visibility
  const currentGroupObj = allGroups.find(g => g.id === groupId);
  if (currentGroupObj && currentGroupObj.adminUsername === currentUser) {
    document.getElementById("group-admin-actions").classList.remove("hidden");
  } else {
    document.getElementById("group-admin-actions").classList.add("hidden");
  }

  unreadCounts[`group_${groupId}`] = 0;
  document.getElementById("typing-indicator").textContent = "";

  cancelReply();
  refreshChatsList();
  loadGroupMessages();
}

async function loadGroupMessages() {
  if (!activeChat || activeChat.type !== "group") return;
  const res = await authFetch(`${API}/messages/group/${activeChat.groupId}`);
  if (!res.ok) return;
  const messages = await res.json();
  renderMessages(messages, true);
}

// ---------------- GROUP OPERATIONS ----------------

async function handleAddMemberClick() {
  if (!activeChat || activeChat.type !== "group") return;
  const username = prompt("Enter username of the user to add:");
  if (!username) return;

  const res = await authFetch(`${API}/groups/${activeChat.groupId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });

  if (res.ok) {
    alert(`Successfully added ${username} to group.`);
    refreshChatsList();
  } else {
    alert("Error adding member: " + await res.text());
  }
}

async function handleRemoveMemberClick() {
  if (!activeChat || activeChat.type !== "group") return;
  const username = prompt("Enter username of the user to remove:");
  if (!username) return;

  const res = await authFetch(`${API}/groups/${activeChat.groupId}/members/${username}`, {
    method: "DELETE"
  });

  if (res.ok) {
    alert(`Successfully removed ${username} from group.`);
    refreshChatsList();
  } else {
    alert("Error removing member: " + await res.text());
  }
}

async function handleRenameGroupClick() {
  if (!activeChat || activeChat.type !== "group") return;
  const groupName = prompt("Enter new name for the group:");
  if (!groupName) return;

  const res = await authFetch(`${API}/groups/${activeChat.groupId}/rename`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupName })
  });

  if (res.ok) {
    alert("Group renamed successfully.");
    document.getElementById("chat-header-name").textContent = `# ${groupName}`;
    refreshChatsList();
  } else {
    alert("Error renaming group: " + await res.text());
  }
}

// ---------------- SEND / RENDER / FILE ----------------

async function handleFileSelected(input) {
  if (!input.files || !input.files[0] || !activeChat) return;
  const file = input.files[0];
  
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await authFetch(`${API}/media/upload`, {
    method: "POST",
    body: formData
  });
  
  if (!res.ok) {
    alert("Upload failed: " + await res.text());
    return;
  }
  
  const media = await res.json();
  
  const body = {
    sender: currentUser,
    content: "",
    fileUrl: media.fileUrl,
    fileName: media.fileName,
    fileType: media.fileType,
    fileSize: media.fileSize
  };
  
  if (activeChat.type === "user") {
    body.receiver = activeChat.username;
  } else {
    body.groupId = activeChat.groupId;
  }

  if (replyingToMessageId) {
    body.parentMessageId = replyingToMessageId;
    cancelReply();
  }
  
  if (stompClient && stompClient.connected) {
    stompClient.send("/app/chat", {}, JSON.stringify(body));
  } else {
    await authFetch(`${API}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }
  
  input.value = "";
}

async function sendMessage() {
  const input = document.getElementById("message-input");
  const content = input.value.trim();
  if (!content || !activeChat) return;

  const body = { sender: currentUser, content };
  if (activeChat.type === "user") {
    body.receiver = activeChat.username;
  } else {
    body.groupId = activeChat.groupId;
  }

  if (replyingToMessageId) {
    body.parentMessageId = replyingToMessageId;
    cancelReply();
  }

  if (stompClient && stompClient.connected) {
    stompClient.send("/app/chat", {}, JSON.stringify(body));
  } else {
    await authFetch(`${API}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  input.value = "";
}

function renderMessages(messages, isGroup) {
  const container = document.getElementById("messages");
  container.innerHTML = "";
  messages.forEach(m => {
    appendSingleMessage(m, isGroup);
  });
}

function appendSingleMessage(m, isGroup) {
  const container = document.getElementById("messages");
  const div = document.createElement("div");
  div.id = `msg-${m.id}`;
  
  updateSingleMessageDom(m, isGroup, div);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function updateSingleMessageDom(m, isGroup, element = null) {
  const div = element || document.getElementById(`msg-${m.id}`);
  if (!div) return;

  const mine = m.sender === currentUser;
  div.className = "msg " + (mine ? "mine" : "theirs");

  const time = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const tick = mine ? `<span class="tick ${m.status === "READ" ? "read" : ""}">${m.status === "READ" ? "✓✓" : "✓"}</span>` : "";
  const senderLabel = (isGroup && !mine) ? `<div class="sender-label">${m.sender}</div>` : "";
  const editedLabel = m.edited && !m.deleted ? `<span style="font-size: 10px; color: #8696a0; margin-right: 5px; font-style: italic;">edited</span>` : "";

  let replyQuoteHtml = "";
  if (m.parentMessageId) {
    replyQuoteHtml = `
      <div class="reply-quote" onclick="scrollToMessage(${m.parentMessageId})">
        <div class="reply-quote-sender">${m.parentMessageSender}</div>
        <div class="reply-quote-content">${escapeHtml(m.parentMessageContent)}</div>
      </div>
    `;
  }

  let mediaHtml = "";
  if (m.fileUrl) {
    if (m.fileType && m.fileType.startsWith("image/")) {
      mediaHtml = `<div class="media-preview" style="margin-top: 5px;">
        <img src="${m.fileUrl}" style="max-width: 220px; max-height: 220px; border-radius: 6px; cursor: pointer; object-fit: cover;" onclick="window.open('${m.fileUrl}', '_blank')" />
      </div>`;
    } else if (m.fileType && m.fileType === "application/pdf") {
      mediaHtml = `<div class="media-preview" style="margin-top: 5px; background: rgba(0,0,0,0.12); padding: 8px; border-radius: 6px;">
        <a href="${m.fileUrl}" target="_blank" style="color: #00e676; text-decoration: none; display: flex; align-items: center; gap: 8px; font-size: 13px;">
          <span style="font-size: 18px;">📄</span>
          <span style="word-break: break-all; text-align:left;">${escapeHtml(m.fileName)}</span>
        </a>
      </div>`;
    }
  }

  let contentHtml = "";
  if (m.deleted) {
    contentHtml = `<div class="msg-content" style="font-style: italic; color: #8696a0;">This message was deleted</div>`;
  } else if (m.content) {
    contentHtml = `<div class="msg-content">${escapeHtml(m.content)}</div>`;
  }

  let actionsHtml = "";
  if (!m.deleted) {
    const isMine = m.sender === currentUser;
    const contentEscaped = escapeJsString(m.content || "");
    const fileUrlEscaped = escapeJsString(m.fileUrl || "");
    const fileNameEscaped = escapeJsString(m.fileName || "");
    const fileTypeEscaped = escapeJsString(m.fileType || "");
    
    actionsHtml = `
      <div class="msg-actions">
        <button class="msg-action-btn" title="Reply" onclick="replyToMessage(${m.id}, '${escapeJsString(m.sender)}', '${contentEscaped || (fileUrlEscaped ? "Media file" : "")}')">↩️</button>
        <button class="msg-action-btn" title="Forward" onclick="openForwardModal('${contentEscaped}', '${fileUrlEscaped}', '${fileNameEscaped}', '${fileTypeEscaped}', ${m.fileSize || 0})">➡️</button>
        <button class="msg-action-btn" title="Copy" onclick="copyToClipboard('${contentEscaped}')">📋</button>
        ${isMine ? `<button class="msg-action-btn" title="Edit" onclick="editMessage(${m.id}, '${contentEscaped}')">✏️</button>` : ""}
        ${isMine ? `<button class="msg-action-btn" title="Delete" onclick="deleteMessage(${m.id})">🗑️</button>` : ""}
      </div>
    `;
  }

  div.innerHTML = `${senderLabel}${replyQuoteHtml}${contentHtml}${mediaHtml}<div class="meta">${editedLabel}<span>${time}</span>${tick}</div>${actionsHtml}`;
}

function escapeJsString(str) {
  if (!str) return "";
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

// ---------------- MESSAGE ACTIONS IMPLEMENTATION ----------------

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text);
}

function replyToMessage(id, sender, text) {
  replyingToMessageId = id;
  document.getElementById("reply-preview-sender").textContent = sender;
  document.getElementById("reply-preview-text").textContent = text;
  document.getElementById("reply-preview-bar").classList.remove("hidden");
  document.getElementById("message-input").focus();
}

function cancelReply() {
  replyingToMessageId = null;
  document.getElementById("reply-preview-bar").classList.add("hidden");
  document.getElementById("reply-preview-sender").textContent = "";
  document.getElementById("reply-preview-text").textContent = "";
}

function scrollToMessage(id) {
  const el = document.getElementById(`msg-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const originalBg = el.style.background;
    el.style.background = "#2a3942";
    setTimeout(() => {
      el.style.background = originalBg;
    }, 1200);
  }
}

async function editMessage(id, oldContent) {
  const newContent = prompt("Edit your message:", oldContent);
  if (newContent === null) return;
  if (newContent.trim() === "") return alert("Message cannot be empty");
  if (newContent === oldContent) return;

  const res = await authFetch(`${API}/messages/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: newContent })
  });

  if (!res.ok) {
    alert("Failed to edit message: " + await res.text());
  }
}

async function deleteMessage(id) {
  if (!confirm("Are you sure you want to delete this message?")) return;

  const res = await authFetch(`${API}/messages/${id}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    alert("Failed to delete message: " + await res.text());
  }
}

// ---------------- FORWARDING IMPLEMENTATION ----------------

function openForwardModal(content, fileUrl, fileName, fileType, fileSize) {
  messageToForward = { content, fileUrl, fileName, fileType, fileSize };
  const container = document.getElementById("forward-targets-list");
  container.innerHTML = "";
  
  allUsers.forEach(u => {
    const div = document.createElement("div");
    div.className = "contact-item";
    div.style.padding = "8px 10px";
    div.style.borderBottom = "1px solid #2a3942";
    div.onclick = () => executeForward("user", u.username);
    div.innerHTML = `
      <div class="avatar" style="width:28px; height:28px; font-size:12px;">${u.username[0].toUpperCase()}</div>
      <div class="contact-name" style="font-size:14px; margin-left:10px; text-align:left; color:var(--text-primary);">${u.username}</div>
    `;
    container.appendChild(div);
  });

  allGroups.forEach(g => {
    const div = document.createElement("div");
    div.className = "group-item";
    div.style.padding = "8px 10px";
    div.style.borderBottom = "1px solid #2a3942";
    div.onclick = () => executeForward("group", g.id);
    div.innerHTML = `
      <div class="avatar" style="width:28px; height:28px; font-size:12px;">#</div>
      <div class="contact-name" style="font-size:14px; margin-left:10px; text-align:left; color:var(--text-primary);">${g.groupName}</div>
    `;
    container.appendChild(div);
  });

  document.getElementById("forward-modal").classList.remove("hidden");
}

function closeForwardModal() {
  document.getElementById("forward-modal").classList.add("hidden");
  messageToForward = null;
}

async function executeForward(type, target) {
  if (!messageToForward) return;
  const body = {
    sender: currentUser,
    content: messageToForward.content,
    fileUrl: messageToForward.fileUrl,
    fileName: messageToForward.fileName,
    fileType: messageToForward.fileType,
    fileSize: messageToForward.fileSize
  };
  
  if (type === "user") {
    body.receiver = target;
  } else {
    body.groupId = target;
  }
  
  if (stompClient && stompClient.connected) {
    stompClient.send("/app/chat", {}, JSON.stringify(body));
  } else {
    await authFetch(`${API}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  closeForwardModal();
  alert("Message forwarded!");
}

// ---------------- GROUP CREATION MODAL ----------------

function openGroupModal() {
  const box = document.getElementById("group-member-checkboxes");
  box.innerHTML = "";
  allUsers.forEach(u => {
    box.innerHTML += `<label><input type="checkbox" value="${u.username}"> ${u.username}</label>`;
  });
  document.getElementById("group-modal").classList.remove("hidden");
}

function closeGroupModal() {
  document.getElementById("group-modal").classList.add("hidden");
}

async function createGroup() {
  const groupName = document.getElementById("group-name-input").value.trim();
  if (!groupName) return;

  const members = Array.from(document.querySelectorAll("#group-member-checkboxes input:checked"))
    .map(cb => cb.value);

  await authFetch(`${API}/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupName, createdBy: currentUser, members })
  });

  document.getElementById("group-name-input").value = "";
  closeGroupModal();
  refreshChatsList();
}

function escapeHtml(str) {
  if (!str) return "";
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
