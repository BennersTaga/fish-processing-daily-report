import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";

type NavigateOptions = {
  replace?: boolean;
};

type RouterContextValue = {
  location: string;
  navigate: (to: string, options?: NavigateOptions) => void;
};

const RouterContext = React.createContext<RouterContextValue | null>(null);

function getHashPath() {
  if (typeof window === "undefined") return "/";
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return "/";
  return hash.startsWith("/") ? hash : `/${hash}`;
}

function normalizeTo(to: string) {
  if (!to) return "#/";
  if (to.startsWith("#")) return to.startsWith("#/") ? to : `#/${to.replace(/^#+/, "")}`;
  if (to.startsWith("/")) return `#${to}`;
  return `#/${to}`;
}

export function HashRouter({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState(() => getHashPath());

  useEffect(() => {
    const handleHashChange = () => setLocation(getHashPath());
    if (typeof window !== "undefined") {
      if (!window.location.hash) {
        window.location.hash = normalizeTo("/");
      } else {
        handleHashChange();
      }
      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }
    return undefined;
  }, []);

  const navigate = useCallback((to: string, options?: NavigateOptions) => {
    if (typeof window === "undefined") return;
    const hash = normalizeTo(to);
    if (options?.replace) {
      window.location.replace(`${window.location.pathname}${hash}`);
    } else {
      window.location.hash = hash;
    }
  }, []);

  const value = useMemo<RouterContextValue>(() => ({ location, navigate }), [location, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function Routes({ children }: { children: React.ReactNode }) {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("Routes must be used within a HashRouter");
  }
  const locationPath = ctx.location.split("?")[0];
  let element: React.ReactNode = null;

  React.Children.forEach(children, (child) => {
    if (element) return;
    if (!React.isValidElement(child)) return;
    const childProps = child.props as RouteProps;
    if (matchPath(childProps.path, locationPath)) {
      element = childProps.element;
    }
  });

  return <>{element}</>;
}

export type RouteProps = {
  path: string;
  element: React.ReactNode;
};

export function Route(_props: RouteProps) {
  return null;
}

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string;
};

export function Link({ to, onClick, ...rest }: LinkProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.altKey ||
        event.ctrlKey ||
        event.shiftKey ||
        rest.target === "_blank"
      ) {
        return;
      }
      event.preventDefault();
      navigate(to);
    },
    [navigate, onClick, rest.target, to]
  );

  const href = normalizeTo(to);

  return <a href={href} {...rest} onClick={handleClick} />;
}

export function useNavigate() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("useNavigate must be used within a HashRouter");
  }
  return ctx.navigate;
}

function matchPath(path: string, current: string) {
  if (path === "*") return true;
  return path.replace(/\/*$/, "") === current.replace(/\/*$/, "");
}
