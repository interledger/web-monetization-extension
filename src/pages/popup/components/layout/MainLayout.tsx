import React from 'react';
import { Header } from './Header';

const Divider = () => {
  return <div className="w-100 h-1 bg-divider-gradient shrink-0" />;
};

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  useFitPopupHeight(ref);

  return (
    <div
      ref={ref}
      className="flex h-popup w-popup max-w-full touch:w-full touch:h-screen flex-col gap-4 px-6 touch:px-4 py-4 @container"
      id="main"
    >
      <Header />
      <Divider />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
};

/**
 * Browsers limit the popup to a maximum size in screen pixels (600px tall in
 * Chrome). When zoomed in, that's fewer CSS pixels than the popup height, so
 * the popup gets a scrollbar even if the content would fit. In that case,
 * limit the layout to the height the popup actually got.
 *
 * The popup opens at a tiny size, and the browser then resizes it to fit the
 * content, so we only measure on `resize`. It's a layout effect so the listener
 * is added before that resize can happen. We use the measured height instead
 * of viewport units (like `vh`), as the popup's size depends on the content's
 * height, which would then depend on the popup's size.
 */
function useFitPopupHeight(ref: React.RefObject<HTMLElement | null>) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    // on touch devices, the popup takes the full screen instead
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;

    const onResize = () => {
      el.style.maxHeight = '';
      if (el.offsetHeight > window.innerHeight) {
        el.style.maxHeight = `${window.innerHeight}px`;
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [ref]);
}
