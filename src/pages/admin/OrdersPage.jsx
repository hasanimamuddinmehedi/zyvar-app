import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  useNavigate,
} from "react-router-dom";

import {
  FaCheckCircle,
  FaClock,
  FaTruck,
  FaTimesCircle,
  FaTrashAlt,
} from "react-icons/fa";

import {
  db,
  auth,
} from "../../firebase/firebase";

import {
  successAlert,
  errorAlert,
  confirmAlert,
} from "../../utils/alerts";

import {
  ADMIN_EMAILS,
} from "../../utils/adminCheck";

// SLUG UTILITY — same as Products.jsx
const toSlug = (name = "") =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

export default function OrdersPage() {

  const navigate =
    useNavigate();

  // ─────────────────────────────────────────────────────
  // VIEWER IDENTITY — resolves who is looking at this page.
  // Admin: email is in ADMIN_EMAILS → sees everything.
  // Partner: has an approved doc in "partnerApplications/{uid}"
  //          → sees only orders/items where item.partnerSlug
  //          matches their own slug.
  // ─────────────────────────────────────────────────────
  const [viewerInfo,
    setViewerInfo] =
    useState(null);

  const [resolvingViewer,
    setResolvingViewer] =
    useState(true);

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {

          if (!currentUser) {

            setViewerInfo(null);

            setResolvingViewer(false);

            return;
          }

          try {

            if (
              ADMIN_EMAILS.includes(
                currentUser.email
              )
            ) {

              setViewerInfo({
                uid: currentUser.uid,
                isAdmin: true,
                partnerSlug: "zyvar",
              });

              setResolvingViewer(false);

              return;
            }

            const partnerRef =
              doc(
                db,
                "partnerApplications",
                currentUser.uid
              );

            const partnerSnap =
              await getDoc(partnerRef);

            if (
              partnerSnap.exists() &&
              partnerSnap.data().status === "approved"
            ) {

              setViewerInfo({
                uid: currentUser.uid,
                isAdmin: false,
                partnerSlug:
                  partnerSnap.data().slug || "",
              });

            } else {

              setViewerInfo(null);
            }

          } catch (error) {

            console.log(error);

            setViewerInfo(null);

          } finally {

            setResolvingViewer(false);
          }
        }
      );

    return () => unsubscribe();

  }, []);

  const isAdmin =
    !!viewerInfo?.isAdmin;

  const partnerSlug =
    viewerInfo?.partnerSlug;

  const [orders,
    setOrders] =
    useState([]);

  const [loading,
    setLoading] =
    useState(true);

  const [orderSearch,
    setOrderSearch] =
    useState("");

  // FETCH ORDERS — waits for viewer resolution first
  useEffect(() => {

    if (resolvingViewer) return;

    if (!viewerInfo) {

      setOrders([]);

      setLoading(false);

      return;
    }

    const fetchOrders =
      async () => {

        try {

          setLoading(true);

          const snapshot =
            await getDocs(
              collection(
                db,
                "orders"
              )
            );

          const data =
            snapshot.docs.map(
              (docItem) => ({

                id: docItem.id,

                ...docItem.data(),
              })
            );

          setOrders(data);

        } catch (error) {

          console.log(error);

        } finally {

          setLoading(false);
        }
      };

    fetchOrders();

  }, [viewerInfo, resolvingViewer]);

  // HELPER — DETERMINE AUTO PAYMENT STATUS
  const resolvePaymentStatus =
    (order, newOrderStatus) => {

      const method =
        (order.paymentMethod || "")
          .toLowerCase();

      // BKASH / NAGAD — AUTO PAID ON CONFIRMED
      if (
        method.includes("bkash") ||
        method.includes("nagad")
      ) {

        if (newOrderStatus === "Confirmed") {
          return "Paid";
        }
      }

      // COD — AUTO PAID ON DELIVERED
      if (
        method.includes("cod") ||
        method.includes("cash")
      ) {

        if (newOrderStatus === "Delivered") {
          return "Paid";
        }
      }

      // ALL OTHER CASES — KEEP EXISTING
      return order.paymentStatus || "Pending";
    };

  // HELPER — GET ONLY THE ITEMS BELONGING TO THE CURRENT PARTNER
  // Admin sees everything; partner only sees their own products within an order.
  const getVisibleItems =
    (order) => {

      if (!Array.isArray(order.items))
        return [];

      if (isAdmin)
        return order.items;

      return order.items.filter(
        (item) =>
          (item.partnerSlug || "zyvar") === partnerSlug
      );
    };

  // UPDATE ORDER STATUS
  // NOTE: not gated by role — both admin and partner call this via the
  // STATUS BUTTONS below, so Confirmed/Delivered emails already fire
  // "like admin" for whichever role triggers the status change.
  const updateOrderStatus =
    async (
      id,
      status,
    ) => {

      try {

        // FIND THE ORDER BEING UPDATED
        const order =
          orders.find(
            (o) => o.id === id
          );

        // RESOLVE PAYMENT STATUS AUTOMATICALLY
        const newPaymentStatus =
          resolvePaymentStatus(
            order,
            status
          );

        const currentSubtotal =

          Number(
            order.productSubtotal
          ) ||

          Number(
            order.subtotal
          ) ||

          (Array.isArray(order.items)

            ? order.items.reduce(
                (acc, item) =>

                  acc +

                  Number(
                    item.price || 0
                  ) *

                    Number(
                      item.quantity || 1
                    ),

                0
              )

            : 0);

        const shippingCharge =
          Number(
            order.shipping || 0
          );

        const grandTotal =
          currentSubtotal +
          shippingCharge;

        // UPDATE FIRESTORE — STATUS + AUTO PAYMENT STATUS
        await updateDoc(
          doc(
            db,
            "orders",
            id
          ),
          {
            status,
            paymentStatus: newPaymentStatus,
          }
        );

        setOrders(
          orders.map(
            (o) =>

              o.id === id

                ? {
                    ...o,
                    status,
                    paymentStatus: newPaymentStatus,
                  }

                : o
          )
        );

        // SEND EMAIL NOTIFICATION TO CUSTOMER
        // NOTE: "Shipping" email is intentionally NOT sent here.
        // It is sent from the Shipping Charge "Save" handler below,
        // once the shipping price has actually been set.
        if (order?.email) {

          // DETERMINE EMAIL API
          let emailEndpoint = "";

          if (status === "Confirmed") {

            emailEndpoint =
              "https://zyvar-email-server.onrender.com/send-order-confirmed-email";

          } else if (status === "Delivered") {

            emailEndpoint =
              "https://zyvar-email-server.onrender.com/send-delivered-email";
          }

          // SEND EMAIL
          if (emailEndpoint) {

            await fetch(emailEndpoint, {

              method: "POST",

              headers: {
                "Content-Type": "application/json",
              },

              body: JSON.stringify({

                order: {

                  ...order,

                  id: order.id,

                  status,

                  paymentStatus: newPaymentStatus,

                  subtotal: currentSubtotal,

                  shipping: shippingCharge,

                  total: grandTotal,
                },
              }),
            });
          }

        }

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Update Failed",
          "Failed to update order status. Please try again."
        );
      }
    };

  // SAVE SHIPPING CHARGE — ALSO SENDS THE "SHIPPING" EMAIL
  // NOTE: not gated by role — now callable by both admin and partner
  // (the "Shipping Charge" box below is no longer admin-only), so the
  // shipping email fires the same way for either role.
  const saveShippingCharge =
    async (order, shippingCharge, currentSubtotal) => {

      try {

        const grandTotal =
          currentSubtotal +
          shippingCharge;

        await updateDoc(
          doc(
            db,
            "orders",
            order.id
          ),
          {

            shipping:
              shippingCharge,

            total:
              grandTotal,
          }
        );

        setOrders(
          orders.map(
            (item) =>

              item.id ===
              order.id

                ? {
                    ...item,
                    shipping:
                      shippingCharge,

                    total:
                      grandTotal,
                  }

                : item
          )
        );

        await successAlert(
          "Shipping Updated!",
          "Shipping charge has been saved successfully."
        );

        // SEND SHIPPING EMAIL — ONLY NOW, AFTER THE PRICE IS SAVED
        if (order?.email) {

          await fetch(
            "https://zyvar-email-server.onrender.com/send-shipping-email",
            {

              method: "POST",

              headers: {
                "Content-Type": "application/json",
              },

              body: JSON.stringify({

                order: {

                  ...order,

                  id: order.id,

                  status: "Shipping",

                  subtotal: currentSubtotal,

                  shipping: shippingCharge,

                  total: grandTotal,
                },
              }),
            }
          );
        }

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Update Failed",
          "Failed to save shipping charge. Please try again."
        );
      }
    };

  // CANCEL ORDER
  const cancelOrder =
    async (orderId) => {

      try {

        const result =
          await confirmAlert(
            "Cancel Order?",
            "Are you sure you want to cancel this order?"
          );

        if (!result.isConfirmed)
          return;

        await updateDoc(
          doc(
            db,
            "orders",
            orderId
          ),
          {
            status: "Cancelled",
          }
        );

        setOrders(
          orders.map((item) =>

            item.id === orderId

              ? {
                  ...item,
                  status:
                    "Cancelled",
                }

              : item
          )
        );

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Cancel Failed",
          "Failed to cancel order. Please try again."
        );
      }
    };

  // DELETE ORDER — ADMIN ONLY (button is gated in render below)
  const deleteOrderHandler =
    async (orderId) => {

      try {

        const result =
          await confirmAlert(
            "Delete Order?",
            "This will permanently delete the order. This action cannot be undone."
          );

        if (!result.isConfirmed)
          return;

        await deleteDoc(
          doc(
            db,
            "orders",
            orderId
          )
        );

        setOrders(
          orders.filter(
            (item) =>
              item.id !== orderId
          )
        );

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Delete Failed",
          "Failed to delete order. Please try again."
        );
      }
    };

  // FILTER + SORT
  const filteredOrders =
    useMemo(() => {

      return orders

        .filter((order) => {

          // PARTNER SCOPE — only orders containing at least one of their own items
          if (!isAdmin) {

            const hasOwnItem =
              Array.isArray(order.items) &&
              order.items.some(
                (item) =>
                  (item.partnerSlug || "zyvar") === partnerSlug
              );

            if (!hasOwnItem)
              return false;
          }

          if (!orderSearch)
            return true;

          return String(order.id || "")
            .toLowerCase()
            .includes(
              String(orderSearch || "")
                .toLowerCase()
            );
        })

        .sort((a, b) => {

          const aTime =
            a.createdAt?.seconds || 0;

          const bTime =
            b.createdAt?.seconds || 0;

          return bTime - aTime;
        });

    }, [orders, orderSearch, isAdmin, partnerSlug]);

  if (resolvingViewer || loading) {

    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white text-2xl font-black">
        Loading Orders...
      </div>
    );
  }

  if (!viewerInfo) {

    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white text-2xl font-black text-center px-6">
        You must be ZYVAR admin or an approved partner to view this dashboard.
      </div>
    );
  }

  return (

    <div className="space-y-8">

      {/* SEARCH */}
      <div className="rounded-[30px] border border-white/10 bg-white/5 p-5 md:p-6">

        <div className="flex flex-col lg:flex-row lg:items-center gap-5 justify-between">

          <div>

            <p className="uppercase tracking-[0.3em] text-[#C6922B] text-xs mb-2">
              Search Orders
            </p>

            <h2 className="text-2xl md:text-3xl font-black">
              {isAdmin
                ? "Manage Customer Orders"
                : "Manage Your Orders"}
            </h2>

          </div>

          <input
            type="text"
            placeholder="Search by Order ID..."
            value={orderSearch}
            onChange={(e) =>
              setOrderSearch(
                e.target.value
              )
            }
            className="w-full lg:w-[380px] px-6 py-4 rounded-2xl bg-black/20 border border-white/10 outline-none focus:border-[#C6922B]"
          />

        </div>

      </div>

      {/* ORDERS */}
      {filteredOrders.map((order) => {

        // ITEMS THIS VIEWER IS ALLOWED TO SEE (admin = all, partner = their own only)
        const visibleItems =
          getVisibleItems(order);

        const currentSubtotal =

          isAdmin

            ? (Number(
                order.productSubtotal
              ) ||

              Number(
                order.subtotal
              ) ||

              (Array.isArray(order.items)

                ? order.items.reduce(
                    (acc, item) =>

                      acc +

                      Number(
                        item.price || 0
                      ) *

                        Number(
                          item.quantity || 1
                        ),

                    0
                  )

                : 0))

            // PARTNER — subtotal is computed only from their own visible items
            : visibleItems.reduce(
                (acc, item) =>

                  acc +

                  Number(
                    item.price || 0
                  ) *

                    Number(
                      item.quantity || 1
                    ),

                0
              );

        const shippingCharge =
          Number(
            order.shipping || 0
          );

        const grandTotal =
          currentSubtotal +
          shippingCharge;

        return (

          <div
            key={order.id}
            className="rounded-[35px] border border-white/10 bg-white/5 p-5 md:p-8"
          >

            <div className="flex flex-col xl:flex-row gap-10">

              {/* LEFT SIDE */}
              <div className="flex-1">

                {/* ORDER ID */}
                <div className="mb-6">

                  <p className="text-gray-400 text-sm mb-2">
                    Order ID
                  </p>

                  <h2 className="text-[#C6922B] text-lg md:text-xl font-black break-all">
                    #{order.id}
                  </h2>

                </div>

                {/* CUSTOMER */}
                <div className="mb-8">

                  <h3 className="text-2xl font-black mb-3">
                    {order.name || "Unknown Customer"}
                  </h3>

                  <p className="text-gray-400 mb-2">
                    {order.phone || "No Phone"}
                  </p>

                  <p className="text-gray-400 mb-5">
                    {order.address || "No Address"}
                  </p>

                  {/* VIEW CUSTOMER PROFILE — ADMIN ONLY (unchanged) */}
                  {isAdmin && (

                    <button
                      onClick={() =>
                        navigate(
                          `/admin/customer/${order.userId}`
                        )
                      }
                      className="px-5 py-3 rounded-2xl bg-[#C6922B] text-black font-bold hover:opacity-90 transition"
                    >
                      View Customer Profile
                    </button>
                  )}

                </div>

                {/* PRODUCTS */}
                <div className="space-y-5">

                  <h3 className="text-2xl font-black">
                    {isAdmin
                      ? "Ordered Products"
                      : "Your Ordered Products"}
                  </h3>

                  {visibleItems.map(
                      (item, index) => (

                        <div
                          key={index}
                          className="rounded-3xl border border-white/10 bg-black/20 p-5 flex flex-col lg:flex-row gap-5"
                        >

                          {/* IMAGE */}
                          <div
                            onClick={() =>
                              navigate(
                                `/product/${item.slug || toSlug(item.name)}`
                              )
                            }
                            className="cursor-pointer"
                          >

                            <img
                              src={
                                item.image ||
                                "/placeholder.png"
                              }
                              alt={item.name}
                              className="w-full lg:w-32 h-32 rounded-2xl object-cover hover:scale-105 transition"
                            />

                          </div>

                          {/* DETAILS */}
                          <div className="flex-1">

                            <p className="text-[#C6922B] text-xs uppercase tracking-widest mb-2">
                              {item.category || "Product"}
                            </p>

                            <h4
                              onClick={() =>
                                navigate(
                                  `/product/${item.slug || toSlug(item.name)}`
                                )
                              }
                              className="text-2xl font-black cursor-pointer hover:text-[#C6922B] transition"
                            >
                              {item.name}
                            </h4>

                            <p className="text-gray-400 mt-2">
                              Quantity:
                              {" "}
                              {item.quantity || 1}
                            </p>

                            <p className="text-gray-400 mt-2">
                              Unit Price:
                              {" "}
                              ৳{item.price || 0}
                            </p>

                            <p className="text-gray-400 mt-2">
                              Product Total:
                              {" "}
                              ৳
                              {
                                Number(
                                  item.price || 0
                                ) *
                                  Number(
                                    item.quantity || 1
                                  )
                              }
                            </p>

                          </div>

                          {/* EDIT TOTAL — NOW AVAILABLE TO BOTH ADMIN AND PARTNER.
                              currentSubtotal above is already role-scoped:
                              admin = whole-order subtotal, partner = subtotal
                              of only their own visible items. */}
                          <div className="w-full lg:w-[260px]">

                            <p className="text-gray-400 mb-3">
                              Edit Product Total
                            </p>

                            <div className="flex flex-col gap-3">

                              <input
                                type="number"
                                value={currentSubtotal}
                                onChange={(e) => {

                                  const value =
                                    Number(
                                      e.target.value
                                    );

                                  setOrders(
                                    orders.map(
                                      (o) =>

                                        o.id ===
                                        order.id

                                          ? {
                                              ...o,
                                              productSubtotal:
                                                value,
                                            }

                                          : o
                                    )
                                  );
                                }}
                                className="w-full px-5 py-3 rounded-2xl bg-black/20 border border-white/10 outline-none focus:border-[#C6922B]"
                              />

                              <button
                                onClick={async () => {

                                  try {

                                    const updatedSubtotal =
                                      Number(
                                        order.productSubtotal ||
                                        currentSubtotal
                                      );

                                    await updateDoc(
                                      doc(
                                        db,
                                        "orders",
                                        order.id
                                      ),
                                      {

                                        productSubtotal:
                                          updatedSubtotal,

                                        total:
                                          updatedSubtotal +
                                          Number(
                                            order.shipping || 0
                                          ),
                                      }
                                    );

                                    setOrders(
                                      orders.map(
                                        (o) =>

                                          o.id ===
                                          order.id

                                            ? {
                                                ...o,
                                                productSubtotal:
                                                  updatedSubtotal,

                                                total:
                                                  updatedSubtotal +
                                                  Number(
                                                    order.shipping || 0
                                                  ),
                                              }

                                            : o
                                      )
                                    );

                                    await successAlert(
                                      "Price Updated!",
                                      "Product price has been updated successfully."
                                    );

                                  } catch (error) {

                                    console.log(error);

                                    await errorAlert(
                                      "Update Failed",
                                      "Failed to update product price. Please try again."
                                    );
                                  }
                                }}
                                className="w-full px-5 py-3 rounded-2xl bg-[#C6922B] text-black font-bold hover:opacity-90 transition"
                              >
                                Save Price
                              </button>

                            </div>

                          </div>

                        </div>
                      )
                    )}

                </div>

              </div>

              {/* RIGHT SIDE */}
              <div className="xl:w-[380px]">

                {/* TOTAL */}
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 mb-8">

                  <p className="text-4xl font-black text-[#C6922B]">
                    ৳{grandTotal}
                  </p>

                  <p className="text-gray-400 mt-3">

                    ৳{currentSubtotal}

                    {" "}
                    +

                    {" "}

                    ৳{shippingCharge}

                    {" "}

                    (Shipping)

                  </p>

                </div>

                {/* PAYMENT — DETAILS VISIBLE TO BOTH, OVERRIDE BUTTONS ADMIN ONLY (unchanged) */}
                <div className="rounded-3xl border border-white/10 bg-black/20 p-6 mb-8 space-y-4">

                  <h3 className="text-2xl font-black">
                    Payment Details
                  </h3>

                  <p className="text-gray-400">
                    Payment Method:
                    {" "}
                    {order.paymentMethod || "N/A"}
                  </p>

                  <p className="text-gray-400">
                    Payment Status:
                    {" "}

                    <span
                      className={`font-bold ${
                        order.paymentStatus === "Paid"

                          ? "text-green-400"

                          : "text-yellow-400"
                      }`}
                    >

                      {order.paymentStatus || "Pending"}

                    </span>

                  </p>

                  {/* TRANSACTION */}
                  {order.transactionId && (

                    <div className="rounded-2xl border border-white/10 bg-[#111111] p-4">

                      <p className="text-gray-400 text-sm mb-2">
                        Transaction ID
                      </p>

                      <h3 className="text-lg font-black text-[#C6922B] break-all">
                        {order.transactionId}
                      </h3>

                    </div>
                  )}

                </div>

                {/* PAYMENT STATUS BUTTONS — ADMIN CAN ALWAYS OVERRIDE (unchanged) */}
                {isAdmin && (

                  <div className="flex flex-wrap gap-3 mb-8">

                    <button
                      onClick={async () => {

                        try {

                          await updateDoc(
                            doc(
                              db,
                              "orders",
                              order.id
                            ),
                            {
                              paymentStatus:
                                "Pending",
                            }
                          );

                          setOrders(
                            orders.map(
                              (o) =>

                                o.id === order.id

                                  ? {
                                      ...o,
                                      paymentStatus:
                                        "Pending",
                                    }

                                  : o
                            )
                          );

                        } catch (error) {

                          console.log(error);

                          await errorAlert(
                            "Update Failed",
                            "Failed to update payment status."
                          );
                        }
                      }}
                      className={`px-5 py-3 rounded-2xl border font-bold transition

                      ${
                        order.paymentStatus ===
                        "Pending"

                          ? "bg-yellow-500 border-yellow-500 text-black"

                          : "border-yellow-500 text-yellow-400"
                      }
                      `}
                    >
                      Pending
                    </button>

                    <button
                      onClick={async () => {

                        try {

                          await updateDoc(
                            doc(
                              db,
                              "orders",
                              order.id
                            ),
                            {
                              paymentStatus:
                                "Paid",
                            }
                          );

                          setOrders(
                            orders.map(
                              (o) =>

                                o.id === order.id

                                  ? {
                                      ...o,
                                      paymentStatus:
                                        "Paid",
                                    }

                                  : o
                            )
                          );

                        } catch (error) {

                          console.log(error);

                          await errorAlert(
                            "Update Failed",
                            "Failed to update payment status."
                          );
                        }
                      }}
                      className={`px-5 py-3 rounded-2xl border font-bold transition

                      ${
                        order.paymentStatus ===
                        "Paid"

                          ? "bg-green-500 border-green-500 text-black"

                          : "border-green-500 text-green-400"
                      }
                      `}
                    >
                      Paid
                    </button>

                  </div>
                )}

                {/* SHIPPING CHARGE — NOW AVAILABLE TO BOTH ADMIN AND PARTNER.
                    Saving triggers the shipping email exactly like admin,
                    since saveShippingCharge() itself is role-agnostic. */}
                {
                  order.status === "Shipping" && (

                    <div className="rounded-3xl border border-white/10 bg-black/20 p-6 mb-8">

                      <p className="text-gray-400 mb-4">
                        Shipping Charge
                      </p>

                      <div className="flex flex-col md:flex-row gap-3">

                        <input
                          type="number"
                          placeholder="Shipping"
                          value={
                            order.shipping || ""
                          }
                          onChange={(e) => {

                            const value =
                              Number(
                                e.target.value
                              );

                            setOrders(
                              orders.map(
                                (item) =>

                                  item.id ===
                                  order.id

                                    ? {
                                        ...item,
                                        shipping:
                                          value,
                                      }

                                    : item
                              )
                            );
                          }}
                          className="flex-1 px-5 py-3 rounded-2xl bg-black/20 border border-white/10 outline-none focus:border-[#C6922B]"
                        />

                        <button
                          onClick={() =>
                            saveShippingCharge(
                              order,
                              shippingCharge,
                              currentSubtotal
                            )
                          }
                          className="px-5 py-3 rounded-2xl bg-[#C6922B] text-black font-bold hover:opacity-90 transition"
                        >
                          Save
                        </button>

                      </div>

                    </div>
                  )
                }

                {/* STATUS BUTTONS — BOTH ADMIN AND PARTNER CAN MANAGE STATUS/CANCEL (unchanged) */}
                <div className="flex flex-wrap gap-3">

                  {/* PENDING */}
                  <button
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "Pending",
                      )
                    }
                    className={`px-5 py-3 rounded-2xl border font-bold transition flex items-center gap-3

                    ${
                      order.status ===
                      "Pending"

                        ? "bg-yellow-500 border-yellow-500 text-black"

                        : "border-yellow-500 text-yellow-400"
                    }
                    `}
                  >
                    <FaClock />
                    Pending
                  </button>

                  {/* CONFIRMED */}
                  <button
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "Confirmed",
                      )
                    }
                    className={`px-5 py-3 rounded-2xl border font-bold transition flex items-center gap-3

                    ${
                      order.status ===
                      "Confirmed"

                        ? "bg-green-500 border-green-500 text-black"

                        : "border-green-500 text-green-400"
                    }
                    `}
                  >
                    <FaCheckCircle />
                    Confirmed
                  </button>

                  {/* SHIPPING */}
                  <button
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "Shipping",
                      )
                    }
                    className={`px-5 py-3 rounded-2xl border font-bold transition flex items-center gap-3

                    ${
                      order.status ===
                      "Shipping"

                        ? "bg-blue-500 border-blue-500 text-black"

                        : "border-blue-500 text-blue-400"
                    }
                    `}
                  >
                    <FaTruck />
                    Shipping
                  </button>

                  {/* DELIVERED */}
                  <button
                    onClick={() =>
                      updateOrderStatus(
                        order.id,
                        "Delivered",
                      )
                    }
                    className={`px-5 py-3 rounded-2xl border font-bold transition flex items-center gap-3

                    ${
                      order.status ===
                      "Delivered"

                        ? "bg-purple-500 border-purple-500 text-black"

                        : "border-purple-500 text-purple-400"
                    }
                    `}
                  >
                    <FaCheckCircle />
                    Delivered
                  </button>

                  {/* CANCEL */}
                  <button
                    onClick={() =>
                      cancelOrder(
                        order.id
                      )
                    }
                    className={`px-5 py-3 rounded-2xl border font-bold transition flex items-center gap-3

                    ${
                      order.status ===
                      "Cancelled"

                        ? "bg-red-500 border-red-500 text-white"

                        : "border-red-500 text-red-400"
                    }
                    `}
                  >
                    <FaTimesCircle />
                    Cancel
                  </button>

                  {/* DELETE — ADMIN ONLY (unchanged; order may contain other partners' items) */}
                  {isAdmin && (

                    <button
                      onClick={() =>
                        deleteOrderHandler(
                          order.id
                        )
                      }
                      className="px-5 py-3 rounded-2xl border border-gray-500 text-gray-300 font-bold transition flex items-center gap-3 hover:bg-gray-500 hover:text-black"
                    >
                      <FaTrashAlt />
                      Delete
                    </button>
                  )}

                </div>

              </div>

            </div>

          </div>
        );
      })}

      {/* EMPTY */}
      {filteredOrders.length === 0 && (

        <div className="rounded-[35px] border border-white/10 bg-white/5 p-10 text-center">

          <h2 className="text-3xl font-black mb-4">
            No Orders Found
          </h2>

          <p className="text-gray-400">
            {isAdmin
              ? "Try searching with another Order ID."
              : "You don't have any orders yet, or try searching with another Order ID."}
          </p>

        </div>
      )}

    </div>
  );
}