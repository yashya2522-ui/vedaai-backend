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

const openRazorpay = () => {

  console.log("Razorpay button clicked");

  console.log(window.Razorpay);

  const options = {

    key: "rzp_test_THkZEInKs5IhSL",

    amount: 19900,

    currency: "INR",

    name: "VedaAI",

    description: "VedaAI Premium Subscription",

    handler: function (response) {

      alert("Payment Successful ✅");

      console.log(response);

    },

    theme: {
      color: "#00e5ff"
    }

  };


  const razorpay = new window.Razorpay(options);

  razorpay.open();

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
<section className="features">

<h2>VedaAI Features 🚀</h2>

<div className="cards">

<div className="card">
<h3>🤖 AI Chat</h3>
<p>Ask questions and get instant AI answers.</p>
</div>


<div className="card">
<h3>📄 PDF Chat</h3>
<p>Upload PDF and chat with your documents.</p>
</div>


<div className="card">
<h3>🖼️ Image AI</h3>
<p>Analyze images using Artificial Intelligence.</p>
</div>


<div className="card">
<h3>🎤 Voice AI</h3>
<p>Talk with VedaAI using your voice.</p>
</div>

</div>

</section>



<section className="pricing">

<h2>Premium Plans 💎</h2>

<div className="price-card">

<h3>VedaAI Premium</h3>

<h1>₹199 / Month</h1>

<p>
Unlimited AI Chat
<br/>
PDF Analysis
<br/>
Priority Response
</p>


<button onClick={openRazorpay}>
Subscribe Now
</button>


</div>

</section>

    </div>
  );
}

export default App;