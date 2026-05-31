/**
 * ConfirmCleanupModal — confirms campaign deletion or archive before proceeding.
 * Shown to admins only. Describes exactly what will happen based on campaign status.
 */
import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

export default function ConfirmCleanupModal({ campaign, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="panel w-full max-w-md">
        {/* Header */}
        <div className="panel-header flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <h2 className="font-display text-sm tracking-wider uppercase text-destructive">
            Delete Campaign Permanently
          </h2>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground">
            Delete campaign permanently? <strong>This cannot be undone.</strong>
          </p>
          <div className="px-3 py-2 rounded border border-destructive/40 bg-destructive/5 text-sm font-display tracking-wide text-foreground">
            {campaign.name}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>The campaign will be permanently hidden from all app views and cannot be recovered.</p>
            <p className="text-destructive/80 font-medium">This action cannot be undone.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded border border-border text-xs font-display tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded bg-destructive text-destructive-foreground text-xs font-display tracking-wider uppercase hover:brightness-110 transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {busy ? 'Deleting…' : 'Delete Campaign'}
          </button>
        </div>
      </div>
    </div>
  );
}