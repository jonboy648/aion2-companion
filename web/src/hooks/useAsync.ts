import { useEffect, useState } from "react";

export type AsyncState<T> = { loading: boolean; data: T | null; error: string | null };

/** Run `fn` when `deps` change; ignores stale results. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true, data: null, error: null });
  useEffect(() => {
    let live = true;
    setState({ loading: true, data: null, error: null });
    fn().then(
      (data) => live && setState({ loading: false, data, error: null }),
      (e: unknown) => live && setState({ loading: false, data: null, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
