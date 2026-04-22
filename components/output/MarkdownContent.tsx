'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  citations?: string[];
  className?: string;
}

function injectCitations(content: string, citations?: string[]): string {
  if (!citations?.length) return content.replace(/\[\d+\]/g, '');
  return content.replace(/\[(\d+)\]/g, (match, n) => {
    const url = citations[parseInt(n, 10) - 1];
    return url ? `[${n}](${url})` : '';
  });
}

const components: Components = {
  h1: ({ children }) => <h1 className="text-xl font-bold text-zinc-100 mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-zinc-100 mt-4 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-zinc-100 mt-3 mb-1">{children}</h3>,
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-zinc-200">{children}</em>,
  ul: ({ children }) => <ul className="mb-3 space-y-1 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 space-y-1 pl-4 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="text-zinc-300 leading-relaxed"><span className="text-zinc-500 mr-1">•</span>{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="text-indigo-400 underline underline-offset-2 hover:text-indigo-300 transition-colors">
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <pre className="my-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800 overflow-x-auto text-xs font-mono text-zinc-300 leading-relaxed">
          <code>{children}</code>
        </pre>
      );
    }
    return <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 text-xs font-mono">{children}</code>;
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-zinc-600 pl-4 my-3 text-zinc-400 italic">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="text-left px-3 py-2 border-b border-zinc-700 text-zinc-300 font-medium">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 border-b border-zinc-800 text-zinc-400">{children}</td>,
  hr: () => <hr className="my-4 border-zinc-800" />,
};

export function MarkdownContent({ content, citations, className }: MarkdownContentProps) {
  const processed = injectCitations(content, citations);
  return (
    <div className={`text-sm text-zinc-300 ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
