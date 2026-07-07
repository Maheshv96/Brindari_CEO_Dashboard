"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

const NO_SIDEBAR_PREFIXES = ["/login", "/portal"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (hideSidebar) {
    return <main className="min-h-screen w-full overflow-y-auto bg-gray-50">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">{children}</main>
    </>
  );
}
