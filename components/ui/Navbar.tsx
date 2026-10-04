"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Network,
  Target,
  Map,
  GitBranch,
  Brain,
  History,
  Code2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: Network },
  { href: "/codeforces", label: "Codeforces", icon: Code2 },
  { href: "/leetcode", label: "LeetCode", icon: Layers },
  { href: "/concepts", label: "Concepts", icon: GitBranch },
  { href: "/recommendations", label: "Recommendations", icon: Target },
  { href: "/roadmap", label: "Weekly Roadmap", icon: Map },
  { href: "/history", label: "History", icon: History },
  { href: "/insights", label: "Insights", icon: Brain },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Network size={18} />
          </div>
          <span className="text-lg font-bold tracking-tight">CodeNext</span>
        </Link>

        <nav className="ml-8 hidden items-center gap-1 overflow-x-auto md:flex">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href ||
              (link.href !== "/" &&
                link.href !== "/dashboard" &&
                pathname.startsWith("/concepts") &&
                link.href === "/concepts");

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}