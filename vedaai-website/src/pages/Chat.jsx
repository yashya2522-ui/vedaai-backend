import { useState, useEffect, useRef } from "react";
import "./../App.css";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import "./../Chat.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
function Chat() {

  const [message, setMessage] = useState("");
  
  const [file,setFile] = useState(null);
 const [messages, setMessages] = useState([]);
const [chatSessions, setChatSessions] = useState([]);
const [currentChatId, setCurrentChatId] = useState(null);

const chatEndRef = useRef(null);

useEffect(() => {

  const savedChats = localStorage.getItem("vedaChats");

  if (savedChats) {

    const parsedChats = JSON.parse(savedChats);

    setChatSessions(parsedChats);

    if (parsedChats.length > 0) {

      setCurrentChatId(parsedChats[0].id);

      setMessages(parsedChats[0].messages);

    }

  }

}, []);

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


const createNewChat = () => {

  setMessages([]);

  setCurrentChatId(null);

};

const sendMessage = async () => {

  if(file){
    await uploadFile();
    setFile(null);
    return;
  }


  if(!message.trim()) return;

  const userText = message;

let chatId = currentChatId;

if (!chatId) {

  chatId = Date.now();

  const newChat = {
  id: chatId,
  title:
    userText.length > 25
      ? userText.substring(0, 25) + "..."
      : userText,
  messages: [
    {
      role: "user",
      text: userText
    }
  ]
};

setChatSessions(prev => [newChat, ...prev]);

  setCurrentChatId(chatId);

}



  setMessages(prev => [
    ...prev,
    {
      role:"user",
      text:userText
    }
  ]);
  

  setMessage("");

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
        body:JSON.stringify({
          message:userText
        })
      }
    );


   const text = await response.text();

console.log("CHAT RESPONSE:", text);

let aiReply = text;

try {

  const data = JSON.parse(text);

  aiReply = data.message || data.reply || text;

}
catch(error){

  console.log("Response is normal text");

}


    setMessages(prev => [
      ...prev,
      {
        role:"ai",
        text: aiReply
      }
    ]);

   setChatSessions(prev =>
  prev.map(chat =>
    chat.id === chatId
      ? {
          ...chat,
          messages: [
            ...chat.messages,
            {
              role: "ai",
              text:aiReply
            }
          ]
        }
      : chat
  )
);

  } catch(error){

    console.log(error);

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
<div className="chat-box">

  {messages.length === 0 && (
    <div className="welcome">
      <h2>👋 Welcome to VedaAI</h2>
      <p>Ask anything to get started.</p>
    </div>
  )}

 {messages.map((msg,index)=>(

  <div
    key={index}
    className={
      msg.role === "user"
      ? "message-row user-row"
      : "message-row ai-row"
    }
  >

    <div className="avatar">
      {
        msg.role === "user"
        ? "👤"
        : "🤖"
      }
    </div>


    <div
  className={
    msg.role === "user"
    ? "user-msg"
    : "ai-msg"
  }
>

{
  msg.role === "ai" ? (

    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {msg.text}
    </ReactMarkdown>

  ) : (

    msg.text

  )
}

</div>


  </div>

))}

<div ref={chatEndRef}></div>

</div>


{file && (
  <div className="file-name">
    📎 {file.name}
  </div>
)}
            <div className="chat-input">

                {/* PDF */}

                <label className="upload-btn">
                    📄
                    <input
                        hidden
                        type="file"
                        accept="application/pdf"
                        onChange={(e)=>setFile(e.target.files[0])}
                    />
                </label>

                {/* Image */}

                <label className="upload-btn">
                    🖼️
                    <input
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={(e)=>setFile(e.target.files[0])}
                    />
                </label>

                <input
                    placeholder="Ask anything..."
                    value={message}
                    onChange={(e)=>setMessage(e.target.value)}
                    onKeyDown={(e)=>{
                        if(e.key==="Enter"){
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