
const WORKER_URL =
  window.CLOUDFLARE_WORKER_URL ||
  "https://loreal-worker.renakalil19.workers.dev/";

// System prompt — guides the assistant to only answer L'Oréal related questions and to refuse out-of-scope requests.
const SYSTEM_PROMPT = `You are the "L'Oréal Smart Product Advisor", an expert assistant that ONLY answers questions related to L'Oréal products, routines, and beauty recommendations (makeup, skincare, haircare, and fragrances). Politely refuse to answer any question unrelated to L'Oréal products, brand info, or beauty routines. Provide concise, accurate product suggestions, explain why each product suits the user, and give step-by-step routine recommendations when appropriate. Use a professional, friendly tone. If you need to ask clarifying questions, ask one focused question at a time.`;

// ======= DOM =======
const chatForm = document.getElementById("chatForm");
const userInputEl = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const currentQuestionEl = document.getElementById("currentQuestion");

// Conversation history (keeps role ordering and context)
let conversation = [{ role: "system", content: SYSTEM_PROMPT }];

// Util: scroll chat window to bottom
function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Util: create message bubble DOM
function appendMessage(role, text, meta) {
  const msg = document.createElement("div");
  msg.classList.add("msg", role === "user" ? "user" : "ai");
  // basic content
  msg.innerHTML = `<div class="content">${escapeHtml(text)}</div>`;
  if (meta) {
    const metaEl = document.createElement("div");
    metaEl.className = "meta";
    metaEl.textContent = meta;
    msg.appendChild(metaEl);
  }
  chatWindow.appendChild(msg);
  scrollToBottom();
  return msg;
}

// util: escape html
function escapeHtml(unsafe) {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Typing indicator
function showTypingIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "msg ai typing-wrapper";
  wrapper.id = "typingIndicator";
  wrapper.innerHTML = `<div class="typing" aria-hidden="true"><span></span><span></span><span></span></div>`;
  chatWindow.appendChild(wrapper);
  scrollToBottom();
}
function removeTypingIndicator() {
  const el = document.getElementById("typingIndicator");
  if (el) el.remove();
}

// Update displayed current question (resets each time)
function setCurrentQuestion(text) {
  if (!text) {
    currentQuestionEl.textContent = "";
    currentQuestionEl.style.opacity = "0.9";
    return;
  }
  currentQuestionEl.textContent = `Latest question: ${text}`;
  currentQuestionEl.style.opacity = "1";
}

// Handle form submission
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = userInputEl.value.trim();
  if (!userText) return;

  // Immediately display user message
  appendMessage("user", userText);
  setCurrentQuestion(userText);
  userInputEl.value = "";
  userInputEl.focus();

  // Add user message to conversation history
  conversation.push({ role: "user", content: userText });

  // Show typing indicator
  showTypingIndicator();

  try {
    // Build payload expected by the Cloudflare worker
    const payload = {
      // worker expects an object with "messages" array
      messages: conversation,
      temperature: 0.4,
      max_tokens: 450,
    };

    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      removeTypingIndicator();
      appendMessage(
        "ai",
        `Sorry — I couldn't reach the assistant (status ${resp.status}). Try again later.`
      );
      return;
    }

    const data = await resp.json();

    
    const aiText =
      data?.choices?.[0]?.message?.content ||
      data?.error ||
      "I'm sorry — no response received.";

    // Append AI message and add to conversation history
    removeTypingIndicator();
    appendMessage("ai", aiText);
    conversation.push({ role: "assistant", content: aiText });

    // Optionally: trim conversation to last N messages to avoid token bloat
    // keep system + last 8 turns
    const keep = 16; // adjust as needed
    if (conversation.length > keep + 1) {
      // ensure system prompt stays at index 0
      const system = conversation[0];
      const tail = conversation.slice(-keep);
      conversation = [system, ...tail];
    }
  } catch (err) {
    removeTypingIndicator();
    appendMessage(
      "ai",
      "An error occurred while contacting the assistant. Please try again."
    );
    console.error(err);
  }
});
