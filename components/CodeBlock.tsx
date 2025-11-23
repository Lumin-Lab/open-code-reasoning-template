import React from 'react';

interface CodeBlockProps {
    code: string;
}

const tokenizeCode = (code: string) => {
    const tokens: { type: string; text: string }[] = [];
    
    // Regex patterns for Python highlighting
    const patterns = [
        { type: 'comment', regex: /(#.*)/ },
        { type: 'string', regex: /(".*?"|'.*?'|`.*?`)/ },
        { type: 'keyword', regex: /\b(def|class|import|from|return|if|else|elif|while|for|break|continue|try|except|finally|raise|with|as|pass|lambda|global|nonlocal|and|or|not|is|in|yield)\b/ },
        { type: 'boolean', regex: /\b(True|False|None)\b/ },
        { type: 'method', regex: /\b(print|len|range|list|dict|set|int|str|float|bool|type|append|extend)\b/ },
        { type: 'function', regex: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)(?=\()/ },
        { type: 'variable', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/ },
        { type: 'number', regex: /\b\d+\b/ },
        { type: 'punctuation', regex: /[{}()\[\];,.]/ },
        { type: 'operator', regex: /[=+\-*/%&|!<>?:]/ },
        { type: 'space', regex: /\s+/ }
    ];

    let remaining = code;
    
    while (remaining.length > 0) {
        let matchFound = false;
        
        for (const { type, regex } of patterns) {
            const match = remaining.match(regex);
            // Must match at the beginning of the string
            if (match && match.index === 0) {
                tokens.push({ type, text: match[0] });
                remaining = remaining.slice(match[0].length);
                matchFound = true;
                break;
            }
        }
        
        if (!matchFound) {
            // If no pattern matches, treat as plain text/variable
            tokens.push({ type: 'text', text: remaining[0] });
            remaining = remaining.slice(1);
        }
    }
    
    return tokens;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  const getColor = (type: string) => {
    switch (type) {
      case 'keyword': return 'text-[#c678dd]'; // Purple
      case 'function': return 'text-[#61afef]'; // Blue
      case 'string': return 'text-[#98c379]'; // Green
      case 'comment': return 'text-[#5c6370] italic'; // Grey
      case 'variable': return 'text-[#e06c75]'; // Red
      case 'punctuation': return 'text-[#abb2bf]'; // Light Grey
      case 'method': return 'text-[#e5c07b]'; // Gold/Yellow
      case 'boolean': return 'text-[#d19a66]'; // Orange
      case 'number': return 'text-[#d19a66]'; // Orange
      case 'operator': return 'text-[#56b6c2]'; // Cyan
      default: return 'text-[#abb2bf]';
    }
  };

  const tokens = tokenizeCode(code);

  return (
    <div className="bg-[#15171c] rounded-lg p-4 overflow-x-auto border border-white/5">
      <pre className="font-mono text-sm leading-relaxed whitespace-pre">
        <code>
          {tokens.map((token, index) => (
            <span key={index} className={getColor(token.type)}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
};