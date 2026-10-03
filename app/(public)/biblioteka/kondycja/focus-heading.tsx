"use client";

import { useEffect, useRef } from "react";

/** Nagłówek, który po pojawieniu się przejmuje fokus — po kliknięciu gminy czytnik od razu czyta jego kartę. */
export function FocusHeading({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <h2 ref={ref} id={id} tabIndex={-1} className={className}>
      {children}
    </h2>
  );
}
