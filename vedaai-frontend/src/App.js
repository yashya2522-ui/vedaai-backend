import { useState } from "react";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: "user", text: input };

    setMessages([...messages, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(
        "https://vedaai-backend-5.onrender.com/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: input }),
        }
      );

      const data = await res.json();

      const aiMsg = { role: "ai", text: data.reply };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Server error ❌" },
      ]);
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>VedaAI Web Chat 💬</h2>

      <div
        style={{
          height: 400,
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: 10,
          marginBottom: 10,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              textAlign: msg.role === "user" ? "right" : "left",
              margin: "10px 0",
            }}
          >
            <b>{msg.role === "user" ? "You" : "VedaAI"}:</b> {msg.text}
          </div>
        ))}

        {loading && <p>Typing...</p>}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask something..."
        style={{ width: "70%", padding: 10 }}
      />

      <button onClick={sendMessage} style={{ padding: 10 }}>
        Send
      </button>
    </div>
  );
}

export default App;