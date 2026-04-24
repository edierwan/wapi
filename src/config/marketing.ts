import {
  BarChart3,
  CalendarClock,
  Inbox,
  MessagesSquare,
  Sparkles,
  Users,
} from "lucide-react";

export const nav = {
  primary: [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  footer: {
    product: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
    company: [
      { label: "About", href: "#" },
      { label: "Contact", href: "mailto:support@getouch.co" },
    ],
    legal: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
} as const;

export const hero = {
  eyebrow: "WhatsApp-first. Business-ready.",
  title: "Grow on WhatsApp without the chaos.",
  subtitle:
    "WAPI gives you one calm place to run campaigns, reply to customers, and measure what works — built for teams that take messaging seriously.",
  primaryCta: { label: "Start Free Trial", href: "/login" },
  secondaryCta: { label: "Book a Demo", href: "mailto:support@getouch.co" },
  trustBadges: [
    "End-to-end on WhatsApp",
    "Team-ready inbox",
    "AI-assisted replies",
  ],
} as const;

export const features = [
  {
    title: "WhatsApp Campaigns",
    description:
      "Send targeted broadcasts with personalization, opt-outs, and delivery insights — built the right way.",
    icon: MessagesSquare,
  },
  {
    title: "Smart Inbox",
    description:
      "A shared inbox for your team. Assign, tag, snooze, and never lose a conversation again.",
    icon: Inbox,
  },
  {
    title: "AI Content Generator",
    description:
      "Draft on-brand messages in seconds. Translate, shorten, and personalize without the blank-page moment.",
    icon: Sparkles,
  },
  {
    title: "Contact Segmentation",
    description:
      "Group by behavior, tags, or attributes. Reach the right audience with the right message.",
    icon: Users,
  },
  {
    title: "Broadcast Scheduler",
    description:
      "Plan campaigns across time zones. Queue, review, and send — with quiet-hour protection.",
    icon: CalendarClock,
  },
  {
    title: "Campaign Analytics",
    description:
      "Know what landed. Track delivery, replies, and conversions in one clean dashboard.",
    icon: BarChart3,
  },
] as const;

export const howItWorks = [
  {
    step: "01",
    title: "Connect WhatsApp",
    description:
      "Link your number in minutes. One or many — we handle the heavy lifting.",
  },
  {
    step: "02",
    title: "Build your audience",
    description:
      "Import contacts, tag segments, and keep your list clean and compliant.",
  },
  {
    step: "03",
    title: "Send, reply, measure",
    description:
      "Launch campaigns, manage replies in a shared inbox, and iterate with real data.",
  },
] as const;

export const benefits = [
  {
    title: "Faster outreach",
    description:
      "Go from idea to sent campaign in minutes — not days.",
  },
  {
    title: "One dashboard",
    description:
      "Campaigns, inbox, contacts, and analytics in a single calm workspace.",
  },
  {
    title: "AI-assisted messaging",
    description:
      "Write better, faster — without losing your brand voice.",
  },
  {
    title: "Organized team workflow",
    description:
      "Assignments, notes, and status — so nothing slips through the cracks.",
  },
  {
    title: "Scalable campaigns",
    description:
      "From 500 contacts to 500,000 — the infrastructure just works.",
  },
  {
    title: "Respectful by default",
    description:
      "Opt-out handling and quiet-hours built in. Your audience stays with you.",
  },
] as const;

export const pricing = [
  {
    name: "Starter",
    price: "Free",
    description: "For individuals exploring WhatsApp outreach.",
    features: [
      "1 WhatsApp number",
      "Up to 500 contacts",
      "Basic analytics",
      "Community support",
    ],
    cta: { label: "Start free", href: "/login" },
    featured: false,
  },
  {
    name: "Business",
    price: "Contact us",
    description: "For growing teams that need a real inbox & campaigns.",
    features: [
      "Up to 3 numbers",
      "Team inbox & assignments",
      "Campaign scheduling",
      "AI content generator",
      "Priority support",
    ],
    cta: { label: "Talk to sales", href: "mailto:support@getouch.co" },
    featured: true,
  },
  {
    name: "Agency",
    price: "Custom",
    description: "For agencies managing many brands and numbers.",
    features: [
      "Unlimited numbers",
      "Multi-tenant workspaces",
      "Advanced analytics",
      "SLA & onboarding",
    ],
    cta: { label: "Request quote", href: "mailto:support@getouch.co" },
    featured: false,
  },
] as const;

export const faqs = [
  {
    q: "Is WAPI only for WhatsApp?",
    a: "Yes — WAPI is WhatsApp-first. We focus on doing one channel exceptionally well rather than being a mediocre omnichannel tool.",
  },
  {
    q: "Can I manage replies from customers?",
    a: "Yes. WAPI ships with a shared inbox where your team can assign, tag, snooze, and respond to conversations together.",
  },
  {
    q: "Is WAPI suitable for teams?",
    a: "Absolutely. Assignments, internal notes, and audit-friendly history are built in. Permissions arrive with the Business plan.",
  },
  {
    q: "Can I connect multiple numbers?",
    a: "Yes — Business supports up to 3 numbers, and Agency supports unlimited numbers across workspaces.",
  },
  {
    q: "Is there a free trial?",
    a: "The Starter plan is free forever for small senders. Business plans include a guided trial — contact us to get started.",
  },
] as const;

export const finalCta = {
  title: "Ready to run WhatsApp the calm way?",
  subtitle:
    "Join teams replacing spreadsheets and group chats with a single, focused platform.",
  primary: { label: "Start Free Trial", href: "/login" },
  secondary: { label: "Book a Demo", href: "mailto:support@getouch.co" },
} as const;
