const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messagesBox = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const historyBox = document.getElementById("history");
const sendBtn = document.getElementById("sendBtn");
const sidebar = document.getElementById("sidebar");

let chats = [];
let activeId = null;
let busy = false;

function newChat() {
    const chat = {
        id: Date.now() + Math.random(),
        title: "New chat",
        messages: []
    };

    chats.unshift(chat);
    activeId = chat.id;
    render();
    input.focus();
}

function currentChat() {
    return chats.find(chat => chat.id === activeId);
}

function addMessage(role, text, typing = false) {
    const row = document.createElement("div");
    row.className = `message ${role === "user" ? "user" : "assistant"}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "Y" : "✦";

    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = text;

    if (typing) body.classList.add("typing");

    row.append(avatar, body);
    messagesBox.appendChild(row);
    row.scrollIntoView({ behavior: "smooth", block: "end" });

    return row;
}

function renderHistory() {
    historyBox.replaceChildren();

    chats.forEach(chat => {
        const button = document.createElement("button");
        button.className = "history-item";
        button.textContent = chat.title;

        if (chat.id === activeId) {
            button.classList.add("active");
        }

        button.addEventListener("click", () => {
            if (busy) return;
            activeId = chat.id;
            render();
            sidebar.classList.remove("open");
        });

        historyBox.appendChild(button);
    });
}

function render() {
    messagesBox.replaceChildren();

    const chat = currentChat();
    const hasMessages = chat && chat.messages.length > 0;

    welcome.hidden = Boolean(hasMessages);

    if (chat) {
        chat.messages.forEach(message => {
            addMessage(message.role, message.text);
        });
    }

    renderHistory();
}

async function sendMessage(text) {
    if (busy || !text.trim()) return;

    if (!currentChat()) newChat();

    const chat = currentChat();
    const cleanText = text.trim();

    if (cleanText.length > 4000) {
        addMessage("model", "Please keep your message under 4000 characters.");
        return;
    }

    if (chat.messages.length >= 40) {
        addMessage("model", "Please start a new chat.");
        return;
    }

    chat.messages.push({ role: "user", text: cleanText });

    if (chat.title === "New chat") {
        chat.title = cleanText.slice(0, 30) +
            (cleanText.length > 30 ? "..." : "");
    }

    busy = true;
    input.disabled = true;
    sendBtn.disabled = true;

    render();
    const loader = addMessage("model", "Thinking...", true);

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                messages: chat.messages.slice(-20)
            })
        });

        const data = await response.json();
        loader.remove();

        if (!response.ok) {
            addMessage("model", data.error || "Something went wrong.");
            return;
        }

        chat.messages.push({ role: "model", text: data.reply });
        addMessage("model", data.reply);

    } catch (error) {
        loader.remove();
        addMessage(
            "model",
            "Server se connection nahi ho raha. Check karo Flask running hai ya nahi."
        );
    } finally {
        busy = false;
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        renderHistory();
    }
}

form.addEventListener("submit", event => {
    event.preventDefault();

    const text = input.value;
    if (!text.trim() || busy) return;

    input.value = "";
    input.style.height = "auto";
    sendMessage(text);
});

input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

document.getElementById("newChat").addEventListener("click", () => {
    if (busy) return;
    newChat();
    sidebar.classList.remove("open");
});

document.getElementById("menuBtn").addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
        if (busy) return;
        input.value = button.dataset.prompt;
        form.requestSubmit();
    });
});

newChat();
