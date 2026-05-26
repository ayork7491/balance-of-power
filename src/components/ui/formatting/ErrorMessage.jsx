/**
 * ErrorMessage — Reusable error display with dismiss.
 * Extracted from CampaignLobby for reusability.
 */
import { AlertTriangle, X } from 'lucide-react';

export default function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded border border-destructive/40 bg-destructive/5">
      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
      <p className="text-xs text-destructive flex-1">{message}</p>
      {onDismiss && (
        <button onClick={onDismiss}>
          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
        </button>
      )}
    </div>
  );
}