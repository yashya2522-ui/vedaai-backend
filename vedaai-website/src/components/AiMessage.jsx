import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import CodeBlock from "./CodeBlock";

import "./Message.css";

function AiMessage({ text, thinking }) {
  return (
    <div className="ai-message">

      <div className="ai-header">

        <div className="ai-avatar">
          🤖
        </div>

        <div className="ai-name">
          VedaAI
        </div>

        <button
          className="copy-btn"
          onClick={() => navigator.clipboard.writeText(text)}
        >
          📋 Copy
        </button>

      </div>

        <div className={
  thinking
  ? "ai-content thinking"
  : "ai-content"
}>

        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ children, className }) {
              const match = /language-(\w+)/.exec(className || "");

              if (match) {
                return (
                  <CodeBlock
                    language={match[1]}
                    value={String(children).replace(/\n$/, "")}
                  />
                );
              }

              return (
                <code className="inline-code">
                  {children}
                </code>
              );
            },
          }}
        >
          {text}
        </ReactMarkdown>

      </div>

    </div>
  );
}

export default AiMessage;