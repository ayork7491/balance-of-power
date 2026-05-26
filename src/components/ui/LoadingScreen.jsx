/**
 * LoadingScreen — full-screen tactical loading indicator.
 */
export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 z-50">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-border rounded-full" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
      </div>
      <p className="font-display text-xs tracking-widest uppercase text-muted-foreground">
        {message}
      </p>
    </div>
  );
}