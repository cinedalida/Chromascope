import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { runFilter } from "../services/productService";
import { useUserStore } from "../store/userStore";
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  Loader2,
} from "lucide-react";
import placeholderImg from "../assets/images/placeholder.svg";

export function IngredientFilterPage() {
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skinType, setSkinType] = useState("Normal");
  const [avoidIngredients, setAvoidIngredients] = useState([]);
  const [category, setCategory] = useState("Face");
  const categories = [
    "Face",
    "Cheeks",
    "Lips",
    "Eyes",
    "Multiuse",
    "Concealer",
  ];
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [maxPrice, setMaxPrice] = useState("");
  const [safeOnly, setSafeOnly] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryMenuRef = useRef(null);
  const itemsPerPage = 10;

  useEffect(() => {
    function handleClickOutside(e) {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target)) {
        setCategoryMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tableColSpan = category === "Face" ? 6 : 5;

  const cleanPath = (url) => {
    if (!url) return placeholderImg;
    return url.startsWith("/public/") ? url.replace("/public/", "/") : url;
  };

  const parsePrice = (price) => {
    const num = parseFloat(String(price ?? "").replace(/[^\d.]/g, ""));
    return Number.isNaN(num) ? null : num;
  };

  const handleImageError = (e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = placeholderImg;
  };

  useEffect(() => {
    if (user) {
      setSkinType(user.skin_type || user.skin_profile?.base_type || "Normal");
      setAvoidIngredients(
        user.avoid_ingredients ||
          user.skin_profile?.blacklisted_ingredients ||
          [],
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    async function loadData() {
      setLoading(true);
      try {
        const results = await runFilter({
          skin_type: skinType,
          avoid_ingredients: avoidIngredients,
          category: category,
          user_lab: user.user_lab,
          seasonal_label: user.seasonal_label,
        });
        setProducts(results.color_matched || []);
      } catch (err) {
        console.error("Database sync error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, category, skinType, avoidIngredients]);

  const verdictOrder = { safe: 0, caution: 1, excluded: 2 };

  const filteredProducts = products
    .filter(
      (p) =>
        p.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .filter((p) => {
      if (maxPrice === "") return true;
      const price = parsePrice(p.price);
      return price === null ? true : price <= Number(maxPrice);
    })
    .filter((p) => !safeOnly || p.verdict?.toLowerCase() === "safe")
    .sort((a, b) => {
      const va = verdictOrder[a.verdict?.toLowerCase()] ?? 1;
      const vb = verdictOrder[b.verdict?.toLowerCase()] ?? 1;
      return va - vb;
    });

  const currentItems = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const rows = currentItems.map((item) => {
    const seasons = Array.isArray(item.season_tags)
      ? item.season_tags
      : item.season_tags?.split(",").map((s) => s.trim()) || ["Universal"];
    const matchPercent =
      item.delta_e !== undefined
        ? Math.max(0, 100 - item.delta_e * 5).toFixed(0)
        : null;
    return { item, seasons, matchPercent };
  });

  return (
    <div className="min-h-screen bg-[#FDFBFF] font-body text-[#1F1924]">
      <main className="p-4 sm:p-8 lg:p-12 pt-4 sm:pt-8">
        <section className="max-w-[1200px] mx-auto">
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tighter mb-3 text-[#1F1924] italic uppercase leading-none">
              Clinical Filter
            </h1>
            <p className="text-gray-400 max-w-2xl leading-relaxed text-sm font-medium">
              Synchronizing biometric data with 248+ active formulations to
              ensure biological safety and perceptual accuracy.
            </p>
          </div>

          <div className="space-y-6 mb-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Mobile: custom dropdown — native <select> popups can't be styled across browsers */}
              <div className="sm:hidden relative w-full" ref={categoryMenuRef}>
                <button
                  type="button"
                  onClick={() => setCategoryMenuOpen((o) => !o)}
                  className="relative w-full flex items-center gap-3 rounded-full border border-primary-light bg-primary-lightest px-5 py-3 shadow-sm transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 active:scale-[0.99]"
                >
                  <Filter size={16} className="text-primary shrink-0" />
                  <span className="flex-1 min-w-0 text-left text-[11px] font-black uppercase tracking-widest text-primary">
                    {category}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-primary shrink-0 transition-transform duration-200 ${categoryMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {categoryMenuOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[#F0E6FA] bg-white shadow-lg">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setCategory(cat);
                          setCurrentPage(1);
                          setCategoryMenuOpen(false);
                        }}
                        className={`block w-full px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest transition-colors ${
                          category === cat
                            ? "bg-primary-light text-primary"
                            : "text-gray-500 hover:bg-primary-lightest"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tablet/desktop: pill tabs */}
              <div className="hidden sm:flex w-fit items-center p-1 bg-white border border-[#F0E6FA] rounded-2xl shadow-sm gap-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategory(cat);
                      setCurrentPage(1);
                    }}
                    className={`px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${category === cat ? "bg-[#25004D] text-white shadow-lg" : "text-gray-400 hover:bg-purple-50"}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:items-start sm:gap-4">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FED7AA] bg-[#FFF6ED] px-3 py-1.5 sm:flex-col sm:items-start sm:gap-1 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 sm:text-gray-400">
                    Skin Type
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#EA580C] sm:rounded-full sm:border sm:border-[#FED7AA] sm:bg-[#FFF6ED] sm:px-4 sm:py-2">
                    {skinType} Skin
                  </span>
                </div>
                {user?.seasonal_label && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E9D5FF] bg-[#F3E8FF] px-3 py-1.5 sm:flex-col sm:items-start sm:gap-1 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 sm:text-gray-400">
                      Color Season
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#7700CF] sm:rounded-full sm:border sm:border-[#E9D5FF] sm:bg-[#F3E8FF] sm:px-4 sm:py-2">
                      {user.seasonal_label}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative min-w-0 flex-1 group">
                <Search
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7700CF]"
                  size={20}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search clinical ${category} database...`}
                  className="w-full pl-14 pr-6 py-4 bg-white rounded-full border border-[#F0E6FA] shadow-sm outline-none focus:border-[#7700CF] transition-all text-sm font-medium"
                />
              </div>
              <div className="w-full md:w-fit md:shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 bg-white border border-[#F0E6FA] rounded-2xl sm:rounded-full shadow-sm px-4 sm:px-5 py-2.5 sm:py-2">
                <Filter size={16} className="text-gray-400 shrink-0" />
                <label className="flex items-center gap-2 text-sm font-medium text-gray-500 whitespace-nowrap">
                  <span>Price</span>
                  <span className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1">
                    <span className="text-gray-400 font-bold">₱</span>
                    <input
                      type="number"
                      min="0"
                      value={maxPrice}
                      onChange={(e) => {
                        setMaxPrice(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="0.00"
                      aria-label="Maximum price filter"
                      className="w-12 sm:w-16 outline-none bg-transparent text-[#1F1924] font-bold"
                    />
                  </span>
                </label>
                <div className="hidden sm:block h-6 w-px bg-[#F0E6FA]" />
                <button
                  type="button"
                  onClick={() => {
                    setSafeOnly((s) => !s);
                    setCurrentPage(1);
                  }}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${safeOnly ? "bg-[#059669] text-white shadow" : "text-gray-400 hover:bg-gray-50"}`}
                >
                  Safe Only
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-[32px] border border-[#F0E6FA] shadow-sm overflow-hidden">
              {/* Mobile cards — same data as the table below, stacked for narrow screens */}
              <div className="sm:hidden divide-y divide-[#F8F4FF]">
                {loading ? (
                  <div className="py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-[#7700CF]" />
                  </div>
                ) : rows.length === 0 ? (
                  <div className="py-20 text-center text-gray-400 font-medium px-6">
                    No biometric matches found.
                  </div>
                ) : (
                  rows.map(({ item, seasons, matchPercent }) => (
                    <div key={item.product_id} className="p-5 flex gap-4 overflow-hidden">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50 shrink-0">
                        <img
                          src={cleanPath(item.image_url)}
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                          alt="Product"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-bold text-[#1F1924] truncate uppercase tracking-tight italic">
                              {item.product_name}
                            </div>
                            <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                              {item.brand}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              navigate("/ar-tryon", {
                                state: { product: item },
                              })
                            }
                            className="text-gray-400 p-1 shrink-0"
                            title="Try on"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#1F1924] text-sm">
                            {item.price || "N/A"}
                          </span>
                          <StatusBadge type={item.verdict} />
                          {category === "Face" && matchPercent && (
                            <span className="text-[10px] font-black text-primary">
                              {matchPercent}% Match
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {seasons.map((tag) => (
                            <span
                              key={tag}
                              className="bg-[#F3E8FF] text-[#7700CF] text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[#F0E6FA] text-[10px] uppercase tracking-widest text-gray-400 font-black">
                      <th className="px-8 py-6">Formulation</th>
                      <th className="px-4 py-6">Price</th>
                      <th className="px-4 py-6">Season Profile</th>
                      {category === "Face" && (
                        <th className="px-4 py-6">Accuracy</th>
                      )}
                      <th className="px-4 py-6">Status</th>
                      <th className="px-6 py-6 text-right font-bold">
                        Inquiry
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={tableColSpan}
                          className="py-20 text-center"
                        >
                          <Loader2 className="animate-spin mx-auto text-[#7700CF]" />
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={tableColSpan}
                          className="py-20 text-center text-gray-400 font-medium"
                        >
                          No biometric matches found.
                        </td>
                      </tr>
                    ) : (
                      rows.map(({ item, seasons, matchPercent }) => {
                        return (
                          <tr
                            key={item.product_id}
                            className="hover:bg-[#FAF9FF] transition-colors border-b last:border-none border-[#F8F4FF] group"
                          >
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                                  <img
                                    src={cleanPath(item.image_url)}
                                    onError={handleImageError}
                                    className="w-full h-full object-cover"
                                    alt="Product"
                                  />
                                </div>
                                <div>
                                  <div className="font-bold text-[#1F1924] truncate max-w-[180px] uppercase tracking-tight italic">
                                    {item.product_name}
                                  </div>
                                  <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                                    {item.brand}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-5 font-bold text-[#1F1924]">
                              {item.price || "N/A"}
                            </td>
                            <td className="px-4 py-5">
                              <div className="flex flex-wrap gap-1">
                                {seasons.map((tag) => (
                                  <span
                                    key={tag}
                                    className="bg-[#F3E8FF] text-[#7700CF] text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            {category === "Face" && (
                              <td className="px-4 py-5">
                                {matchPercent ? (
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-black text-primary">
                                      {matchPercent}% Match
                                    </span>
                                    <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-primary transition-all duration-1000"
                                        style={{ width: `${matchPercent}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-bold text-gray-200">
                                    N/A
                                  </span>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-5">
                              <StatusBadge type={item.verdict} />
                            </td>
                            <td className="px-6 py-5 text-right">
                              <button
                                onClick={() =>
                                  navigate("/ar-tryon", {
                                    state: { product: item },
                                  })
                                }
                                className="text-gray-400 group-hover:text-primary transition-all p-2"
                                title="Try on"
                              >
                                <Eye size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-8 py-6 bg-[#FCFAFF] border-t border-[#F0E6FA]">
                <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                  Catalog Index:{" "}
                  {filteredProducts.length === 0
                    ? 0
                    : (currentPage - 1) * 10 + 1}
                  -{Math.min(currentPage * 10, filteredProducts.length)} /{" "}
                  {filteredProducts.length}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="p-2 text-gray-300 hover:text-[#7700CF] disabled:opacity-20"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button className="w-8 h-8 rounded-xl text-xs font-bold bg-[#25004D] text-white shadow-lg">
                    {currentPage}
                  </button>
                  <button
                    disabled={currentPage * 10 >= filteredProducts.length}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-2 text-gray-300 hover:text-[#7700CF] disabled:opacity-20"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </footer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusBadge({ type }) {
  const verdict = type?.toLowerCase();
  const isSafe = verdict === "safe";
  const isCaution = verdict === "caution";
  const isExcluded = verdict === "excluded";
  const styles = isSafe
    ? "bg-[#ECFDF5] border-[#D1FAE5] text-[#059669]"
    : isExcluded
      ? "bg-rose-50 border-rose-100 text-rose-600"
      : "bg-[#FFFBEB] border-[#FEF3C7] text-[#D97706]";
  const dotColor = isSafe
    ? "bg-[#10B981]"
    : isExcluded
      ? "bg-rose-600"
      : "bg-[#F59E0B]";
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl border ${styles}`}
    >
      <div className={`w-1 h-1 rounded-full ${dotColor}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">
        {type || "Caution"}
      </span>
    </div>
  );
}
