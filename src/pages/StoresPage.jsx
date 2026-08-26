import {
useEffect,
useState,
} from "react";

import {
collection,
getDocs,
query,
where,
} from "firebase/firestore";

import {
Link,
} from "react-router-dom";

import {
Store,
Search,
Star,
Package,
ShoppingBag,
} from "lucide-react";

import {
db,
} from "../firebase/firebase";

import BecomePartnerCTA from "../components/BecomePartnerCTA";
import Footer from "../components/Footer";

export default function StoresPage() {

const [
stores,
setStores,
] = useState([]);

const [
loading,
setLoading,
] = useState(true);

const [
search,
setSearch,
] = useState("");

useEffect(() => {

fetchStores();

}, []);

const fetchStores = async () => {

try {

  setLoading(true);

  const q = query(

    collection(
      db,
      "partnerApplications"
    ),

    where(
      "status",
      "==",
      "approved"
    )
  );

  const snapshot =
    await getDocs(q);

  const applicationsData =
    snapshot.docs.map(
      (docItem) => ({

        id:
          docItem.id,

        ...docItem.data(),
      })
    );

  // FOR EACH APPROVED PARTNER — pull their live store stats
  // (rating, totalReviews, totalSales) from the "partners"
  // collection, and count their products from "products".
  // These are the same fields PartnerStorePage.jsx already
  // reads and that get updated after orders/reviews on that
  // page, so this stays accurate as the store page evolves.
  const storesData =
    await Promise.all(

      applicationsData.map(
        async (application) => {

          let rating = 0;
          let totalReviews = 0;
          let totalSales = 0;
          let totalProducts = 0;

          try {

            if (application.slug) {

              const partnerQuery =
                query(
                  collection(
                    db,
                    "partners"
                  ),
                  where(
                    "slug",
                    "==",
                    application.slug
                  )
                );

              const partnerSnap =
                await getDocs(
                  partnerQuery
                );

              if (!partnerSnap.empty) {

                const partnerData =
                  partnerSnap.docs[0].data();

                rating =
                  partnerData.rating || 0;

                totalReviews =
                  partnerData.totalReviews || 0;

                totalSales =
                  partnerData.totalSales || 0;
              }

              const productsQuery =
                query(
                  collection(
                    db,
                    "products"
                  ),
                  where(
                    "partnerSlug",
                    "==",
                    application.slug
                  )
                );

              const productsSnap =
                await getDocs(
                  productsQuery
                );

              totalProducts =
                productsSnap.size;
            }

          } catch (err) {

            console.log(err);
          }

          return {

            ...application,

            rating,
            totalReviews,
            totalSales,
            totalProducts,
          };
        }
      )
    );

  setStores(
    storesData
  );

} catch (error) {

  console.log(error);

} finally {

  setLoading(false);
}

};

const filteredStores =
stores.filter(
(store) =>

    store.shopName
      ?.toLowerCase()
      .includes(
        search.toLowerCase()
      )
);

return (

<div className="min-h-screen bg-[#0B0B0B] text-white">

  {/* HERO */}

  <section className="relative overflow-hidden pt-32 pb-20 border-b border-white/10">

    <div className="absolute inset-0">

      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#C6922B]/10 blur-[150px] rounded-full" />

    </div>

    <div className="relative z-10 max-w-7xl mx-auto px-6">

      <div className="text-center">

        <p className="uppercase tracking-[0.35em] text-[#C6922B] text-sm mb-6">

          ZYVAR Marketplace

        </p>

        <h1 className="text-5xl md:text-7xl font-black mb-8">

          Explore

          <span className="block text-[#C6922B]">

            Partner Stores

          </span>

        </h1>

        <p className="max-w-3xl mx-auto text-gray-400 text-lg">

          Discover trusted stores, verified sellers,
          premium brands and exclusive collections
          available on ZYVAR.

        </p>

      </div>

    </div>

  </section>

  {/* SEARCH */}

  <section className="max-w-7xl mx-auto px-6 py-12">

    <div className="relative max-w-xl mx-auto">

      <Search
        size={20}
        className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500"
      />

      <input
        type="text"
        placeholder="Search Stores..."
        value={search}
        onChange={(e) =>
          setSearch(
            e.target.value
          )
        }
        className="
          w-full
          bg-white/5
          border
          border-white/10
          rounded-2xl
          py-4
          pl-14
          pr-5
          outline-none
          focus:border-[#C6922B]
        "
      />

    </div>

  </section>

  {/* STORES */}

  <section className="max-w-7xl mx-auto px-6 pb-24">

    {loading ? (

      <div className="flex justify-center py-32">

        <div className="w-16 h-16 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

      </div>

    ) : filteredStores.length === 0 ? (

      <div className="text-center py-24">

        <h2 className="text-4xl font-black mb-4">

          No Stores Found

        </h2>

        <p className="text-gray-500">

          No approved partner stores available yet.

        </p>

      </div>

    ) : (

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

        {filteredStores.map(
          (store) => (

            <div
              key={store.id}
              className="
                bg-white/5
                border
                border-white/10
                rounded-[32px]
                overflow-hidden
                hover:border-[#C6922B]
                transition
              "
            >

              <div className="p-8">

                <div className="flex items-center gap-5 mb-6">

                  {store.logo ? (

                    <img
                      src={store.logo}
                      alt={store.shopName}
                      className="
                        w-20
                        h-20
                        rounded-2xl
                        object-cover
                      "
                    />

                  ) : (

                    <div
                      className="
                        w-20
                        h-20
                        rounded-2xl
                        bg-[#C6922B]/10
                        flex
                        items-center
                        justify-center
                      "
                    >

                      <Store
                        size={32}
                        className="text-[#C6922B]"
                      />

                    </div>

                  )}

                  <div>

                    <h3 className="text-2xl font-black">

                      {store.shopName}

                    </h3>

                    <p className="text-gray-400">

                      Verified Partner

                    </p>

                  </div>

                </div>

                <p className="text-gray-400 mb-8 line-clamp-3">

                  {store.description ||
                    "Premium partner store on ZYVAR marketplace."}

                </p>

                {/* STORE STATS — rating, products, orders.
                    Replaces the raw /slug URL display since
                    these numbers are more useful to a browsing
                    customer than an implementation detail. */}
                <div
                  className="
                    grid
                    grid-cols-3
                    gap-3
                    mb-8
                  "
                >

                  <div
                    className="
                      rounded-2xl
                      border
                      border-white/10
                      bg-black/30
                      p-4
                      text-center
                    "
                  >

                    <div className="flex items-center justify-center gap-1 mb-1">

                      <Star
                        size={16}
                        className="text-[#C6922B] fill-[#C6922B]"
                      />

                      <span className="font-black">

                        {
                          store.rating
                            ? store.rating.toFixed(1)
                            : "New"
                        }

                      </span>

                    </div>

                    <p className="text-gray-500 text-xs">

                      {
                        store.totalReviews > 0

                          ? `${store.totalReviews} Reviews`

                          : "Rating"
                      }

                    </p>

                  </div>

                  <div
                    className="
                      rounded-2xl
                      border
                      border-white/10
                      bg-black/30
                      p-4
                      text-center
                    "
                  >

                    <div className="flex items-center justify-center gap-1 mb-1">

                      <Package
                        size={16}
                        className="text-[#C6922B]"
                      />

                      <span className="font-black">

                        {store.totalProducts}

                      </span>

                    </div>

                    <p className="text-gray-500 text-xs">

                      Products

                    </p>

                  </div>

                  <div
                    className="
                      rounded-2xl
                      border
                      border-white/10
                      bg-black/30
                      p-4
                      text-center
                    "
                  >

                    <div className="flex items-center justify-center gap-1 mb-1">

                      <ShoppingBag
                        size={16}
                        className="text-[#C6922B]"
                      />

                      <span className="font-black">

                        {store.totalSales}

                      </span>

                    </div>

                    <p className="text-gray-500 text-xs">

                      Orders

                    </p>

                  </div>

                </div>

                <div className="flex justify-end items-center">

                  <Link
                    to={`/${store.slug}`}
                    className="
                      px-6
                      py-3
                      rounded-xl
                      bg-[#C6922B]
                      text-black
                      font-bold
                    "
                  >

                    View Store

                  </Link>

                </div>

              </div>

            </div>
          )
        )}

      </div>

    )}

  </section>

  {/* BECOME A PARTNER CTA */}
  <BecomePartnerCTA />

  {/* FOOTER */}
  <Footer />

</div>

);
}