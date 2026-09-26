import Link from "next/link";
import {
  ShoppingBag,
  Truck,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

interface StepProgressProps {
  currentStep: number;
}

export function StepProgress({ currentStep }: StepProgressProps) {
  const steps = [
    { label: "Bag", icon: ShoppingBag, href: "/cart" },
    { label: "Shipping", icon: Truck },
    { label: "Payment", icon: CreditCard },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-8 md:mb-10">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const Icon = step.icon;

        return (
          <div key={step.label} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              {step.href && isCompleted ? (
                <Link
                  href={step.href}
                  className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted
                      ? "bg-olive text-cornsilk shadow-md shadow-olive/20"
                      : "bg-olive/10 text-muted-text"
                  }`}
                >
                  <CheckCircle2 className="size-4 md:size-[18px]" />
                </Link>
              ) : (
                <div
                  className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                    isCompleted
                      ? "bg-olive text-cornsilk shadow-md shadow-olive/20"
                      : isCurrent
                      ? "bg-forest text-cornsilk shadow-lg shadow-forest/25 ring-4 ring-forest/10"
                      : "bg-olive/10 text-muted-text"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="size-4 md:size-[18px]" />
                  ) : (
                    <Icon className="size-4 md:size-[18px]" />
                  )}
                </div>
              )}
              <span
                className={`font-montserrat text-[10px] md:text-xs uppercase tracking-wider font-semibold transition-colors duration-300 ${
                  isCurrent
                    ? "text-forest"
                    : isCompleted
                    ? "text-olive"
                    : "text-muted-text/60"
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* Connector */}
            {idx < steps.length - 1 && (
              <div className="w-12 sm:w-16 md:w-24 h-[2px] mx-2 sm:mx-3 mb-5 relative overflow-hidden rounded-full bg-olive/10">
                <div
                  className="absolute inset-y-0 left-0 bg-olive rounded-full transition-all duration-700 ease-out"
                  style={{ width: isCompleted ? "100%" : "0%" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
