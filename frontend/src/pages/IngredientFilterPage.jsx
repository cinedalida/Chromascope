// IngredientFilterPage enables ingredient safety filtering for cosmetic products.

import React, { useState, useEffect } from "react";
import { filterIngredients } from "../services/ingredientService";
import { useUserStore } from "../store/userStore";
import {
  Search,
  Filter,
  X,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
} from "lucide-react";
import productImageMap from "../data/productImageMap.json";

export function IngredientFilterPage() {
  const user = useUserStore((state) => state.user);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skinType, setSkinType] = useState("sensitive");
  const [concerns, setConcerns] = useState(["sensitive", "eczema"]);
  const [avoidIngredients, setAvoidIngredients] = useState(["fragrance", "parabens"]);

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [triggerFetch, setTriggerFetch] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user) {
      if (user.skinType) setSkinType(user.skinType.toLowerCase());
      if (user.concerns && user.concerns.length > 0) setConcerns(user.concerns.map(c => c.toLowerCase()));
      if (user.avoidIngredients && user.avoidIngredients.length > 0) setAvoidIngredients(user.avoidIngredients.map(a => a.toLowerCase()));
    }
  }, [user]);

  useEffect(() => {
    async function loadFilteredProducts() {
      setLoading(true);
      const results = await filterIngredients({
        skin_type: skinType,
        concerns,
        avoid_ingredients: avoidIngredients
      });
      setProducts(results);
      setLoading(false);
    }
    loadFilteredProducts();
  }, [triggerFetch]); // Only fetch on initial load or when triggerFetch increments

  const handleFilterSubmit = () => {
    setAppliedSearchQuery(searchQuery);
    setCurrentPage(1);
    setTriggerFetch(t => t + 1);
  };

  const handleRemoveAvoid = (item) => {
    setAvoidIngredients(prev => prev.filter(i => i !== item));
  };

  const handleClearAll = () => {
    setAvoidIngredients([]);
    setSkinType("");
  };

  const insightText = concerns.length > 0
    ? `Your profile suggests a focus on ${concerns.join(' and ')}.`
    : "Your profile suggests a balanced skincare approach.";

  const displayProducts = products.filter(p => {
    if (!appliedSearchQuery) return true;
    const q = appliedSearchQuery.toLowerCase();
    return (
      (p.product_name && p.product_name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.full_inci_list && p.full_inci_list.toLowerCase().includes(q))
    );
  });

  return (
    <main className="page-shell font-body text-black bg-primary-lightest">
      <section className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <header className="space-y-2">
          <h1 className="font-heading text-4xl font-bold text-black">
            Scientific Filter
          </h1>
          <p className="text-gray max-w-2xl text-lg">
            Analyze and filter product catalogs based on your unique skin
            profile and clinical ingredient constraints. Our AI detects
            potential allergens in real-time.
          </p>
        </header>

        {/* Main Grid Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Sidebar (3/12 on lg) */}
          <aside className="col-span-1 lg:col-span-3 space-y-6">
            {/* Active Filters Card */}
            <div className="page-card">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-heading font-semibold text-lg">
                  Active Filters
                </h3>
                <button
                  onClick={handleClearAll}
                  className="text-primary text-xs font-bold hover:underline">
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {avoidIngredients.map((item, idx) => (
                  <FilterBadge
                    key={idx}
                    label={`${item.toUpperCase()}-FREE`}
                    color="bg-primary-light text-primary"
                    onRemove={() => handleRemoveAvoid(item)}
                  />
                ))}
                {skinType && (
                  <FilterBadge
                    label={`${skinType.toUpperCase()} SKIN`}
                    color="bg-[#FFE9D5] text-warning"
                    onRemove={() => setSkinType("")}
                  />
                )}
              </div>
            </div>

            {/* Skin Profile Insight Card */}
            <div className="bg-primary-lightest p-6 rounded-xl">
              <h3 className="font-heading font-semibold text-lg mb-3">
                Skin Profile Insight
              </h3>
              <p className="text-sm text-gray mb-6 leading-relaxed capitalize">
                {insightText}
              </p>
              <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-primary">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Sparkles size={14} fill="currentColor" />
                  <span className="font-bold text-[10px] uppercase tracking-widest">
                    Clinical AI Tip
                  </span>
                </div>
                <p className="text-[11px] text-black leading-normal">
                  Prioritize products with Niacinamide but ensure it is below 5%
                  concentration for your reactive skin type.
                </p>
              </div>
            </div>
          </aside>

          {/* Right Column: Main Area (9/12 on lg) */}
          <div className="col-span-1 lg:col-span-9 space-y-6">
            {/* Controls: Search and Filter */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search
                  className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-light"
                  size={20}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ingredient or brand..."
                  className="w-full max-w-[600px] pl-14 pr-6 py-4 rounded-full bg-white border border-gray-lighter focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary-light text-black placeholder-gray-light font-medium shadow-sm transition-all m-0"
                  style={{ borderStyle: 'solid' }}
                />
              </div>

              <button
                onClick={handleFilterSubmit}
                className="shrink-0 whitespace-nowrap bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-full font-bold flex items-center gap-2 transition-all duration-300 shadow-md hover:shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1">
                <Filter size={20} strokeWidth={3} />
                Filter Results
              </button>
            </div>

            {/* Product Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-lightest text-[10px] uppercase tracking-[0.2em] text-gray-light">
                    <th className="px-6 py-5 font-bold">Product</th>
                    <th className="px-6 py-5 font-bold text-center">
                      Season Tags
                    </th>
                    <th className="px-6 py-5 font-bold">Ingredients Preview</th>
                    <th className="px-6 py-5 font-bold text-center">Status</th>
                    <th className="px-6 py-5 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-lightest text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-gray-light">
                        Analyzing formulation data...
                      </td>
                    </tr>
                  ) : displayProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item) => {
                    const seasons = Array.isArray(item.season_tags)
                      ? item.season_tags
                      : typeof item.season_tags === "string" && item.season_tags
                        ? item.season_tags.split(",").map(s => s.trim())
                        : ["All Seasons"];

                    const statusMap = {
                      safe: "Safe",
                      caution: "Caution",
                      excluded: "Flagged"
                    };
                    const displayStatus = statusMap[item.verdict] || "Unknown";

                    const sku = item.product_id || item.sku;
                    const imageSrc = sku ? productImageMap[sku] : null;

                    return (
                      <tr
                        key={item.product_id}
                        className="hover:bg-primary-lightest/40 transition-colors group"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            {imageSrc ? (
                              <img 
                                src={imageSrc} 
                                alt={item.product_name} 
                                className="w-12 h-12 rounded-lg object-cover shadow-sm bg-white shrink-0"
                              />
                            ) : (
                              <div
                                className="w-12 h-12 rounded-lg shadow-inner flex items-center justify-center bg-gray-lightest shrink-0 overflow-hidden"
                                style={item.hex_color ? { backgroundColor: item.hex_color } : {}}
                              />
                            )}
                            <div>
                              <div className="font-bold text-black max-w-[200px] truncate">
                                {item.product_name}
                              </div>
                              <div className="text-xs text-primary font-medium">
                                {item.brand}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {seasons.map((season) => (
                              <span
                                key={season}
                                className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase ${season.toLowerCase() === "summer"
                                  ? "bg-primary-light text-primary"
                                  : season.toLowerCase() === "spring"
                                    ? "bg-[#FFE9D5] text-warning"
                                    : "bg-gray-lightest text-gray"
                                  }`}
                              >
                                {season}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-xs text-gray-light truncate max-w-[200px]" title={item.full_inci_list}>
                            {item.full_inci_list || "No ingredients listed"}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <StatusPill type={displayStatus} />
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button className="text-gray-lighter group-hover:text-primary transition-colors">
                            <Eye size={20} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-lightest bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-bold text-gray-light text-center sm:text-left">
                  Showing {displayProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, displayProducts.length)} of {displayProducts.length} products
                </span>
                <div className="flex items-center gap-1.5">
                  <PaginationBtn
                    icon={<ChevronLeft size={16} />}
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || loading}
                  />

                  {(() => {
                    const totalPages = Math.ceil(displayProducts.length / itemsPerPage) || 1;
                    let buttons = [];

                    if (totalPages <= 5) {
                      for (let i = 1; i <= totalPages; i++) {
                        buttons.push(<PaginationBtn key={i} label={i} active={currentPage === i} onClick={() => setCurrentPage(i)} />);
                      }
                    } else {
                      if (currentPage <= 3) {
                        for (let i = 1; i <= 4; i++) buttons.push(<PaginationBtn key={i} label={i} active={currentPage === i} onClick={() => setCurrentPage(i)} />);
                        buttons.push(<span key="e1" className="text-gray-lighter px-2">...</span>);
                        buttons.push(<PaginationBtn key={totalPages} label={totalPages} onClick={() => setCurrentPage(totalPages)} />);
                      } else if (currentPage >= totalPages - 2) {
                        buttons.push(<PaginationBtn key={1} label="1" onClick={() => setCurrentPage(1)} />);
                        buttons.push(<span key="e1" className="text-gray-lighter px-2">...</span>);
                        for (let i = totalPages - 3; i <= totalPages; i++) buttons.push(<PaginationBtn key={i} label={i} active={currentPage === i} onClick={() => setCurrentPage(i)} />);
                      } else {
                        buttons.push(<PaginationBtn key={1} label="1" onClick={() => setCurrentPage(1)} />);
                        buttons.push(<span key="e1" className="text-gray-lighter px-2">...</span>);
                        buttons.push(<PaginationBtn key={currentPage - 1} label={currentPage - 1} onClick={() => setCurrentPage(currentPage - 1)} />);
                        buttons.push(<PaginationBtn key={currentPage} label={currentPage} active={true} onClick={() => setCurrentPage(currentPage)} />);
                        buttons.push(<PaginationBtn key={currentPage + 1} label={currentPage + 1} onClick={() => setCurrentPage(currentPage + 1)} />);
                        buttons.push(<span key="e2" className="text-gray-lighter px-2">...</span>);
                        buttons.push(<PaginationBtn key={totalPages} label={totalPages} onClick={() => setCurrentPage(totalPages)} />);
                      }
                    }
                    return buttons;
                  })()}

                  <PaginationBtn
                    icon={<ChevronRight size={16} />}
                    onClick={() => setCurrentPage(Math.min(Math.ceil(displayProducts.length / itemsPerPage), currentPage + 1))}
                    disabled={currentPage === Math.ceil(displayProducts.length / itemsPerPage) || loading || displayProducts.length === 0}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Status Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <LegendCard
                icon={<ShieldCheck size={20} className="text-success" />}
                title="Clinically Validated"
                desc="Ingredients matches your biocompatibility profile at 95%+"
                dotColor="bg-success"
              />
              <LegendCard
                icon={<AlertTriangle size={20} className="text-warning" />}
                title="Irritant Detected"
                desc="Contains specific allergens flagged in your profile settings."
                dotColor="bg-warning"
              />
              <LegendCard
                icon={<Info size={20} className="text-primary" />}
                title="Unknown Profile"
                desc="Product requires patch test due to rare molecular compound."
                dotColor="bg-primary"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// Internal Helper Components
function FilterBadge({ label, color, onRemove }) {
  return (
    <span
      className={`${color} px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 tracking-wider transition-hover hover:brightness-95 cursor-default`}
    >
      {label} {onRemove && <X size={10} className="cursor-pointer" onClick={onRemove} />}
    </span>
  );
}

function StatusPill({ type }) {
  const isSafe = type === "Safe";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isSafe ? "bg-[#E8F5F1] text-success" : type === "Caution" ? "bg-[#FFF4E5] text-warning" : "bg-red-50 text-red-600"
        }`}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full ${isSafe ? "bg-success" : type === "Caution" ? "bg-warning" : "bg-red-500"}`}
      />
      {type}
    </span>
  );
}

function PaginationBtn({ label, icon, active, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`w-8 h-8 rounded-md flex items-center justify-center transition-all text-xs font-bold ${active
        ? "bg-primary text-white"
        : "text-gray-light hover:bg-gray-lightest"
        } ${disabled ? "opacity-25" : ""}`}
    >
      {label || icon}
    </button>
  );
}

function LegendCard({ icon, title, desc, dotColor }) {
  return (
    <div className="page-card flex gap-4">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-lightest/50`}
      >
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-sm text-black mb-1 flex items-center gap-2">
          {title}
        </h4>
        <p className="text-[11px] text-gray leading-tight">{desc}</p>
      </div>
    </div>
  );
}
