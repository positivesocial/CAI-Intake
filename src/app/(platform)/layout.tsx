import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform Admin | CAI Intake",
  description: "CAI Intake Platform Administration",
};

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}




