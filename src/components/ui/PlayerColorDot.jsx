/**
 * PlayerColorDot — renders a player's color as a small dot or pill.
 */
export default function PlayerColorDot({ color, name, size = 'md', showName = false }) {
  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${sizes[size] || sizes.md} rounded-full flex-shrink-0 ring-1 ring-white/20`}
        style={{ backgroundColor: color }}
      />
      {showName && name && (
        <span className="text-foreground text-sm">{name}</span>
      )}
    </span>
  );
}