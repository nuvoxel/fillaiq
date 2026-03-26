import Link from "next/link";
import {
  Scale,
  Nfc,
  Palette,
  Printer,
  Server,
  Thermometer,
  ScanLine,
  Router,
  Cpu,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
// Button base classes for server-side rendering (equivalent to BTN_LG)
const BTN_LG = "inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none h-9 gap-1.5 px-2.5";
import { cn } from "@/lib/utils";

const GITHUB_REPO = "nuvoxel/fillaiq";
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

const features = [
  {
    icon: <Nfc className="size-9" />,
    title: "NFC Identification",
    description:
      "Reads Bambu Lab, Creality, OpenSpool, TigerTag, and NTAG tags. Decrypts Bambu Lab NFC with HKDF key derivation. Place the item — it's identified instantly.",
  },
  {
    icon: <Scale className="size-9" />,
    title: "Precision Weight Tracking",
    description:
      "24-bit NAU7802 load cell ADC measures weight to the gram. Track filament spools, resin bottles, fastener bins, sheet stock — anything with weight.",
  },
  {
    icon: <Palette className="size-9" />,
    title: "Spectral Color Detection",
    description:
      "AS7341/AS7343 14-channel spectral sensor measures actual color — not just what the label says. LAB color space for accurate matching across materials.",
  },
  {
    icon: <ScanLine className="size-9" />,
    title: "Barcode & QR Scanning",
    description:
      "Scan barcodes and QR codes from your phone camera for instant catalog lookup. Works with any packaged product.",
  },
  {
    icon: <Package className="size-9" />,
    title: "Workshop Product Catalog",
    description:
      "7,000+ filaments pre-loaded from SpoolmanDB, plus standard imperial and metric fasteners, sheet goods, resins, CNC stock, and laser materials. Add your own or contribute back.",
  },
  {
    icon: <Printer className="size-9" />,
    title: "Label Printing",
    description:
      "Print thermal labels with brand logo, material, color, temps, drying info, flow ratio, TD, and QR code. Configurable templates from 25mm to 50mm.",
  },
  {
    icon: <Server className="size-9" />,
    title: "Rack & Shelf Management",
    description:
      "Organize storage as zones, racks, shelves, bays, and slots. Track filament spools, hardware bins, tools, and components. Interactive drag-and-drop with environmental monitoring.",
  },
  {
    icon: <Router className="size-9" />,
    title: "Multi-Machine Control",
    description:
      "Manage FDM printers, resin printers, CNC routers, and laser cutters from one dashboard. Bambu Lab, Klipper, OctoPrint, PrusaLink, and GRBL protocols. Normalized status and job queue.",
  },
  {
    icon: <Thermometer className="size-9" />,
    title: "Environmental Monitoring",
    description:
      "Track temperature, humidity, and pressure per shelf or zone. Know which materials need drying, which storage areas are too humid, and when conditions change.",
  },
  {
    icon: <Cpu className="size-9" />,
    title: "MQTT Real-Time",
    description:
      "All device communication over MQTT — scans, machine status, heartbeats, OTA updates. No polling, no lag. Works with Home Assistant and any MQTT platform.",
  },
];

const products = [
  {
    name: "FillaScan",
    tagline: "Scan Station",
    description:
      "NFC reader + load cell + spectral color sensor + 2.8\" touch display. Identifies filaments, hardware, and supplies — reports to your dashboard via MQTT.",
    specs: [
      "ESP32-S3",
      "PN5180 NFC",
      "NAU7802 ADC",
      "AS7343 Color",
      "BLE Label Printer",
    ],
  },
  {
    name: "FillaShelf",
    tagline: "Smart Storage",
    description:
      "Multi-bay shelf module with per-slot weight monitoring, NFC identification, and environmental sensors. Track filament spools, hardware bins, tools, and components.",
    specs: ["Per-slot weight", "NFC per bay", "Temp/humidity", "MQTT connected"],
  },
  {
    name: "Paper Labels",
    tagline: "Thermal Printing",
    description:
      "BLE thermal printer integration. Prints labels in the 3DFilamentProfiles format — brand logo, material strip, temps, QR code. Phomemo, NIIMBOT, Brother support.",
    specs: ["40x30mm labels", "Brand logos", "QR codes", "Configurable templates"],
  },
  {
    name: "FillaLabel",
    tagline: "E-Ink Shelf Labels (Coming Soon)",
    description:
      "Repurpose electronic shelf labels (ESL / e-ink price tags) as smart per-slot displays. Shows item info, weight, color, and status — updates wirelessly when inventory changes.",
    specs: ["E-ink displays", "Wireless update", "Per-slot info", "Discovery phase"],
  },
];

const nfcFormats = [
  "Bambu Lab (MIFARE)",
  "Creality",
  "OpenSpool",
  "TigerTag",
  "OpenPrintTag",
  "NTAG",
  "FillaIQ",
];

const machineProtocols = [
  "Bambu Lab",
  "Klipper",
  "OctoPrint",
  "PrusaLink",
  "GRBL",
];

const steps = [
  {
    number: "1",
    title: "Scan",
    description:
      "Place an item on the scan station. NFC, weight, and color are read automatically — filament, hardware, supplies.",
  },
  {
    number: "2",
    title: "Identify",
    description:
      "Matched against the catalog — filaments, fasteners, sheet goods, and more. Review, edit, and confirm the details.",
  },
  {
    number: "3",
    title: "Store",
    description:
      "Assign it to a rack slot. Print a label. Track weight, usage, and environmental conditions from your dashboard.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0F1F23] via-[#1A2530] to-[#0F1F23] py-20 text-center text-white md:py-28">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#00D2FF 1px, transparent 1px), linear-gradient(90deg, #00D2FF 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* GitHub buttons — top right */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 md:top-5 md:right-6">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-[0.8rem] font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/15"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
          <a
            href={`${GITHUB_URL}/stargazers`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <img
              src={`https://img.shields.io/github/stars/${GITHUB_REPO}?style=social`}
              alt="GitHub stars"
              className="h-5"
            />
          </a>
        </div>

        <div className="relative z-[1] mx-auto max-w-2xl px-4">
          {/* Logo bars */}
          <div className="mb-6 inline-flex gap-1">
            <div className="h-11 w-2 rounded-full bg-primary" />
            <div className="h-11 w-2 rounded-full bg-primary" />
          </div>

          <h1 className="mb-3 font-display text-4xl font-extrabold md:text-5xl">
            FillaIQ
          </h1>
          <p className="mb-3 font-display text-lg font-medium opacity-90 md:text-2xl">
            Open-Source Smart Workshop Inventory
          </p>

          <div className="mb-5 flex flex-wrap justify-center gap-1.5">
            {["Hardware", "Firmware", "Web App", "APIs", "Data"].map(
              (label) => (
                <span
                  key={label}
                  className="rounded-full border border-primary/25 bg-primary/12 px-2.5 py-0.5 text-xs font-semibold text-primary"
                >
                  {label}
                </span>
              )
            )}
          </div>

          <p className="mx-auto mb-8 max-w-xl leading-7 opacity-65">
            Identify, weigh, and track everything in your workshop — filament spools,
            resin bottles, fastener bins, sheet stock, tools. Manage 3D printers,
            CNC routers, and laser cutters from one dashboard. Fully open source
            — hardware designs, ESP32 firmware, Next.js web app, REST APIs, and
            a growing catalog. Build it, modify it, contribute back.
          </p>

          <Link
            href="/login"
            className={cn(
              BTN_LG,
              "bg-primary px-8 py-3 text-base font-bold text-white transition-all hover:bg-[#00B8E0] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,210,255,0.4)]"
            )}
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section className="border-b bg-white py-6">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-6 px-4 md:gap-12">
          {[
            { value: "7,000+", label: "Filaments" },
            { value: "87", label: "Brands" },
            { value: "50", label: "Materials" },
            { value: "7", label: "NFC Formats" },
            { value: "5", label: "Machine Protocols" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-xl font-extrabold text-[#1A2530]">
                {s.value}
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="mb-2 text-center font-display text-2xl font-bold md:text-3xl">
            How It Works
          </h2>
          <p className="mb-10 text-center text-muted-foreground">
            From spool to shelf in seconds.
          </p>
          <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-center">
            {steps.map((s) => (
              <div key={s.number} className="flex-1 text-center">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[#0F1F23] font-display text-xl font-bold text-primary">
                  {s.number}
                </div>
                <h3 className="mb-1 text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="bg-[#F8FAFC] py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-center font-display text-2xl font-bold md:text-3xl">
            Features
          </h2>
          <p className="mb-10 text-center text-muted-foreground">
            Everything you need to run a smart workshop.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="h-full border border-border shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="mb-3 text-primary">{f.icon}</div>
                  <h3 className="mb-1.5 text-sm font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-2 text-center font-display text-2xl font-bold md:text-3xl">
            Hardware
          </h2>
          <p className="mb-10 text-center text-muted-foreground">
            Open-source hardware for workshop automation.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {products.map((p) => (
              <div
                key={p.name}
                className="flex h-full flex-col rounded-xl bg-[#0F1F23] p-5 text-white"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  {p.tagline}
                </p>
                <h3 className="mb-2 font-display text-xl font-bold">
                  {p.name}
                </h3>
                <p className="mb-4 text-sm leading-relaxed opacity-70">
                  {p.description}
                </p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {p.specs.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-primary/12 px-2 py-0.5 text-[0.7rem] text-primary"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Compatibility ── */}
      <section className="bg-[#F8FAFC] py-12 md:py-16">
        <div className="mx-auto grid max-w-2xl gap-10 px-4 md:grid-cols-2">
          <div>
            <h3 className="mb-3 text-lg font-bold">NFC Tag Formats</h3>
            <div className="flex flex-wrap gap-1.5">
              {nfcFormats.map((f) => (
                <Badge key={f} variant="outline" className="font-medium">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-lg font-bold">Machine Protocols</h3>
            <div className="flex flex-wrap gap-1.5">
              {machineProtocols.map((p) => (
                <Badge key={p} variant="outline" className="font-medium">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bg-gradient-to-br from-[#0F1F23] to-[#1A2530] py-12 text-center text-white md:py-20">
        <div className="mx-auto max-w-lg px-4">
          <h2 className="mb-4 font-display text-2xl font-bold md:text-3xl">
            Ready to organize your workshop?
          </h2>
          <p className="mb-8 opacity-65">
            Sign in to access your dashboard, scan your first spool, and take
            control of your inventory.
          </p>
          <Link
            href="/login"
            className={cn(
              BTN_LG,
              "bg-primary px-8 py-3 text-base font-bold text-white hover:bg-[#00B8E0] hover:shadow-[0_4px_20px_rgba(0,210,255,0.4)]"
            )}
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-6 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} FillaIQ / Nuvoxel. Open source under
          the{" "}
          <a
            href={`${GITHUB_URL}/blob/main/LICENSE`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground underline-offset-2 hover:underline"
          >
            MIT License
          </a>
          .
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          <a href="https://fillaiq.com/privacy" className="underline-offset-2 hover:underline">
            Privacy Policy
          </a>
          {" · "}
          <a href="https://fillaiq.com/terms" className="underline-offset-2 hover:underline">
            Terms of Service
          </a>
        </p>
      </footer>
    </div>
  );
}
