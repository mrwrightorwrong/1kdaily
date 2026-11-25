import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Bell,
  CalendarDays,
  FileText,
  HandCoins,
  LayoutDashboard,
  LifeBuoy,
  Percent,
  PiggyBank,
  Receipt,
  Settings,
  Shield,
  Target,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
  /** Phase in which this route becomes functional. Shown in placeholder pages. */
  readonly phase: number;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { label: "Overview", href: "/app", icon: LayoutDashboard, phase: 1 },
  { label: "My Savings", href: "/app/savings", icon: PiggyBank, phase: 3 },
  { label: "Savings Plans", href: "/app/plans", icon: Target, phase: 3 },
  { label: "Calendar", href: "/app/calendar", icon: CalendarDays, phase: 3 },
  { label: "Loan Eligibility", href: "/app/eligibility", icon: Percent, phase: 6 },
  { label: "My Loans", href: "/app/loans", icon: HandCoins, phase: 7 },
  { label: "Repayments", href: "/app/repayments", icon: Receipt, phase: 9 },
  { label: "Transactions", href: "/app/transactions", icon: ArrowLeftRight, phase: 4 },
  { label: "Notifications", href: "/app/notifications", icon: Bell, phase: 11 },
  { label: "Profile", href: "/app/profile", icon: User, phase: 2 },
  { label: "Security", href: "/app/security", icon: Shield, phase: 2 },
  { label: "Help & Support", href: "/app/support", icon: LifeBuoy, phase: 11 },
];

export const MOBILE_NAV: readonly NavItem[] = [
  PRIMARY_NAV[0]!,
  PRIMARY_NAV[1]!,
  PRIMARY_NAV[5]!,
  PRIMARY_NAV[7]!,
  PRIMARY_NAV[9]!,
];

export const SIDEBAR_GROUPS: ReadonlyArray<{ readonly title: string; readonly items: readonly NavItem[] }> = [
  { title: "Money", items: [PRIMARY_NAV[0]!, PRIMARY_NAV[1]!, PRIMARY_NAV[2]!, PRIMARY_NAV[3]!] },
  { title: "Credit", items: [PRIMARY_NAV[4]!, PRIMARY_NAV[5]!, PRIMARY_NAV[6]!] },
  { title: "Records", items: [PRIMARY_NAV[7]!, PRIMARY_NAV[8]!] },
  { title: "Account", items: [PRIMARY_NAV[9]!, PRIMARY_NAV[10]!, PRIMARY_NAV[11]!] },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, phase: 10 },
  { label: "Users", href: "/admin/users", icon: Users, phase: 10 },
  { label: "Savings", href: "/admin/savings", icon: PiggyBank, phase: 10 },
  { label: "Loans", href: "/admin/loans", icon: HandCoins, phase: 10 },
  { label: "Finance", href: "/admin/finance", icon: Wallet, phase: 10 },
  { label: "Risk", href: "/admin/risk", icon: TrendingUp, phase: 10 },
  { label: "Reports", href: "/admin/reports", icon: FileText, phase: 10 },
  { label: "Settings", href: "/admin/settings", icon: Settings, phase: 10 },
];
