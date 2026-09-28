'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Newspaper, Users, CalendarDays, ShieldCheck, Stethoscope, BarChart3, ScrollText, type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoutButton } from '@/components/logout-button';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ title: 'Overview', url: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Management',
    items: [
      { title: 'Appointments', url: '/admin/appointments', icon: CalendarDays },
      { title: 'Reports', url: '/admin/reports', icon: BarChart3 },
      { title: 'Doctors', url: '/admin/doctors', icon: Stethoscope },
      { title: 'Patients', url: '/admin/users', icon: Users },
    ],
  },
  {
    label: 'Content',
    items: [{ title: 'Insights', url: '/admin/insights', icon: Newspaper }],
  },
  {
    label: 'Access',
    items: [
      { title: 'Admins', url: '/admin/admins', icon: ShieldCheck },
      { title: 'Audit Log', url: '/admin/audit-log', icon: ScrollText },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-soft">
            M
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">MomsCare</p>
            <p className="truncate text-[0.7rem] text-sidebar-foreground/50">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1.5">
              <SidebarMenu className="gap-1">
                {group.items.map((item) => {
                  const isActive =
                    item.url === '/admin' ? pathname === '/admin' : pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.url} />}
                        className="h-10 rounded-full px-3.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground data-[active=true]:shadow-soft data-[active=true]:hover:bg-primary"
                      >
                        <item.icon className="h-[17px] w-[17px]" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2 border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}