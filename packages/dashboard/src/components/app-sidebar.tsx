"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  UsersThree,
  Cube,
  ChartBar,
  GearSix,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/users", label: "用户管理", icon: UsersThree },
  { href: "/models", label: "模型管理", icon: Cube },
  { href: "/usage", label: "用量统计", icon: ChartBar },
  { href: "/settings", label: "系统设置", icon: GearSix },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-foreground">Uni-Gateway</h1>
        <p className="text-xs text-muted-foreground">管理后台</p>
      </div>
      <nav className="flex-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const IconComponent = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <IconComponent size={18} weight={isActive ? "fill" : "regular"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
