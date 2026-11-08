"use client";

import type { AdminOrder } from "@/types/admin";
import { getApiErrorMessage } from "@/lib/admin-error";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData, type UseMutationResult } from "@tanstack/react-query";
import Pagination from "@/components/admin/ui/Pagination";
import type { PaginationMeta } from "@/types/admin";

const PAGE_SIZE = 50;

type OrdersResponse = { orders: AdminOrder[]; statusCounts: Record<string, number> } & PaginationMeta;
import { adminAxios } from "@/lib/admin-axios";
import { toast } from "react-hot-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Package, MapPin, CreditCard } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";

type StatusUpdater = UseMutationResult<unknown, Error, { id: string; status: string }>;
type RefundInput = { id: string; refundStatus: string; refundNote: string; razorpayRefundId: string };
type RefundSaver = UseMutationResult<unknown, Error, RefundInput>;

const REFUND_LABEL: Record<string, string> = { NOT_NEEDED: "Not needed", PENDING: "Pending", REFUNDED: "Refunded" };

/** Small badge in the orders list: only for refunds that need attention or are done */
function RefundBadge({ status }: { status?: string }) {
  if (status !== "PENDING" && status !== "REFUNDED") return null;
  return (
    <span
      className={`mt-1 inline-block rounded-full px-2 py-0.5 font-montserrat text-[10px] font-bold uppercase tracking-wider ${
        status === "PENDING" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"
      }`}
    >
      {status === "PENDING" ? "Refund pending" : "Refunded"}
    </span>
  );
}

/** Refunds are made in the Razorpay dashboard; this only records them (nothing is sent to Razorpay). */
function RefundPanel({ order, saveRefund }: { order: AdminOrder; saveRefund: RefundSaver }) {
  const [status, setStatus] = useState(order.refundStatus ?? "NOT_NEEDED");
  const [note, setNote] = useState(order.refundNote ?? "");
  const [refundId, setRefundId] = useState(order.razorpayRefundId ?? "");
  const needsRefund = order.status === "CANCELLED" && status === "PENDING";
  const field = "block w-full min-w-0 rounded-sm border border-olive/25 bg-cornsilk px-2.5 py-1.5 font-montserrat text-xs text-forest outline-none focus:border-olive";
  return (
    <div className="mt-4 min-w-0 space-y-2 whitespace-normal rounded-sm border border-olive/10 bg-white p-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-text">Refund</p>
      {needsRefund && (
        <p role="alert" className="rounded-sm border border-amber-300 bg-amber-50 p-2 font-montserrat text-xs text-amber-900">
          Cancelled orders are <b>not refunded automatically</b>. Refund ₹{order.totalAmount.toLocaleString("en-IN")} in the Razorpay
          dashboard (Payments, find {order.razorpayPaymentId ?? "the payment"}, Refund), then set this to Refunded.
        </p>
      )}
      <label className="block font-montserrat text-[11px] text-muted-text">
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${field} mt-0.5`}>
          {Object.entries(REFUND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="block font-montserrat text-[11px] text-muted-text">
        Razorpay refund id (optional)
        <input value={refundId} onChange={(e) => setRefundId(e.target.value)} maxLength={64} placeholder="rfnd_..." className={`${field} mt-0.5`} />
      </label>
      <label className="block font-montserrat text-[11px] text-muted-text">
        Note (optional, only you see it)
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={`${field} mt-0.5`} />
      </label>
      <Button
        type="button"
        disabled={saveRefund.isPending}
        onClick={() => saveRefund.mutate({ id: order._id, refundStatus: status, refundNote: note, razorpayRefundId: refundId })}
        className="h-8 w-full rounded-sm bg-forest px-3 font-montserrat text-[11px] font-semibold uppercase tracking-wider text-cornsilk hover:bg-olive"
      >
        Save refund details
      </Button>
    </div>
  );
}

function OrderRow({
  order,
  updateStatus,
  saveRefund,
  getStatusColor,
}: {
  order: AdminOrder;
  updateStatus: StatusUpdater;
  saveRefund: RefundSaver;
  getStatusColor: (status: string) => string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-olive/5 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <TableCell>
          <div className="flex items-start gap-2">
            <button className="mt-0.5 text-muted-text hover:text-forest">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div>
              <span className="font-merriweather text-sm font-bold text-forest block">
                #{order._id.slice(-6).toUpperCase()}
              </span>
              <span className="font-montserrat text-[10px] text-muted-text">
                {new Date(order.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <div className="mt-1 font-montserrat text-[11px] text-olive-leaf">
                {order.items.length} item{order.items.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="font-montserrat text-sm text-forest font-medium">
            {order.customerName}
          </div>
          <div className="font-montserrat text-xs text-muted-text">
            {order.email}
          </div>
          <div className="font-montserrat text-xs text-muted-text">
            {order.phone}
          </div>
        </TableCell>
        <TableCell>
          <div className="font-montserrat text-xs font-semibold text-forest">
            {order.paymentStatus}
          </div>
          {order.razorpayPaymentId && (
            <div className="text-[10px] text-muted-text font-mono mt-0.5">
              {order.razorpayPaymentId}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="font-merriweather text-sm font-bold text-forest">
            ₹{order.totalAmount.toLocaleString("en-IN")}
          </div>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="font-montserrat text-[10px] uppercase tracking-wider font-bold h-8 border border-olive/30 hover:bg-olive/10 rounded-md px-3 flex items-center justify-between min-w-30 bg-white"
            >
              <span
                className={`px-2 py-0.5 rounded-full mr-2 ${getStatusColor(
                  order.status
                )}`}
              >
                {order.status === "DELIVERED" ? "COMPLETED" : order.status}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </DropdownMenuTrigger>
            <RefundBadge status={order.refundStatus} />
            <DropdownMenuContent align="end" className="font-montserrat text-xs bg-cornsilk border-olive/20">
              <DropdownMenuItem
                onClick={() => updateStatus.mutate({ id: order._id, status: "PROCESSING" })}
                className="hover:bg-olive/10 focus:bg-olive/10"
              >
                Processing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateStatus.mutate({ id: order._id, status: "SHIPPED" })}
                className="hover:bg-olive/10 focus:bg-olive/10"
              >
                Shipped
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => updateStatus.mutate({ id: order._id, status: "DELIVERED" })}
                className="hover:bg-olive/10 focus:bg-olive/10"
              >
                Completed (Delivered)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (
                    confirm(
                      `Cancel this order? The stock goes back on sale.\n\nThe customer is NOT refunded automatically: you must refund ₹${order.totalAmount.toLocaleString("en-IN")} in the Razorpay dashboard yourself. The order will be listed under "Refund pending" until you mark it refunded.`,
                    )
                  ) {
                    updateStatus.mutate({ id: order._id, status: "CANCELLED" });
                  }
                }}
                className="text-red-600 hover:bg-red-50 focus:bg-red-50"
              >
                Cancelled
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {/* EXPANDED DETAILS */}
      {isExpanded && (
        <TableRow className="bg-warm-mist/30 hover:bg-warm-mist/30">
          <TableCell colSpan={5} className="p-0 border-b border-olive/20">
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-hidden">
              
              {/* Column 1: Shipping Address */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-forest font-merriweather font-semibold border-b border-olive/10 pb-2">
                  <MapPin className="h-4 w-4" />
                  Shipping Address
                </div>
                <div className="font-montserrat text-sm text-muted-text space-y-1">
                  <p className="font-medium text-forest">{order.customerName}</p>
                  <p>{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                  <p>{order.shippingAddress.country}</p>
                  <p className="pt-2">Phone: {order.phone}</p>
                  <p>Email: {order.email}</p>
                </div>

                {order.reviewNote && (
                  <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-sm">
                    <p className="font-montserrat text-[10px] text-red-700 uppercase tracking-widest font-semibold mb-1">Needs review</p>
                    <p className="font-montserrat text-xs text-red-900">{order.reviewNote}</p>
                  </div>
                )}

                {/* Delivery Notes */}
                {order.deliveryNotes && (
                  <div className="mt-3 p-2.5 bg-amber-50/60 border border-amber-200/50 rounded-sm">
                    <p className="font-montserrat text-[10px] text-amber-700 uppercase tracking-widest font-semibold mb-1">Delivery Notes</p>
                    <p className="font-montserrat text-xs text-amber-900">{order.deliveryNotes}</p>
                  </div>
                )}
              </div>

              {/* Column 2: Order Items */}
              <div className="space-y-3 lg:col-span-1">
                <div className="flex items-center gap-2 text-forest font-merriweather font-semibold border-b border-olive/10 pb-2">
                  <Package className="h-4 w-4" />
                  Ordered Items
                </div>
                <div className="space-y-3 max-h-62.5 overflow-y-auto pr-2 custom-scrollbar">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex gap-3 bg-white p-2 border border-olive/10 rounded-sm">
                      <div className="relative w-12 h-16 bg-warm/50 shrink-0 overflow-hidden">
                        <SafeImage src={item.image} fallbackSrc={item.currentImage} alt={item.name} className="object-cover" sizes="48px" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-merriweather text-xs font-semibold text-forest truncate">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 font-montserrat text-[10px] text-muted-text mt-0.5">
                          {item.selectedSize && <span>Size: <strong className="text-forest">{item.selectedSize}</strong></span>}
                          {item.selectedSize && item.selectedColor && <span>|</span>}
                          {item.selectedColor && (
                            <span className="inline-flex items-center gap-1">
                              Color:
                              {item.selectedColorHex && (
                                <span
                                  className="inline-block size-2.5 rounded-full border border-olive/30"
                                  style={{ backgroundColor: item.selectedColorHex }}
                                  aria-hidden
                                />
                              )}
                              <strong className="text-forest">{item.selectedColor}</strong>
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="font-montserrat text-[10px] font-medium text-olive-leaf">Qty: {item.quantity}</span>
                          <span className="font-montserrat text-[11px] font-bold text-forest">₹{item.priceAtPurchase.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3: Payment & Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-forest font-merriweather font-semibold border-b border-olive/10 pb-2">
                  <CreditCard className="h-4 w-4" />
                  Payment Summary
                </div>
                <div className="font-montserrat text-sm space-y-2">
                  <div className="flex justify-between text-muted-text">
                    <span>Subtotal</span>
                    <span>₹{order.subtotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-muted-text">
                    <span>Shipping</span>
                    <span>{order.shippingCost > 0 ? `₹${order.shippingCost.toLocaleString("en-IN")}` : "Free"}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-forest font-medium">
                      <span>Discount ({order.promoCode})</span>
                      <span>-₹{order.discountAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {order.taxAmount > 0 && (
                    <div className="flex justify-between text-muted-text">
                      <span>Taxes</span>
                      <span>₹{order.taxAmount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="border-t border-olive/10 pt-2 flex justify-between font-bold text-forest">
                    <span>Total Paid</span>
                    <span>₹{order.totalAmount.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="mt-4 p-3 bg-white border border-olive/10 rounded-sm space-y-1.5">
                    <p className="text-[10px] text-muted-text uppercase tracking-widest font-semibold">Gateway Details</p>
                    <p className="text-xs text-forest"><span className="text-muted-text">Order ID:</span> {order.razorpayOrderId}</p>
                    {order.razorpayPaymentId && (
                      <p className="text-xs text-forest"><span className="text-muted-text">Pay ID:</span> {order.razorpayPaymentId}</p>
                    )}
                  </div>
                  <RefundPanel key={`${order.refundStatus}|${order.refundNote}|${order.razorpayRefundId}`} order={order} saveRefund={saveRefund} />
                </div>
              </div>

            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("ALL");

  const [page, setPage] = useState(1);

  const { data: response, isLoading, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ["admin", "orders", filter, page],
    queryFn: async (): Promise<OrdersResponse> => {
      const res = await adminAxios.get("/api/admin/orders", { params: { status: filter, page, limit: PAGE_SIZE } });
      return res.data;
    },
    placeholderData: keepPreviousData,
  });
  const data = response?.orders;

  // The page may stop existing (an order moved to another status tab): go back to the last page
  useEffect(() => {
    if (response && !isPlaceholderData && response.totalPages >= 1 && page > response.totalPages) setPage(response.totalPages);
  }, [response, isPlaceholderData, page]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await adminAxios.patch(`/api/admin/orders/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (data: { refundReminder?: boolean; order?: { totalAmount?: number } }) => {
      if (data?.refundReminder) {
        toast(
          `Order cancelled. Remember to refund ₹${(data.order?.totalAmount ?? 0).toLocaleString("en-IN")} in the Razorpay dashboard: it is NOT refunded automatically. It is listed under "Refund pending" until you mark it refunded.`,
          { duration: 12000, icon: "⚠️" },
        );
      } else {
        toast.success("Order status updated");
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    },
  });

  const saveRefund = useMutation({
    mutationFn: async ({ id, ...body }: RefundInput) => {
      const res = await adminAxios.patch(`/api/admin/orders/${id}/refund`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Refund details saved");
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Could not save the refund details"));
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      case "SHIPPED":
        return "bg-purple-100 text-purple-800";
      case "DELIVERED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const tabs = [
    { label: "All Orders", value: "ALL" },
    { label: "Processing", value: "PROCESSING" },
    { label: "Shipped", value: "SHIPPED" },
    { label: "Completed", value: "DELIVERED" },
    { label: "Cancelled", value: "CANCELLED" },
    { label: "Refund pending", value: "REFUND_PENDING" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-merriweather text-2xl font-bold text-forest">
            Orders
          </h1>
          <p className="font-montserrat text-sm text-muted-text mt-1">
            Manage and track all customer orders
          </p>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-olive/20 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setFilter(tab.value); setPage(1); }}
            className={`whitespace-nowrap px-4 py-2 font-montserrat text-xs uppercase tracking-widest font-semibold transition-colors ${
              filter === tab.value
                ? "border-b-2 border-forest text-forest"
                : "text-muted-text hover:text-forest"
            }`}
          >
            {tab.label}
            {response?.statusCounts && (
              <span className="ml-1.5 text-[10px] opacity-60">({response.statusCounts[tab.value] ?? 0})</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-sm shadow-sm border border-olive/10 overflow-hidden">
        <Table>
          <TableHeader className="bg-warm-mist">
            <TableRow>
              <TableHead className="font-montserrat text-xs uppercase tracking-widest text-olive-leaf font-bold">
                Order
              </TableHead>
              <TableHead className="font-montserrat text-xs uppercase tracking-widest text-olive-leaf font-bold">
                Customer
              </TableHead>
              <TableHead className="font-montserrat text-xs uppercase tracking-widest text-olive-leaf font-bold">
                Payment Info
              </TableHead>
              <TableHead className="font-montserrat text-xs uppercase tracking-widest text-olive-leaf font-bold">
                Total
              </TableHead>
              <TableHead className="font-montserrat text-xs uppercase tracking-widest text-olive-leaf font-bold">
                Status
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <p className="font-montserrat text-sm text-muted-text">
                    Loading orders...
                  </p>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <p className="font-montserrat text-sm text-copper mb-2">{getApiErrorMessage(error, "Could not load orders")}</p>
                  <button onClick={() => refetch()} className="text-xs font-montserrat uppercase tracking-wider text-olive hover:underline">Try again</button>
                </TableCell>
              </TableRow>
            ) : !data || data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center justify-center text-muted-text">
                    <Package className="h-8 w-8 mb-2 opacity-50" />
                    <p className="font-montserrat text-sm">No orders found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((order) => (
                <OrderRow key={order._id} order={order} updateStatus={updateStatus} saveRefund={saveRefund} getStatusColor={getStatusColor} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {response && (
        <Pagination
          page={page}
          totalPages={response.totalPages}
          total={response.total}
          limit={PAGE_SIZE}
          isLoading={isPlaceholderData}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
