'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import {
  LayoutDashboard, Users, Camera, CalendarDays, UserCircle, type LucideIcon,
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { getInitials } from '@/lib/avatar-color';
import { showFriendlyError } from '@/lib/error-messages';
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
    items: [{ title: 'Overview', url: '/doctor', icon: LayoutDashboard }],
  },
  {
    label: 'Patient Care',
    items: [
      { title: 'My Patients', url: '/doctor/patients', icon: Users },
      { title: 'Snapshots', url: '/doctor/snapshots', icon: Camera },
      { title: 'My Appointments', url: '/doctor/appointments', icon: CalendarDays },
    ],
  },
  {
    label: 'Account',
    items: [{ title: 'My Profile', url: '/doctor/profile', icon: UserCircle }],
  },
];

export function DoctorSidebar({
  doctorId,
  doctorName,
  pendingCount,
}: {
  doctorId: string;
  doctorName: string;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const [identity, setIdentity] = useState({ name: doctorName, photoUrl: null as string | null });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, `doctors/${doctorId}`),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        setIdentity({
          name: data.name ?? doctorName,
          photoUrl: data.photoUrl ?? null,
        });
      },
      (error) => showFriendlyError(error, 'live sidebar identity sync')
    );
    return () => unsub();
  }, [doctorId, doctorName]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4 group-data-[collapsible=icon]:px-2">
        <Link href="/doctor/profile" className="flex items-center gap-2.5">
          {identity.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={identity.photoUrl}
              alt={identity.name}
              className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-soft group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9"
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-semibold shadow-soft group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9"
              style={{ backgroundColor: 'var(--accent-blue)', color: '#ffffff' }}
            >
              {getInitials(identity.name)}
            </div>
          )}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold leading-tight">
              {identity.name}
            </p>
            <p className="truncate text-[0.7rem] text-sidebar-foreground/50">Healthcare Provider</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:px-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent className="mt-1.5">
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:gap-2">
                {group.items.map((item) => {
                  const isActive =
                    item.url === '/doctor' ? pathname === '/doctor' : pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        isActive={isActive}
                        tooltip={item.title}
                        render={<Link href={item.url} />}
                        className="h-10 rounded-full px-3.5 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground data-[active=true]:shadow-soft data-[active=true]:hover:bg-primary group-data-[collapsible=icon]:h-11 group-data-[collapsible=icon]:w-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-2xl group-data-[collapsible=icon]:p-0"
                      >
                        <item.icon className="h-[17px] w-[17px] group-data-[collapsible=icon]:h-5 group-data-[collapsible=icon]:w-5" />
                        <span>{item.title}</span>
                        {item.url === '/doctor/appointments' && pendingCount > 0 && (
                          <span
                            className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold group-data-[collapsible=icon]:hidden"
                            style={
                              isActive
                                ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff' }
                                : { backgroundColor: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' }
                            }
                          >
                            {pendingCount}
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
      <SidebarFooter className="gap-2 border-t border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center justify-between gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
