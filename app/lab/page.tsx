import type { Metadata } from "next";

import LabScreen from "@/components/LabScreen";

export const metadata: Metadata = {
  title: "Physics Lab — Physics Puzzle Lab",
  description:
    "重力・摩擦・反発・空気抵抗を動かして、その場で観察する実験室。数値は物理エンジンの内部単位で、SI ではない。",
};

export default function LabPage() {
  return <LabScreen />;
}
