import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | FillaIQ",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-16 px-6">
      <div className="mx-auto max-w-2xl prose prose-neutral dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: March 25, 2026</p>

        <h2>1. Introduction</h2>
        <p>
          This Privacy Policy describes how NuVoxel LLC (&quot;we&quot;,
          &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your
          information when you use FillaIQ (&quot;the Service&quot;).
        </p>

        <h2>2. Information We Collect</h2>
        <h3>Account Information</h3>
        <p>
          When you create an account, we collect your name, email address, and
          authentication credentials. If you sign in with a third-party provider
          (Google, GitHub, or Microsoft), we receive your name, email, and
          profile picture from that provider.
        </p>
        <h3>Inventory Data</h3>
        <p>
          The Service stores data you provide about your workshop inventory,
          including filament spools, hardware items, weights, colors, NFC tag
          identifiers, and organizational structure (locations, racks, shelves).
        </p>
        <h3>Device Data</h3>
        <p>
          If you use FillaIQ hardware (scan stations, shelf modules), the
          devices transmit sensor readings such as weight, color, and NFC tag
          data to the Service.
        </p>
        <h3>Usage Data</h3>
        <p>
          We may collect basic usage information such as IP addresses, browser
          type, and pages visited to maintain and improve the Service.
        </p>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To provide and maintain the Service</li>
          <li>To authenticate your identity</li>
          <li>To send transactional emails (verification, password reset)</li>
          <li>To respond to support requests</li>
        </ul>

        <h2>4. Data Sharing</h2>
        <p>
          We do not sell your personal information. We may share data only in
          the following cases:
        </p>
        <ul>
          <li>With your consent</li>
          <li>To comply with legal obligations</li>
          <li>
            With service providers who assist in operating the Service (e.g.,
            hosting, email delivery), under contractual obligations to protect
            your data
          </li>
        </ul>

        <h2>5. Data Storage and Security</h2>
        <p>
          Your data is stored on servers in the United States. We use
          industry-standard security measures including encryption in transit
          (TLS) and at rest to protect your information.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain your data for as long as your account is active. You may
          request deletion of your account and associated data at any time by
          contacting us.
        </p>

        <h2>7. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export your inventory data</li>
        </ul>

        <h2>8. Cookies</h2>
        <p>
          The Service uses essential cookies for authentication and session
          management. We do not use tracking or advertising cookies.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of material changes by posting the updated policy on this page.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about this Privacy Policy? Contact us at{" "}
          <a href="mailto:mike@nuvoxel.com" className="underline">
            mike@nuvoxel.com
          </a>
          .
        </p>

        <div className="mt-8 pt-8 border-t">
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
