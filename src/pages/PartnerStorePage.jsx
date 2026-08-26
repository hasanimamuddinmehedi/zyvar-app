import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useNavigate,
} from "react-router-dom";

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  FaFacebook,
  FaInstagram,
  FaPhone,
  FaMapMarkerAlt,
  FaStar,
  FaShoppingBag,
  FaHeart,
  FaBolt,
} from "react-icons/fa";

import { db, auth } from "../firebase/firebase";

import {
  useCart,
} from "../context/CartContext";

import {
  useWishlist,
} from "../context/WishlistContext";

import {
  successAlert,
  errorAlert,
  warningAlert,
} from "../utils/alerts";

export default function PartnerStorePage() {

  const {
    partnerSlug,
  } = useParams();

  const navigate =
    useNavigate();

  const {
    addToCart,
  } = useCart();

  const {
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  } = useWishlist();

  const [
    partner,
    setPartner,
  ] = useState(null);

  const [
    products,
    setProducts,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  // LOGGED-IN CUSTOMER — needed to gate review submission
  // and to check "is this user logged in" for buy/cart actions,
  // same pattern used in Products.jsx (zyvar-user flag)
  const [currentUser,
    setCurrentUser] =
    useState(null);

  const isLoggedIn =
    localStorage.getItem(
      "zyvar-user"
    ) === "true";

  // REVIEWS — pulled from the new "reviews" collection,
  // filtered by this store's partnerSlug
  const [reviews,
    setReviews] =
    useState([]);

  const [reviewsLoading,
    setReviewsLoading] =
    useState(true);

  // THIS USER'S EXISTING REVIEW FOR THIS STORE (if any) —
  // used to switch the form between "submit" and "update" mode,
  // enforcing one review per user per store
  const [myReview,
    setMyReview] =
    useState(null);

  const [reviewRating,
    setReviewRating] =
    useState(5);

  const [reviewComment,
    setReviewComment] =
    useState("");

  const [submittingReview,
    setSubmittingReview] =
    useState(false);

  useEffect(() => {

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {

          setCurrentUser(user);
        }
      );

    return () => unsubscribe();

  }, []);

  useEffect(() => {

    fetchPartner();

  }, [partnerSlug]);

  // FETCH THIS USER'S EXISTING REVIEW once we know both
  // who's logged in and which store we're on
  useEffect(() => {

    if (currentUser && partnerSlug) {

      fetchMyReview();
    }

  }, [currentUser, partnerSlug]);

  const fetchPartner = async () => {

    try {

      setLoading(true);

      const partnerQuery =
        query(
          collection(
            db,
            "partners"
          ),
          where(
            "slug",
            "==",
            partnerSlug
          )
        );

      const partnerSnapshot =
        await getDocs(
          partnerQuery
        );

      if (
        partnerSnapshot.empty
      ) {
        setLoading(false);
        return;
      }

      const partnerData =
        {
          id:
            partnerSnapshot.docs[0]
              .id,

          ...partnerSnapshot.docs[0]
            .data(),
        };

      setPartner(
        partnerData
      );

      const productQuery =
        query(
          collection(
            db,
            "products"
          ),
          where(
            "partnerSlug",
            "==",
            partnerSlug
          )
        );

      const productSnapshot =
        await getDocs(
          productQuery
        );

      const productData =
        productSnapshot.docs.map(
          (docItem) => ({
            id:
              docItem.id,

            ...docItem.data(),
          })
        );

      setProducts(
        productData
      );

      // FETCH STORE REVIEWS — independent of product fetch,
      // but kept inside the same try block since both depend
      // on partnerSlug resolving successfully
      await fetchReviews();

    } catch (error) {

      console.log(error);

    } finally {

      setLoading(false);
    }
  };

  // FETCH ALL REVIEWS FOR THIS STORE
  const fetchReviews = async () => {

    try {

      setReviewsLoading(true);

      const reviewsQuery =
        query(
          collection(
            db,
            "reviews"
          ),
          where(
            "partnerSlug",
            "==",
            partnerSlug
          )
        );

      const reviewsSnapshot =
        await getDocs(
          reviewsQuery
        );

      const reviewsData =
        reviewsSnapshot.docs.map(
          (docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          })
        );

      // NEWEST FIRST
      reviewsData.sort(
        (a, b) => {

          const aTime =
            a.createdAt?.seconds || 0;

          const bTime =
            b.createdAt?.seconds || 0;

          return bTime - aTime;
        }
      );

      setReviews(reviewsData);

    } catch (error) {

      console.log(error);

    } finally {

      setReviewsLoading(false);
    }
  };

  // FETCH THE CURRENT USER'S OWN REVIEW FOR THIS STORE —
  // one review per user per store, doc ID is `${uid}_${partnerSlug}`
  // so existence can be checked directly instead of querying
  const fetchMyReview = async () => {

    try {

      const reviewRef =
        doc(
          db,
          "reviews",
          `${currentUser.uid}_${partnerSlug}`
        );

      const reviewSnap =
        await getDoc(reviewRef);

      if (reviewSnap.exists()) {

        const data = reviewSnap.data();

        setMyReview(data);

        setReviewRating(
          data.rating || 5
        );

        setReviewComment(
          data.comment || ""
        );
      }

    } catch (error) {

      console.log(error);
    }
  };

  // SUBMIT OR UPDATE A REVIEW — one per user per store,
  // requires login, then recomputes the store's aggregate
  // rating + totalReviews and writes them back onto the
  // partners doc so PartnerStorePage and StoresPage both
  // reflect the new average immediately
  const handleSubmitReview =
    async (e) => {

      e.preventDefault();

      if (!currentUser) {

        await warningAlert(
          "Login Required",
          "Please login to leave a review for this store."
        );

        navigate("/login");

        return;
      }

      try {

        setSubmittingReview(true);

        const reviewRef =
          doc(
            db,
            "reviews",
            `${currentUser.uid}_${partnerSlug}`
          );

        const reviewData = {
          partnerSlug,
          partnerId:
            partner?.uid || partner?.id || "",
          userId: currentUser.uid,
          userName:
            currentUser.displayName ||
            currentUser.email ||
            "ZYVAR Customer",
          rating: Number(reviewRating),
          comment: reviewComment,
          createdAt:
            myReview?.createdAt ||
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        };

        await setDoc(
          reviewRef,
          reviewData
        );

        setMyReview(reviewData);

        // RECOMPUTE AGGREGATE RATING — refetch all reviews
        // for this store so the average reflects this submission
        const reviewsQuery =
          query(
            collection(
              db,
              "reviews"
            ),
            where(
              "partnerSlug",
              "==",
              partnerSlug
            )
          );

        const reviewsSnapshot =
          await getDocs(
            reviewsQuery
          );

        const allReviews =
          reviewsSnapshot.docs.map(
            (docItem) => docItem.data()
          );

        const totalReviews =
          allReviews.length;

        const averageRating =
          totalReviews > 0

            ? allReviews.reduce(
                (acc, r) =>
                  acc + Number(r.rating || 0),
                0
              ) / totalReviews

            : 0;

        // WRITE THE NEW AVERAGE BACK ONTO THE PARTNER DOC
        if (partner?.id) {

          await updateDoc(

            doc(
              db,
              "partners",
              partner.id
            ),

            {
              rating: averageRating,
              totalReviews,
            }
          );

          setPartner(
            (prev) => ({
              ...prev,
              rating: averageRating,
              totalReviews,
            })
          );
        }

        await fetchReviews();

        await successAlert(
          myReview
            ? "Review Updated"
            : "Review Submitted",
          myReview
            ? "Your review has been updated."
            : "Thanks for reviewing this store!"
        );

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Failed",
          "Could not submit your review. Please try again."
        );

      } finally {

        setSubmittingReview(false);
      }
    };

  // BUY NOW
  const handleBuyNow =
    (product) => {

      if (!isLoggedIn) {

        navigate("/login");

        return;
      }

      addToCart(product);

      navigate("/payment");
    };

  if (loading) {

    return (

      <div className="min-h-screen bg-black text-white flex items-center justify-center">

        Loading Store...

      </div>
    );
  }

  if (!partner) {

    return (

      <div className="min-h-screen bg-black text-white flex items-center justify-center">

        Store Not Found

      </div>
    );
  }

  return (

    <div className="min-h-screen bg-black text-white">

      {/* HERO */}

      <div className="relative">

        {/* COVER / BANNER — uses the banner image partners can
            set from their dashboard (Profile.jsx Partner Store
            Settings), falling back to the plain gradient if
            they haven't set one yet */}

        {
          partner.banner ? (

            <img
              src={partner.banner}
              alt={`${partner.shopName} banner`}
              className="h-[320px] w-full object-cover"
            />

          ) : (

            <div className="h-[320px] bg-gradient-to-r from-[#C6922B] to-black" />
          )
        }

        <div className="absolute inset-0 h-[320px] bg-black/30" />

        <div className="max-w-7xl mx-auto px-6">

          <div className="-mt-24 relative">

            <img
              src={
                partner.logo
              }
              alt={
                partner.shopName
              }
              className="
              w-44
              h-44
              rounded-3xl
              object-cover
              border-4
              border-black
            "
            />

            <div className="mt-6">

              <h1 className="text-5xl font-black">

                {
                  partner.shopName
                }

              </h1>

              <p className="text-gray-300 mt-3 max-w-3xl">

                {
                  partner.description
                }

              </p>

              <div className="flex flex-wrap gap-6 mt-6 text-sm">

                {
                  partner.phone && (

                    <div className="flex items-center gap-2">

                      <FaPhone />

                      {
                        partner.phone
                      }

                    </div>
                  )
                }

                {
                  partner.address && (

                    <div className="flex items-center gap-2">

                      <FaMapMarkerAlt />

                      {
                        partner.address
                      }

                    </div>
                  )
                }

                <div className="flex items-center gap-2">

                  <FaStar />

                  {
                    partner.rating
                      ? Number(partner.rating).toFixed(1)
                      : 0
                  }

                  / 5

                  {
                    partner.totalReviews > 0 && (

                      <span className="text-gray-400">

                        ({partner.totalReviews} reviews)

                      </span>
                    )
                  }

                </div>

              </div>

              <div className="flex gap-4 mt-6">

                {
                  partner.facebook && (

                    <a
                      href={
                        partner.facebook
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FaFacebook className="text-3xl text-[#C6922B]" />
                    </a>
                  )
                }

                {
                  partner.instagram && (

                    <a
                      href={
                        partner.instagram
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FaInstagram className="text-3xl text-[#C6922B]" />
                    </a>
                  )
                }

              </div>

            </div>

          </div>

        </div>

      </div>

      {/* STATS */}

      <div className="max-w-7xl mx-auto px-6 mt-14">

        <div className="grid md:grid-cols-3 gap-6">

          <div className="bg-white/5 rounded-3xl p-8">

            <h3 className="text-gray-400">

              Products

            </h3>

            <p className="text-4xl font-black text-[#C6922B]">

              {
                products.length
              }

            </p>

          </div>

          <div className="bg-white/5 rounded-3xl p-8">

            <h3 className="text-gray-400">

              Total Reviews

            </h3>

            <p className="text-4xl font-black text-[#C6922B]">

              {
                partner.totalReviews || 0
              }

            </p>

          </div>

          <div className="bg-white/5 rounded-3xl p-8">

            <h3 className="text-gray-400">

              Total Sales

            </h3>

            <p className="text-4xl font-black text-[#C6922B]">

              {
                partner.totalSales || 0
              }

            </p>

          </div>

        </div>

      </div>

      {/* PRODUCTS */}

      <div className="max-w-7xl mx-auto px-6 py-20">

        <h2 className="text-4xl font-black mb-10">

          Products From

          <span className="text-[#C6922B]">

            {" "}
            {
              partner.shopName
            }

          </span>

        </h2>

        {
          products.length === 0 ? (

            <div className="bg-white/5 rounded-3xl p-16 text-center">

              <p className="text-gray-400 text-lg">

                This store hasn't added any products yet.

              </p>

            </div>

          ) : (

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">

              {
                products.map(
                  (
                    product
                  ) => (

                    <div
                      key={
                        product.id
                      }
                      className="
                      bg-white/5
                      rounded-3xl
                      overflow-hidden
                      border
                      border-white/10
                      hover:border-[#C6922B]
                      transition
                    "
                    >

                      <img
                        src={
                          product.images?.[0] ||
                          product.image
                        }
                        alt={
                          product.name
                        }
                        className="
                        w-full
                        h-64
                        object-cover
                      "
                      />

                      <div className="p-6">

                        <h3 className="font-bold text-lg mb-2">

                          {
                            product.name
                          }

                        </h3>

                        <p className="text-[#C6922B] font-black text-2xl mb-5">

                          ৳
                          {
                            product.price
                          }

                        </p>

                        {/* BUY / CART / WISHLIST — same pattern
                            used on Products.jsx, so a partner
                            store page is a fully functional
                            storefront, not just a catalog */}

                        <div className="space-y-3">

                          <button
                            onClick={() =>
                              handleBuyNow(product)
                            }
                            className="
                              w-full
                              py-3
                              rounded-2xl
                              bg-[#C6922B]
                              text-black
                              font-black
                              hover:scale-[1.02]
                              transition
                              flex
                              items-center
                              justify-center
                              gap-2
                            "
                          >

                            <FaBolt />

                            Buy Now

                          </button>

                          <div className="flex gap-3">

                            <button
                              onClick={async () => {

                                addToCart(product);

                                await successAlert(
                                  "Added To Cart!",
                                  `${product.name} has been added to your cart.`
                                );
                              }}
                              className="
                                flex-1
                                py-3
                                rounded-2xl
                                border
                                border-white/10
                                bg-white/5
                                hover:border-[#C6922B]
                                hover:text-[#C6922B]
                                transition
                                flex
                                items-center
                                justify-center
                                gap-2
                                text-sm
                              "
                            >

                              <FaShoppingBag />

                              Cart

                            </button>

                            <button
                              onClick={async () => {

                                if (
                                  isInWishlist(product.id)
                                ) {

                                  removeFromWishlist(
                                    product.id
                                  );

                                  await successAlert(
                                    "Removed From Wishlist",
                                    `${product.name} has been removed from your wishlist.`
                                  );

                                } else {

                                  addToWishlist(
                                    product
                                  );

                                  await successAlert(
                                    "Added To Wishlist!",
                                    `${product.name} has been added to your wishlist.`
                                  );
                                }
                              }}
                              className={`
                                w-14
                                rounded-2xl
                                border
                                transition
                                flex
                                items-center
                                justify-center

                                ${
                                  isInWishlist(product.id)

                                    ? "bg-red-500 text-white border-red-500"

                                    : "border-white/10 bg-white/5 hover:border-[#C6922B]"
                                }
                              `}
                            >

                              <FaHeart />

                            </button>

                          </div>

                        </div>

                      </div>

                    </div>
                  )
                )
              }

            </div>
          )
        }

      </div>

      {/* CUSTOMER REVIEWS */}

      <div className="max-w-7xl mx-auto px-6 py-20 border-t border-white/10">

        <h2 className="text-4xl font-black mb-10">

          Customer Reviews

        </h2>

        <div className="grid lg:grid-cols-3 gap-10">

          {/* REVIEW FORM */}

          <div className="bg-white/5 rounded-3xl p-8 border border-white/10 h-fit">

            <h3 className="text-2xl font-black mb-6">

              {
                myReview
                  ? "Update Your Review"
                  : "Leave A Review"
              }

            </h3>

            {
              !currentUser ? (

                <div>

                  <p className="text-gray-400 mb-6">

                    Please login to leave a review for this store.

                  </p>

                  <button
                    onClick={() =>
                      navigate("/login")
                    }
                    className="
                      w-full
                      py-4
                      rounded-2xl
                      bg-[#C6922B]
                      text-black
                      font-black
                    "
                  >

                    Login To Review

                  </button>

                </div>

              ) : (

                <form
                  onSubmit={handleSubmitReview}
                  className="space-y-6"
                >

                  <div>

                    <label className="block mb-3 text-gray-400 text-sm uppercase tracking-widest">

                      Your Rating

                    </label>

                    <div className="flex gap-2">

                      {
                        [1, 2, 3, 4, 5].map(
                          (star) => (

                            <button
                              key={star}
                              type="button"
                              onClick={() =>
                                setReviewRating(star)
                              }
                              className="text-3xl"
                            >

                              <FaStar
                                className={
                                  star <= reviewRating

                                    ? "text-[#C6922B]"

                                    : "text-white/10"
                                }
                              />

                            </button>
                          )
                        )
                      }

                    </div>

                  </div>

                  <div>

                    <label className="block mb-3 text-gray-400 text-sm uppercase tracking-widest">

                      Your Review

                    </label>

                    <textarea
                      rows="5"
                      required
                      value={reviewComment}
                      onChange={(e) =>
                        setReviewComment(
                          e.target.value
                        )
                      }
                      placeholder="Share your experience with this store..."
                      className="
                        w-full
                        px-5
                        py-4
                        rounded-2xl
                        bg-black/40
                        border
                        border-white/10
                        outline-none
                        focus:border-[#C6922B]
                        resize-none
                      "
                    />

                  </div>

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="
                      w-full
                      py-4
                      rounded-2xl
                      bg-[#C6922B]
                      text-black
                      font-black
                      disabled:opacity-50
                      disabled:cursor-not-allowed
                    "
                  >

                    {
                      submittingReview

                        ? "Submitting..."

                        : myReview
                          ? "Update Review"
                          : "Submit Review"
                    }

                  </button>

                </form>
              )
            }

          </div>

          {/* REVIEW LIST */}

          <div className="lg:col-span-2 space-y-5">

            {
              reviewsLoading ? (

                <div className="flex items-center gap-3 text-gray-400">

                  <div className="w-5 h-5 border-2 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

                  Loading reviews...

                </div>

              ) : reviews.length === 0 ? (

                <div className="bg-white/5 rounded-3xl p-10 text-center">

                  <p className="text-gray-400">

                    No reviews yet. Be the first to review this store!

                  </p>

                </div>

              ) : (

                reviews.map(
                  (review) => (

                    <div
                      key={review.id}
                      className="bg-white/5 rounded-3xl p-6 border border-white/10"
                    >

                      <div className="flex items-center justify-between mb-3">

                        <h4 className="font-bold">

                          {review.userName}

                        </h4>

                        <div className="flex items-center gap-1">

                          {
                            [1, 2, 3, 4, 5].map(
                              (star) => (

                                <FaStar
                                  key={star}
                                  size={14}
                                  className={
                                    star <= review.rating

                                      ? "text-[#C6922B]"

                                      : "text-white/10"
                                  }
                                />
                              )
                            )
                          }

                        </div>

                      </div>

                      <p className="text-gray-300 leading-relaxed">

                        {review.comment}

                      </p>

                    </div>
                  )
                )
              )
            }

          </div>

        </div>

      </div>

    </div>
  );
}