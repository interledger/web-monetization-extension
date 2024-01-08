import React from 'react'

export const Spinner = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      {...props}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        d="M2.204 6.447A6 6 0 108 2"
      />
    </svg>
  )
}
