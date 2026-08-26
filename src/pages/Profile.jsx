import { useEffect, useRef, useState } from "react";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  useNavigate,
} from "react-router-dom";

import {
  FaUser,
  FaCamera,
  FaMapMarkerAlt,
  FaBoxOpen,
  FaHeart,
  FaCog,
  FaCrown,
  FaEdit,
  FaStore,
  FaGlobe,
  FaCheckCircle,
} from "react-icons/fa";

import {
  ADMIN_EMAILS,
} from "../utils/adminCheck";

import {
  bangladeshData,
} from "../data/bangladeshData";

import {
  uploadImage,
} from "../utils/cloudinary";

import {
  successAlert,
  errorAlert,
} from "../utils/alerts";

export default function Profile() {

  const navigate =
    useNavigate();

  const photoInputRef =
    useRef(null);

  const coverInputRef =
    useRef(null);

  const [user, setUser] =
    useState(null);

  const [profile, setProfile] =
    useState({

      name: "",
      phone: "",
      dob: "",
      gender: "",
      occupation: "",
      division: "",
      district: "",
      upazila: "",
      area: "",
      address: "",

      photoURL: "",

      coverPhoto: "",

      isPartner: false,

      partnerStatus: "",

      partnerSlug: "",

      storeName: "",

      paymentNumber: "",

      facebook: "",

      instagram: "",

      description: "",
    });

  const [loading, setLoading] =
    useState(true);

  const [editing, setEditing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [photoUploading,
    setPhotoUploading] =
    useState(false);

  const [coverUploading,
    setCoverUploading] =
    useState(false);

  const [partnerData,
    setPartnerData] =
    useState(null);

  const [partnerStats,
    setPartnerStats] =
    useState({
      products: 0,
      reviews: 0,
      followers: 0,
      visits: 0,
      revenue: 0,
    });

  // ADMIN CHECK
  const isAdmin =
    ADMIN_EMAILS.includes(
      user?.email
    );

  // FIX: Derive partner status from partnerData (source of truth)
  // instead of profile.isPartner / profile.partnerStatus
  // so that approval changes reflect immediately without a page reload
  const isPartner =
    !!partnerData;

  const isApprovedPartner =
    partnerData?.status === "approved";

  const partnerStoreUrl =
    profile?.partnerSlug
      ? `${window.location.origin}/${profile.partnerSlug}`
      : "";

  // AUTO FILTER
  const districts =
    profile?.division
      ? Object.keys(
          bangladeshData[
            profile.division
          ] || {}
        )
      : [];

  const upazilas =
    profile?.division &&
    profile?.district
      ? bangladeshData[
          profile.division
        ]?.[
          profile.district
        ] || []
      : [];

  // AUTH CHECK
  useEffect(() => {

    const unsubscribe =

      onAuthStateChanged(

        auth,

        async (
          currentUser
        ) => {

          if (!currentUser) {

            navigate("/login");

            return;
          }

          setUser(currentUser);

          try {

            /* USER PROFILE */

            const userRef =
              doc(
                db,
                "users",
                currentUser.uid
              );

            const userSnap =
              await getDoc(
                userRef
              );

            if (
              userSnap.exists()
            ) {

              const userData =
                userSnap.data();

              setProfile(
                (prev) => ({

                  ...prev,

                  ...userData,
                })
              );
            }

            /* PARTNER APPLICATION */

            const partnerRef =
              doc(
                db,
                "partnerApplications",
                currentUser.uid
              );

            const partnerSnap =
              await getDoc(
                partnerRef
              );

            if (
              partnerSnap.exists()
            ) {

              const partner =
                partnerSnap.data();

              // FIX: Store the full partner document so isPartner
              // and isApprovedPartner are derived from partnerData
              // directly, making them always accurate
              setPartnerData(
                partner
              );

              setProfile(
                (prev) => ({

                  ...prev,

                  isPartner:
                    partner.status ===
                    "approved",

                  partnerStatus:
                    partner.status ||
                    "",

                  partnerSlug:
                    partner.slug ||
                    "",

                  storeName:
                    partner.shopName ||
                    "",

                  paymentNumber:
                    partner.paymentNumber ||
                    "",

                  facebook:
                    partner.facebook ||
                    "",

                  instagram:
                    partner.instagram ||
                    "",

                  description:
                    partner.description ||
                    "",
                })
              );

              if (
                partner.status ===
                "approved"
              ) {

                loadPartnerStats(
                  currentUser.uid
                );
              }
            }

          } catch (error) {

            console.log(
              error
            );

          } finally {

            setLoading(
              false
            );
          }
        }
      );

    return () =>
      unsubscribe();

  }, []);

  // LOAD PARTNER STATS
  const loadPartnerStats =
    async (uid) => {

      try {

        let productCount = 0;
        let reviewCount = 0;

        const productsQuery =
          query(
            collection(
              db,
              "products"
            ),
            where(
              "partnerId",
              "==",
              uid
            )
          );

        const productsSnap =
          await getDocs(
            productsQuery
          );

        productCount =
          productsSnap.size;

        const reviewsQuery =
          query(
            collection(
              db,
              "reviews"
            ),
            where(
              "partnerId",
              "==",
              uid
            )
          );

        const reviewsSnap =
          await getDocs(
            reviewsQuery
          );

        reviewCount =
          reviewsSnap.size;

        setPartnerStats({

          products:
            productCount,

          reviews:
            reviewCount,

          followers:
            profile?.followers ||
            0,

          visits:
            profile?.storeVisits ||
            0,

          revenue:
            profile?.totalRevenue ||
            0,
        });

      } catch (error) {

        console.log(error);
      }
    };

  // UPDATE INPUT
  const handleChange =
    (e) => {

      setProfile({

        ...profile,

        [e.target.name]:
          e.target.value,
      });
    };

  // DIVISION CHANGE
  const handleDivisionChange =
    (e) => {

      setProfile({

        ...profile,

        division:
          e.target.value,

        district: "",

        upazila: "",
      });
    };

  // DISTRICT CHANGE
  const handleDistrictChange =
    (e) => {

      setProfile({

        ...profile,

        district:
          e.target.value,

        upazila: "",
      });
    };

  // PROFILE PICTURE UPLOAD
  const handlePhotoChange =
    async (e) => {

      const selectedFile =
        e.target.files?.[0];

      if (!selectedFile)
        return;

      try {

        setPhotoUploading(true);

        const imageUrl =
          await uploadImage(
            selectedFile
          );

        await updateDoc(

          doc(
            db,
            "users",
            user.uid
          ),

          {
            photoURL: imageUrl,
          }
        );

        setProfile((prev) => ({

          ...prev,

          photoURL: imageUrl,
        }));

        await successAlert(
          "Photo Updated!",
          "Profile picture updated successfully."
        );

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Upload Failed",
          "Failed to upload profile picture. Please try again."
        );

      } finally {

        setPhotoUploading(false);

        if (photoInputRef.current) {

          photoInputRef.current.value = "";
        }
      }
    };

  // COVER PHOTO UPLOAD
  const handleCoverChange =
    async (e) => {

      const file =
        e.target.files?.[0];

      if (!file) return;

      try {

        setCoverUploading(true);

        const imageUrl =
          await uploadImage(file);

        if (!imageUrl) {

          throw new Error(
            "Upload Failed"
          );
        }

        await updateDoc(

          doc(
            db,
            "users",
            user.uid
          ),

          {
            coverPhoto:
              imageUrl,
          }
        );

        setProfile((prev) => ({

          ...prev,

          coverPhoto:
            imageUrl,
        }));

        await successAlert(
          "Cover Updated",
          "Your cover photo has been updated successfully."
        );

      } catch (error) {

        console.log(error);

        await errorAlert(
          "Upload Failed",
          "Failed to upload cover photo."
        );

      } finally {

        setCoverUploading(
          false
        );
      }
    };

  // SAVE PROFILE
  const saveProfile =
    async () => {

      try {

        setSaving(true);

        await updateDoc(

          doc(
            db,
            "users",
            user.uid
          ),

          {

            name:
              profile.name || "",

            phone:
              profile.phone || "",

            dob:
              profile.dob || "",

            gender:
              profile.gender || "",

            occupation:
              profile.occupation || "",

            division:
              profile.division || "",

            district:
              profile.district || "",

            upazila:
              profile.upazila || "",

            area:
              profile.area || "",

            address:
              profile.address || "",

            photoURL:
              profile.photoURL || "",

            coverPhoto:
              profile.coverPhoto || "",

            isPartner:
              profile.isPartner || false,

            partnerStatus:
              profile.partnerStatus || "",

            partnerSlug:
              profile.partnerSlug || "",
          }
        );

        await successAlert(
          "Profile Updated!",
          "Your profile has been updated successfully."
        );

        setEditing(
          false
        );

      } catch (error) {

        console.log(
          error
        );

        await errorAlert(
          "Update Failed",
          "Failed to update profile. Please try again."
        );

      } finally {

        setSaving(
          false
        );
      }
    };

  // LOADING
  if (loading) {

    return (

      <div className="min-h-screen bg-black flex items-center justify-center">

        <div className="w-16 h-16 border-4 border-[#C6922B] border-t-transparent rounded-full animate-spin" />

      </div>
    );
  }

  return (

    <div className="min-h-screen bg-[#0B0B0B] text-white px-4 sm:px-6 lg:px-10 py-20">

      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-2xl overflow-hidden mb-10">

          {/* COVER */}

          <div className="h-56 relative">

            {profile?.coverPhoto ? (

              <img
                src={profile.coverPhoto}
                alt="cover"
                className="w-full h-full object-cover"
              />

            ) : (

              <div className="w-full h-full bg-gradient-to-r from-[#C6922B]/30 to-black" />

            )}

            <div className="absolute inset-0 bg-black/30" />

            {/* COVER INPUT */}

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />

            {/* COVER BUTTON */}

            <button
              type="button"
              disabled={coverUploading}
              onClick={() =>
                coverInputRef.current?.click()
              }
              className="
                absolute
                top-5
                right-5
                bg-black/70
                border
                border-white/20
                px-4
                py-3
                rounded-xl
                flex
                items-center
                gap-2
                hover:border-[#C6922B]
                transition
              "
            >

              {
                coverUploading
                  ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )
                  : <FaCamera />
              }

              Cover Photo

            </button>

          </div>

          {/* PROFILE */}

          <div className="px-8 pb-8 relative">

            {/* IMAGE */}

            <div className="-mt-20 relative w-fit">

              {
                profile?.photoURL ? (

                  <img
                    src={profile.photoURL}
                    alt="profile"
                    className="
                      w-40
                      h-40
                      rounded-full
                      object-cover
                      border-4
                      border-[#0B0B0B]
                    "
                  />

                ) : (

                  <div className="
                    w-40
                    h-40
                    rounded-full
                    bg-[#C6922B]/20
                    border-4
                    border-[#0B0B0B]
                    flex
                    items-center
                    justify-center
                    text-6xl
                    text-[#C6922B]
                  ">
                    <FaUser />
                  </div>
                )
              }

              {/* PROFILE IMAGE INPUT */}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />

              <button
                type="button"
                disabled={photoUploading}
                onClick={() =>
                  photoInputRef.current?.click()
                }
                className="
                  absolute
                  bottom-2
                  right-2
                  w-12
                  h-12
                  rounded-full
                  bg-[#C6922B]
                  text-black
                  flex
                  items-center
                  justify-center
                  disabled:opacity-50
                  disabled:cursor-not-allowed
                  transition
                "
              >

                {
                  photoUploading
                    ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    )
                    : <FaCamera />
                }

              </button>

            </div>

            {/* INFO */}

            <div className="mt-6 flex flex-col lg:flex-row lg:items-center justify-between gap-8">

              <div>

                <div className="flex flex-wrap items-center gap-3 mb-3">

                  <h1 className="text-4xl font-black">

                    {
                      profile?.name ||

                      user?.displayName ||

                      "ZYVAR Customer"
                    }

                  </h1>

                  {
                    isApprovedPartner && (

                      <span className="
                        px-4
                        py-2
                        rounded-full
                        bg-green-500/20
                        text-green-400
                        text-sm
                        font-bold
                        flex
                        items-center
                        gap-2
                      ">
                        <FaCheckCircle />
                        Verified Partner
                      </span>

                    )
                  }

                </div>

                <p className="text-gray-400 mb-2">

                  {user?.email}

                </p>

                {
                  profile?.storeName && (

                    <div className="
                      flex
                      items-center
                      gap-3
                      text-[#C6922B]
                      mb-2
                    ">

                      <FaStore />

                      <span>

                        {profile.storeName}

                      </span>

                    </div>

                  )
                }

                {
                  partnerStoreUrl && (

                    <div className="
                      flex
                      items-center
                      gap-3
                      text-gray-300
                      mb-3
                    ">

                      <FaGlobe />

                      <a
                        href={partnerStoreUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="
                          hover:text-[#C6922B]
                          transition
                        "
                      >

                        {partnerStoreUrl}

                      </a>

                    </div>

                  )
                }

                <div className="
                  flex
                  items-center
                  gap-3
                  text-gray-400
                ">

                  <FaMapMarkerAlt />

                  <span>

                    {
                      profile?.address

                        ? profile.address

                        : "Update Your Address"
                    }

                  </span>

                </div>

              </div>

              {/* BUTTONS */}

              <div className="flex flex-wrap gap-4">

                {/* BECOME PARTNER */}

                {
                  !isPartner && (

                    <button
                      onClick={() =>
                        navigate("/become-partner")
                      }
                      className="
                        px-6
                        py-4
                        rounded-2xl
                        bg-[#C6922B]
                        text-black
                        font-bold
                      "
                    >
                      Become Partner
                    </button>

                  )
                }

                {/* PARTNER DASHBOARD */}

                {
                  isApprovedPartner && (

                    <button
                      onClick={() =>
                        navigate("/partner-dashboard")
                      }
                      className="
                        px-6
                        py-4
                        rounded-2xl
                        bg-green-500
                        text-black
                        font-bold
                      "
                    >
                      Partner Dashboard
                    </button>

                  )
                }

                {/* EDIT PARTNER PROFILE — navigates to dedicated page */}

                {
                  isApprovedPartner && (

                    <button
                      onClick={() =>
                        navigate(
                          "/partner-settings"
                        )
                      }
                      className="
                        px-6
                        py-4
                        rounded-2xl
                        border
                        border-[#C6922B]
                        text-[#C6922B]
                        font-bold
                        flex
                        items-center
                        gap-2
                        hover:bg-[#C6922B]/10
                        transition
                      "
                    >
                      <FaEdit />
                      Edit Partner Profile
                    </button>

                  )
                }

                <button

                  onClick={() =>
                    navigate("/my-orders")
                  }

                  className="px-6 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] transition flex items-center gap-3"
                >

                  <FaBoxOpen />

                  View Orders

                </button>

                <button

                  onClick={() =>
                    navigate("/wishlist")
                  }

                  className="px-6 py-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#C6922B] transition flex items-center gap-3"
                >

                  <FaHeart />

                  Wishlist

                </button>

                <button

                  onClick={() =>
                    setEditing(
                      !editing
                    )
                  }

                  className="px-6 py-4 rounded-2xl bg-[#C6922B] text-black font-bold flex items-center gap-3"
                >

                  <FaEdit />

                  {
                    editing
                      ? "Close"
                      : "Edit Profile"
                  }

                </button>

              </div>

            </div>

          </div>

        </div>

        {/* GRID */}
        <div className="grid lg:grid-cols-3 gap-10">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-10">

            {/* ACCOUNT INFO */}
            <div className="rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-2xl p-8">

              <div className="flex items-center justify-between mb-10">

                <h2 className="text-3xl font-black">

                  Account Information

                </h2>

                <button

                  onClick={() =>
                    setEditing(
                      !editing
                    )
                  }

                  className="text-[#C6922B]"
                >

                  <FaCog size={24} />

                </button>

              </div>

              {/* ADMIN */}
              {
                isAdmin && (

                  <button

                    onClick={() =>
                      navigate("/admin")
                    }

                    className="w-full rounded-[32px] border border-[#C6922B]/20 bg-[#C6922B]/10 p-8 text-left hover:scale-[1.02] transition duration-300 mb-8"
                  >

                    <h3 className="text-2xl font-black text-[#C6922B] mb-3">

                      Admin Dashboard

                    </h3>

                    <p className="text-gray-300 leading-relaxed">

                      Manage products, orders,
                      users and settings.

                    </p>

                  </button>
                )
              }

              {/* FORM */}
              <div className="grid md:grid-cols-2 gap-6">

                {/* NAME */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Full Name

                  </label>

                  <input

                    type="text"

                    name="name"

                    value={
                      profile?.name || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  />

                </div>

                {/* PHONE */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Phone Number

                  </label>

                  <input

                    type="text"

                    name="phone"

                    value={
                      profile?.phone || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  />

                </div>

                {/* DOB */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Date Of Birth

                  </label>

                  <input

                    type="date"

                    name="dob"

                    value={
                      profile?.dob || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  />

                </div>

                {/* GENDER */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Gender

                  </label>

                  <select

                    name="gender"

                    value={
                      profile?.gender || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  >

                    <option value="">
                      Select Gender
                    </option>

                    <option value="Male">
                      Male
                    </option>

                    <option value="Female">
                      Female
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

                {/* OCCUPATION */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Occupation

                  </label>

                  <input

                    type="text"

                    name="occupation"

                    value={
                      profile?.occupation || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  />

                </div>

                {/* DIVISION */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Division

                  </label>

                  <select

                    name="division"

                    value={
                      profile?.division || ""
                    }

                    onChange={
                      handleDivisionChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  >

                    <option value="">
                      Select Division
                    </option>

                    {
                      Object.keys(
                        bangladeshData
                      ).map(
                        (item) => (

                          <option
                            key={item}
                            value={item}
                          >

                            {item}

                          </option>
                        )
                      )
                    }

                  </select>

                </div>

                {/* DISTRICT */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    District

                  </label>

                  <select

                    name="district"

                    value={
                      profile?.district || ""
                    }

                    onChange={
                      handleDistrictChange
                    }

                    disabled={
                      !editing ||
                      !profile?.division
                    }

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  >

                    <option value="">
                      Select District
                    </option>

                    {
                      districts.map(
                        (item) => (

                          <option
                            key={item}
                            value={item}
                          >

                            {item}

                          </option>
                        )
                      )
                    }

                  </select>

                </div>

                {/* UPAZILA */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Thana / Upazila

                  </label>

                  <select

                    name="upazila"

                    value={
                      profile?.upazila || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={
                      !editing ||
                      !profile?.district
                    }

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  >

                    <option value="">
                      Select Upazila
                    </option>

                    {
                      upazilas.map(
                        (item) => (

                          <option
                            key={item}
                            value={item}
                          >

                            {item}

                          </option>
                        )
                      )
                    }

                  </select>

                </div>

                {/* AREA */}
                <div>

                  <label className="block mb-3 text-gray-400">

                    Area

                  </label>

                  <input

                    type="text"

                    name="area"

                    value={
                      profile?.area || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  />

                </div>

                {/* ADDRESS */}
                <div className="md:col-span-2">

                  <label className="block mb-3 text-gray-400">

                    Full Address

                  </label>

                  <textarea

                    rows="5"

                    name="address"

                    value={
                      profile?.address || ""
                    }

                    onChange={
                      handleChange
                    }

                    disabled={!editing}

                    className="w-full px-5 py-4 rounded-2xl bg-black/30 border border-white/10 outline-none focus:border-[#C6922B]"
                  />

                </div>

              </div>

              {/* SAVE BUTTON */}
              {
                editing && (

                  <button

                    onClick={
                      saveProfile
                    }

                    disabled={saving}

                    className="mt-10 px-10 py-5 rounded-2xl bg-[#C6922B] text-black font-black hover:scale-105 transition"
                  >

                    {
                      saving
                        ? "Saving..."
                        : "Save Changes"
                    }

                  </button>
                )
              }

            </div>

          </div>

          {/* RIGHT */}
          <div className="space-y-8">

            {/* MEMBERSHIP */}
            <div className="rounded-[40px] border border-white/10 bg-gradient-to-br from-[#C6922B]/20 to-black p-8">

              <div className="w-16 h-16 rounded-2xl bg-[#C6922B] text-black flex items-center justify-center mb-6">

                <FaCrown size={28} />

              </div>

              <h2 className="text-3xl font-black mb-4">

                ZYVAR Premium

              </h2>

              <p className="text-gray-300 leading-relaxed mb-8">

                Unlock exclusive premium deals, early access and luxury member rewards.

              </p>

              <button className="w-full py-4 rounded-2xl bg-[#C6922B] text-black font-black">

                Upgrade Plan

              </button>

            </div>

            {/* PARTNER STATUS */}

            {
              isPartner && (

                <div className="
                  rounded-[40px]
                  border
                  border-white/10
                  bg-white/5
                  backdrop-blur-xl
                  p-8
                ">

                  <h2 className="text-2xl font-black mb-6">

                    Partner Status

                  </h2>

                  {
                    partnerData?.status ===
                    "approved" && (

                      <div className="
                        bg-green-500/10
                        border
                        border-green-500/20
                        rounded-3xl
                        p-5
                      ">

                        <p className="
                          text-green-400
                          font-bold
                          text-lg
                        ">
                          Approved Partner
                        </p>

                        <p className="text-gray-300 mt-2">

                          Your store is now live on ZYVAR.

                        </p>

                      </div>

                    )
                  }

                  {
                    partnerData?.status ===
                    "pending" && (

                      <div className="
                        bg-yellow-500/10
                        border
                        border-yellow-500/20
                        rounded-3xl
                        p-5
                      ">

                        <p className="
                          text-yellow-400
                          font-bold
                          text-lg
                        ">
                          Under Review
                        </p>

                        <p className="text-gray-300 mt-2">

                          Your application is being reviewed by the ZYVAR Team.

                        </p>

                      </div>

                    )
                  }

                  {
                    partnerData?.status ===
                    "rejected" && (

                      <div className="
                        bg-red-500/10
                        border
                        border-red-500/20
                        rounded-3xl
                        p-5
                      ">

                        <p className="
                          text-red-400
                          font-bold
                          text-lg
                        ">
                          Application Rejected
                        </p>

                        <p className="text-gray-300 mt-2">

                          Contact support for details.

                        </p>

                      </div>

                    )
                  }

                  {/* SHORTCUT TO EDIT PARTNER PROFILE */}
                  {
                    isApprovedPartner && (

                      <button
                        onClick={() =>
                          navigate("/partner-settings")
                        }
                        className="
                          mt-6
                          w-full
                          py-4
                          rounded-2xl
                          border
                          border-[#C6922B]
                          text-[#C6922B]
                          font-bold
                          flex
                          items-center
                          justify-center
                          gap-2
                          hover:bg-[#C6922B]/10
                          transition
                        "
                      >
                        <FaEdit />
                        Edit Partner Profile
                      </button>

                    )
                  }

                </div>

              )
            }

            {/* STORE STATISTICS */}

            {
              isApprovedPartner && (

                <div className="
                  rounded-[40px]
                  border
                  border-white/10
                  bg-white/5
                  backdrop-blur-xl
                  p-8
                ">

                  <h2 className="text-2xl font-black mb-8">

                    Store Statistics

                  </h2>

                  <div className="space-y-5">

                    <div className="flex justify-between">

                      <span>Total Products</span>

                      <span className="font-bold">

                        {partnerStats.products}

                      </span>

                    </div>

                    <div className="flex justify-between">

                      <span>Total Sales</span>

                      <span className="font-bold">

                        {partnerStats.visits}

                      </span>

                    </div>

                    <div className="flex justify-between">

                      <span>Store Rating</span>

                      <span className="font-bold">

                        {partnerStats.reviews}

                      </span>

                    </div>

                  </div>

                </div>

              )
            }

            {/* SOCIAL LINKS */}

            {
              isApprovedPartner && (

                <div className="
                  rounded-[40px]
                  border
                  border-white/10
                  bg-white/5
                  backdrop-blur-xl
                  p-8
                ">

                  <h2 className="text-2xl font-black mb-8">

                    Social Links

                  </h2>

                  <div className="space-y-4">

                    {
                      profile?.facebook && (

                        <a
                          href={profile.facebook}
                          target="_blank"
                          rel="noreferrer"
                          className="
                            block
                            hover:text-[#C6922B]
                            transition
                          "
                        >
                          Facebook Profile
                        </a>

                      )
                    }

                    {
                      profile?.instagram && (

                        <a
                          href={profile.instagram}
                          target="_blank"
                          rel="noreferrer"
                          className="
                            block
                            hover:text-[#C6922B]
                            transition
                          "
                        >
                          Instagram Profile
                        </a>

                      )
                    }

                  </div>

                </div>

              )
            }

            {/* EARNINGS PREVIEW */}

            {
              isApprovedPartner && (

                <div className="
                  rounded-[40px]
                  border
                  border-[#C6922B]/20
                  bg-[#C6922B]/10
                  p-8
                ">

                  <h2 className="
                    text-2xl
                    font-black
                    text-[#C6922B]
                    mb-8
                  ">

                    Earnings Preview

                  </h2>

                  <div className="space-y-5">

                    <div className="flex justify-between">

                      <span>Total Revenue</span>

                      <span className="font-bold">

                        ৳
                        {partnerStats.revenue}

                      </span>

                    </div>

                    <div className="flex justify-between">

                      <span>Pending Withdrawal</span>

                      <span className="font-bold">

                        ৳
                        {partnerData?.pendingAmount || 0}

                      </span>

                    </div>

                  </div>

                </div>

              )
            }

            {/* COMMUNITY / FOLLOWERS */}

            {
              isApprovedPartner && (

                <div className="
                  rounded-[40px]
                  border
                  border-white/10
                  bg-white/5
                  backdrop-blur-xl
                  p-8
                ">

                  <h2 className="
                    text-2xl
                    font-black
                    mb-8
                  ">
                    Community
                  </h2>

                  <div className="
                    flex
                    justify-between
                  ">

                    <span>
                      Followers
                    </span>

                    <span className="
                      font-bold
                      text-[#C6922B]
                    ">
                      {
                        partnerStats.followers
                      }
                    </span>

                  </div>

                </div>

              )
            }

            {/* QUICK INFO */}
            <div className="rounded-[40px] border border-white/10 bg-white/5 backdrop-blur-xl p-8">

              <h2 className="text-2xl font-black mb-8">

                Quick Details

              </h2>

              <div className="space-y-5 text-gray-300">

                <div className="flex justify-between">

                  <span>Email</span>

                  <span>

                    {user?.email}

                  </span>

                </div>

                <div className="flex justify-between">

                  <span>Phone</span>

                  <span>

                    {
                      profile?.phone ||

                      "Not Added"
                    }

                  </span>

                </div>

                <div className="flex justify-between">

                  <span>Occupation</span>

                  <span>

                    {
                      profile?.occupation ||

                      "Not Added"
                    }

                  </span>

                </div>

                <div className="flex justify-between">

                  <span>Division</span>

                  <span>

                    {
                      profile?.division ||

                      "Not Added"
                    }

                  </span>

                </div>

                {
                  isPartner && (

                    <div className="flex justify-between">

                      <span>Partner Status</span>

                      <span>

                        {partnerData?.status}

                      </span>

                    </div>

                  )
                }

                {
                  profile?.storeName && (

                    <div className="flex justify-between">

                      <span>Store</span>

                      <span>

                        {profile.storeName}

                      </span>

                    </div>

                  )
                }

                {
                  profile?.partnerSlug && (

                    <div className="flex justify-between">

                      <span>Store URL</span>

                      <span className="text-[#C6922B]">

                        /{profile.partnerSlug}

                      </span>

                    </div>

                  )
                }

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}