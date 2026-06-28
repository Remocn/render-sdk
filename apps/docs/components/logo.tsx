import type { SVGProps } from "react";

/** The Remocn Render SDK mark — a play triangle over vertical timeline bars. */
export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="100"
      viewBox="0 0 100 100"
      width="100"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect fill="black" height="100" rx="14" width="100" />
      <path
        d="M83.9141 45.7661C86.9141 47.4982 86.9141 51.829 83.9141 53.561L31.4141 83.8716C28.4141 85.6036 24.6641 83.4382 24.6641 79.9741L24.6641 19.353C24.6641 15.8889 28.4141 13.7235 31.4141 15.4556L83.9141 45.7661Z"
        fill="white"
        stroke="white"
      />
      <path
        d="M68.998 31.3979C68.998 50.3798 68.998 63.307 68.998 67.3979"
        stroke="black"
        strokeWidth="10"
      />
      <path
        d="M53.0625 16.75C53.0625 48.2803 53.0625 69.7535 53.0625 76.5488"
        stroke="black"
        strokeWidth="10"
      />
      <path
        d="M37.127 9.88379C37.127 51.1081 37.127 79.1833 37.127 88.0679"
        stroke="black"
        strokeWidth="10"
      />
      <path
        d="M31.1318 15.8618L43.1074 22.7646"
        stroke="white"
        strokeWidth="2"
      />
      <path d="M63.291 34.439L75.2617 41.3579" stroke="white" strokeWidth="2" />
      <path
        d="M46.6641 74.4712L59.208 67.2573"
        stroke="white"
        strokeWidth="2"
      />
      <path
        d="M76.0205 57.5371L82.9848 53.5226"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  );
}
