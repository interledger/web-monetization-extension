import React from 'react';

export default function PostConnect() {
  return (
    <div className="bg-white md:bg-gray-50 flex h-screen w-screen flex-col items-center justify-center gap-6 md:gap-14 p-3 md:p-4">
      <header className="flex gap-2 items-center w-fit mx-auto mt-8 md:mt-16 md:mb-14 text-center">
        <img
          src="/assets/images/logo.svg"
          alt="Web Monetization"
          className="h-6 md:h-16"
        />
        <h1 className="text-base md:text-4xl font-bold text-secondary-dark">
          Web Monetization extension
        </h1>
      </header>

      {/* TODO: show real status based on state */}

      <div className="md:p-8 md:border rounded-lg bg-white bg-opacity-75 border-gray-100 mb-auto flex flex-col items-center gap-6 text-center w-full md:w-[42rem]">
        <img
          className="h-8 w-8 md:w-32 md:h-32"
          src="/assets/images/icons/error.svg"
          alt=""
        />

        <h2 className="text-3xl md:text-4xl font-bold">
          Something went wrong. Please try reconnecting your wallet.
        </h2>

        <p className="text-lg">You may safely close this tab.</p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="bg-button-base border border-popup text-white px-6 py-3 rounded-xl w-full md:w-96 text-base"
          >
            Try again
          </button>

          <button
            type="button"
            className="bg-white border border-popup text-secondary-dark px-6 py-3 rounded-xl w-full md:w-96 text-base"
          >
            Change the wallet address or budget amount
          </button>
        </div>
      </div>
    </div>
  );
}
