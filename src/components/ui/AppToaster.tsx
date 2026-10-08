"use client";

import { Toaster } from "react-hot-toast";
import { usePathname } from "next/navigation";

const baseStyle = {
  background: "#fdf6e3",
  color: "#283618",
  fontFamily: "Montserrat, sans-serif",
  fontSize: "13px",
  fontWeight: 500,
};

export function AppToaster() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <Toaster
      position={isAdmin ? "bottom-right" : "top-center"}
      containerStyle={isAdmin ? undefined : { top: 72 }}
      toastOptions={{
        duration: 3000,
        success: {
          style: { ...baseStyle, border: "1px solid rgba(96,108,56,0.3)" },
          iconTheme: { primary: "#606c38", secondary: "#fefae0" },
        },
        error: {
          duration: 5000,
          style: { ...baseStyle, border: "1px solid rgba(188,108,37,0.4)" },
          iconTheme: { primary: "#bc6c25", secondary: "#fefae0" },
        },
      }}
    />
  );
}
