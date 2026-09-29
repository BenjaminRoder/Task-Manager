"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="error-banner">
      <h1>Something went wrong.</h1>
      <p>
        Please try loading this page again. Check your connection and sign in
        again if your session expired.
      </p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
