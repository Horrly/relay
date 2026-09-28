export default function EmptyState({ title, body }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-2xl">💬</div>
        <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{body}</p>
      </div>
    </div>
  );
}
