import { Truck, Clock } from "lucide-react";

export function EstimatedDelivery() {
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 5);
  const deliveryEnd = new Date();
  deliveryEnd.setDate(deliveryEnd.getDate() + 7);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  return (
    <div className="flex items-start gap-3 bg-olive/5 border border-olive/10 rounded-md p-4">
      <div className="w-9 h-9 rounded-full bg-olive/10 flex items-center justify-center flex-shrink-0">
        <Truck className="size-4 text-olive" />
      </div>
      <div>
        <p className="font-montserrat text-xs font-semibold text-forest">
          Estimated Delivery
        </p>
        <p className="font-montserrat text-sm text-forest mt-0.5">
          {formatDate(deliveryDate)} — {formatDate(deliveryEnd)}
        </p>
        <p className="font-montserrat text-[10px] text-muted-text mt-1 flex items-center gap-1">
          <Clock className="size-3" />
          Order within 2 hrs for fastest dispatch
        </p>
      </div>
    </div>
  );
}
