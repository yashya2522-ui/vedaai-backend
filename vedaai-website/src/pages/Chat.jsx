import { useState, useEffect, useRef } from "react";
import "./../App.css";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import "./../Chat.css";
import AiMessage from "../components/AiMessage";

function Chat() {

  const [message, setMessage] = useState("");

const [file, setFile] = useState(null);

const [messages, setMessages] = useState([]);

const [chatSessions, setChatSessions] = useState([]);

const [currentChatId, setCurrentChatId] = useState(null);

const [isThinking, setIsThinking] = useState(false);

const [remainingTime, setRemainingTime] = useState("");

const [isSearching, setIsSearching] = useState(false);
const [sources, setSources] = useState([]);

const [isOwner, setIsOwner] = useState(false);

const [isPremium, setIsPremium] = useState(false);

const chatEndRef = useRef(null);

useEffect(() => {
  const savedChats = localStorage.getItem("vedaChats");

  if (savedChats) {
    const parsedChats = JSON.parse(savedChats);

    setChatSessions(parsedChats);

    if (parsedChats.length > 0) {
      setCurrentChatId(parsedChats[0].id);
      setMessages(parsedChats[0].messages || []);
    }
  }
}, []);

useEffect(() => {
  const role = localStorage.getItem("role");
  const premium =
    localStorage.getItem("isPremium") === "true";

  setIsOwner(role === "owner");
  setIsPremium(premium);

  console.log("WEB ROLE:", role);
  console.log("WEB PREMIUM:", premium);
}, []);


useEffect(() => {
  const timer = setInterval(() => {
    if (!currentChatId) return;

    const chat = chatSessions.find(
      c => String(c.id) === String(currentChatId)
    );

    if (!chat || !chat.resetTime) {
      setRemainingTime("");
      return;
    }

    const difference =
      new Date(chat.resetTime).getTime() -
      Date.now();

    if (difference <= 0) {
      setChatSessions(prev =>
        prev.map(c =>
          String(c.id) === String(currentChatId)
            ? {
                ...c,
                paused: false,
                resetTime: null,
                messageCount: 0
              }
            : c
        )
      );

      setRemainingTime("");
      return;
    }

    const hours = Math.floor(
      difference / (1000 * 60 * 60)
    );

    const minutes = Math.floor(
      (difference / (1000 * 60)) % 60
    );

    const seconds = Math.floor(
      (difference / 1000) % 60
    );

    setRemainingTime(
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`
    );
  }, 1000);

  return () => clearInterval(timer);
}, [currentChatId, chatSessions]);


useEffect(() => {

  chatEndRef.current?.scrollIntoView({
    behavior: "smooth"
  });

}, [messages]);

useEffect(() => {

  if(chatSessions.length > 0){

    localStorage.setItem(
      "vedaChats",
      JSON.stringify(chatSessions)
    );

    console.log(
      "SAVED HISTORY:",
      chatSessions
    );

  }

}, [chatSessions]);

const isSearchQuestion = (text) => {
  const searchWords = [
    "current",
    "latest",
    "today",
    "now",
    "price",
    "cost",
    "news",
    "recent",
    "weather",
    "available",
    "availability",
    "who is",
    "which is",
    "when is",
    "आत्ता",
    "आत्ताचा",
    "आत्ताची",
    "आत्ताचे",
    "आज",
    "आजचा",
    "आजची",
    "सध्याचा",
    "सध्याची",
    "सध्याचे",
    "किंमत",
    "भाव",
    "न्यूज",
    "ताजी माहिती"
  ];

  const lowerText = text.toLowerCase();

  return searchWords.some(word =>
    lowerText.includes(word.toLowerCase())
  );
};

const createNewChat = () => {

  setMessages([]);

  setCurrentChatId(null);

};

const sendMessage = async () => {

  if (file) {
    await uploadFile();
    setFile(null);
    return;
  }


  if (!message.trim()) return;


  const userText = message;
  setSources([]);

  let chatId = currentChatId;


  // CREATE NEW CHAT
  if (!chatId) {

    chatId = Date.now();


    const newChat = {
      id: chatId,
      title:
        userText.length > 25
          ? userText.substring(0, 25) + "..."
          : userText,
      messages: []
    };


    setChatSessions(prev => [
      newChat,
      ...prev
    ]);


    setCurrentChatId(chatId);

  }



  // USER MESSAGE
  const userMessage = {
    role:"user",
    text:userText
  };


  setMessages(prev => [
    ...prev,
    userMessage
  ]);



  // SAVE USER MESSAGE
  setChatSessions(prev =>
    prev.map(chat =>
      chat.id === chatId
        ? {
            ...chat,
            messages:[
              ...chat.messages,
              userMessage
            ]
          }
        : chat
    )
  );



  setMessage("");

const searching = isSearchQuestion(userText);

setIsThinking(true);
setIsSearching(searching);

// ADD THINKING MESSAGE
const thinkingMessage = {
  role: "ai",
  text: searching
    ? "Searching the web..."
    : "VedaAI is thinking...",
  thinking: true
};

setMessages(prev => [
  ...prev,
  thinkingMessage
]);


  setMessages(prev => [
    ...prev,
    thinkingMessage
  ]);



  try {


    const response = await fetch(
      "http://localhost:3000/chat",
      {

        method:"POST",

        headers:{

          "Content-Type":"application/json",

          "Authorization":
          "Bearer " + localStorage.getItem("token")

        },


       body: JSON.stringify({
  message: userText,
  chatId: String(chatId),
  history: messages
})

      }
    );

const data = await response.clone().json().catch(() => null);

if (data?.paused === true) {

  setChatSessions(prev =>
    prev.map(chat =>
      String(chat.id) === String(chatId)
        ? {
            ...chat,
            paused: true,
            resetTime: data.resetTime,
          }
        : chat
    )
  );

  setRemainingTime("");

  return;
}

    if(!response.ok){

      throw new Error(
        "Server Error"
      );

    }



    
  const reader = response.body.getReader();
const decoder = new TextDecoder();

let aiText = "";
let streamBuffer = "";

setIsSearching(true);

while (true) {
  const { done, value } = await reader.read();

  if (done) {
    break;
  }

  const chunk = decoder.decode(value, {
    stream: true
  });

  streamBuffer += chunk;

  // ==============================================
  // SOURCE JSON MESSAGE
  // ==============================================

  const lines = streamBuffer.split("\n");

  // शेवटची incomplete line buffer मध्ये ठेव
  streamBuffer = lines.pop() || "";

  for (const line of lines) {

    if (!line.trim()) {
      continue;
    }

    // ============================================
    // SOURCES
    // ============================================

    try {

      const parsed = JSON.parse(line);

      if (parsed.type === "sources") {

        console.log(
          "📚 SOURCES RECEIVED:",
          parsed.sources
        );

        setSources(
          parsed.sources || []
        );

        continue;
      }

    } catch (error) {
      // JSON नाही → normal AI text
    }

    // ============================================
    // NORMAL AI RESPONSE
    // ============================================

    aiText += line;

    setIsSearching(false);

    setMessages(prev => {

      const updated = [...prev];

      updated[updated.length - 1] = {
        role: "ai",
        text: aiText,
        thinking: false
      };

      return updated;

    });

    chatEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }
}

// ==============================================
// REMAINING BUFFER
// ==============================================

if (streamBuffer.trim()) {

  try {

    const parsed =
      JSON.parse(streamBuffer);

    if (parsed.type === "sources") {

      console.log(
        "📚 FINAL SOURCES:",
        parsed.sources
      );

      setSources(
        parsed.sources || []
      );

    } else {

      aiText += streamBuffer;

    }

  } catch (error) {

    aiText += streamBuffer;

  }
}

// ==============================================
// SEARCHING FINISHED
// ==============================================

setIsSearching(false);

// ==============================================
// FINAL AI MESSAGE
// ==============================================

const aiMessage = {
  role: "ai",
  text: aiText
};

setMessages(prev => {

  const updated = [...prev];

  updated[updated.length - 1] =
    aiMessage;

  return updated;

});

// ==============================================
// SAVE CHAT HISTORY
// ==============================================

setChatSessions(prev =>

  prev.map(chat =>

    chat.id === chatId

      ? {
          ...chat,

          messages: [
            ...chat.messages,
            aiMessage
          ]
        }

      : chat

  )

);


  }


  catch(error){


    console.log(
      "CHAT ERROR:",
      error
    );



    const errorMessage = {

      role:"ai",

      text:
      "AI is temporarily busy. Please try again."

    };



    setMessages(prev => [

      ...prev,

      errorMessage

    ]);

  }


};
const uploadFile = async () => {

  if(!file){
    alert("Please select file");
    return;
  }



  const formData = new FormData();

if (file.type === "application/pdf") {
  formData.append("file", file);   
} else if (file.type.startsWith("image/")) {
  formData.append("image", file);  // Image route
}



  try {

    let url = "";

    if(file.type === "application/pdf"){
      url = "http://localhost:3000/pdf";
    }
    else if(file.type.startsWith("image/")){
      url = "http://localhost:3000/image";
    }
    else{
      alert("Only PDF or Image allowed");
      return;
    }


    const response = await axios.post(
      url,
      formData,
      {
        headers:{
          "Content-Type":"multipart/form-data",
          "Authorization":
          "Bearer " + localStorage.getItem("token")
        }
      }
    );


    setMessages(prev=>[
      ...prev,
      {
        role:"ai",
        text:response.data.reply || response.data.message
      }
    ]);


  }
  catch(error){

    console.log(error);
    alert("Upload failed");

  }

};

return (
  <div className="chat-layout">

    <Sidebar
      chatSessions={chatSessions}
      currentChatId={currentChatId}
      setMessages={setMessages}
      setCurrentChatId={setCurrentChatId}
      createNewChat={createNewChat}
    />

    <div className="chat-main">

      <div className="chat-container">

        <h1>VedaAI Chat 🤖</h1>

        {/* ================= PAUSED CHAT ================= */}
        {!isOwner &&
          !isPremium &&
          chatSessions.find(
            chat =>
              String(chat.id) === String(currentChatId)
          )?.paused === true && (
            <div className="paused-container">

              <div className="paused-icon">⏸</div>

              <h2>Chats paused</h2>

              <p>
                You've reached the message limit
                <br />
                for this chat.
              </p>

              <span>Try again in</span>

              <strong>
                {remainingTime || "04:00:00"}
              </strong>

              <div className="paused-buttons">

                <button
                  onClick={createNewChat}
                  className="new-chat-btn"
                >
                  ＋ New Chat
                </button>

                <button
                  onClick={() => {
                    window.location.href =
                      "/subscription";
                  }}
                  className="upgrade-btn"
                >
                  👑 Upgrade
                </button>

              </div>

            </div>
          )}

        {/* ================= WELCOME ================= */}
        {messages.length === 0 && (
          <div className="welcome-message">
            👋 Welcome to VedaAI
            <br />
            Ask anything to get started.
          </div>
        )}

       {/* ================= SEARCHING ================= */}
        {isSearching && (
  <div className="searching-container">
    <div className="searching-dot"></div>

    <div className="searching-text">
      Searching...
    </div>

    <div className="searching-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
)}


        {/* ================= MESSAGES ================= */}
        <div className="messages-container">

          {messages.map((msg, index) => (

            msg.role === "ai" ? (

              <AiMessage
                key={index}
                message={msg}
              />

            ) : (

              <div
                className="user-wrapper"
                key={index}
              >

                <div className="user-msg">
                  {msg.text}
                </div>

                <div className="user-avatar">
                  👤
                </div>

              </div>

            )

          ))}

        </div>

        {/* ================= SOURCES ================= */}
{sources && sources.length > 0 && (
  <div className="sources-container">

    <div className="sources-title">
      Sources
    </div>

    <div className="sources-list">

      {sources.map((source, index) => (
        <a
          key={index}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="source-card"
        >

         <div className="source-logo">
  <img
    src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=64`}
    alt=""
    onError={(e) => {
      e.currentTarget.style.display = "none";
    }}
  />
</div>

          <div className="source-info">

            <div className="source-name">
              {source.title}
            </div>

            <div className="source-domain">
              {source.domain}
            </div>

          </div>

        </a>
      ))}

    </div>

  </div>
)}

          
      

        {/* ================= INPUT AREA ================= */}
        <div className="chat-input-area">

          {/* PDF */}
          <label className="upload-btn">
            📄

            <input
              hidden
              type="file"
              accept="application/pdf"
              onChange={(e) =>
                setFile(e.target.files[0])
              }
            />
          </label>

          {/* IMAGE */}
          <label className="upload-btn">
            🖼️

            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFile(e.target.files[0])
              }
            />
          </label>

          <input
            placeholder="Ask anything..."
            value={message}
            disabled={
              !isOwner &&
              !isPremium &&
              chatSessions.find(
                chat =>
                  String(chat.id) ===
                  String(currentChatId)
              )?.paused === true
            }
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
          />

          <button
            className="send-btn"
            onClick={sendMessage}
          >
            ➤
          </button>

        </div>

      </div>

    </div>

  </div>
);
}
export default Chat;
