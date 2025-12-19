/**
 * CampaignCard
 *
 * Card component for displaying a campaign in the triage dashboard.
 * Shows campaign name, total email count, and breakdown by constituent status.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flag, User, MapPin, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============= TYPES =============

export interface CampaignCardData {
  id: string;
  name: string;
  totalCount: number;
  knownCount: number;
  hasAddressCount: number;
  noAddressCount: number;
}

interface CampaignCardProps {
  campaign: CampaignCardData;
  onClick?: () => void;
  onReviewClick?: () => void;
  className?: string;
}

// ============= COMPONENT =============

/**
 * CampaignCard
 *
 * Displays campaign info with email counts broken down by constituent status:
 * - Known: Emails from recognized constituents
 * - Has Address: Emails with address found in body
 * - No Address: Emails with no address
 */
export function CampaignCard({
  campaign,
  onClick,
  onReviewClick,
  className,
}: CampaignCardProps) {
  const handleReviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReviewClick?.();
  };

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-all border bg-white',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <Flag className="h-4 w-4 text-muted-foreground shrink-0" />
        <h3 className="text-sm font-medium truncate flex-1">{campaign.name}</h3>

        {/* Total email count badge */}
        <Badge
          variant="outline"
          className="rounded-full h-6 w-6 p-0 flex items-center justify-center text-xs font-semibold"
        >
          {campaign.totalCount}
        </Badge>

        {/* Constituent status breakdown */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Known constituents">
            <User className="h-3 w-3 text-gray-700" />
            <span>{campaign.knownCount.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1" title="Has address in email">
            <MapPin className="h-3 w-3 text-gray-500" />
            <span>{campaign.hasAddressCount.toString().padStart(2, '0')}</span>
          </span>
          <span className="text-muted-foreground/50">|</span>
          <span className="flex items-center gap-1" title="No address found">
            <MapPinOff className="h-3 w-3 text-gray-500" />
            <span>{campaign.noAddressCount.toString().padStart(2, '0')}</span>
          </span>
        </div>

        {/* Review button */}
        {(onReviewClick || onClick) && (
          <Button
            size="sm"
            className="h-7 px-3 text-xs shrink-0"
            onClick={onReviewClick ? handleReviewClick : undefined}
          >
            Review
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============= CAMPAIGN LIST =============

interface CampaignListProps {
  campaigns: CampaignCardData[];
  onCampaignClick?: (campaignId: string) => void;
  onReviewClick?: (campaignId: string) => void;
  emptyMessage?: string;
  className?: string;
}

/**
 * CampaignList
 *
 * Renders a list of CampaignCards with empty state handling.
 */
export function CampaignList({
  campaigns,
  onCampaignClick,
  onReviewClick,
  emptyMessage = 'No campaigns with pending emails',
  className,
}: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-foreground', className)}>
        <Flag className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          onClick={onCampaignClick ? () => onCampaignClick(campaign.id) : undefined}
          onReviewClick={onReviewClick ? () => onReviewClick(campaign.id) : undefined}
        />
      ))}
    </div>
  );
}

// ============= CAMPAIGN STATS SUMMARY =============

interface CampaignStatsSummaryProps {
  totalEmails: number;
  knownCount: number;
  hasAddressCount: number;
  noAddressCount: number;
  className?: string;
}

/**
 * CampaignStatsSummary
 *
 * Summary stats row for campaign triage overview.
 */
export function CampaignStatsSummary({
  totalEmails,
  knownCount,
  hasAddressCount,
  noAddressCount,
  className,
}: CampaignStatsSummaryProps) {
  return (
    <div className={cn('flex items-center gap-4 text-sm', className)}>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-semibold">
          {totalEmails} total
        </Badge>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-4 w-4 text-green-600" />
          <span className="font-medium">{knownCount}</span> known
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-4 w-4 text-yellow-600" />
          <span className="font-medium">{hasAddressCount}</span> with address
        </span>
        <span className="flex items-center gap-1">
          <MapPinOff className="h-4 w-4 text-red-500" />
          <span className="font-medium">{noAddressCount}</span> no address
        </span>
      </div>
    </div>
  );
}
