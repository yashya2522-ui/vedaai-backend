import { useState } from "react";
import "./../App.css";
import axios from "axios";
import Sidebar from "../components/Sidebar";
function Chat() {

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [file,setFile] = useState(null);

const sendMessage = async () => {

  if(file){
    await uploadFile();
    setFile(null);
    return;
  }


  if(!message.trim()) return;

  const userText = message;

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

    <Sidebar />

    <div className="chat-main">

        <div className="chat-container">

            <h1>VedaAI Chat 🤖</h1>

            <div className="chat-box">

                {messages.map((msg,index)=>(

                    <div
                        key={index}
                        className={
                            msg.role==="user"
                            ? "user-msg"
                            : "ai-msg"
                        }
                    >
                        {msg.text}
                    </div>

                ))}

            </div>

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