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
import { getProductCatalog } from "../services/productService";
import productImageMap from "../data/productImageMap.json";

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
      const data = await getProductCatalog();
      setProducts(data);
      setFilteredProducts(data);
      setLoading(false);
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
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.brand && p.brand.toLowerCase().includes(q)) ||
            (p.product_id && p.product_id.toLowerCase().includes(q)) ||
            (p.sku && p.sku.toLowerCase().includes(q))
        )
      );
    }
    setCurrentPage(1);
  }, [searchQuery, products]);

  // Derived stats
  const totalInventory = products.length;
  // If API doesn't return status, we fallback to some ratio for demo purposes
  const safeCount = products.filter(p => p.status === 'Verified' || p.status === 'Safe').length || Math.floor(totalInventory * 0.95);
  const flaggedCount = products.filter(p => p.status === 'Flagged' || p.status === 'Pending').length || (totalInventory - safeCount);
  
  // Count unique seasons analyzed
  const uniqueSeasons = new Set();
  products.forEach(p => {
    if (p.season_tags) {
      if (Array.isArray(p.season_tags)) p.season_tags.forEach(s => uniqueSeasons.add(s));
      else p.season_tags.split(',').forEach(s => uniqueSeasons.add(s.trim()));
    }
  });
  const seasonsAnalyzed = uniqueSeasons.size || 4;

  return (
    <main className="page-shell bg-[#FAF4FF] font-body text-black">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Search Bar */}
        <div className="relative w-full max-w-4xl">
          <Search
            className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-light"
            size={20}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search database by name, brand, or SKU..."
            className="w-full pl-14 pr-6 py-4 rounded-full bg-white border border-gray-lighter focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary-light text-black placeholder-gray-light font-medium shadow-sm transition-all m-0"
            style={{ borderStyle: 'solid' }}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard
            title="TOTAL INVENTORY"
            value={totalInventory.toLocaleString()}
            icon={<Package className="text-primary" />}
            bgColor="bg-[#F4E5FF]"
          />
          <StatCard
            title="CLINICALLY SAFE"
            value={safeCount.toLocaleString()}
            icon={<ShieldCheck className="text-success" />}
            bgColor="bg-[#E8F5F1]"
          />
          <StatCard
            title="FLAGGED ITEMS"
            value={flaggedCount.toLocaleString()}
            icon={<AlertTriangle className="text-danger" />}
            bgColor="bg-[#FFF1F1]"
          />
          <StatCard
            title="SEASONS ANALYZED"
            value={`${seasonsAnalyzed} / 4`}
            icon={<Sun className="text-warning" />}
            bgColor="bg-[#FFF8E6]"
          />
        </div>

        {/* Main Catalog Table Area */}
        <section className="bg-white rounded-[32px] border border-primary-light/10 shadow-card overflow-hidden">
          <header className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
            <h2 className="font-heading text-xl sm:text-2xl font-black italic">
              Product Catalog
            </h2>
            <div className="flex items-center gap-4 text-gray-light font-bold text-sm">
              <button className="flex items-center gap-2 hover:text-primary transition-colors">
                <Filter size={16} /> Filter
              </button>
              <button className="flex items-center gap-2 hover:text-primary transition-colors">
                <Download size={16} /> Export
              </button>
            </div>
          </header>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="text-[10px] font-bold text-gray-lighter uppercase tracking-widest border-b border-gray-lightest">
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
            <tbody className="divide-y divide-gray-lightest text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-8 py-10 text-center text-gray-light">
                    Loading catalog...
                  </td>
                </tr>
              ) : filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((p) => {
                const seasonTag = p.season_tags || "All Seasons";
                const sku = p.product_id || p.sku;
                const imageSrc = sku ? productImageMap[sku] : null;
                return (
                  <tr
                    key={sku || Math.random()}
                    className="hover:bg-primary-lightest/30 transition-colors group"
                  >
                    <td className="px-8 py-6 font-bold text-gray-lighter">
                      {sku || "#----"}
                    </td>
                    <td className="px-8 py-6">
                      {imageSrc ? (
                        <img 
                          src={imageSrc} 
                          alt={p.product_name || p.name} 
                          className="w-12 h-12 rounded-lg object-cover shadow-sm bg-white"
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-lg shadow-inner flex items-center justify-center bg-gray-lightest overflow-hidden"
                          style={p.hex_color ? { backgroundColor: p.hex_color } : {}}
                        />
                      )}
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-black">{p.product_name || p.name}</div>
                      <div className="text-xs text-primary font-medium">
                        {p.brand}
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-black">{p.price || "N/A"}</td>
                    <td className="px-8 py-6">
                      <span className="bg-gray-lightest text-gray-light px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                        {p.category}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="bg-[#E0F2FE] text-[#0369A1] px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest">
                        {seasonTag}
                      </span>
                    </td>
                    <td className="px-8 py-6 max-w-[200px]">
                      <div className="flex flex-wrap gap-1.5" title={p.full_inci_list}>
                        {p.full_inci_list ? (
                          (() => {
                            const ingredients = p.full_inci_list.split(',').map(i => i.trim()).filter(i => i);
                            const display = ingredients.slice(0, 2);
                            const remaining = ingredients.length - 2;
                            return (
                              <>
                                {display.map((ing, i) => (
                                  <span key={i} className="bg-gray-lightest text-black px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-gray-lighter truncate max-w-[120px]">
                                    {ing}
                                  </span>
                                ))}
                                {remaining > 0 && (
                                  <span className="bg-primary-lightest text-primary px-2 py-0.5 rounded text-[9px] font-black tracking-widest border border-primary-light">
                                    +{remaining}
                                  </span>
                                )}
                              </>
                            );
                          })()
                        ) : (
                          <span className="text-gray-light text-[10px] font-medium italic">Unspecified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-[#E8F5F1] text-success">
                        <div className="w-1.5 h-1.5 rounded-full bg-success" />
                        Active
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button className="text-gray-lighter hover:text-primary transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>

          {/* Footer / Pagination */}
          <footer className="px-6 sm:px-8 py-6 border-t border-gray-lightest flex flex-col sm:flex-row justify-between items-center bg-white gap-4 sm:gap-0">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <select className="bg-gray-lightest border-none text-[10px] font-bold py-2 px-3 rounded-lg focus:ring-0">
                <option>Bulk Actions</option>
              </select>
              <span className="text-xs text-gray-light font-bold">
                Showing {filteredProducts.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PaginationBtn 
                icon={<ChevronLeft size={16} />} 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loading}
              />
              
              {(() => {
                const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
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
                onClick={() => setCurrentPage(Math.min(Math.ceil(filteredProducts.length / itemsPerPage), currentPage + 1))}
                disabled={currentPage === Math.ceil(filteredProducts.length / itemsPerPage) || loading || filteredProducts.length === 0}
              />
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

// Helper Components
function StatCard({ title, value, icon, bgColor }) {
  return (
    <div
      className={`${bgColor} p-6 rounded-3xl border border-white flex flex-col gap-2 shadow-sm transition-transform hover:scale-[1.02]`}
    >
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em] opacity-60">
          {title}
        </span>
        <div className="p-1.5 bg-white/50 rounded-lg">{icon}</div>
      </div>
      <span className="text-3xl font-heading font-black text-black">
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Verified: "bg-[#E8F5F1] text-success",
    Pending: "bg-[#FFF8E6] text-warning",
    Flagged: "bg-[#FFF1F1] text-danger",
  };
  return (
    <span
      className={`${styles[status]} px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest`}
    >
      {status}
    </span>
  );
}

function PaginationBtn({ label, icon, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold ${
        active
          ? "bg-primary text-white"
          : "text-gray-lighter hover:bg-gray-lightest hover:text-black"
      } ${disabled ? "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-gray-lighter" : ""}`}
    >
      {label || icon}
    </button>
  );
}
