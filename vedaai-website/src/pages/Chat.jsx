import { useState, useEffect, useRef } from "react";
import "./../App.css";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import "./../Chat.css";
function Chat() {

  const [message, setMessage] = useState("");
  
  const [file,setFile] = useState(null);
 const [messages, setMessages] = useState([]);
const [chatSessions, setChatSessions] = useState([]);
const [currentChatId, setCurrentChatId] = useState(null);
const chatEndRef = useRef(null);

useEffect(() => {

  chatEndRef.current?.scrollIntoView({
    behavior: "smooth"
  });

}, [messages]);


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

 if(!currentChatId){

  const newChat = {
    id: Date.now(),

    title:
      userText.length > 25
      ? userText.substring(0,25) + "..."
      : userText,

    messages:[
      {
        role:"user",
        text:userText
      }
    ]
  };


  setChatSessions(prev=>[
    ...prev,
    newChat
  ]);


  setCurrentChatId(newChat.id);

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


    setMessages(prev => [
      ...prev,
      {
        role:"ai",
        text:text
      }
    ]);

    setChatSessions(prev =>
  prev.map(chat =>
    chat.id === currentChatId
    ?
    {
      ...chat,
      messages:[
        ...chat.messages,
        {
          role:"ai",
          text:text
        }
      ]
    }
    :
    chat
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
      {msg.text}
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