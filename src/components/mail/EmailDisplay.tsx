import { useState } from 'react';
import { Letter } from 'react-letter';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageIcon } from 'lucide-react';

interface EmailDisplayProps {
  html: string;
  from: string;
  date: string;
  subject?: string;
}

export function EmailDisplay({ html, from, date, subject }: EmailDisplayProps) {
  const [showRemoteImages, setShowRemoteImages] = useState(false);

  // Check if the email contains images
  const hasImages = /<img/i.test(html);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">{from}</p>
            <p className="text-xs text-muted-foreground">{date}</p>
            {subject && (
              <p className="text-sm font-semibold mt-2">{subject}</p>
            )}
          </div>
          {hasImages && !showRemoteImages && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRemoteImages(true)}
              className="flex items-center gap-2"
            >
              <ImageIcon className="h-4 w-4" />
              Load Images
            </Button>
          )}
        </div>
        {hasImages && !showRemoteImages && (
          <Badge variant="secondary" className="w-fit">
            Images blocked for your safety
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div
          className="prose prose-sm max-w-none prose-headings:font-semibold prose-p:text-sm prose-p:leading-relaxed"
          style={{
            fontSize: '14px',
            lineHeight: '1.6',
          }}
        >
          <Letter
            html={html}
            className={showRemoteImages ? '' : 'email-display-no-images'}
          />
        </div>
      </CardContent>

      <style>{`
        .email-display-no-images img {
          display: none !important;
        }

        /* Override any inline styles that might make text too large */
        .prose * {
          max-width: 100%;
        }

        /* Ensure proper email formatting */
        .prose table {
          font-size: inherit;
        }

        .prose blockquote {
          border-left: 3px solid #e5e7eb;
          padding-left: 1rem;
          color: #6b7280;
          font-style: italic;
        }
      `}</style>
    </Card>
  );
}
