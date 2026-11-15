import { AlertCircle } from "lucide-react";

/** A clear error with a Retry button, used where a customer page could not load its data. */
export function LoadFailure({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 border border-red-200 bg-red-50 px-6 py-8 text-center">
      <AlertCircle className="size-6 text-red-600" aria-hidden="true" />
      <p className="font-merriweather text-base text-black-forest">{title}</p>
      <p className="font-montserrat text-xs text-red-800">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-1 border border-olive-leaf px-5 py-2 font-montserrat text-xs font-semibold uppercase tracking-widest text-olive-leaf transition-colors hover:bg-olive-leaf hover:text-cornsilk"
      >
        Retry
      </button>
    </div>
  );
}
