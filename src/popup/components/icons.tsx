import React from 'react'

export const Spinner = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      {...props}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        d="M2.204 6.447A6 6 0 108 2"
      />
    </svg>
  )
}

export const ArrowBack = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <mask
        id="mask0_169_196"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="25"
        height="25"
      >
        <rect x="0.75" y="0.5" width="24" height="24" fill="#C4C4C4" />
      </mask>
      <g mask="url(#mask0_169_196)">
        <path
          d="M12.75 20.5L4.75 12.5L12.75 4.5L14.175 5.9L8.575 11.5H20.75V13.5H8.575L14.175 19.1L12.75 20.5Z"
          fill="#475569"
        />
      </g>
    </svg>
  )
}

export const Settings = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="25"
      height="25"
      viewBox="0 0 25 25"
      fill="none"
      {...props}
    >
      <mask
        id="mask0_140_3136"
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="25"
        height="25"
      >
        <rect x="0.75" y="0.5" width="24" height="24" fill="#C4C4C4" />
      </mask>
      <g mask="url(#mask0_140_3136)">
        <path
          d="M10.0002 22.5L9.6002 19.3C9.38353 19.2167 9.17953 19.1167 8.9882 19C8.7962 18.8833 8.60853 18.7583 8.4252 18.625L5.4502 19.875L2.7002 15.125L5.2752 13.175C5.25853 13.0583 5.2502 12.9457 5.2502 12.837C5.2502 12.729 5.2502 12.6167 5.2502 12.5C5.2502 12.3833 5.2502 12.2707 5.2502 12.162C5.2502 12.054 5.25853 11.9417 5.2752 11.825L2.7002 9.875L5.4502 5.125L8.4252 6.375C8.60853 6.24167 8.8002 6.11667 9.0002 6C9.2002 5.88333 9.4002 5.78333 9.6002 5.7L10.0002 2.5H15.5002L15.9002 5.7C16.1169 5.78333 16.3212 5.88333 16.5132 6C16.7045 6.11667 16.8919 6.24167 17.0752 6.375L20.0502 5.125L22.8002 9.875L20.2252 11.825C20.2419 11.9417 20.2502 12.054 20.2502 12.162C20.2502 12.2707 20.2502 12.3833 20.2502 12.5C20.2502 12.6167 20.2502 12.729 20.2502 12.837C20.2502 12.9457 20.2335 13.0583 20.2002 13.175L22.7752 15.125L20.0252 19.875L17.0752 18.625C16.8919 18.7583 16.7002 18.8833 16.5002 19C16.3002 19.1167 16.1002 19.2167 15.9002 19.3L15.5002 22.5H10.0002ZM12.8002 16C13.7669 16 14.5919 15.6583 15.2752 14.975C15.9585 14.2917 16.3002 13.4667 16.3002 12.5C16.3002 11.5333 15.9585 10.7083 15.2752 10.025C14.5919 9.34167 13.7669 9 12.8002 9C11.8169 9 10.9875 9.34167 10.3122 10.025C9.63753 10.7083 9.3002 11.5333 9.3002 12.5C9.3002 13.4667 9.63753 14.2917 10.3122 14.975C10.9875 15.6583 11.8169 16 12.8002 16ZM12.8002 14C12.3835 14 12.0295 13.854 11.7382 13.562C11.4462 13.2707 11.3002 12.9167 11.3002 12.5C11.3002 12.0833 11.4462 11.7293 11.7382 11.438C12.0295 11.146 12.3835 11 12.8002 11C13.2169 11 13.5712 11.146 13.8632 11.438C14.1545 11.7293 14.3002 12.0833 14.3002 12.5C14.3002 12.9167 14.1545 13.2707 13.8632 13.562C13.5712 13.854 13.2169 14 12.8002 14ZM11.7502 20.5H13.7252L14.0752 17.85C14.5919 17.7167 15.0712 17.5207 15.5132 17.262C15.9545 17.004 16.3585 16.6917 16.7252 16.325L19.2002 17.35L20.1752 15.65L18.0252 14.025C18.1085 13.7917 18.1669 13.5457 18.2002 13.287C18.2335 13.029 18.2502 12.7667 18.2502 12.5C18.2502 12.2333 18.2335 11.9707 18.2002 11.712C18.1669 11.454 18.1085 11.2083 18.0252 10.975L20.1752 9.35L19.2002 7.65L16.7252 8.7C16.3585 8.31667 15.9545 7.99567 15.5132 7.737C15.0712 7.479 14.5919 7.28333 14.0752 7.15L13.7502 4.5H11.7752L11.4252 7.15C10.9085 7.28333 10.4295 7.479 9.9882 7.737C9.5462 7.99567 9.14186 8.30833 8.7752 8.675L6.3002 7.65L5.3252 9.35L7.47519 10.95C7.39186 11.2 7.33353 11.45 7.3002 11.7C7.26686 11.95 7.2502 12.2167 7.2502 12.5C7.2502 12.7667 7.26686 13.025 7.3002 13.275C7.33353 13.525 7.39186 13.775 7.47519 14.025L5.3252 15.65L6.3002 17.35L8.7752 16.3C9.14186 16.6833 9.5462 17.004 9.9882 17.262C10.4295 17.5207 10.9085 17.7167 11.4252 17.85L11.7502 20.5Z"
          fill="#475569"
        />
      </g>
    </svg>
  )
}

export const DollarSign = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g id="attach_money">
        <mask
          id="mask0_140_3168"
          style={{ maskType: 'alpha' }}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="24"
          height="24"
        >
          <rect id="Bounding box" width="24" height="24" fill="#D9D9D9" />
        </mask>
        <g mask="url(#mask0_140_3168)">
          <path
            id="attach_money_2"
            d="M11.0252 21V18.85C10.1419 18.65 9.37953 18.2667 8.7382 17.7C8.0962 17.1333 7.6252 16.3333 7.3252 15.3L9.1752 14.55C9.4252 15.35 9.7962 15.9583 10.2882 16.375C10.7795 16.7917 11.4252 17 12.2252 17C12.9085 17 13.4879 16.846 13.9632 16.538C14.4379 16.2293 14.6752 15.75 14.6752 15.1C14.6752 14.5167 14.4919 14.054 14.1252 13.712C13.7585 13.3707 12.9085 12.9833 11.5752 12.55C10.1419 12.1 9.15853 11.5627 8.6252 10.938C8.09186 10.3127 7.8252 9.55 7.8252 8.65C7.8252 7.56667 8.1752 6.725 8.8752 6.125C9.5752 5.525 10.2919 5.18333 11.0252 5.1V3H13.0252V5.1C13.8585 5.23333 14.5462 5.53733 15.0882 6.012C15.6295 6.48733 16.0252 7.06667 16.2752 7.75L14.4252 8.55C14.2252 8.01667 13.9419 7.61667 13.5752 7.35C13.2085 7.08333 12.7085 6.95 12.0752 6.95C11.3419 6.95 10.7835 7.11267 10.4002 7.438C10.0169 7.76267 9.8252 8.16667 9.8252 8.65C9.8252 9.2 10.0752 9.63333 10.5752 9.95C11.0752 10.2667 11.9419 10.6 13.1752 10.95C14.3252 11.2833 15.1962 11.8123 15.7882 12.537C16.3795 13.2623 16.6752 14.1 16.6752 15.05C16.6752 16.2333 16.3252 17.1333 15.6252 17.75C14.9252 18.3667 14.0585 18.75 13.0252 18.9V21H11.0252Z"
            fill="#475569"
          />
        </g>
      </g>
    </svg>
  )
}

export const WarningSign = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <mask
        id="mask0_140_3633"
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <rect width="24" height="24" fill="#C4C4C4" />
      </mask>
      <g mask="url(#mask0_140_3633)">
        <path
          d="M11 13H13V7H11V13ZM12 17C12.2833 17 12.521 16.904 12.713 16.712C12.9043 16.5207 13 16.2833 13 16C13 15.7167 12.9043 15.479 12.713 15.287C12.521 15.0957 12.2833 15 12 15C11.7167 15 11.4793 15.0957 11.288 15.287C11.096 15.479 11 15.7167 11 16C11 16.2833 11.096 16.5207 11.288 16.712C11.4793 16.904 11.7167 17 12 17ZM12 22C10.6167 22 9.31667 21.7373 8.1 21.212C6.88333 20.6873 5.825 19.975 4.925 19.075C4.025 18.175 3.31267 17.1167 2.788 15.9C2.26267 14.6833 2 13.3833 2 12C2 10.6167 2.26267 9.31667 2.788 8.1C3.31267 6.88333 4.025 5.825 4.925 4.925C5.825 4.025 6.88333 3.31233 8.1 2.787C9.31667 2.26233 10.6167 2 12 2C13.3833 2 14.6833 2.26233 15.9 2.787C17.1167 3.31233 18.175 4.025 19.075 4.925C19.975 5.825 20.6873 6.88333 21.212 8.1C21.7373 9.31667 22 10.6167 22 12C22 13.3833 21.7373 14.6833 21.212 15.9C20.6873 17.1167 19.975 18.175 19.075 19.075C18.175 19.975 17.1167 20.6873 15.9 21.212C14.6833 21.7373 13.3833 22 12 22ZM12 20C14.2167 20 16.1043 19.221 17.663 17.663C19.221 16.1043 20 14.2167 20 12C20 9.78333 19.221 7.89567 17.663 6.337C16.1043 4.779 14.2167 4 12 4C9.78333 4 7.896 4.779 6.338 6.337C4.77933 7.89567 4 9.78333 4 12C4 14.2167 4.77933 16.1043 6.338 17.663C7.896 19.221 9.78333 20 12 20Z"
          fill="#EF4444"
        />
      </g>
    </svg>
  )
}

export const ClipboardIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9 18C8.45 18 7.97933 17.8043 7.588 17.413C7.196 17.021 7 16.55 7 16V4C7 3.45 7.196 2.979 7.588 2.587C7.97933 2.19567 8.45 2 9 2H18C18.55 2 19.021 2.19567 19.413 2.587C19.8043 2.979 20 3.45 20 4V16C20 16.55 19.8043 17.021 19.413 17.413C19.021 17.8043 18.55 18 18 18H9ZM9 16H18V4H9V16ZM5 22C4.45 22 3.979 21.8043 3.587 21.413C3.19567 21.021 3 20.55 3 20V6H5V20H16V22H5Z"
        fill="currentColor"
      />
    </svg>
  )
}

export const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  )
}
