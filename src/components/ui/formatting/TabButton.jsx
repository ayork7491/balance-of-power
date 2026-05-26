/**
 * TabButton — Reusable tab button with icon and badge support.
 * Extracted from CampaignLobby for reusability.
 */
export default function TabButton({ 
  id, 
  label, 
  icon: Icon, 
  isActive, 
  onClick, 
  badgeCount = null 
}) {
  if (!Icon) return null;
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-display tracking-wider uppercase border-b-2 transition-colors ${
        isActive
          ? 'border-primary text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      {badgeCount !== null && badgeCount > 0 && (
        <span className="w-4 h-4 rounded-full bg-status-pending text-primary-foreground text-xs flex items-center justify-center font-bold">
          {badgeCount}
        </span>
      )}
    </button>
  );
}