import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">@remocn/render-sdk</h1>
      <p className="mb-2">
        Backend-swappable render engine for Remotion.
        One API surface, two execution targets: local server or AWS Lambda.
      </p>
      <p>
        Read the{' '}
        <Link href="/docs" className="font-medium underline">
          documentation
        </Link>{' '}
        to get started.
      </p>
    </div>
  );
}
