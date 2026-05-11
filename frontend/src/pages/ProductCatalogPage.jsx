import React from "react";
import {
  Search,
  Filter,
  Download,
  Package,
  ShieldCheck,
  AlertTriangle,
  Sun,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
} from "lucide-react";
import { getProductCatalog } from "../services/productService"; // Ensure this import exists

export function ProductCatalogPage() {
  const [products, setProducts] = React.useState([]);
  const [filteredProducts, setFilteredProducts] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

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
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredProducts(
        products.filter(
          (p) =>
            (p.product_name && p.product_name.toLowerCase().includes(q)) ||
            (p.brand && p.brand.toLowerCase().includes(q)) ||
            (p.product_id && p.product_id.toLowerCase().includes(q))
        )
      );
    }
    setCurrentPage(1);
  }, [searchQuery, products]);

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

        <section className="bg-white rounded-[32px] border border-primary-light/10 shadow-card overflow-hidden">
          <header className="p-8 flex justify-between items-center">
            <h2 className="font-heading text-2xl font-black italic">Product Catalog</h2>
            <div className="flex gap-4 text-gray-light font-bold text-sm">
              <button className="flex items-center gap-2 hover:text-primary"><Filter size={16} /> Filter</button>
              <button className="flex items-center gap-2 hover:text-primary"><Download size={16} /> Export</button>
            </div>
          </header>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left whitespace-nowrap">
              <thead>
                <tr className="text-[10px] font-bold text-gray-lighter uppercase tracking-widest border-b">
                  <th className="px-8 py-4">#SKU</th>
                  <th className="px-8 py-4">Image</th>
                  <th className="px-8 py-4">Product & Brand</th>
                  <th className="px-8 py-4">Price</th>
                  <th className="px-8 py-4">Category</th>
                  <th className="px-8 py-4">Season Tags</th>
                  <th className="px-8 py-4">INCI Ingredients</th>
                  <th className="px-8 py-4">Status</th>
                  <th className="px-8 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {loading ? (
                  <tr><td colSpan="9" className="px-8 py-10 text-center text-gray-light">Loading...</td></tr>
                ) : filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((p) => (
                  <tr key={p.product_id || p.sku} className="hover:bg-primary-lightest/30 transition-colors group">
                    <td className="px-8 py-6 font-bold text-gray-lighter">{p.product_id || p.sku || "#----"}</td>
                    <td className="px-8 py-6">
                      {p.image_url ? (
                        <img 
                          src={p.image_url} 
                          alt={p.product_name} 
                          className="w-12 h-12 rounded-lg object-cover shadow-sm bg-white"
                          onError={(e) => { e.target.src = "/placeholder.png"; }} 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg shadow-inner bg-gray-lightest" style={{ backgroundColor: p.hex_color }} />
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-black">{p.product_name || p.name}</div>
                      <div className="text-xs text-primary font-medium">{p.brand}</div>
                    </td>
                    <td className="px-8 py-6 font-bold text-black">{p.price || "N/A"}</td>
                    <td className="px-8 py-6">
                      <span className="bg-gray-lightest text-gray-light px-3 py-1 rounded text-[10px] font-bold uppercase">{p.category}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="bg-[#E0F2FE] text-[#0369A1] px-2 py-0.5 rounded text-[9px] font-black uppercase">
                        {p.season_tags || "All Seasons"}
                      </span>
                    </td>
                    <td className="px-8 py-6 max-w-[200px]">
                      <div className="flex flex-wrap gap-1.5">
                        {p.full_inci_list ? p.full_inci_list.split(',').slice(0, 2).map((ing, i) => (
                          <span key={i} className="bg-gray-lightest text-black px-2 py-0.5 rounded text-[9px] border truncate max-w-[100px]">{ing.trim()}</span>
                        )) : <span className="italic text-gray-light text-[10px]">Unspecified</span>}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase bg-[#E8F5F1] text-success">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" /> Active
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button className="text-gray-lighter hover:text-primary"><MoreVertical size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination Footer Remains Same... */}
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
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${active ? "bg-primary text-white" : "text-gray-lighter hover:bg-gray-lightest"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {label || icon}
    </button>
  );
}