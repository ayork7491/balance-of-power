/**
 * InfoLabel — Reusable label/value display component.
 * Extracted from CampaignLobby for reusability.
 */
export default function InfoLabel({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs font-display tracking-wider uppercase text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground mt-0.5 font-medium">{value}</p>
    </div>
  );
}