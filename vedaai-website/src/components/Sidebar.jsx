import "./../App.css";

import { FiPlus, FiSearch, FiSettings } from "react-icons/fi";
import { HiOutlineUser } from "react-icons/hi";
import { RiVipCrownLine } from "react-icons/ri";
import { BsRobot } from "react-icons/bs";
import "./Sidebar.css";

function Sidebar({
  chatSessions,
  currentChatId,
  setMessages,
  setCurrentChatId,
  createNewChat
})
 {

  return (
    <div className="sidebar">

      <div className="logo">
  <BsRobot className="logo-icon" />
  <span>VedaAI</span>
</div>

<button 
  className="new-chat-btn"
  onClick={createNewChat}
>

  <FiPlus />
  <span>New Chat</span>
</button>

<div className="search-box">
  <FiSearch className="search-icon" />

  <input
    type="text"
    placeholder="Search..."
  />
</div>
<div className="history">

  <h4>Chat History</h4>


  {
    chatSessions && chatSessions.length > 0 ?

    chatSessions.map((chat)=>(

      <div
        key={chat.id}
       className={
  chat.id === currentChatId
    ? "history-item active"
    : "history-item"
}
        onClick={()=>{
          
          setMessages(chat.messages);
          setCurrentChatId(chat.id);

        }}
      >

        💬 {chat.title}

      </div>

    ))

    :

    <p className="empty-history">
      No chats yet
    </p>

  }


</div>

      <div className="sidebar-bottom">

        <button>
  <HiOutlineUser />
  <span>Profile</span>
</button>

<button>
  <FiSettings />
  <span>Settings</span>
</button>

<button>
  <RiVipCrownLine />
  <span>Premium</span>
</button>

      </div>

    </div>
  );
}

export default Sidebar;