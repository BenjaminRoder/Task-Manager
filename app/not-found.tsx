import Link from "next/link";
export default function NotFound() {
  return (
    <div className="future-section">
      <h1>Page not found.</h1>
      <p>Let&apos;s get back to your day.</p>
      <Link href="/today" className="primary-button">
        Back to Today
      </Link>
    </div>
  );
}
