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

export type OrderData = {
  _id: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  items: {
    productId: { name: string; images: { url: string }[] };
    quantity: number;
    priceAtPurchase: number;
  }[];
};
