
import { useEffect, useState } from "react";
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
}) {

  // ================= USER =================
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [isPremium, setIsPremium] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {

    const name =
      localStorage.getItem("name") ||
      localStorage.getItem("userName") ||
      "User";

    const email =
      localStorage.getItem("email") ||
      "";

    const premium =
      localStorage.getItem("isPremium") === "true";

    const role =
      localStorage.getItem("role") ||
      "";

    setUserName(name);
    setUserEmail(email);
    setIsPremium(premium);
    setIsOwner(role === "owner");

  }, []);

  return (

    <div className="sidebar">

      {/* ================= LOGO ================= */}

      <div className="logo">
        <BsRobot />
        <span>VedaAI</span>
      </div>


      {/* ================= NEW CHAT ================= */}

      <button
        className="new-chat-btn"
        onClick={createNewChat}
      >
        <FiPlus />
        New Chat
      </button>


      {/* ================= SEARCH ================= */}

      <button className="search-btn">
        <FiSearch />
        Search
      </button>


      {/* ================= CHAT HISTORY ================= */}

      <div className="chat-history">

        {chatSessions && chatSessions.length > 0 ?

          chatSessions.map((chat) => (

            <div
              key={chat.id}
              className={
                chat.id === currentChatId
                  ? "history-item active"
                  : "history-item"
              }
              onClick={() => {

                setMessages(
                  chat.messages || []
                );

                setCurrentChatId(chat.id);

              }}
            >

              💬 {chat.title || "New Chat"}

            </div>

          ))

          :

          <p className="empty-history">
            No chats yet
          </p>

        }

      </div>


      {/* ================= BOTTOM USER ================= */}

      <div className="sidebar-bottom">

        <div className="user-profile">

          <div className="user-avatar">
            <HiOutlineUser />
          </div>

          <div className="user-info">

            <div className="user-name">
              {userName}
            </div>

            {userEmail && (
              <div className="user-email">
                {userEmail}
              </div>
            )}

            <div className="user-plan">

              {isOwner ? (

                <>
                  <RiVipCrownLine />
                  Owner
                </>

              ) : isPremium ? (

                <>
                  <RiVipCrownLine />
                  Premium
                </>

              ) : (

                <>
                  Free Plan
                </>

              )}

            </div>

          </div>

        </div>


        {/* SETTINGS */}

        <button className="settings-btn">
          <FiSettings />
          Settings
        </button>

      </div>

    </div>

  );
}

export default Sidebar;
