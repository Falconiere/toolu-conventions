/** The smallest layout primitive: a div that forwards className and children. */
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { classNames } from "@/utilities/class-names";

export interface SurfaceProps extends ComponentPropsWithoutRef<"div"> {
  children?: ReactNode;
}

// No colour, no spacing, no border — those are the consuming app's utility
// classes, passed straight through `className`. A component library that
// bakes in a colour bakes in a hex value the console app can never override
// without fighting it, which is exactly what `house/no-hardcoded-hex` exists
// to keep out of this package.
export function Surface({ className, children, ...rest }: SurfaceProps) {
  return (
    <div className={classNames(className)} {...rest}>
      {children}
    </div>
  );
}
