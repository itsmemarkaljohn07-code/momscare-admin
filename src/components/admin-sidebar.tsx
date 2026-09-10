'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Newspaper, Users, CalendarDays, ShieldCheck, Camera, Stethoscope, type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { title: 'Overview', url: '/admin', icon: LayoutDashboard },
  { title: 'Appointments', url: '/admin/appointments', icon: CalendarDays },
  { title: 'Doctors', url: '/admin/doctors', icon: Stethoscope },
  { title: 'Snapshots', url: '/admin/snapshots', icon: Camera },
  { title: 'Insights', url: '/admin/insights', icon: Newspaper },
  { title: 'Users', url: '/admin/users', icon: Users },
  { title: 'Admins', url: '/admin/admins', icon: ShieldCheck },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-3 py-4">
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#e07eb8] to-[#9b6fc4] text-sm font-bold text-white shadow-sm">
            M
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">MomsCare</p>
            <p className="truncate text-xs text-muted-foreground">Admin Panel</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.url === '/admin' ? pathname === '/admin' : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.url} />}
                      className="h-9 rounded-lg px-2.5 text-sm font-medium transition-colors data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-primary hover:bg-muted"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}