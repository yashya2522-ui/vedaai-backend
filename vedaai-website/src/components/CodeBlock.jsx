import React, { useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="code-block">

      <div className="code-header">

        <span className="code-language">
          {language}
        </span>

        <CopyToClipboard
          text={value}
          onCopy={() => {
            setCopied(true);

            setTimeout(() => {
              setCopied(false);
            }, 2000);
          }}
        >
          <button className="code-copy-btn">
            {copied ? "✅ Copied" : "📋 Copy"}
          </button>
        </CopyToClipboard>

      </div>

      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={true}
        customStyle={{
          margin: 0,
          borderRadius: "0 0 12px 12px",
          fontSize: "14px",
          padding: "20px",
        }}
      >
        {value}
      </SyntaxHighlighter>

    </div>
  );
}

export default CodeBlock;