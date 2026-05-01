import Link from "next/link";
import { Container } from "@/components/ui/container";

const footerLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/cancellation", label: "Cancellation Policy" }
];

export function FooterCompliance() {
  return (
    <footer className="footer-compliance">
      <Container className="footer-layout">
        <div>
          <p className="footer-brand">WOMEN HEALTH MASTERCLASS 101</p>
          <p className="footer-copy">
            Disclaimer: This workshop is for educational and wellness awareness purposes only. It is
            not medical advice, diagnosis, treatment, or a replacement for consultation with a
            qualified doctor. Do not stop or change any medicine without medical supervision.
            Results vary from person to person.
          </p>
        </div>

        <nav className="footer-links" aria-label="Legal links">
          {footerLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              {link.label}
            </Link>
          ))}
          <a href="mailto:[Support Email]">Contact Support</a>
        </nav>
      </Container>
    </footer>
  );
}
