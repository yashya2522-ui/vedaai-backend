import React from "react";

function MessageToolbar({ text }) {

  const copyMessage = async () => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="message-toolbar">

      <button onClick={copyMessage}>
        📋 Copy
      </button>

      <button>
        🔄 Regenerate
      </button>

      <button>
        👍
      </button>

      <button>
        👎
      </button>

    </div>
  );
}

export default MessageToolbar;