"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="error-banner">
      <h1>Something went wrong.</h1>
      <p>
        Please try loading this page again. Your saved tasks remain in this
        browser.
      </p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
