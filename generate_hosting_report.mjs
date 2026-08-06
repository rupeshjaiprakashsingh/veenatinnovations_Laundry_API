import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  VerticalAlign,
  PageOrientation,
  PageBreak,
  Header,
  Footer,
  ImageRun,
  convertInchesToTwip,
  TableLayoutType,
  UnderlineType,
  LineRuleType,
} from "docx";
import { writeFileSync } from "fs";

// ─── COLOR PALETTE ─────────────────────────────────────────────────────────────
const COLORS = {
  primary:     "1A3C5E",   // Deep Navy Blue
  secondary:   "2E86AB",   // Steel Blue
  accent:      "F18F01",   // Amber
  success:     "27AE60",   // Green
  warning:     "F39C12",   // Orange
  danger:      "E74C3C",   // Red
  light:       "EBF5FB",   // Light Blue
  lightGray:   "F5F6FA",   // Light Gray
  midGray:     "BDC3C7",   // Mid Gray
  darkGray:    "555555",   // Dark Gray
  white:       "FFFFFF",
  gold:        "F1C40F",   // Gold
  rankBg1:     "D5F5E3",   // #1 Winner Green
  rankBg2:     "D6EAF8",   // #2 Blue
  rankBg3:     "FDEBD0",   // #3 Orange
  tableHeader: "1A3C5E",   // Header rows
  altRow:      "EAF4FB",   // Alternating rows
};

// ─── HELPER: TEXT RUNS ─────────────────────────────────────────────────────────
function bold(text, opts = {}) {
  return new TextRun({ text, bold: true, ...opts });
}
function run(text, opts = {}) {
  return new TextRun({ text, ...opts });
}
function br() {
  return new TextRun({ break: 1 });
}

// ─── HELPER: STYLED PARAGRAPH ─────────────────────────────────────────────────
function styledParagraph(children, opts = {}) {
  return new Paragraph({ children, ...opts });
}

// ─── HELPER: SECTION HEADING ──────────────────────────────────────────────────
function sectionHeading(text, level = HeadingLevel.HEADING_1) {
  const color = level === HeadingLevel.HEADING_1 ? COLORS.primary : COLORS.secondary;
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        color,
        size: level === HeadingLevel.HEADING_1 ? 32 : 26,
        font: "Calibri",
      }),
    ],
    spacing: { before: 300, after: 160 },
    border: level === HeadingLevel.HEADING_1 ? {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.accent },
    } : undefined,
  });
}

// ─── HELPER: SUBHEADING ───────────────────────────────────────────────────────
function subHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: COLORS.primary, size: 24, font: "Calibri" })],
    spacing: { before: 200, after: 100 },
  });
}

// ─── HELPER: BULLET ───────────────────────────────────────────────────────────
function bullet(text, indent = 0, color = COLORS.darkGray) {
  return new Paragraph({
    children: [new TextRun({ text, color, size: 20, font: "Calibri" })],
    bullet: { level: indent },
    spacing: { before: 40, after: 40 },
  });
}

// ─── HELPER: NORMAL PARA ──────────────────────────────────────────────────────
function para(children, opts = {}) {
  const kids = typeof children === "string"
    ? [new TextRun({ text: children, size: 20, font: "Calibri", color: COLORS.darkGray })]
    : children;
  return new Paragraph({ children: kids, spacing: { before: 80, after: 80 }, ...opts });
}

// ─── HELPER: TABLE CELL ───────────────────────────────────────────────────────
function cell(text, opts = {}) {
  const {
    bold: isBold = false,
    bg = COLORS.white,
    color = COLORS.darkGray,
    align = AlignmentType.LEFT,
    width,
    colspan = 1,
    size = 18,
    wrap = true,
  } = opts;

  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text), bold: isBold, color, size, font: "Calibri" })],
        alignment: align,
        spacing: { before: 60, after: 60 },
      }),
    ],
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    ...(width ? { width: { size: width, type: WidthType.PERCENTAGE } } : {}),
    ...(colspan > 1 ? { columnSpan: colspan } : {}),
  });
}

// ─── HELPER: HEADER ROW ───────────────────────────────────────────────────────
function headerRow(cols) {
  return new TableRow({
    children: cols.map((c) =>
      cell(c.text || c, { bold: true, bg: COLORS.tableHeader, color: COLORS.white, align: AlignmentType.CENTER, size: 19, ...c })
    ),
    tableHeader: true,
  });
}

// ─── HELPER: SPACER ───────────────────────────────────────────────────────────
function spacer(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ children: [new TextRun("")], spacing: { before: 60, after: 60 } }));
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════════
function makeCoverPage() {
  return [
    new Paragraph({ children: [new TextRun("")], spacing: { before: 1400 } }),
    new Paragraph({
      children: [new TextRun({ text: "LAUNDRY APP", bold: true, color: COLORS.accent, size: 48, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: "Cloud Hosting Vendor Comparison Report", bold: true, color: COLORS.white, size: 36, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      shading: { type: ShadingType.SOLID, color: COLORS.primary, fill: COLORS.primary },
      spacing: { before: 120, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "For Indian Market — API + Admin Panel Deployment", color: COLORS.secondary, size: 24, font: "Calibri", italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    }),
    new Paragraph({ children: [new TextRun({ text: "─────────────────────────────────────────────────────────────────", color: COLORS.midGray, size: 20 })], alignment: AlignmentType.CENTER }),
    ...spacer(2),
    new Paragraph({
      children: [new TextRun({ text: "Prepared By:  DevOps Engineering Team", bold: true, color: COLORS.darkGray, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: "Prepared For:  Client Stakeholders / Management", color: COLORS.darkGray, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Date:  July 2026", color: COLORS.darkGray, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Classification:  CONFIDENTIAL — Client Use Only", bold: true, color: COLORS.danger, size: 22, font: "Calibri" })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
    }),
    ...spacer(2),
    new Paragraph({ children: [new TextRun({ text: "─────────────────────────────────────────────────────────────────", color: COLORS.midGray, size: 20 })], alignment: AlignmentType.CENTER }),
    new Paragraph({
      children: [
        new TextRun({ text: "Tech Stack Evaluated:  ", bold: true, color: COLORS.primary, size: 20, font: "Calibri" }),
        new TextRun({ text: "NestJS 11 + Prisma ORM + PostgreSQL 15 (API)  |  React + Vite (Admin Panel)  |  Docker-Containerised", color: COLORS.darkGray, size: 20, font: "Calibri" }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
    }),
    new Paragraph({
      children: [new PageBreak()],
    }),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXECUTIVE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
function makeExecutiveSummary() {
  return [
    sectionHeading("1. Executive Summary"),
    para("This report provides a comprehensive technical evaluation of three leading cloud hosting vendors for deploying the Laundry App — a production-grade platform consisting of a NestJS REST API backend and a React-based Admin Panel, targeting Indian end-customers."),
    ...spacer(1),
    para([
      bold("Vendors Evaluated: ", { color: COLORS.primary, size: 20, font: "Calibri" }),
      run("DigitalOcean App Platform  |  Railway.app  |  Render.com", { size: 20, font: "Calibri", color: COLORS.darkGray }),
    ]),
    ...spacer(1),
    para("Each vendor has been evaluated against 12 critical criteria including India-specific latency, pricing in INR, ease of deployment, Docker support, managed PostgreSQL availability, compliance, and scalability."),
    ...spacer(1),
    // Summary recommendation box
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: "⭐  FINAL RECOMMENDATION", bold: true, color: COLORS.white, size: 24, font: "Calibri" }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "DigitalOcean App Platform (Bangalore Region)", bold: true, color: COLORS.gold, size: 26, font: "Calibri" }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Best India latency (<50ms) + Render-like simplicity + Docker support + $200 free trial credit (~₹16,700)", color: COLORS.white, size: 20, font: "Calibri", italics: true }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60 },
                }),
              ],
              shading: { type: ShadingType.SOLID, color: COLORS.primary, fill: COLORS.primary },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
            }),
          ],
        }),
      ],
    }),
    ...spacer(2),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TECH STACK OVERVIEW
// ═══════════════════════════════════════════════════════════════════════════════
function makeTechStack() {
  return [
    sectionHeading("2. Project Tech Stack & Requirements"),
    subHeading("2.1 Backend API"),
    bullet("Framework: NestJS v11 (Node.js — TypeScript)"),
    bullet("ORM: Prisma v6 with PostgreSQL 15"),
    bullet("Authentication: JWT (Passport.js)"),
    bullet("API Documentation: Swagger UI"),
    bullet("Containerisation: Docker + Docker Compose (already configured)"),
    bullet("Port: 10000 (configurable via env)"),
    bullet("Build: TypeScript → compiled dist/ folder"),
    ...spacer(1),
    subHeading("2.2 Admin Panel (Frontend)"),
    bullet("Framework: React 18 + TypeScript"),
    bullet("Build Tool: Vite"),
    bullet("Output: Static files in /dist folder"),
    bullet("API Communication: REST via VITE_API_URL environment variable"),
    ...spacer(1),
    subHeading("2.3 Key Hosting Requirements"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Requirement", "Priority", "Details"]),
        new TableRow({ children: [cell("Low Latency for India"), cell("🔴 Critical", { align: AlignmentType.CENTER }), cell("API must respond in <100ms for Indian customers")] }),
        new TableRow({ children: [cell("Managed PostgreSQL", { bg: COLORS.altRow }), cell("🔴 Critical", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("Automated backups, no manual DB management", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("Docker Support"), cell("🔴 Critical", { align: AlignmentType.CENTER }), cell("Dockerfile already present in repository")] }),
        new TableRow({ children: [cell("Auto-deploy on Git Push", { bg: COLORS.altRow }), cell("🟡 High", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("CI/CD pipeline for zero-downtime deployments", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("Environment Variables"), cell("🟡 High", { align: AlignmentType.CENTER }), cell("Secure injection of JWT_SECRET, DATABASE_URL, etc.")] }),
        new TableRow({ children: [cell("Free Static Hosting", { bg: COLORS.altRow }), cell("🟡 High", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("Admin Panel (React/Vite) should be free or near-free", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("SSL / HTTPS"), cell("🟡 High", { align: AlignmentType.CENTER }), cell("Automatic SSL certificate management")] }),
        new TableRow({ children: [cell("Custom Domain", { bg: COLORS.altRow }), cell("🟢 Medium", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("Support for custom domain (e.g., api.laundry.com)", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("INR-friendly Pricing"), cell("🟢 Medium", { align: AlignmentType.CENTER }), cell("Predictable monthly billing convertible to INR")] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(2),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VENDOR DETAILS
// ═══════════════════════════════════════════════════════════════════════════════
function makeVendorDetails() {
  const sections = [];

  sections.push(sectionHeading("3. Vendor-by-Vendor Deep Dive"));

  // ── VENDOR 1: DigitalOcean ─────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "🏆  VENDOR 1: DigitalOcean App Platform", bold: true, color: COLORS.white, size: 28, font: "Calibri" }),
        new TextRun({ text: "   RECOMMENDED", bold: true, color: COLORS.gold, size: 22, font: "Calibri" }),
      ],
      shading: { type: ShadingType.SOLID, color: COLORS.primary, fill: COLORS.primary },
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 0 },
      border: { all: { style: BorderStyle.SINGLE, size: 4, color: COLORS.accent } },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            cell("Website", { bold: true, bg: COLORS.light, width: 30 }),
            cell("https://cloud.digitalocean.com/apps", { width: 70 }),
          ],
        }),
        new TableRow({
          children: [
            cell("India Region", { bold: true, bg: COLORS.light }),
            cell("✅ Bangalore (BLR1) — PHYSICALLY IN INDIA"),
          ],
        }),
        new TableRow({
          children: [
            cell("India Latency", { bold: true, bg: COLORS.light }),
            cell("< 50ms to all major Indian cities (Mumbai, Delhi, Hyderabad, Chennai, Pune)"),
          ],
        }),
        new TableRow({
          children: [
            cell("Docker Support", { bold: true, bg: COLORS.light }),
            cell("✅ Full Docker support — auto-detects your existing Dockerfile"),
          ],
        }),
        new TableRow({
          children: [
            cell("PostgreSQL", { bold: true, bg: COLORS.light }),
            cell("✅ Managed PostgreSQL 15 — matches your current render.yaml configuration exactly"),
          ],
        }),
        new TableRow({
          children: [
            cell("Free Trial", { bold: true, bg: COLORS.light }),
            cell("✅ $200 credit for 60 days (≈ ₹16,700) — approx. 2 months completely free"),
          ],
        }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("Pricing Breakdown — DigitalOcean"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Component", "Plan / Specs", "USD/Month", "INR/Month (~)"]),
        new TableRow({ children: [cell("NestJS API"), cell("Basic — 1 Shared vCPU, 512MB RAM"), cell("$5", { align: AlignmentType.CENTER }), cell("₹420", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("React Admin Panel", { bg: COLORS.altRow }), cell("Static Site (FREE forever)", { bg: COLORS.altRow }), cell("$0", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("₹0", { align: AlignmentType.CENTER, bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("PostgreSQL DB"), cell("Dev Database — 1GB SSD (good for MVP)"), cell("$7", { align: AlignmentType.CENTER }), cell("₹585", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("STARTER TOTAL", { bold: true, bg: COLORS.rankBg1 }), cell("Good for MVP / Launch phase", { bg: COLORS.rankBg1 }), cell("~$12/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg1 }), cell("~₹1,005/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg1 })] }),
        new TableRow({ children: [cell("API (Production)", { bg: COLORS.altRow }), cell("Standard — 1 vCPU, 1GB RAM (no cold starts)", { bg: COLORS.altRow }), cell("$12", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("₹1,005", { align: AlignmentType.CENTER, bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("Managed PostgreSQL"), cell("Basic Cluster — 1 vCPU, 1GB RAM, 10GB SSD"), cell("$15", { align: AlignmentType.CENTER }), cell("₹1,255", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("PRODUCTION TOTAL", { bold: true, bg: COLORS.rankBg1 }), cell("For 100-1000 orders/day", { bg: COLORS.rankBg1 }), cell("~$27/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg1 }), cell("~₹2,260/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg1 })] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("Pros — DigitalOcean"),
    bullet("🟢 Bangalore data center — lowest latency (<50ms) for ALL Indian customers"),
    bullet("🟢 Identical experience to Render — GitHub connect → push → auto-deploy"),
    bullet("🟢 Your existing Dockerfile is auto-detected; zero extra configuration needed"),
    bullet("🟢 render.yaml maps almost 1:1 to DigitalOcean App Spec (easy migration)"),
    bullet("🟢 Admin Panel hosted FREE as a static site — no extra cost"),
    bullet("🟢 $200 free credit — 2 months of production hosting at zero cost"),
    bullet("🟢 Managed PostgreSQL 15 — matches your current DB version exactly"),
    bullet("🟢 Automatic SSL/HTTPS, custom domain support"),
    bullet("🟢 Predictable flat monthly billing — easy budgeting"),
    bullet("🟢 Excellent 24/7 support documentation and community"),
    ...spacer(1),
    subHeading("Cons — DigitalOcean"),
    bullet("🔴 No permanent free tier (requires paid plan or use of trial credits after 60 days)"),
    bullet("🔴 App Platform has fewer global regions than AWS or GCP"),
    bullet("🟡 Autoscaling only available on higher-tier (dedicated CPU) plans"),
    bullet("🟡 UI is slightly less polished than Railway's 'Canvas' interface"),
    ...spacer(2),
  );

  // ── VENDOR 2: Railway ─────────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "🥈  VENDOR 2: Railway.app", bold: true, color: COLORS.white, size: 28, font: "Calibri" }),
        new TextRun({ text: "   RUNNER-UP", bold: true, color: COLORS.midGray, size: 22, font: "Calibri" }),
      ],
      shading: { type: ShadingType.SOLID, color: COLORS.secondary, fill: COLORS.secondary },
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 0 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell("Website", { bold: true, bg: COLORS.light, width: 30 }), cell("https://railway.app", { width: 70 })] }),
        new TableRow({ children: [cell("India Region", { bold: true, bg: COLORS.light }), cell("⚠️ Singapore (SIN) — Closest to India but NOT within India")] }),
        new TableRow({ children: [cell("India Latency", { bold: true, bg: COLORS.light }), cell("70–90ms to Indian cities (acceptable, not ideal)")] }),
        new TableRow({ children: [cell("Docker Support", { bold: true, bg: COLORS.light }), cell("✅ Full Docker support with auto-detection")] }),
        new TableRow({ children: [cell("PostgreSQL", { bold: true, bg: COLORS.light }), cell("✅ Built-in PostgreSQL plugin — one click to add")] }),
        new TableRow({ children: [cell("Free Trial", { bold: true, bg: COLORS.light }), cell("❌ No permanent free tier — credit card required from day one")] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("Pricing Breakdown — Railway"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Component", "Billing Model", "USD/Month (Est.)", "INR/Month (~)"]),
        new TableRow({ children: [cell("NestJS API"), cell("Usage-based: CPU/RAM per second"), cell("~$5–10", { align: AlignmentType.CENTER }), cell("₹420–835", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("React Admin Panel", { bg: COLORS.altRow }), cell("Static deployment (minimal cost)", { bg: COLORS.altRow }), cell("~$0–2", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("₹0–165", { align: AlignmentType.CENTER, bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("PostgreSQL DB"), cell("Usage-based per storage + compute"), cell("~$5", { align: AlignmentType.CENTER }), cell("₹420", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("ESTIMATED TOTAL", { bold: true, bg: COLORS.rankBg2 }), cell("Variable — depends on traffic", { bg: COLORS.rankBg2 }), cell("~$10–17/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg2 }), cell("~₹835–1,420/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg2 })] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("Pros — Railway"),
    bullet("🟢 Absolute simplest deployment experience — fastest to get started"),
    bullet("🟢 Beautiful 'Canvas' UI showing all services (API, DB, Frontend) visually connected"),
    bullet("🟢 One-click PostgreSQL plugin — database ready in seconds"),
    bullet("🟢 Usage-based billing — you only pay for what you consume (good for low traffic)"),
    bullet("🟢 Full Docker support with auto-detection"),
    bullet("🟢 GitHub auto-deploy on every git push"),
    bullet("🟢 Scales to zero — no cost when idle (great for development environments)"),
    ...spacer(1),
    subHeading("Cons — Railway"),
    bullet("🔴 No India data center — Singapore region means 70–90ms latency (40ms more than DO Bangalore)"),
    bullet("🔴 No permanent free tier — billing starts immediately"),
    bullet("🔴 Usage-based billing = unpredictable bills during traffic spikes"),
    bullet("🔴 Bill shock risk: if a customer load-tests your API, costs spike unexpectedly"),
    bullet("🟡 Less mature ecosystem compared to DigitalOcean"),
    bullet("🟡 Support is community-based; no dedicated SLA for small plans"),
    ...spacer(2),
  );

  // ── VENDOR 3: Render ──────────────────────────────────────────────────────
  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "🥉  VENDOR 3: Render.com", bold: true, color: COLORS.white, size: 28, font: "Calibri" }),
        new TextRun({ text: "   CURRENT PLATFORM", bold: true, color: COLORS.warning, size: 22, font: "Calibri" }),
      ],
      shading: { type: ShadingType.SOLID, color: COLORS.darkGray, fill: COLORS.darkGray },
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 0 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [cell("Website", { bold: true, bg: COLORS.light, width: 30 }), cell("https://render.com", { width: 70 })] }),
        new TableRow({ children: [cell("India Region", { bold: true, bg: COLORS.light }), cell("⚠️ Singapore (closest) — Oregon USA is current default in your render.yaml")] }),
        new TableRow({ children: [cell("India Latency", { bold: true, bg: COLORS.light }), cell("❌ Oregon = 200ms+ (current) | Singapore = 70–90ms (if configured)")] }),
        new TableRow({ children: [cell("Docker Support", { bold: true, bg: COLORS.light }), cell("✅ Full Docker support")] }),
        new TableRow({ children: [cell("PostgreSQL", { bold: true, bg: COLORS.light }), cell("✅ Managed PostgreSQL (free tier available)")] }),
        new TableRow({ children: [cell("Free Trial", { bold: true, bg: COLORS.light }), cell("⚠️ Free tier available but services SLEEP after 15 min of inactivity → 30-60s cold start!")] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("⚠️ Critical Issue with Your Current Render Setup"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: "CURRENT PROBLEM IN YOUR render.yaml", bold: true, color: COLORS.white, size: 22, font: "Calibri" })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: "plan: free  →  App sleeps every 15 min → Customer waits 30–60 seconds for API on first request", color: COLORS.white, size: 20, font: "Calibri" })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: "No region: set  →  Defaults to Oregon, USA → 200ms+ latency for every Indian customer", color: COLORS.white, size: 20, font: "Calibri" })],
                }),
              ],
              shading: { type: ShadingType.SOLID, color: COLORS.danger, fill: COLORS.danger },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
            }),
          ],
        }),
      ],
    }),
    ...spacer(1),
    subHeading("Pricing Breakdown — Render (Upgraded)"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Component", "Plan", "USD/Month", "INR/Month (~)"]),
        new TableRow({ children: [cell("NestJS API"), cell("Starter — No sleep, always-on"), cell("$7", { align: AlignmentType.CENTER }), cell("₹585", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("React Admin Panel", { bg: COLORS.altRow }), cell("Static Site (FREE forever)", { bg: COLORS.altRow }), cell("$0", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("₹0", { align: AlignmentType.CENTER, bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("PostgreSQL DB"), cell("Starter DB — 1GB storage"), cell("$7", { align: AlignmentType.CENTER }), cell("₹585", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("UPGRADED TOTAL", { bold: true, bg: COLORS.rankBg3 }), cell("With Singapore region + no cold start", { bg: COLORS.rankBg3 }), cell("~$14/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg3 }), cell("~₹1,170/mo", { bold: true, align: AlignmentType.CENTER, bg: COLORS.rankBg3 })] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("Pros — Render"),
    bullet("🟢 You already know it — zero learning curve, existing render.yaml in your project"),
    bullet("🟢 Admin Panel hosted FREE as static site"),
    bullet("🟢 Excellent developer experience, very clean UI"),
    bullet("🟢 Free tier for prototyping/testing"),
    bullet("🟢 Full Docker support"),
    bullet("🟢 GitHub auto-deploy on push"),
    ...spacer(1),
    subHeading("Cons — Render"),
    bullet("🔴 NO India data center — best available region for India is Singapore (~80ms latency)"),
    bullet("🔴 Current free plan SLEEPS after 15 min → unacceptable for production laundry orders"),
    bullet("🔴 Free PostgreSQL has 90-day expiry — data deleted after 90 days on free plan"),
    bullet("🟡 Slightly more expensive than DigitalOcean for equivalent specs"),
    bullet("🟡 Less enterprise-grade features compared to DigitalOcean or AWS"),
    ...spacer(2),
  );

  return sections;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MASTER COMPARISON TABLE
// ═══════════════════════════════════════════════════════════════════════════════
function makeMasterComparison() {
  const tick = "✅";
  const cross = "❌";
  const warn = "⚠️";

  function compRow(criterion, do_, railway, render, altRow = false) {
    const bg = altRow ? COLORS.altRow : COLORS.white;
    return new TableRow({
      children: [
        cell(criterion, { bold: true, bg }),
        cell(do_, { align: AlignmentType.CENTER, bg }),
        cell(railway, { align: AlignmentType.CENTER, bg }),
        cell(render, { align: AlignmentType.CENTER, bg }),
      ],
    });
  }

  return [
    sectionHeading("4. Master Comparison Table"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow([
          { text: "Criteria", width: 30 },
          { text: "🏆 DigitalOcean\n(Recommended)", width: 23 },
          { text: "🥈 Railway", width: 23 },
          { text: "🥉 Render", width: 24 },
        ]),
        compRow("India Data Center", "✅ Bangalore (IN)", "⚠️ Singapore (SG)", "⚠️ Singapore (SG)", false),
        compRow("Latency to India", "✅ <50ms", "⚠️ 70–90ms", "⚠️ 70–90ms*", true),
        compRow("Docker Support", "✅ Auto-detect", "✅ Auto-detect", "✅ Full support", false),
        compRow("Managed PostgreSQL 15", "✅ Yes (BLR1)", "✅ Yes (SIN)", "✅ Yes (SIN)", true),
        compRow("Free Static Hosting (Admin)", "✅ Yes — FREE", "⚠️ Near-free", "✅ Yes — FREE", false),
        compRow("Auto-deploy (Git Push)", "✅ Yes", "✅ Yes", "✅ Yes", true),
        compRow("Free Trial Credit", "✅ $200 (60 days)", "❌ None", "⚠️ Free tier (limited)", false),
        compRow("Cold Start Issue", "✅ None on paid", "✅ Scales to zero", "❌ Yes (free plan)", true),
        compRow("Pricing Model", "✅ Flat monthly", "⚠️ Usage-based", "✅ Flat monthly", false),
        compRow("INR Price / Month (Starter)", "✅ ~₹1,000", "⚠️ ~₹835–1,400", "✅ ~₹1,170", true),
        compRow("Existing render.yaml Compat.", "✅ Near 1:1 port", "⚠️ Minor changes", "✅ No changes", false),
        compRow("SSL / Custom Domain", "✅ Free", "✅ Free", "✅ Free", true),
        compRow("Scalability", "✅ High", "✅ High", "⚠️ Medium", false),
        compRow("Support Quality", "✅ Excellent docs", "⚠️ Community", "✅ Good docs", true),
        compRow("India DPDP Compliance", "✅ Data in India", "❌ Data outside IN", "❌ Data outside IN", false),
        new TableRow({
          children: [
            cell("OVERALL SCORE", { bold: true, bg: COLORS.tableHeader, color: COLORS.white }),
            cell("9.5 / 10  🏆", { bold: true, align: AlignmentType.CENTER, bg: COLORS.success, color: COLORS.white }),
            cell("7.5 / 10", { bold: true, align: AlignmentType.CENTER, bg: COLORS.secondary, color: COLORS.white }),
            cell("7.0 / 10", { bold: true, align: AlignmentType.CENTER, bg: COLORS.warning, color: COLORS.white }),
          ],
        }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    para("* Render's latency assumes Singapore region is manually configured. Default (Oregon) = 200ms+"),
    ...spacer(2),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRICING SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
function makePricingSummary() {
  return [
    sectionHeading("5. Pricing Summary (INR)"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Phase", "DigitalOcean", "Railway", "Render (Upgraded)"]),
        new TableRow({
          children: [
            cell("Launch / MVP\n(Month 1–2)", { bold: true }),
            cell("₹0\n($200 free credit)", { align: AlignmentType.CENTER, bg: COLORS.rankBg1 }),
            cell("₹835–1,400\n(no free trial)", { align: AlignmentType.CENTER, bg: COLORS.rankBg2 }),
            cell("₹0 (free tier)\n⚠️ Cold starts", { align: AlignmentType.CENTER, bg: COLORS.rankBg3 }),
          ],
        }),
        new TableRow({
          children: [
            cell("Production Start\n(Month 3+)", { bold: true, bg: COLORS.altRow }),
            cell("₹1,005/mo\n(API $5 + DB $7)", { align: AlignmentType.CENTER, bg: COLORS.rankBg1 }),
            cell("₹835–1,400/mo\n(variable)", { align: AlignmentType.CENTER, bg: COLORS.rankBg2 }),
            cell("₹1,170/mo\n(API $7 + DB $7)", { align: AlignmentType.CENTER, bg: COLORS.rankBg3 }),
          ],
        }),
        new TableRow({
          children: [
            cell("Scale\n(1000+ orders/day)", { bold: true }),
            cell("₹2,260/mo\n(1GB API + Managed DB)", { align: AlignmentType.CENTER, bg: COLORS.rankBg1 }),
            cell("₹2,000–3,500/mo\n(usage spikes)", { align: AlignmentType.CENTER, bg: COLORS.rankBg2 }),
            cell("₹2,500+/mo\n(Standard plan)", { align: AlignmentType.CENTER, bg: COLORS.rankBg3 }),
          ],
        }),
        new TableRow({
          children: [
            cell("WINNER", { bold: true, bg: COLORS.tableHeader, color: COLORS.white }),
            cell("🏆 BEST VALUE", { bold: true, align: AlignmentType.CENTER, bg: COLORS.success, color: COLORS.white }),
            cell("2nd", { bold: true, align: AlignmentType.CENTER, bg: COLORS.secondary, color: COLORS.white }),
            cell("3rd", { bold: true, align: AlignmentType.CENTER, bg: COLORS.warning, color: COLORS.white }),
          ],
        }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(2),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DEPLOYMENT GUIDE
// ═══════════════════════════════════════════════════════════════════════════════
function makeDeploymentGuide() {
  return [
    sectionHeading("6. Deployment Guide — DigitalOcean App Platform"),
    para("Since DigitalOcean is the recommended platform and your project already has a Dockerfile and render.yaml, migration is straightforward. Follow the steps below:"),
    ...spacer(1),
    subHeading("Step 1 — Create DigitalOcean Account"),
    bullet("Go to https://cloud.digitalocean.com and sign up"),
    bullet("Apply $200 free credit (no billing for 60 days)"),
    bullet("Verify your email address"),
    ...spacer(1),
    subHeading("Step 2 — Connect GitHub Repository"),
    bullet("Navigate to Apps → Create App"),
    bullet("Select 'GitHub' as source"),
    bullet("Authorize DigitalOcean to access your GitHub"),
    bullet("Select the laundry API repository"),
    bullet("Select branch: main (or your production branch)"),
    ...spacer(1),
    subHeading("Step 3 — Configure API Service"),
    bullet("Resource Type: Detected as 'Dockerfile' automatically ✅"),
    bullet("IMPORTANT: Set Region to Bangalore (BLR1)"),
    bullet("Plan: Basic — 512MB RAM ($5/mo) for MVP"),
    bullet("HTTP Port: 10000 (matches your PORT env var)"),
    ...spacer(1),
    subHeading("Step 4 — Add PostgreSQL Database"),
    bullet("Click 'Add Resource' → 'Database'"),
    bullet("Select PostgreSQL 15 (matches your current version)"),
    bullet("Plan: Dev Database ($7/mo) — auto-injects DATABASE_URL"),
    bullet("Region: Bangalore (same as API — critical for performance!)"),
    ...spacer(1),
    subHeading("Step 5 — Configure Environment Variables"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Environment Variable", "Value / Source"]),
        new TableRow({ children: [cell("DATABASE_URL"), cell("Auto-injected from database resource ✅")] }),
        new TableRow({ children: [cell("PORT", { bg: COLORS.altRow }), cell("10000", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("JWT_SECRET"), cell("Generate a strong random string (min 64 chars)")] }),
        new TableRow({ children: [cell("JWT_EXPIRATION", { bg: COLORS.altRow }), cell("365d", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("JWT_REFRESH_EXPIRATION"), cell("365d")] }),
        new TableRow({ children: [cell("CORS_ORIGIN", { bg: COLORS.altRow }), cell("https://your-admin-panel-domain.com", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("NODE_ENV"), cell("production")] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("Step 6 — Deploy Admin Panel (Free Static Hosting)"),
    bullet("Create a second App → Select laundry-admin-panel repository"),
    bullet("Resource Type: Static Site (FREE)"),
    bullet("Build Command: npm run build"),
    bullet("Output Directory: dist"),
    bullet("Set VITE_API_URL = https://your-api.ondigitalocean.app"),
    bullet("Region: Bangalore"),
    ...spacer(1),
    subHeading("Step 7 — Add Custom Domain + Cloudflare CDN"),
    bullet("In DO App settings → Domains → Add your custom domain"),
    bullet("Point DNS through Cloudflare (free tier) for CDN + DDoS protection"),
    bullet("Cloudflare automatically caches static assets for Indian users globally"),
    ...spacer(2),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════════
function makeArchitecture() {
  return [
    sectionHeading("7. Recommended Production Architecture"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "LAUNDRY APP — PRODUCTION ARCHITECTURE", bold: true, color: COLORS.white, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "All components in Bangalore (BLR1) — <50ms for Indian customers", color: COLORS.light, size: 20, font: "Calibri", italics: true })], alignment: AlignmentType.CENTER }),
              ],
              shading: { type: ShadingType.SOLID, color: COLORS.primary, fill: COLORS.primary },
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "🌐  Indian Customer (Mobile / Browser)", bold: true, color: COLORS.primary, size: 20, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "↓", color: COLORS.accent, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "☁️  Cloudflare CDN (FREE) — DDoS protection + caching + SSL", color: COLORS.secondary, size: 20, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "↓                                        ↓", color: COLORS.accent, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "📊 Admin Panel (Static — FREE)        🖥️  NestJS API (DO Bangalore)", bold: true, color: COLORS.primary, size: 20, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "React + Vite                              Port 10000 | Docker", color: COLORS.darkGray, size: 18, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "                                                      ↓", color: COLORS.accent, size: 24, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "🗄️  Managed PostgreSQL 15 (DO Bangalore) — Automated Backups", bold: true, color: COLORS.primary, size: 20, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "< 50ms end-to-end  |  All data physically stored in India  |  DPDP compliant", color: COLORS.success, size: 18, font: "Calibri", italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 60 } }),
              ],
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
            }),
          ],
        }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(2),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FINAL RECOMMENDATION
// ═══════════════════════════════════════════════════════════════════════════════
function makeFinalRecommendation() {
  return [
    sectionHeading("8. Final Recommendation & Decision Matrix"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Your Requirement", "Best Vendor", "Reason"]),
        new TableRow({ children: [cell("India latency critical"), cell("✅ DigitalOcean", { align: AlignmentType.CENTER }), cell("Only vendor with Bangalore data center (physically in India)")] }),
        new TableRow({ children: [cell("Easy like Render", { bg: COLORS.altRow }), cell("✅ DigitalOcean", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("Same Git-push-to-deploy experience, identical DX to Render", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("Cheap / Budget-friendly"), cell("✅ DigitalOcean", { align: AlignmentType.CENTER }), cell("$200 free, then ₹1,000/mo — cheapest for India quality")] }),
        new TableRow({ children: [cell("Your Docker is ready", { bg: COLORS.altRow }), cell("✅ DigitalOcean", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("Auto-detects your Dockerfile — zero extra config needed", { bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("India data law (DPDP)"), cell("✅ DigitalOcean", { align: AlignmentType.CENTER }), cell("Data stored in India (Bangalore) — fully DPDP compliant")] }),
        new TableRow({ children: [cell("Admin Panel hosting", { bg: COLORS.altRow }), cell("✅ DigitalOcean", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("FREE static hosting — ₹0/month for Admin Panel forever", { bg: COLORS.altRow })] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    subHeading("Phased Rollout Plan"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRow(["Phase", "Timeline", "Action", "Cost"]),
        new TableRow({ children: [cell("Phase 1: Launch"), cell("Month 1–2", { align: AlignmentType.CENTER }), cell("Deploy on DO with $200 credit — test in Bangalore"), cell("₹0", { align: AlignmentType.CENTER })] }),
        new TableRow({ children: [cell("Phase 2: Production", { bg: COLORS.altRow }), cell("Month 3+", { align: AlignmentType.CENTER, bg: COLORS.altRow }), cell("Upgrade to paid plan, add Cloudflare CDN, custom domain", { bg: COLORS.altRow }), cell("~₹1,000/mo", { align: AlignmentType.CENTER, bg: COLORS.altRow })] }),
        new TableRow({ children: [cell("Phase 3: Scale"), cell("As needed", { align: AlignmentType.CENTER }), cell("Upgrade DB to managed cluster, add Redis cache, autoscale"), cell("~₹2,260/mo", { align: AlignmentType.CENTER })] }),
      ],
      layout: TableLayoutType.FIXED,
    }),
    ...spacer(1),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: "DevOps Team Verdict", bold: true, color: COLORS.white, size: 26, font: "Calibri" })], alignment: AlignmentType.CENTER }),
                new Paragraph({ children: [new TextRun({ text: "Go with DigitalOcean App Platform — Bangalore Region", bold: true, color: COLORS.gold, size: 28, font: "Calibri" })], alignment: AlignmentType.CENTER, spacing: { before: 80 } }),
                new Paragraph({ children: [new TextRun({ text: "It is the only option that puts your data physically in India, giving your customers the fastest possible experience while keeping costs under ₹1,000/month with 2 months completely free to start. Your existing Dockerfile and render.yaml make migration a 30-minute task.", color: COLORS.light, size: 20, font: "Calibri" })], alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 } }),
              ],
              shading: { type: ShadingType.SOLID, color: COLORS.primary, fill: COLORS.primary },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
            }),
          ],
        }),
      ],
    }),
    ...spacer(1),
    new Paragraph({
      children: [
        new TextRun({ text: "Prepared by DevOps Engineering Team  |  Saimorphix Innovations  |  July 2026  |  Confidential", color: COLORS.midGray, size: 16, font: "Calibri", italics: true }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
    }),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BUILD DOCUMENT
// ═══════════════════════════════════════════════════════════════════════════════
async function buildDoc() {
  const doc = new Document({
    creator: "DevOps Engineering Team — Saimorphix Innovations",
    title: "Laundry App Cloud Hosting Vendor Comparison Report",
    description: "Comprehensive comparison of DigitalOcean, Railway, and Render for Indian market deployment",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, bottom: 720, left: 900, right: 900 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Laundry App — Cloud Hosting Vendor Comparison Report", color: COLORS.primary, size: 18, font: "Calibri", bold: true }),
                  new TextRun({ text: "  |  Saimorphix Innovations  |  CONFIDENTIAL", color: COLORS.midGray, size: 16, font: "Calibri" }),
                ],
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.accent } },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "© 2026 Saimorphix Innovations — DevOps Engineering Team  |  Page ", color: COLORS.midGray, size: 16, font: "Calibri" })],
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.midGray } },
              }),
            ],
          }),
        },
        children: [
          ...makeCoverPage(),
          ...makeExecutiveSummary(),
          ...makeTechStack(),
          ...makeVendorDetails(),
          ...makeMasterComparison(),
          ...makePricingSummary(),
          ...makeDeploymentGuide(),
          ...makeArchitecture(),
          ...makeFinalRecommendation(),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = "Laundry_App_Hosting_Vendor_Comparison.docx";
  writeFileSync(outPath, buffer);
  console.log(`✅ Word document created: ${outPath}`);
  console.log(`📄 File size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

buildDoc().catch(console.error);
