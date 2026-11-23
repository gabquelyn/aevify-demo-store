import type { Metadata } from "next";
import { OrderView } from "./order-view";

export const metadata: Metadata = { title: "Your tickets" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return <OrderView id={(await params).id} />;
}
