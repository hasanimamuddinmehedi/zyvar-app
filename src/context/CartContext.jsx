import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const CartContext =
  createContext();

export function CartProvider({
  children,
}) {

  // LOAD FROM LOCAL STORAGE
  const [cart,
    setCart] =
    useState(() => {

      const savedCart =
        localStorage.getItem(
          "zyvar-cart"
        );

      return savedCart
        ? JSON.parse(savedCart)
        : [];
    });

  // SELECTED ITEMS — IDs of the items the customer has
  // chosen to check out. Populated from Cart.jsx when the
  // customer picks one partner's group and hits Checkout.
  // Payment.jsx reads this instead of the full cart so it
  // only processes the selected partner's products.
  // Persisted to localStorage so it survives page refresh.
  const [selectedItems,
    setSelectedItems] =
    useState(() => {

      const saved =
        localStorage.getItem(
          "zyvar-cart-selected"
        );

      return saved
        ? JSON.parse(saved)
        : [];
    });

  // SAVE CART TO LOCAL STORAGE
  useEffect(() => {

    localStorage.setItem(

      "zyvar-cart",

      JSON.stringify(cart)
    );

  }, [cart]);

  // SAVE SELECTED ITEMS TO LOCAL STORAGE
  useEffect(() => {

    localStorage.setItem(

      "zyvar-cart-selected",

      JSON.stringify(selectedItems)
    );

  }, [selectedItems]);

  // ADD TO CART
  const addToCart =
    (product) => {

      setCart((prev) => {

        // CHECK EXISTING
        const existing =
          prev.find(

            (item) =>
              item.id ===
              product.id
          );

        // IF EXISTS — INCREMENT QUANTITY (capped at stock)
        if (existing) {

          return prev.map(
            (item) =>

              item.id ===
              product.id

                ? {

                    ...item,

                    quantity:
                      Math.min(
                        item.quantity + 1,
                        Number(item.stock) || 999
                      ),
                  }

                : item
          );
        }

        // NEW PRODUCT
        return [

          ...prev,

          {

            ...product,

            quantity: 1,
          },
        ];
      });

      // ALERT REMOVED FROM CONTEXT —
      // each component handles its own success popup
    };

  // REMOVE ITEM — also remove from selectedItems if present
  const removeFromCart =
    (id) => {

      setCart(

        cart.filter(

          (item) =>
            item.id !== id
        )
      );

      setSelectedItems(
        (prev) =>
          prev.filter(
            (selectedId) =>
              selectedId !== id
          )
      );
    };

  // REMOVE MULTIPLE ITEMS AT ONCE — used after an order is
  // successfully placed so ONLY the items belonging to the
  // partner group that was just checked out are cleared from
  // the cart. Any items from other sellers that the customer
  // did not select stay in the cart untouched, matching the
  // "one store at a time" checkout flow in Cart.jsx.
  // Also clears those same IDs out of selectedItems so a
  // stale selection doesn't linger for the next visit.
  const removeOrderedItems =
    (ids) => {

      setCart(
        (prev) =>
          prev.filter(
            (item) => !ids.includes(item.id)
          )
      );

      setSelectedItems(
        (prev) =>
          prev.filter(
            (selectedId) => !ids.includes(selectedId)
          )
      );
    };

  // UPDATE QUANTITY — caps at item.stock and minimum 1.
  // Used by the +/− buttons in Cart.jsx.
  const updateQuantity =
    (id, newQty) => {

      setCart((prev) =>

        prev.map((item) => {

          if (item.id !== id)
            return item;

          const maxStock =
            Number(item.stock) || 999;

          const capped =
            Math.min(
              Math.max(1, newQty),
              maxStock
            );

          return {
            ...item,
            quantity: capped,
          };
        })
      );
    };

  // CLEAR CART — also clear selected items
  // (still kept for cases that genuinely need to wipe the
  // whole cart, e.g. logout — Payment.jsx uses
  // removeOrderedItems instead so partial carts survive)
  const clearCart =
    () => {

      setCart([]);

      setSelectedItems([]);
    };

  // TOTAL ITEMS
  const cartCount =
    cart.reduce(

      (acc, item) =>

        acc +
        item.quantity,

      0
    );

  // TOTAL PRICE (full cart)
  const cartTotal =
    cart.reduce(

      (acc, item) =>

        acc +
        Number(item.price) *
          item.quantity,

      0
    );

  return (

    <CartContext.Provider

      value={{

        cart,

        addToCart,

        removeFromCart,

        removeOrderedItems,

        updateQuantity,

        clearCart,

        cartCount,

        cartTotal,

        selectedItems,

        setSelectedItems,
      }}
    >

      {children}

    </CartContext.Provider>
  );
}

// USE CART
export function useCart() {

  return useContext(
    CartContext
  );
}