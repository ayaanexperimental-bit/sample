import Link from "next/link";

export default function DisclaimerPage() {
  return (
    <main className="policy-page">
      <article className="policy-document">
        <p className="policy-kicker">Yours Wellness Center</p>
        <h1>Disclaimer</h1>
        <p>
          This masterclass is intended for education and general wellness awareness. It is not a
          substitute for diagnosis, medical treatment, medication decisions, or advice from a
          qualified healthcare professional.
        </p>
        <p>
          Results and experiences vary. The information on this page is educational wellness content
          and should be interpreted with professional medical guidance where needed.
        </p>
        <p>
          If you have diabetes, PMOS, thyroid issues, pregnancy-related concerns, infertility,
          menstrual irregularities, high blood pressure, kidney disease, liver disease, heart
          disease, eating disorders, or any medical condition, please consult your doctor before
          making lifestyle, food, exercise, supplement, or medication-related changes.
        </p>
        <p>
          We do not guarantee cure, reversal, medicine stoppage, weight loss, pregnancy, skin
          improvement, hair growth, hormone correction, or any fixed outcome. Testimonials, success
          stories, and examples are individual experiences and should not be treated as guaranteed
          results.
        </p>
        <p>
          If you experience any medical emergency, immediately contact a qualified medical
          professional or emergency service.
        </p>
        <Link href="/">Back to landing page</Link>
      </article>
    </main>
  );
}
