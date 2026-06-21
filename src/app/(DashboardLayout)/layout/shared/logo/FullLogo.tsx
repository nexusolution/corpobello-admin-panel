"use client";

import Image from "next/image";

const FullLogo = () => {
  return (
    <>
      {/* Dark Logo */}
      <Image
        src="/images/logos/dark-logo.svg"
        alt="logo"
        width={175}
        height={26}
        className="block dark:hidden rtl:scale-x-[-1]"
      />
      {/* Light Logo */}
      <Image
        src="/images/logos/light-logo.svg"
        alt="logo"
        width={175}
        height={26}
        className="hidden dark:block rtl:scale-x-[-1]"
      />
    </>
  );
};

export default FullLogo;
