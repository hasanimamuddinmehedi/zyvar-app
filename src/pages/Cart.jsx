import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useCart,
} from "../context/CartContext";

import {
  FaPlus,
  FaMinus,
  FaStore,
  FaCheckCircle,
} from "react-icons/fa";

export default function Cart() {

  const navigate =
    useNavigate();

  const {

    cart = [],

    removeFromCart,

    updateQuantity,

    cartTotal,

    selectedItems,

    setSelectedItems,

  } = useCart();

  // SELECTED PARTNER SLUG — the partner group the customer
  // has chosen to check out. Only one group at a time, since
  // payment goes to one seller's bKash/Nagad number per order.
  const [selectedPartnerSlug,
    setSelectedPartnerSlug] =
    useState(() => {

      // PRE-SELECT: if selectedItems is already set (e.g.
      // customer navigated back from payment), restore which
      // partner group was selected so they don't have to
      // re-pick it.
      if (selectedItems.length > 0 && cart.length > 0) {

        const firstSelectedItem =
          cart.find(
            (item) => selectedItems.includes(item.id)
          );

        return firstSelectedItem?.partnerSlug || "zyvar";
      }

      return null;
    });

  // SELECTED PRODUCT IDS — WITHIN the chosen partner group,
  // which specific products the customer actually wants to
  // pay for right now. This lets a customer check out only
  // some of a single seller's products, leaving the rest in
  // the cart for later, instead of being forced to pay for
  // every item from that seller at once.
  const [selectedProductIds,
    setSelectedProductIds] =
    useState(() => {

      // PRE-SELECT: restore the exact product subset from a
      // previously persisted selectedItems list (e.g. customer
      // navigated back from payment), rather than defaulting
      // to the whole group.
      if (selectedItems.length > 0 && cart.length > 0) {

        return [...selectedItems];
      }

      return [];
    });

  // GROUP CART ITEMS BY partnerSlug — same fallback pattern
  // used across Products.jsx, Payment.jsx, OrdersPage.jsx etc.
  const partnerGroups =
    useMemo(() => {

      const map = {};

      (cart || []).forEach((item) => {

        const slug =
          item.partnerSlug || "zyvar";

        if (!map[slug]) {

          map[slug] = {
            partnerSlug: slug,
            shopName:
              item.uploadedBy ||
              (slug === "zyvar" ? "ZYVAR" : slug),
            items: [],
          };
        }

        map[slug].items.push(item);
      });

      return Object.values(map);

    }, [cart]);

  // TOTAL FOR THE SELECTED PRODUCTS ONLY — not the whole
  // group, since the customer may have deselected some of
  // that seller's products
  const selectedGroupTotal =
    useMemo(() => {

      if (!selectedPartnerSlug) return 0;

      const group =
        partnerGroups.find(
          (g) => g.partnerSlug === selectedPartnerSlug
        );

      if (!group) return 0;

      return group.items

        .filter((item) =>
          selectedProductIds.includes(item.id)
        )

        .reduce(
          (acc, item) =>
            acc +
            Number(item.price) *
              Number(item.quantity),
          0
        );

    }, [selectedPartnerSlug, selectedProductIds, partnerGroups, cart]);

  // SELECT A PARTNER GROUP TO CHECK OUT — defaults to ALL of
  // that seller's products being selected; the customer can
  // then uncheck individual products via the per-item checkbox
  const handleSelectGroup =
    (slug) => {

      setSelectedPartnerSlug(slug);

      const group =
        partnerGroups.find(
          (g) => g.partnerSlug === slug
        );

      if (group) {

        const allIds =
          group.items.map((item) => item.id);

        setSelectedProductIds(allIds);

        // Pre-populate selectedItems with all item IDs in the
        // chosen group so Payment.jsx already has the right list
        // before the customer even clicks Checkout
        setSelectedItems(allIds);
      }
    };

  // TOGGLE A SINGLE PRODUCT'S SELECTION — if the product
  // belongs to a different seller than the one currently
  // selected, switch the whole selection over to that seller
  // (checking just this one product), since only one store
  // can be paid per order. If it belongs to the already
  // selected seller, just add/remove it from the subset.
  const handleToggleProduct =
    (item) => {

      const itemSlug =
        item.partnerSlug || "zyvar";

      if (itemSlug !== selectedPartnerSlug) {

        setSelectedPartnerSlug(itemSlug);

        setSelectedProductIds([item.id]);

        setSelectedItems([item.id]);

        return;
      }

      setSelectedProductIds((prev) => {

        const next =
          prev.includes(item.id)

            ? prev.filter((id) => id !== item.id)

            : [...prev, item.id];

        setSelectedItems(next);

        return next;
      });
    };

  // SELECT ALL / DESELECT ALL PRODUCTS WITHIN A GROUP — quick
  // shortcut shown once a group has been selected, so the
  // customer doesn't have to click every checkbox one by one
  const handleToggleAllInGroup =
    (slug) => {

      const group =
        partnerGroups.find(
          (g) => g.partnerSlug === slug
        );

      if (!group) return;

      const allIds =
        group.items.map((item) => item.id);

      const allSelected =
        allIds.every((id) =>
          selectedProductIds.includes(id)
        );

      const next =
        allSelected ? [] : allIds;

      setSelectedProductIds(next);

      setSelectedItems(next);
    };

  // PROCEED TO CHECKOUT
  const handleCheckout =
    () => {

      if (!selectedPartnerSlug) return;

      if (
        !selectedProductIds ||
        selectedProductIds.length === 0
      )
        return;

      // Ensure selectedItems is up to date before navigating
      setSelectedItems(selectedProductIds);

      navigate("/payment");
    };

  // EMPTY CART
  if (!cart || cart.length === 0) {

    return (

      <div className="min-h-screen bg-[#0B0B0B] text-white flex flex-col items-center justify-center px-6">

        <h1 className="text-4xl font-black text-[#C6922B] mb-6 text-center">

          Your Cart Is Empty

        </h1>

        <button

          onClick={() =>
            navigate("/products")
          }

          className="px-8 py-5 rounded-2xl bg-[#C6922B] text-black font-bold hover:scale-105 transition duration-300"
        >

          Continue Shopping

        </button>

      </div>
    );
  }

  return (

    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 sm:px-6 lg:px-10 py-20">

      <div className="max-w-7xl mx-auto">

        <div className="flex items-center justify-between mb-12 flex-wrap gap-4">

          <h1 className="text-5xl font-black">

            Shopping Cart

          </h1>

          <span className="text-[#C6922B] text-xl font-bold">

            {cart.length} Items

          </span>

        </div>

        {/* MULTI-PARTNER NOTICE — only shown when the cart
            has items from more than one seller, since that's
            when the selection step becomes necessary */}
        {
          partnerGroups.length > 1 && (

            <div className="
              rounded-[24px]
              border border-[#C6922B]/30
              bg-[#C6922B]/10
              px-6 py-5
              mb-10
              flex items-start gap-4
            ">

              <FaStore
                className="text-[#C6922B] shrink-0 mt-0.5"
                size={18}
              />

              <div>

                <p className="font-bold text-[#C6922B] mb-1">
                  Multiple Stores In Your Cart
                </p>

                <p className="text-gray-300 text-sm leading-relaxed">
                  Your cart contains items from{" "}
                  <span className="font-bold">
                    {partnerGroups.length} different stores
                  </span>
                  . You can only check out one store at a time.
                  Select the store you want to pay for now —
                  the other items will stay in your cart.
                </p>

              </div>

            </div>
          )
        }

        <div className="grid lg:grid-cols-3 gap-10">

          {/* LEFT — PARTNER GROUP CARDS */}
          <div className="lg:col-span-2 space-y-8">

            {partnerGroups.map((group) => {

              const isSelected =
                selectedPartnerSlug ===
                group.partnerSlug;

              const groupSubtotal =
                group.items.reduce(
                  (acc, item) =>
                    acc +
                    Number(item.price) *
                      Number(item.quantity),
                  0
                );

              return (

                <div
                  key={group.partnerSlug}
                  className={`
                    rounded-[32px]
                    border
                    transition
                    duration-300
                    overflow-hidden
                    ${
                      isSelected

                        ? "border-[#C6922B] shadow-[0_0_30px_rgba(198,146,43,0.15)]"

                        : "border-white/10"
                    }
                  `}
                >

                  {/* STORE HEADER + SELECT BUTTON */}
                  <div
                    className={`
                      flex flex-wrap
                      items-center
                      justify-between
                      gap-4
                      px-6 py-5
                      border-b
                      ${
                        isSelected

                          ? "bg-[#C6922B]/10 border-[#C6922B]/30"

                          : "bg-white/5 border-white/10"
                      }
                    `}
                  >

                    <div className="flex items-center gap-3 min-w-0">

                      <FaStore
                        className={
                          isSelected
                            ? "text-[#C6922B]"
                            : "text-gray-400"
                        }
                        size={18}
                      />

                      <div className="min-w-0">

                        <p className="font-black text-lg break-words">
                          {group.shopName}
                        </p>

                        <p className="text-gray-400 text-sm">
                          {group.items.length} item
                          {group.items.length !== 1 ? "s" : ""}
                          {" · "}
                          ৳{groupSubtotal}
                        </p>

                      </div>

                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-end">

                      {/* SELECTED-COUNT INDICATOR — only shown
                          once this group is the active one, so
                          the customer can see how many of this
                          seller's products are currently picked */}
                      {
                        isSelected && (

                          <span className="text-xs text-gray-400">

                            {selectedProductIds.length} of{" "}
                            {group.items.length} selected

                          </span>
                        )
                      }

                      {/* SELECT ALL / DESELECT ALL SHORTCUT —
                          quick way to toggle every product in
                          this group without clicking each box */}
                      {
                        isSelected && (

                          <button
                            type="button"
                            onClick={() =>
                              handleToggleAllInGroup(
                                group.partnerSlug
                              )
                            }
                            className="text-xs font-bold text-[#C6922B] hover:underline whitespace-nowrap"
                          >

                            {
                              group.items.every((item) =>
                                selectedProductIds.includes(item.id)
                              )
                                ? "Deselect All"
                                : "Select All"
                            }

                          </button>
                        )
                      }

                      {/* SELECT / SELECTED BUTTON */}
                      <button
                        onClick={() =>
                          handleSelectGroup(
                            group.partnerSlug
                          )
                        }
                        className={`
                          px-5 py-3
                          rounded-2xl
                          font-bold
                          text-sm
                          flex items-center gap-2
                          whitespace-nowrap
                          transition duration-300
                          ${
                            isSelected

                              ? "bg-[#C6922B] text-black"

                              : "border border-white/20 bg-white/5 hover:border-[#C6922B] hover:text-[#C6922B]"
                          }
                        `}
                      >

                        {
                          isSelected && (
                            <FaCheckCircle size={14} />
                          )
                        }

                        {
                          isSelected
                            ? "Selected For Checkout"
                            : "Select To Checkout"
                        }

                      </button>

                    </div>

                  </div>

                  {/* PRODUCT LINES WITHIN THIS GROUP */}
                  <div className="divide-y divide-white/5 bg-white/[0.02]">

                    {group.items.map((item) => {

                      const maxStock =
                        Number(item.stock) || 999;

                      const atMax =
                        item.quantity >= maxStock;

                      const atMin =
                        item.quantity <= 1;

                      return (

                        <div

                          key={item.id}

                          className={`
                            p-5 flex flex-col md:flex-row gap-5
                            ${
                              isSelected &&
                              selectedProductIds.includes(item.id)

                                ? "bg-[#C6922B]/[0.04]"

                                : ""
                            }
                          `}
                        >

                          {/* PRODUCT CHECKBOX — lets the
                              customer pick exactly which
                              products from this seller they
                              want to pay for right now. Ticking
                              a product from a different seller
                              switches the active checkout group
                              over to that seller instead. */}
                          <div className="flex md:items-start items-center pt-1 shrink-0">

                            <input

                              type="checkbox"

                              checked={
                                isSelected &&
                                selectedProductIds.includes(item.id)
                              }

                              onChange={() =>
                                handleToggleProduct(item)
                              }

                              className="w-5 h-5 accent-[#C6922B] rounded cursor-pointer"

                              aria-label={`Select ${item.name} for checkout`}
                            />

                          </div>

                          {/* IMAGE */}
                          <img

                            src={
                              item.images?.[0] ||
                              item.image
                            }

                            alt={item.name}

                            className="w-full md:w-32 h-32 rounded-2xl object-cover shrink-0"
                          />

                          {/* DETAILS */}
                          <div className="flex-1 min-w-0">

                            <p className="uppercase tracking-widest text-[#C6922B] text-xs mb-2">
                              {item.category}
                            </p>

                            <h2 className="text-xl font-black mb-3 break-words leading-snug">
                              {item.name}
                            </h2>

                            {/* QUANTITY EDITOR */}
                            <div className="flex items-center gap-3 mb-4 flex-wrap">

                              <span className="text-gray-400 text-sm">
                                Quantity:
                              </span>

                              <div className="flex items-center gap-2">

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.quantity - 1
                                    )
                                  }
                                  disabled={atMin}
                                  className="
                                    w-8 h-8
                                    rounded-xl
                                    border border-white/20
                                    bg-white/5
                                    flex items-center justify-center
                                    hover:border-[#C6922B]
                                    hover:text-[#C6922B]
                                    transition
                                    disabled:opacity-30
                                    disabled:cursor-not-allowed
                                  "
                                >
                                  <FaMinus size={10} />
                                </button>

                                <span className="
                                  w-10
                                  text-center
                                  font-black
                                  text-lg
                                ">
                                  {item.quantity}
                                </span>

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.quantity + 1
                                    )
                                  }
                                  disabled={atMax}
                                  className="
                                    w-8 h-8
                                    rounded-xl
                                    border border-white/20
                                    bg-white/5
                                    flex items-center justify-center
                                    hover:border-[#C6922B]
                                    hover:text-[#C6922B]
                                    transition
                                    disabled:opacity-30
                                    disabled:cursor-not-allowed
                                  "
                                >
                                  <FaPlus size={10} />
                                </button>

                              </div>

                              {/* STOCK WARNING */}
                              {
                                atMax && (

                                  <span className="text-orange-400 text-xs font-semibold">
                                    Max stock ({maxStock}) reached
                                  </span>
                                )
                              }

                            </div>

                            <h3 className="text-2xl font-black text-[#C6922B]">

                              ৳
                              {
                                Number(item.price) *
                                Number(item.quantity)
                              }

                            </h3>

                          </div>

                          {/* REMOVE */}
                          <button

                            onClick={() =>
                              removeFromCart(
                                item.id
                              )
                            }

                            className="px-5 py-3 rounded-2xl border border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition h-fit self-start whitespace-nowrap"
                          >

                            Remove

                          </button>

                        </div>
                      );
                    })}

                  </div>

                </div>
              );
            })}

          </div>

          {/* RIGHT — ORDER SUMMARY */}
          <div className="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl p-8 h-fit sticky top-10">

            <h2 className="text-3xl font-black mb-8">

              Order Summary

            </h2>

            {/* SELECTED GROUP SUMMARY */}
            {
              selectedPartnerSlug ? (

                <>

                  <div className="
                    rounded-2xl
                    border border-[#C6922B]/20
                    bg-[#C6922B]/5
                    p-4
                    mb-6
                  ">

                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">
                      Checking Out From
                    </p>

                    <p className="font-black text-[#C6922B] text-lg break-words">
                      {
                        partnerGroups.find(
                          (g) =>
                            g.partnerSlug ===
                            selectedPartnerSlug
                        )?.shopName
                      }
                    </p>

                  </div>

                  <div className="flex justify-between items-center mb-3">

                    <span className="text-gray-400">

                      Items

                    </span>

                    <span className="font-bold">

                      {
                        partnerGroups.find(
                          (g) =>
                            g.partnerSlug ===
                            selectedPartnerSlug
                        )?.items.length
                      }

                    </span>

                  </div>

                  <div className="border-t border-white/10 pt-6 flex justify-between items-center mb-10">

                    <h3 className="text-2xl font-black">

                      Total

                    </h3>

                    <h3 className="text-4xl font-black text-[#C6922B]">

                      ৳{selectedGroupTotal}

                    </h3>

                  </div>

                </>

              ) : (

                /* NO GROUP SELECTED YET */

                <div className="mb-10">

                  <div className="flex justify-between items-center mb-3">

                    <span className="text-gray-400">

                      Cart Total

                    </span>

                    <span className="font-bold text-xl">

                      ৳{cartTotal}

                    </span>

                  </div>

                  <div className="
                    rounded-2xl
                    border border-white/10
                    bg-white/5
                    p-4
                    mt-6
                  ">

                    <p className="text-gray-400 text-sm text-center leading-relaxed">
                      {
                        partnerGroups.length > 1

                          ? "Select a store above to proceed to checkout."

                          : "Select the store above to proceed to checkout."
                      }
                    </p>

                  </div>

                </div>
              )
            }

            <button

              onClick={handleCheckout}

              disabled={!selectedPartnerSlug}

              className="
                w-full
                py-5
                rounded-2xl
                bg-[#C6922B]
                text-black
                text-lg
                font-black
                hover:scale-[1.02]
                transition
                disabled:opacity-40
                disabled:cursor-not-allowed
                disabled:hover:scale-100
              "
            >

              Proceed To Checkout

            </button>

            {/* REMAINING CART NOTE — shown when the cart has
                items from other stores that won't be checked
                out in this session */}
            {
              selectedPartnerSlug &&
              partnerGroups.length > 1 && (

                <p className="text-gray-500 text-xs text-center mt-4 leading-relaxed">
                  Items from other stores will remain in your cart.
                </p>
              )
            }

          </div>

        </div>

      </div>

    </div>
  );
}