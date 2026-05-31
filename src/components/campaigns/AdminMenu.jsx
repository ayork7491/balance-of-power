/**
 * AdminMenu — Reusable admin overflow menu for campaign actions.
 * Extracted from CampaignCard for reusability.
 */
import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AdminMenu({
  campaign,
  onCleanup,
  isOpen,
  onOpenChange,
}) {
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (isOpen && !userId) {
      base44.auth.me().then(u => setUserId(u?.id));
    }
  }, [isOpen, userId]);

  const handleCleanup = async () => {
    const u = userId || (await base44.auth.me().then(u => u?.id));
    onCleanup?.(campaign.id, u);
    onOpenChange?.(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop to close */}
      <div className="fixed inset-0 z-30" onClick={() => onOpenChange?.(false)} />
      <div className="absolute right-0 top-8 z-40 min-w-44 panel border shadow-lg">
        <button
          onClick={handleCleanup}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-display tracking-wider uppercase text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete Campaign
        </button>
      </div>
    </>
  );
}