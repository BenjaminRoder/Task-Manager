"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  {
    href: "/today",
    name: "Today",
    path: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  },
  {
    href: "/tasks",
    name: "Tasks",
    path: "m8 12 3 3 5-6M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
  },
  {
    href: "/analytics",
    name: "Analytics",
    path: "M4 21v-7h3v7m4 0V8h3v13m4 0V3h3v18",
  },
  {
    href: "/reading",
    name: "Reading",
    path: "M12 5c-3-3-7-3-10-1v16c3-2 7-2 10 1 3-3 7-3 10-1V4c-3-2-7-2-10 1Zm0 0v16",
  },
  {
    href: "/history",
    name: "History",
    path: "M12 8v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/today" className="brand">
        Task Manager
      </Link>
      <nav aria-label="Main navigation">
        {sections.map(({ href, name, path }) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? "page" : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              width="21"
              height="21"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={path} />
            </svg>
            {name}
          </Link>
        ))}
      </nav>
      <p className="storage-note">Saved on this device</p>
    </aside>
  );
}
