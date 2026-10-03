"use client";

import { useEffect, useRef } from "react";

/** Nagłówek, który po pojawieniu się przejmuje fokus — po kliknięciu gminy czytnik od razu czyta jego kartę. */
export function FocusHeading({ id, className, children, as: Tag = "h2" }: {
  id: string; className?: string; children: React.ReactNode; as?: "h2" | "h3";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <Tag ref={ref} id={id} tabIndex={-1} className={className}>
      {children}
    </Tag>
  );
}
