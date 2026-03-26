'use client';

import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { ImageResult } from '@/types';

interface ImageOutputProps {
  imageResult: ImageResult;
  prompt: string;
  textResponse?: string;
}

export function ImageOutput({ imageResult, prompt, textResponse }: ImageOutputProps) {
  function handleDownload() {
    const link = document.createElement('a');
    link.href = imageResult.url;
    link.download = `consensus-ai-${Date.now()}.png`;
    link.target = '_blank';
    link.click();
  }

  return (
    <div className="space-y-4">
      {/* Optional text response (hybrid mode) */}
      {textResponse && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {textResponse}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Image card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="warning" className="text-xs">
                {imageResult.provider === 'openai-image' ? 'DALL-E 3' : 'Gemini Imagen'}
              </Badge>
              <span className="text-xs text-zinc-500">
                {imageResult.width}×{imageResult.height}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-7 text-xs gap-1.5"
              >
                <Download className="w-3 h-3" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 text-xs gap-1.5"
              >
                <a href={imageResult.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3" />
                  Open
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Image display */}
          <div className="relative rounded-lg overflow-hidden bg-zinc-800 border border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageResult.url}
              alt={prompt}
              className="w-full h-auto max-h-[600px] object-contain"
              loading="lazy"
            />
          </div>

          {/* Revised prompt */}
          {imageResult.revisedPrompt && imageResult.revisedPrompt !== prompt && (
            <div className="mt-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
              <p className="text-[11px] font-medium text-zinc-500 mb-1 uppercase tracking-wide">
                Revised prompt
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed italic">
                "{imageResult.revisedPrompt}"
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
