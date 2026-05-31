/**
 * AdminMenu — Reusable admin overflow menu for campaign actions.
 * Extracted from CampaignCard for reusability.
 */
import { Trash2 } from 'lucide-react';

export default function AdminMenu({
  campaign,
  onCleanup,
  isOpen,
  onOpenChange,
}) {
  const handleCleanup = () => {
    onOpenChange?.(false);
    onCleanup?.();
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