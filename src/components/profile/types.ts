export type ShippingAddress = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
};

export type UserData = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  shippingAddress?: ShippingAddress;
};

export type OrderItemData = {
  productId?: { _id?: string; name?: string; slug?: string; images?: { url: string }[] } | string | null;
  name?: string;
  quantity: number;
  priceAtPurchase: number;
  image?: string;
  selectedSize?: string;
  selectedColor?: string;
};

export type OrderData = {
  _id: string;
  totalAmount: number;
  subtotal?: number;
  shippingCost?: number;
  taxAmount?: number;
  discountAmount?: number;
  promoCode?: string;
  deliveryNotes?: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  shippingAddress?: ShippingAddress;
  items: OrderItemData[];
};
