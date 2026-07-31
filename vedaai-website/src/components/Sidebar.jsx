import "./../App.css";

function Sidebar() {
  return (
    <div className="sidebar">

      <div className="logo">
        🤖 <span>VedaAI</span>
      </div>

      <button className="new-chat-btn">
        ➕ New Chat
      </button>

      <div className="search-box">
        <input
          type="text"
          placeholder="🔍 Search..."
        />
      </div>
<div className="history">

  <h4>Chat History</h4>

  <p className="empty-history">
    No chats yet
  </p>

</div>

      <div className="sidebar-bottom">

        <button>
          👤 Profile
        </button>

        <button>
          ⚙️ Settings
        </button>

        <button>
          👑 Premium
        </button>

      </div>

    </div>
  );
}

export default Sidebar;