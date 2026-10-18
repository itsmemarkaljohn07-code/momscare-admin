'use client';

import Image from 'next/image';
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
import { useLiveAppointmentRequests } from '@/hooks/use-live-appointment-requests';
import { useLiveCancellationCount } from '@/lib/live-cancellation-count';

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

export function AppSidebar({ pendingCancellations: serverCancellations = 0 }: { pendingCancellations?: number }) {
  const pathname = usePathname();
  // Counted live by the admin bell's listener when it runs; otherwise the
  // count the server rendered (cached up to 60 s).
  const liveCancellations = useLiveCancellationCount();
  const pendingCancellations = liveCancellations ?? serverCancellations;
  // Live, so a new request adds to the Appointments badge without
  // reloading, and a scheduled or declined one drops out.
  const { requests } = useLiveAppointmentRequests();
  const pendingRequests = requests.filter((r) => r.status === 'pending').length;
  const appointmentsBadge = pendingRequests + pendingCancellations;
  const appointmentsBadgeLabel = [
    pendingRequests > 0 && `${pendingRequests} pending appointment request${pendingRequests === 1 ? '' : 's'}`,
    pendingCancellations > 0 && `${pendingCancellations} cancellation request${pendingCancellations === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' and ');

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          {/* The logo PNG is transparent with wide margins: a white tile keeps
              it legible in both themes, and the scale crops the margins. */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-sidebar-border">
            <Image
              src="/momcare-logo.png"
              alt="MomCare logo"
              width={32}
              height={32}
              sizes="56px"
              className="scale-[1.7]"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">MomCare</p>
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
                        {item.url === '/admin/appointments' && appointmentsBadge > 0 && (
                          <span
                            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold"
                            title={appointmentsBadgeLabel}
                            aria-label={appointmentsBadgeLabel}
                            style={
                              isActive
                                ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }
                                : { backgroundColor: 'var(--status-pending-bg)', color: 'var(--status-pending)' }
                            }
                          >
                            {appointmentsBadge > 99 ? '99+' : appointmentsBadge}
                          </span>
                        )}
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