export function SiteHeader() {
  return (
    <header className="site-header" aria-label="Primary navigation">
      <a className="site-brand" href="#top" aria-label="Heal Your Hormones Masterclass home">
        <span>HYH</span>
        Heal Your Hormones Masterclass
      </a>
      <nav className="site-nav" aria-label="Page sections">
        <a href="#details">Details</a>
        <a href="#registration">{"\u20B951"}</a>
      </nav>
    </header>
  );
}
