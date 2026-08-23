"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Modal } from "@/components/ui/Modal";

/** Renders `children` as a modal whenever `?<param>=<value>` (or, if no value
 * is given, any truthy value) is present in the URL — closing removes the
 * param, taking the user back to the underlying page. This lets "New client",
 * "Edit client", etc. be plain links/buttons that just change the URL. */
export function QueryModal({
  param,
  value,
  size = "sm",
  children,
}: {
  param: string;
  value?: string;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get(param);
  const isOpen = value ? current === value : Boolean(current);
  if (!isOpen) return null;

  function close() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete(param);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Modal onClose={close} size={size}>
      {children}
    </Modal>
  );
}
