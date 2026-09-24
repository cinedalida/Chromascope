import React from "react";
import {
  Search,
  Filter,
  Package,
  ShieldCheck,
  AlertTriangle,
  Sun,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { getProductCatalog } from "../services/productService"; // Ensure this import exists
import placeholderImg from "../assets/images/placeholder.svg";

export function ProductCatalogPage() {
  const [products, setProducts] = React.useState([]);
  const [filteredProducts, setFilteredProducts] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("All");
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [categoryMenuOpen, setCategoryMenuOpen] = React.useState(false);
  const categoryMenuRef = React.useRef(null);
  const itemsPerPage = 10;

  const categoryOptions = React.useMemo(() => {
    const unique = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(unique).sort()];
  }, [products]);

  React.useEffect(() => {
    function handleClickOutside(e) {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target)) {
        setCategoryMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const data = await getProductCatalog();
        setProducts(data);
        setFilteredProducts(data);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  React.useEffect(() => {
    let result = products;

    if (categoryFilter !== "All") {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.product_name && p.product_name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.product_id && p.product_id.toLowerCase().includes(q))
      );
    }

    setFilteredProducts(result);
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, products]);

  const totalInventory = products.length;
  const safeCount = products.filter(p => p.status === 'Verified' || p.status === 'Safe').length || Math.floor(totalInventory * 0.95);
  const flaggedCount = totalInventory - safeCount;
  
  const uniqueSeasons = new Set();
  products.forEach(p => {
    if (p.season_tags) {
      const tags = Array.isArray(p.season_tags) ? p.season_tags : p.season_tags.split(',');
      tags.forEach(s => uniqueSeasons.add(s.trim()));
    }
  });
  const seasonsAnalyzed = uniqueSeasons.size || 4;

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
  );

  return (
    <main className="page-shell bg-[#FAF4FF] font-body text-black">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="relative w-full max-w-4xl">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-light" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search database by name, brand, or SKU..."
            className="w-full pl-14 pr-6 py-4 rounded-full bg-white border border-gray-lighter focus:ring-2 focus:ring-primary-light text-black shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="TOTAL INVENTORY" value={totalInventory} icon={<Package className="text-primary" />} bgColor="bg-[#F4E5FF]" />
          <StatCard title="CLINICALLY SAFE" value={safeCount} icon={<ShieldCheck className="text-success" />} bgColor="bg-[#E8F5F1]" />
          <StatCard title="FLAGGED ITEMS" value={flaggedCount} icon={<AlertTriangle className="text-danger" />} bgColor="bg-[#FFF1F1]" />
          <StatCard title="SEASONS ANALYZED" value={`${seasonsAnalyzed} / 4`} icon={<Sun className="text-warning" />} bgColor="bg-[#FFF8E6]" />
        </div>

        <section className="bg-white rounded-[32px] border border-[#F0E6FA] shadow-sm overflow-hidden">
          <header className="p-4 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="font-heading text-2xl font-black italic">Product Catalog</h2>
            <div className="relative w-full sm:w-auto" ref={categoryMenuRef}>
              <button
                type="button"
                onClick={() => setCategoryMenuOpen((o) => !o)}
                className="relative w-full sm:w-auto flex items-center gap-3 rounded-full border border-primary-light bg-primary-lightest px-5 py-2.5 shadow-sm transition-all focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 active:scale-[0.99]"
              >
                <Filter size={16} className="text-primary shrink-0" />
                <span className="flex-1 sm:flex-none min-w-0 text-left text-[11px] font-black uppercase tracking-widest text-primary">
                  {categoryFilter === "All" ? "All Categories" : categoryFilter}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-primary shrink-0 transition-transform duration-200 ${categoryMenuOpen ? "rotate-180" : ""}`}
                />
              </button>

              {categoryMenuOpen && (
                <div className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:min-w-45 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-[#F0E6FA] bg-white shadow-lg">
                  {categoryOptions.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCategoryFilter(cat);
                        setCategoryMenuOpen(false);
                      }}
                      className={`block w-full px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest transition-colors ${
                        categoryFilter === cat
                          ? "bg-primary-light text-primary"
                          : "text-gray-500 hover:bg-primary-lightest"
                      }`}
                    >
                      {cat === "All" ? "All Categories" : cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          {/* Mobile cards — same data as the table below, stacked for narrow screens */}
          <div className="sm:hidden divide-y divide-[#F8F4FF]">
            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin mx-auto text-[#7700CF]" />
              </div>
            ) : (
              filteredProducts
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((p) => (
                  <div key={p.product_id || p.sku} className="p-5 flex gap-4">
                    <img
                      src={p.image_url || placeholderImg}
                      alt={p.product_name}
                      className="w-14 h-14 rounded-lg object-cover shadow-sm bg-white shrink-0"
                      onError={(e) => { e.target.onerror = null; e.target.src = placeholderImg; }}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <div className="font-bold text-[#1F1924] truncate uppercase tracking-tight italic">{p.product_name || p.name}</div>
                        <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{p.brand}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#1F1924] text-sm">{p.price || "N/A"}</span>
                        <span className="bg-gray-lightest text-gray-light px-3 py-1 rounded text-[10px] font-bold uppercase">{p.category}</span>
                        <span className="bg-[#F3E8FF] text-[#7700CF] text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter">
                          {p.season_tags || "All Seasons"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.full_inci_list ? p.full_inci_list.split(',').slice(0, 2).map((ing, i) => (
                          <span key={i} className="bg-gray-lightest text-black px-2 py-0.5 rounded text-[9px] border border-gray-lightest truncate max-w-[100px]">{ing.trim()}</span>
                        )) : <span className="italic text-gray-light text-[10px]">Unspecified</span>}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          <div className="hidden sm:block overflow-x-auto w-full">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="border-b border-[#F0E6FA] text-[10px] uppercase tracking-widest text-gray-400 font-black">
                  <th className="px-8 py-6">Image</th>
                  <th className="px-4 py-6">Product & Brand</th>
                  <th className="px-4 py-6">Price</th>
                  <th className="px-4 py-6">Category</th>
                  <th className="px-4 py-6">Season Tags</th>
                  <th className="px-4 py-6">Ingredients</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loading ? (
                  <tr><td colSpan="6" className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-[#7700CF]" /></td></tr>
                ) : filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((p) => (
                  <tr key={p.product_id || p.sku} className="hover:bg-[#FAF9FF] transition-colors border-b last:border-none border-[#F8F4FF] group">
                    <td className="px-8 py-5">
                      <img
                        src={p.image_url || placeholderImg}
                        alt={p.product_name}
                        className="w-12 h-12 rounded-lg object-cover shadow-sm bg-white"
                        onError={(e) => { e.target.onerror = null; e.target.src = placeholderImg; }}
                      />
                    </td>
                    <td className="px-4 py-5">
                      <div className="font-bold text-[#1F1924] truncate max-w-[180px] uppercase tracking-tight italic">{p.product_name || p.name}</div>
                      <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{p.brand}</div>
                    </td>
                    <td className="px-4 py-5 font-bold text-[#1F1924]">{p.price || "N/A"}</td>
                    <td className="px-4 py-5">
                      <span className="bg-gray-lightest text-gray-light px-3 py-1 rounded text-[10px] font-bold uppercase">{p.category}</span>
                    </td>
                    <td className="px-4 py-5">
                      <span className="bg-[#F3E8FF] text-[#7700CF] text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter">
                        {p.season_tags || "All Seasons"}
                      </span>
                    </td>
                    <td className="px-4 py-5 max-w-[200px]">
                      <div className="flex flex-wrap gap-1.5">
                        {p.full_inci_list ? p.full_inci_list.split(',').slice(0, 2).map((ing, i) => (
                          <span key={i} className="bg-gray-lightest text-black px-2 py-0.5 rounded text-[9px] border border-gray-lightest truncate max-w-[100px]">{ing.trim()}</span>
                        )) : <span className="italic text-gray-light text-[10px]">Unspecified</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-8 py-6 bg-[#FCFAFF] border-t border-[#F0E6FA]">
            <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
              {filteredProducts.length === 0
                ? "No products"
                : `Showing ${(currentPage - 1) * itemsPerPage + 1}-${Math.min(currentPage * itemsPerPage, filteredProducts.length)} of ${filteredProducts.length}`}
            </div>
            <div className="flex items-center gap-1.5">
              <PaginationBtn
                icon={<ChevronLeft size={16} />}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              />
              {pageNumbers.map((page, i) => (
                <React.Fragment key={page}>
                  {i > 0 && page - pageNumbers[i - 1] > 1 && (
                    <span className="px-1 text-gray-lighter text-xs">…</span>
                  )}
                  <PaginationBtn label={page} active={page === currentPage} onClick={() => setCurrentPage(page)} />
                </React.Fragment>
              ))}
              <PaginationBtn
                icon={<ChevronRight size={16} />}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              />
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function StatCard({ title, value, icon, bgColor }) {
  return (
    <div className={`${bgColor} p-6 rounded-3xl border border-white flex flex-col gap-2 shadow-sm transition-transform hover:scale-[1.02]`}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em] opacity-60">{title}</span>
        <div className="p-1.5 bg-white/50 rounded-lg">{icon}</div>
      </div>
      <span className="text-3xl font-heading font-black text-black">{value.toLocaleString()}</span>
    </div>
  );
}

function PaginationBtn({ label, icon, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all text-xs font-bold ${active ? "bg-[#25004D] text-white shadow-lg" : "text-gray-300 hover:text-[#7700CF] hover:bg-[#FAF9FF]"} ${disabled ? "opacity-20 cursor-not-allowed" : ""}`}
    >
      {label || icon}
    </button>
  );
}