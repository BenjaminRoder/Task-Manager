import Link from "next/link";

export function FutureSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </header>
      <section className="future-section">
        <h2>A little further down the road.</h2>
        <p>
          This section is planned for a future milestone. For now, make a little
          progress with your tasks.
        </p>
        <Link className="primary-button" href="/today">
          Back to Today
        </Link>
      </section>
    </>
  );
}
