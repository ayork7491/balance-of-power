/**
 * EmptyState — reusable empty/placeholder state for lists and panels.
 */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="font-display text-sm font-semibold tracking-wider text-foreground uppercase">
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-48">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}