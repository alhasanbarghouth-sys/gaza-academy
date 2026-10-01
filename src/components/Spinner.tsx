export default function Spinner({ label = "جارٍ التحميل..." }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-gray-400">
      <span
        aria-hidden
        className="h-8 w-8 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600"
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}
