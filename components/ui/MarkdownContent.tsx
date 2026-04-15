'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('text-sm text-zinc-300 leading-relaxed space-y-3', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-semibold text-zinc-100 mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold text-zinc-100 mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-200 mt-2 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-zinc-300 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
        em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
        ul: ({ children }) => <ul className="list-none space-y-1 pl-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-none space-y-1 pl-2 counter-reset-list">{children}</ol>,
        li: ({ children, ...props }) => (
          <li className="flex gap-2 text-zinc-300">
            <span className="text-zinc-500 shrink-0 mt-0.5">{'ordered' in props ? '•' : '•'}</span>
            <span>{children}</span>
          </li>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-zinc-600 pl-4 text-zinc-400 italic my-2">
            {children}
          </blockquote>
        ),
        code: ({ children, className: codeClass }) => {
          const isBlock = codeClass?.startsWith('language-');
          if (isBlock) {
            const lang = codeClass?.replace('language-', '') ?? '';
            return (
              <div className="rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden my-2">
                {lang && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                    <span className="text-xs text-zinc-500 font-mono">{lang}</span>
                  </div>
                )}
                <pre className="p-4 overflow-x-auto">
                  <code className="text-xs text-zinc-300 font-mono leading-relaxed whitespace-pre">
                    {children}
                  </code>
                </pre>
              </div>
            );
          }
          return (
            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs font-mono text-zinc-200 border border-zinc-700">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-xs text-zinc-300 border-collapse w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-zinc-700 px-3 py-2 text-left font-semibold text-zinc-200 bg-zinc-800/60">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-zinc-700 px-3 py-2 text-zinc-300">{children}</td>
        ),
        hr: () => <hr className="border-zinc-800 my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
