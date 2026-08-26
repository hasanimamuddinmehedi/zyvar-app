// src/pages/Payment.jsx

import { useEffect, useMemo, useState } from "react";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import {
  useNavigate,
} from "react-router-dom";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  useCart,
} from "../context/CartContext";

import {
  onAuthStateChanged,
} from "firebase/auth";

// ADDRESS DATA IMPORT
import {
  bangladeshData,
} from "../data/bangladeshData";

import {
  successAlert,
  errorAlert,
  warningAlert,
} from "../utils/alerts";

// ZYVAR'S OWN FIXED PAYMENT NUMBER — used for products
// uploaded directly by ZYVAR admin (partnerSlug === "zyvar")
const ZYVAR_PAYMENT_NUMBER = "01820400999";

export default function Payment() {

  const [orderPlaced, setOrderPlaced] = useState(false);


const bkashLogo =
  "https://www.logo.wine/a/logo/BKash/BKash-Logo.wine.svg";

const nagadLogo =
  "https://download.logo.wine/logo/Nagad/Nagad-Logo.wine.png";

  const navigate =
    useNavigate();

  const {
    cart: fullCart = [],
    removeOrderedItems,
    clearCart,
    selectedItems,
  } = useCart();

  // FILTER CART TO SELECTED ITEMS ONLY — Cart.jsx now only
  // lets the customer check out ONE partner group at a time,
  // and sets selectedItems to that group's item IDs before
  // navigating here. Payment only processes those items; the
  // rest of the cart (other sellers' items) is left alone.
  // Falls back to the full cart if nothing is selected (e.g.
  // an old link straight to /payment, or a single-partner
  // cart where selection is implicit).
  //
  // MEMOIZED — without this, `cart` was a brand-new array on
  // every single render (a fresh .filter() call each time).
  // The seller-groups effect below depends on `cart`, so React
  // saw a "changed" dependency on every render and re-ran it in
  // a loop, continuously flipping sellerGroupsLoading back to
  // true. That's why bKash/Nagad payment details never finished
  // loading. Memoizing keeps the same array reference unless
  // fullCart or selectedItems actually change.
  const cart =
    useMemo(() => {

      return selectedItems && selectedItems.length > 0

        ? fullCart.filter(
            (item) => selectedItems.includes(item.id)
          )

        : fullCart;

    }, [fullCart, selectedItems]);

  const [name, setName] =
    useState("");

  // EMAIL STATE
  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [division, setDivision] =
    useState("");

  const [district, setDistrict] =
    useState("");

  const [upazila, setUpazila] =
    useState("");

  const [area, setArea] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [paymentMethod,
    setPaymentMethod] =
    useState("COD");

  // TRANSACTION IDs — one per seller, since bKash/Nagad
  // payments may need to be split across multiple partners
  // if the cart contains products from more than one seller.
  // (In the current one-store-at-a-time checkout flow this
  // will normally only ever hold a single entry, but the
  // grouping logic is kept generic in case that ever changes.)
  // Keyed by partnerSlug, e.g. { zyvar: "TXN123", "shop-abc": "TXN456" }
  const [transactionIds,
    setTransactionIds] =
    useState({});

  const [loading, setLoading] =
    useState(false);

  const [profileLoading,
    setProfileLoading] =
    useState(true);

  // SELLER PAYMENT BREAKDOWN — grouped by partnerSlug, with
  // each seller's subtotal and the number to send payment to
  const [sellerGroups,
    setSellerGroups] =
    useState([]);

  const [sellerGroupsLoading,
    setSellerGroupsLoading] =
    useState(true);

  // AUTO FILTER
  const districts =
    division
      ? Object.keys(
          bangladeshData[
            division
          ]
        )
      : [];

  const upazilas =
    division &&
    district
      ? bangladeshData[
          division
        ][district]
      : [];

  // AUTO FILL USER PROFILE
  useEffect(() => {

    const unsubscribe =

      onAuthStateChanged(

        auth,

        async (user) => {

          if (!user) {

            navigate("/login");

            return;
          }

          try {

            const savedProfile =

              JSON.parse(

                localStorage.getItem(
                  "zyvar-profile"
                )
              );

            setName(

              savedProfile?.name ||

              user.displayName ||

              ""
            );

            // AUTO FILL EMAIL FROM FIREBASE AUTH
            setEmail(
              user.email ||
              savedProfile?.email ||
              ""
            );

            setPhone(

              savedProfile?.phone ||
              ""
            );

            setDivision(
              savedProfile?.division || ""
            );

            setDistrict(
              savedProfile?.district || ""
            );

            setUpazila(
              savedProfile?.upazila || ""
            );

            setArea(
              savedProfile?.area || ""
            );

            setAddress(

              savedProfile?.address ||
              ""
            );

          } catch (error) {

            console.log(error);

          } finally {

            setProfileLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();

  }, []);

  // EMPTY CART (based on selected/filtered cart)
  useEffect(() => {

  if (
    !orderPlaced &&
    (!cart || cart.length === 0)
  ) {

    navigate("/cart");
  }

}, [cart, orderPlaced, navigate]);

  // TOTAL (based on selected/filtered cart)
  const total = cart.reduce(

    (acc, item) =>

      acc +
      Number(item.price) *
      Number(item.quantity),

    0
  );

  // BUILD SELLER PAYMENT BREAKDOWN — groups cart items by
  // partnerSlug, calculates each seller's subtotal, and
  // resolves each seller's bKash/Nagad payment number
  // (ZYVAR's products use the fixed ZYVAR number; partner
  // products look up the number they gave during application)
  useEffect(() => {

    const buildSellerGroups =
      async () => {

        if (!cart || cart.length === 0) {

          setSellerGroups([]);

          setSellerGroupsLoading(false);

          return;
        }

        try {

          setSellerGroupsLoading(true);

          // GROUP CART ITEMS BY partnerSlug
          // (items missing partnerSlug are treated as ZYVAR's own,
          // same fallback used everywhere else in the app)
          const groupsMap = {};

          cart.forEach((item) => {

            const slug =
              item.partnerSlug || "zyvar";

            if (!groupsMap[slug]) {

              groupsMap[slug] = {
                partnerSlug: slug,
                items: [],
                subtotal: 0,
              };
            }

            groupsMap[slug].items.push(item);

            groupsMap[slug].subtotal +=
              Number(item.price) *
              Number(item.quantity);
          });

          const slugs =
            Object.keys(groupsMap);

          // RESOLVE EACH SELLER'S NAME + PAYMENT NUMBER
          const resolvedGroups =
            await Promise.all(

              slugs.map(
                async (slug) => {

                  const group =
                    groupsMap[slug];

                  // ZYVAR — fixed identity, fixed number
                  if (slug === "zyvar") {

                    return {
                      ...group,
                      shopName: "ZYVAR",
                      paymentNumber:
                        ZYVAR_PAYMENT_NUMBER,
                    };
                  }

                  // PARTNER — look up their approved
                  // partner doc for shopName + paymentNumber
                  try {

                    const partnerQuery =
                      query(
                        collection(
                          db,
                          "partners"
                        ),
                        where(
                          "slug",
                          "==",
                          slug
                        )
                      );

                    const partnerSnap =
                      await getDocs(
                        partnerQuery
                      );

                    if (!partnerSnap.empty) {

                      const partnerData =
                        partnerSnap.docs[0].data();

                      return {
                        ...group,
                        shopName:
                          partnerData.shopName ||
                          "Partner Store",
                        paymentNumber:
                          partnerData.paymentNumber ||
                          "",
                      };
                    }

                    // PARTNER DOC NOT FOUND — fall back
                    // gracefully instead of breaking checkout
                    return {
                      ...group,
                      shopName: "Partner Store",
                      paymentNumber: "",
                    };

                  } catch (err) {

                    console.log(err);

                    return {
                      ...group,
                      shopName: "Partner Store",
                      paymentNumber: "",
                    };
                  }
                }
              )
            );

          setSellerGroups(resolvedGroups);

        } catch (error) {

          console.log(error);

          setSellerGroups([]);

        } finally {

          setSellerGroupsLoading(false);
        }
      };

    buildSellerGroups();

  }, [cart]);

  // UPDATE A SPECIFIC SELLER'S TRANSACTION ID
  const handleTransactionIdChange =
    (slug, value) => {

      setTransactionIds(
        (prev) => ({
          ...prev,
          [slug]: value,
        })
      );
    };

  // FULL ADDRESS
  const fullAddress = `
${area},
${upazila},
${district},
${division}

${address}
`;

  // PLACE ORDER
  const handleOrder =
    async (e) => {

      e.preventDefault();

      try {

        setLoading(true);

        // VALIDATE TRANSACTION — one transaction ID required
        // per seller when paying via bKash or Nagad, since
        // payment may be split across multiple sellers
        if (
          paymentMethod === "bKash" ||
          paymentMethod === "Nagad"
        ) {

          const missingSeller =
            sellerGroups.find(
              (group) =>
                !transactionIds[group.partnerSlug]
            );

          if (missingSeller) {

            await warningAlert(
              "Transaction ID Required",
              `Please enter the transaction ID for your payment to ${missingSeller.shopName}.`
            );

            setLoading(false);

            return;
          }
        }

        // SAVE PROFILE
        localStorage.setItem(

          "zyvar-profile",

          JSON.stringify({

            name,
            email,
            phone,
            division,
            district,
            upazila,
            area,
            address,
          })
        );

        // SAVE ORDER
        await addDoc(

          collection(
            db,
            "orders"
          ),

          {

            userId: auth.currentUser?.uid || "",

            userEmail:
              auth.currentUser?.email ||
              email ||
              "",

            email:
              auth.currentUser?.email ||
              email ||
              "",

            name,
            phone,

            division,
            district,
            upazila,
            area,

            address:
              fullAddress,

            paymentMethod,

            // SELLER PAYMENT BREAKDOWN — records exactly which
            // seller received which amount, sent to which number,
            // confirmed by which transaction ID
            sellerPayments:

              paymentMethod === "COD"

                ? []

                : sellerGroups.map(
                    (group) => ({
                      partnerSlug:
                        group.partnerSlug,
                      shopName:
                        group.shopName,
                      paymentNumber:
                        group.paymentNumber,
                      subtotal:
                        group.subtotal,
                      transactionId:
                        transactionIds[
                          group.partnerSlug
                        ] || "",
                    })
                  ),

            // KEPT FOR BACKWARD COMPATIBILITY — older order
            // views may still read a single transactionId field
            transactionId:

              paymentMethod === "COD"

                ? ""

                : Object.values(
                    transactionIds
                  ).join(", "),

            items: cart,

            total,

            shippingFee:
              "Collected Later",

            status: "Pending",

            createdAt:
              new Date(),
          }
        );

        await successAlert(
          "Order Placed!",
          "Your order has been placed successfully."
        );

        setOrderPlaced(true);

        // REMOVE ONLY THE CHECKED-OUT ITEMS — Cart.jsx now
        // supports checking out one partner group at a time
        // while other sellers' items stay behind, so placing
        // this order must NOT wipe the entire cart. Fall back
        // to clearCart() only in the unlikely case the removal
        // helper isn't available (e.g. older CartContext).
        if (typeof removeOrderedItems === "function") {

          removeOrderedItems(
            cart.map((item) => item.id)
          );

        } else {

          clearCart();
        }

        navigate("/my-orders", {
          replace: true,
        });

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Payment Failed",
          "Something went wrong. Please try again."
        );

      } finally {

        setLoading(false);
      }
    };

  // LOADING
  if (profileLoading) {

    return (

      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">

        <div className="w-16 h-16 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

      </div>
    );
  }

  return (

    <div className="min-h-screen bg-[#050505] text-white px-4 sm:px-6 lg:px-10 py-20">

      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-10">

        {/* LEFT */}
        <div className="lg:col-span-2 rounded-[40px] border border-white/10 bg-white/[0.04] backdrop-blur-3xl p-8 md:p-10 shadow-2xl">

          {/* HEADER */}
          <div className="mb-10">

            <p className="uppercase tracking-[0.3em] text-[#C6922B] text-sm mb-3">

              Checkout

            </p>

            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">

              Payment

            </h1>

          </div>

          {/* FORM */}
          <form

            onSubmit={handleOrder}

            className="space-y-8"
          >

            {/* NAME */}
            <div>

              <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                Full Name

              </label>

              <input

                type="text"

                required

                value={name}

                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }

                placeholder="Enter your full name"

                className="w-full px-6 py-5 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B] transition"
              />

            </div>

            {/* EMAIL */}
            <div>

              <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                Email Address

              </label>

              <input

                type="email"

                required

                value={email}

                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }

                placeholder="Enter your email"

                className="w-full px-6 py-5 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B] transition"
              />

            </div>

            {/* PHONE */}
            <div>

              <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                Phone Number

              </label>

              <input

                type="text"

                required

                value={phone}

                onChange={(e) =>
                  setPhone(
                    e.target.value
                  )
                }

                placeholder="017XXXXXXXX"

                className="w-full px-6 py-5 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B] transition"
              />

            </div>

            {/* ADDRESS SECTION */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-6">

              <div className="flex items-center justify-between">

                <h2 className="text-2xl font-black">

                  Shipping Address

                </h2>

                <span className="text-xs bg-[#C6922B]/10 text-[#C6922B] px-4 py-2 rounded-full border border-[#C6922B]/20">

                  Bangladesh Delivery Optimized

                </span>

              </div>

              {/* DIVISION */}
              <div>

                <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                  Division

                </label>

                <select

                  value={division}

                  onChange={(e) => {

                    setDivision(
                      e.target.value
                    );

                    setDistrict("");
                    setUpazila("");
                  }}

                  required

                  className="w-full px-6 py-5 rounded-2xl bg-black border border-white/10 outline-none focus:border-[#C6922B]"
                >

                  <option value="">
                    Select Division
                  </option>

                  {
                    Object.keys(
                      bangladeshData
                    ).map((div) => (

                      <option
                        key={div}
                        value={div}
                      >

                        {div}

                      </option>
                    ))
                  }

                </select>

              </div>

              {/* DISTRICT */}
              <div>

                <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                  District

                </label>

                <select

                  value={district}

                  onChange={(e) => {

                    setDistrict(
                      e.target.value
                    );

                    setUpazila("");
                  }}

                  required

                  disabled={!division}

                  className="w-full px-6 py-5 rounded-2xl bg-black border border-white/10 outline-none focus:border-[#C6922B] disabled:opacity-50"
                >

                  <option value="">
                    Select District
                  </option>

                  {
                    districts.map(
                      (dist) => (

                        <option
                          key={dist}
                          value={dist}
                        >

                          {dist}

                        </option>
                      )
                    )
                  }

                </select>

              </div>

              {/* UPAZILA */}
              <div>

                <label className="block mb-3 text-sm uppercase tracking-widests text-gray-400">

                  Thana / Upazila

                </label>

                <select

                  value={upazila}

                  onChange={(e) =>
                    setUpazila(
                      e.target.value
                    )
                  }

                  required

                  disabled={!district}

                  className="w-full px-6 py-5 rounded-2xl bg-black border border-white/10 outline-none focus:border-[#C6922B] disabled:opacity-50"
                >

                  <option value="">
                    Select Upazila
                  </option>

                  {
                    upazilas.map(
                      (upa) => (

                        <option
                          key={upa}
                          value={upa}
                        >

                          {upa}

                        </option>
                      )
                    )
                  }

                </select>

              </div>

              {/* AREA */}
              <div>

                <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                  Area / Road / Village

                </label>

                <input

                  type="text"

                  required

                  value={area}

                  onChange={(e) =>
                    setArea(
                      e.target.value
                    )
                  }

                  placeholder="Road / Area / Village"

                  className="w-full px-6 py-5 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B]"
                />

              </div>

              {/* FULL ADDRESS */}
              <div>

                <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                  Full Address

                </label>

                <textarea

                  rows="5"

                  required

                  value={address}

                  onChange={(e) =>
                    setAddress(
                      e.target.value
                    )
                  }

                  placeholder="House no, building, landmark etc."

                  className="w-full px-6 py-5 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B]"
                />

              </div>

            </div>

            {/* PAYMENT */}
            <div>

              <label className="block mb-5 text-sm uppercase tracking-widest text-gray-400">

                Select Payment Method

              </label>

              <div className="grid md:grid-cols-3 gap-5">

                {/* COD */}
                <button

                  type="button"

                  onClick={() =>
                    setPaymentMethod(
                      "COD"
                    )
                  }

                  className={`rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.02] ${
                    paymentMethod === "COD"

                      ? "border-[#C6922B] bg-[#C6922B]/10"

                      : "border-white/10 bg-white/5"
                  }`}
                >

                  <h3 className="text-2xl font-black mb-3">

                    Cash On Delivery

                  </h3>

                  <p className="text-gray-400 text-sm">

                    Pay after receiving product.

                  </p>

                </button>

                {/* BKASH */}
                <button

                  type="button"

                  onClick={() =>
                    setPaymentMethod(
                      "bKash"
                    )
                  }

                  className={`rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.02] ${
                    paymentMethod === "bKash"

                      ? "border-[#E2136E] bg-[#E2136E]/10"

                      : "border-white/10 bg-white/5"
                  }`}
                >

                  <div className="flex items-center gap-3 mb-4">

                    <img

                      src={bkashLogo}

                      alt="bKash"

                      className="w-14 object-contain"
                    />

                    <h3 className="text-2xl font-black">

                      bKash

                    </h3>

                  </div>

                  <p className="text-gray-400 text-sm">

                    {
                      sellerGroups.length > 1

                        ? "Send money to each seller below."

                        : `Send Money: ${
                            sellerGroups[0]?.paymentNumber ||
                            ZYVAR_PAYMENT_NUMBER
                          }`
                    }

                  </p>

                </button>

                {/* NAGAD */}
                <button

                  type="button"

                  onClick={() =>
                    setPaymentMethod(
                      "Nagad"
                    )
                  }

                  className={`rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.02] ${
                    paymentMethod === "Nagad"

                      ? "border-[#F58220] bg-[#F58220]/10"

                      : "border-white/10 bg-white/5"
                  }`}
                >

                  <div className="flex items-center gap-3 mb-4">

                    <img

                      src={nagadLogo}

                      alt="Nagad"

                      className="w-14 object-contain"
                    />

                    <h3 className="text-2xl font-black">

                      Nagad

                    </h3>

                  </div>

                  <p className="text-gray-400 text-sm">

                    {
                      sellerGroups.length > 1

                        ? "Send money to each seller below."

                        : `Send Money: ${
                            sellerGroups[0]?.paymentNumber ||
                            ZYVAR_PAYMENT_NUMBER
                          }`
                    }

                  </p>

                </button>

              </div>

            </div>

            {/* SELLER PAYMENT BREAKDOWN + TRANSACTION IDS */}
            {
              (paymentMethod === "bKash" ||

              paymentMethod === "Nagad") && (

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 space-y-6">

                  <h2 className="text-2xl font-black">

                    Send Payment To

                  </h2>

                  {
                    sellerGroupsLoading ? (

                      <div className="flex items-center gap-3 text-gray-400">

                        <div className="w-5 h-5 border-2 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

                        Loading payment details...

                      </div>

                    ) : (

                      sellerGroups.map(
                        (group) => (

                          <div

                            key={group.partnerSlug}

                            className="rounded-2xl border border-white/10 bg-black/30 p-5 space-y-4"
                          >

                            <div className="flex flex-wrap items-center justify-between gap-3">

                              <div>

                                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">

                                  Seller

                                </p>

                                <h3 className="text-xl font-black text-[#C6922B]">

                                  {group.shopName}

                                </h3>

                              </div>

                              <div className="text-right">

                                <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">

                                  Amount To Send

                                </p>

                                <h3 className="text-xl font-black">

                                  ৳{group.subtotal}

                                </h3>

                              </div>

                            </div>

                            <div className="rounded-xl bg-white/5 border border-white/10 p-4">

                              {
                                group.paymentNumber ? (

                                  <p className="text-gray-200">

                                    {paymentMethod} Number:
                                    {" "}
                                    <span className="font-black text-[#C6922B]">

                                      {group.paymentNumber}

                                    </span>

                                  </p>

                                ) : (

                                  <p className="text-red-400 text-sm">

                                    This seller has not added a payment number yet. Please contact support before paying.

                                  </p>
                                )
                              }

                            </div>

                            <div>

                              <label className="block mb-3 text-sm uppercase tracking-widest text-gray-400">

                                Transaction ID For {group.shopName}

                              </label>

                              <input

                                type="text"

                                required

                                value={
                                  transactionIds[
                                    group.partnerSlug
                                  ] || ""
                                }

                                onChange={(e) =>
                                  handleTransactionIdChange(
                                    group.partnerSlug,
                                    e.target.value
                                  )
                                }

                                placeholder="Enter transaction ID"

                                className="w-full px-6 py-5 rounded-2xl bg-black/40 border border-white/10 outline-none focus:border-[#C6922B]"
                              />

                            </div>

                          </div>
                        )
                      )
                    )
                  }

                </div>
              )
            }

            {/* BUTTON */}
            <button

              type="submit"

              disabled={loading}

              className="w-full py-5 rounded-2xl bg-[#C6922B] text-black text-lg font-black hover:scale-[1.02] transition-all duration-300 shadow-xl"
            >

              {
                loading

                  ? "Processing Payment..."

                  : "Place Order"
              }

            </button>

          </form>

        </div>

        {/* RIGHT */}
        <div className="rounded-[40px] border border-white/10 bg-white/[0.04] backdrop-blur-3xl p-8 h-fit sticky top-10 shadow-2xl">

          <h2 className="text-3xl font-black mb-8">

            Order Summary

          </h2>

          <div className="space-y-5 mb-8">

            {
              cart.map((item) => (

                <div

                  key={item.id}

                  className="flex items-center gap-4"
                >

                  <img

                    src={
                      item.images?.[0] ||
                      item.image
                    }

                    alt={item.name}

                    className="w-20 h-20 rounded-2xl object-cover border border-white/10"
                  />

                  <div className="flex-1 min-w-0">

                    <h3 className="font-bold break-words leading-snug">
                      {item.name}
                    </h3>

                    <p className="text-gray-400 text-sm">

                      Qty:
                      {" "}
                      {item.quantity}

                    </p>

                  </div>

                  <h4 className="font-black text-[#C6922B] shrink-0">

                    ৳
                    {
                      Number(item.price) *
                      Number(item.quantity)
                    }

                  </h4>

                </div>
              ))
            }

          </div>

          {/* TOTAL */}
          <div className="border-t border-white/10 pt-6 flex justify-between items-center">

            <h3 className="text-2xl font-black">

              Total

            </h3>

            <h3 className="text-4xl font-black text-[#C6922B]">

              ৳{total}

            </h3>

          </div>

          {/* ADDRESS PREVIEW */}
          <div className="mt-8 rounded-3xl border border-white/10 bg-black/30 p-5">

            <h4 className="font-bold mb-3 text-[#C6922B]">

              Delivery Address

            </h4>

            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">

              {fullAddress}

            </p>

          </div>

          {/* SHIPPING NOTE */}
          <div className="mt-6 rounded-2xl border border-[#C6922B]/20 bg-[#C6922B]/10 p-5">

            <p className="text-sm text-gray-300 leading-relaxed">

              Shipping fee will be collected separately during delivery confirmation.

            </p>

          </div>

        </div>

      </div>

    </div>
  );
}